import React, { useEffect, useState, useMemo } from "react";
import { getAuth } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import NotificationService from "../../utils/notificationService";
import {
  collection,
  query,
  where,
  updateDoc,
  doc,
  serverTimestamp,
  onSnapshot,
  getDoc,
} from "firebase/firestore";
import { db } from "../../firebase/firebase";
import {
  parseDeadline,
  getRemainingDays,
  getDeadlineColor,
} from "../../utils/deadlineUtils";
import { formatFirestoreDate } from "../../utils/dateUtils"; // new import

import { Timestamp } from "firebase/firestore";

// countdown hook that updates every second and returns formatted string with minutes
function useCountdown(deadlineDate) {
  const compute = () => {
    if (!deadlineDate) return 0;
    const target =
      deadlineDate instanceof Date
        ? deadlineDate.getTime()
        : new Date(deadlineDate).getTime();
    return Math.max(target - Date.now(), 0);
  };
  const [remainingMs, setRemainingMs] = useState(compute);
  useEffect(() => {
    if (!deadlineDate) return;
    setRemainingMs(compute());
    const id = setInterval(() => setRemainingMs(compute()), 1000);
    return () => clearInterval(id);
  }, [deadlineDate]);
  const s = Math.floor(remainingMs / 1000);
  const days = Math.floor(s / 86400);
  const hours = Math.floor((s % 86400) / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;
  const formatted = `${days}d ${String(hours).padStart(2, "0")}h ${String(
    mins
  ).padStart(2, "0")}m ${String(secs).padStart(2, "0")}s`;
  return { remainingMs, formatted, days, hours, mins, secs };
}

function CountdownBadge({ deadline }) {
  if (!deadline)
    return (
      <span className="px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-700">
        No deadline
      </span>
    );
  const cd = useCountdown(deadline);
  return (
    <span className="px-2 py-0.5 rounded text-xs font-semibold bg-yellow-100 text-yellow-800">
      {cd.formatted}
    </span>
  );
}

const ReviewerInvitations = () => {
  const [invitations, setInvitations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [processingId, setProcessingId] = useState(null);
  const [viewingInvitation, setViewingInvitation] = useState(null);
  const [now, setNow] = useState(new Date());

  // Update current time every minute for countdown
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 60000); // Update every minute

    return () => clearInterval(timer);
  }, []);

  const auth = getAuth();
  const currentUser = auth.currentUser;
  const navigate = useNavigate();

  useEffect(() => {
    if (!currentUser) {
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, "manuscripts"),
      where("assignedReviewers", "array-contains", currentUser.uid)
    );

    const unsubscribe = onSnapshot(
      q,
      async (querySnapshot) => {
        const processedInvitations = (
          await Promise.all(
            querySnapshot.docs.map(async (docRef) => {
              try {
                const data = docRef.data();
                const meta =
                  data.assignedReviewersMeta?.[currentUser.uid] || {};

                // Filter out invitations that have been responded to (accepted or declined)
                // BUT include re-review invitations (isReReview: true) even if previously accepted
                const isReReview = meta.isReReview === true;
                if (
                  !isReReview &&
                  (meta.invitationStatus === "accepted" ||
                    meta.invitationStatus === "declined")
                )
                  return null;

                const abstractAnswer =
                  data.answeredQuestions?.find((q) => q.question === "Abstract")
                    ?.answer || "No abstract available";

                // Dates
                const invitedAt = meta.invitedAt;
                const respondedAt = meta.respondedAt;

                let displayInvitedAt;
                if (invitedAt) {
                  if (typeof invitedAt.toDate === "function") {
                    displayInvitedAt = new Date(invitedAt.toDate().getTime());
                  } else if (invitedAt.seconds) {
                    displayInvitedAt = new Date(invitedAt.seconds * 1000);
                  } else {
                    displayInvitedAt = new Date();
                  }
                }

                let displayAcceptedAt = null;
                if (respondedAt) {
                  if (typeof respondedAt.toDate === "function") {
                    displayAcceptedAt = new Date(
                      respondedAt.toDate().getTime()
                    );
                  } else if (respondedAt.seconds) {
                    displayAcceptedAt = new Date(respondedAt.seconds * 1000);
                  } else {
                    displayAcceptedAt = new Date();
                  }
                }

                // Normalize / find deadline in several places including assignedReviewersMeta for this reviewer
                let deadline = null;
                // check common meta keys
                const keys = [
                  "invitationDeadline",
                  "deadline",
                  "reviewDeadline",
                  "revisionDeadline",
                  "finalizationDeadline",
                ];
                for (const k of keys) {
                  if (meta?.[k]) {
                    deadline = parseDeadline(meta[k]);
                    if (deadline) break;
                  }
                }
                // check assignedReviewersMeta for reviewer-specific keys
                if (!deadline && meta?.assignedReviewersMeta && currentUser.uid) {
                  const arm = meta.assignedReviewersMeta[currentUser.uid];
                  if (arm) {
                    for (const k of keys.concat(["assignedAt", "invitedAt"])) {
                      if (arm[k]) {
                        deadline = parseDeadline(arm[k]);
                        if (deadline) break;
                      }
                    }
                  }
                }
                // final fallback: any field named *Deadline anywhere in meta
                if (!deadline && meta) {
                  const entries = Object.entries(meta);
                  for (const [key, val] of entries) {
                    if (/deadline/i.test(key) && val) {
                      deadline = parseDeadline(val);
                      if (deadline) break;
                    }
                  }
                }
                // log if none found (for debugging)
                if (!deadline) {
                  console.debug(
                    "ReviewerInvitations: no parsed deadline for",
                    docRef.id
                  );
                }

                return {
                  id: docRef.id,
                  title: data.title || "Untitled Manuscript",
                  abstract: abstractAnswer,
                  keywords: data.keywords || [],
                  invitedAt: displayInvitedAt,
                  acceptedAt: displayAcceptedAt,
                  originalInvitedAt: invitedAt,
                  status: meta.invitationStatus || "pending",
                  deadline: deadline,
                  meta,
                  isReReview: meta.isReReview || false,
                  versionNumber: data.versionNumber || 1,
                  previousReviewVersion: meta.previousReviewVersion || null,
                  reReviewInvitedAt: meta.reReviewInvitedAt || null,
                };
              } catch (err) {
                console.error("Error processing document:", err);
                return null;
              }
            })
          )
        ).filter(Boolean);

        processedInvitations.sort((a, b) => {
          if (!a.acceptedAt) return 1;
          if (!b.acceptedAt) return -1;
          return b.acceptedAt - a.acceptedAt;
        });

        setInvitations(processedInvitations);
        setError(null);
        setLoading(false);
      },
      (err) => {
        console.error("Error in snapshot listener:", err);
        setError("Failed to load invitations. Please refresh the page.");
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [currentUser]);
  // 🧩 Update reviewer invitation status (accepted / declined)
  const updateStatus = async (manuscriptId, reviewerId, status) => {
    try {
      const msRef = doc(db, "manuscripts", manuscriptId);
      const msSnap = await getDoc(msRef);

      if (!msSnap.exists()) {
        console.error("Manuscript not found:", manuscriptId);
        return;
      }

      const msData = msSnap.data();
      const meta = msData.assignedReviewersMeta || {};
      const reviewerMeta = meta[reviewerId] || {};

      const updateFields = {
        ...reviewerMeta,
        invitationStatus: status,
        respondedAt: serverTimestamp(),
        acceptedAt:
          status === "accepted" ? serverTimestamp() : reviewerMeta.acceptedAt,
        declinedAt:
          status === "declined" ? serverTimestamp() : reviewerMeta.declinedAt,
      };

      meta[reviewerId] = updateFields;

      await updateDoc(msRef, { assignedReviewersMeta: meta });

      console.log(`Reviewer ${status} status updated successfully.`);
    } catch (error) {
      console.error("Error updating reviewer status:", error);
    }
  };
  const handleDecision = async (manuscriptId, isAccepted) => {
    if (!currentUser || !manuscriptId) return;

    setProcessingId(manuscriptId);
    setError(null);

    try {
      const msRef = doc(db, "manuscripts", manuscriptId);
      const msSnap = await getDoc(msRef);

      if (!msSnap.exists()) {
        console.error("Manuscript not found:", manuscriptId);
        setProcessingId(null);
        return;
      }

      const msData = msSnap.data();
      const meta = msData.assignedReviewersMeta || {};
      const reviewerMeta = meta[currentUser.uid] || {};

      // Compute deadline if accepting
      let deadline = reviewerMeta.deadline;
      if (isAccepted) {
        try {
          const settingsRef = doc(db, "deadlineSettings", "deadlines");
          const settingsSnap = await getDoc(settingsRef);
          if (settingsSnap.exists()) {
            const settings = settingsSnap.data();
            const isReReview = reviewerMeta.isReReview === true;
            const reviewDeadlineDays = isReReview
              ? settings.reReviewDeadline || settings.reviewDeadline || 2
              : settings.reviewDeadline || 4;
            const deadlineDate = new Date();
            deadlineDate.setDate(deadlineDate.getDate() + reviewDeadlineDays);
            deadline = deadlineDate;
          } else {
            const isReReview = reviewerMeta.isReReview === true;
            const fallbackDays = isReReview ? 2 : 4;
            const deadlineDate = new Date();
            deadlineDate.setDate(deadlineDate.getDate() + fallbackDays);
            deadline = deadlineDate;
          }
        } catch (err) {
          console.error("Error fetching deadline settings:", err);
          const isReReview = reviewerMeta.isReReview === true;
          const fallbackDays = isReReview ? 2 : 4;
          const deadlineDate = new Date();
          deadlineDate.setDate(deadlineDate.getDate() + fallbackDays);
          deadline = deadlineDate;
        }
      }

      // Prepare updated reviewer meta
      const updateFields = {
        ...reviewerMeta,
        invitationStatus: isAccepted ? "accepted" : "declined",
        respondedAt: serverTimestamp(),
        acceptedAt: isAccepted ? serverTimestamp() : reviewerMeta.acceptedAt,
        declinedAt: !isAccepted ? serverTimestamp() : reviewerMeta.declinedAt,
        ...(isAccepted && deadline && { deadline }),
        ...(reviewerMeta.isReReview && isAccepted
          ? { isReReview: false, reReviewRespondedAt: serverTimestamp() }
          : {}),
      };

      meta[currentUser.uid] = updateFields;

      // Prepare data update
      const updateData = {
        assignedReviewersMeta: meta,
      };

      // Remove reviewer from assignedReviewers array if declined
      if (!isAccepted) {
        updateData.assignedReviewers = msData.assignedReviewers?.filter(
          (uid) => uid !== currentUser.uid
        );
      }

      // Update manuscript status if accepting and at least one reviewer accepted
      if (isAccepted) {
        const hasAcceptedReviewer = Object.values(meta).some(
          (m) => m.invitationStatus === "accepted"
        );
        if (hasAcceptedReviewer) {
          // Set initial status to Peer Reviewer Assigned
          updateData.status = "Peer Reviewer Assigned";
          
          // Schedule status update to Peer Reviewer Reviewing after 5 seconds
          setTimeout(async () => {
            try {
              const msSnap = await getDoc(msRef);
              if (msSnap.exists()) {
                const currentStatus = msSnap.data().status;
                // Only update if the status is still Peer Reviewer Assigned
                if (currentStatus === "Peer Reviewer Assigned") {
                  await updateDoc(msRef, {
                    status: "Peer Reviewer Reviewing"
                  });
                }
              }
            } catch (error) {
              console.error("Error updating to Peer Reviewer Reviewing status:", error);
            }
          }, 5000); // 5 seconds delay
        }
      }

      await updateDoc(msRef, updateData);

      // Notify admins
      let adminIds = await NotificationService.getAdminUserIds();
      if (!Array.isArray(adminIds)) adminIds = adminIds ? [adminIds] : [];
      if (adminIds.length > 0) {
        await NotificationService.notifyPeerReviewerDecision(
          manuscriptId,
          msData.title,
          currentUser.uid,
          adminIds,
          isAccepted
        );
      }

      // Update local state
      setInvitations((prev) =>
        prev.filter((inv) => !(inv.id === manuscriptId && !isAccepted))
      );

      // Navigate if accepted
      if (isAccepted) {
        navigate(`/review-manuscript?manuscriptId=${manuscriptId}`);
      }
    } catch (err) {
      console.error("Error processing decision:", err);
      setError("Failed to process your decision. Please try again.");
    } finally {
      setProcessingId(null);
    }
  };

  const handleViewDetails = (invitation) => setViewingInvitation(invitation);
  const handleCloseModal = () => setViewingInvitation(null);

  // 🧩 Updated Modal — now includes Deadline + Overdue highlight
  const AbstractModal = ({ isOpen, onClose, invitation }) => {
    if (!isOpen || !invitation) return null;
    const {
      title,
      abstract,
      keywords,
      invitedAt,
      deadline,
      isReReview,
      versionNumber,
      previousReviewVersion,
    } = invitation;

    const isOverdue = deadline && new Date() > new Date(deadline);

    return (
      <div className="fixed z-10 inset-0 overflow-y-auto">
        <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
          <div className="fixed inset-0 transition-opacity" aria-hidden="true">
            <div
              className="absolute inset-0 bg-gray-500 opacity-75"
              onClick={onClose}
            ></div>
          </div>

          <span
            className="hidden sm:inline-block sm:align-middle sm:h-screen"
            aria-hidden="true"
          >
            &#8203;
          </span>

          <div className="inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full sm:p-6">
            <div>
              <div className="mt-3 text-center sm:mt-0 sm:text-left">
                <div className="flex items-center gap-2">
                  <h3 className="text-lg leading-6 font-medium text-gray-900">
                    {title}
                  </h3>
                  {isReReview && (
                    <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                      Re-Review v{versionNumber}
                    </span>
                  )}
                </div>
                {isReReview && (
                  <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded">
                    <p className="text-sm text-blue-800">
                      📝 <strong>Re-Review Request:</strong> You previously
                      reviewed version {previousReviewVersion} of this
                      manuscript. The author has submitted a revised version (v
                      {versionNumber}). Please review the changes and provide
                      feedback on the revisions.
                    </p>
                  </div>
                )}
                <div className="mt-2">
                  <div className="mt-4 text-sm text-gray-500">
                    <span className="font-medium">Invited: </span>
                    {invitedAt?.toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                      hour12: true,
                    })}
                  </div>

                  {deadline && (
                    <div className="mt-3">
                      {(() => {
                        const startDate =
                          invitation.acceptedAt ||
                          invitation.invitedAt ||
                          new Date();
                        const parsedStart =
                          startDate?.toDate?.() ?? new Date(startDate);
                        const parsedEnd =
                          deadline?.toDate?.() ?? new Date(deadline);

                        const colorClass = getDeadlineColor(
                          parsedStart,
                          parsedEnd
                        );
                        const remainingTime = getRemainingDays(parsedEnd);
                        const { days, hours, minutes } = remainingTime;

                        return (
                          <div
                            className={`inline-block px-3 py-1 rounded-lg text-sm font-medium transition-colors duration-300 ${colorClass}`}
                          >
                            Deadline:{" "}
                            {parsedEnd.toLocaleDateString("en-US", {
                              year: "numeric",
                              month: "long",
                              day: "numeric",
                            })}{" "}
                            {days > 0
                              ? `${days} day${
                                  days > 1 ? "s" : ""
                                }, ${hours} hour${hours !== 1 ? "s" : ""} left`
                              : hours > 0
                              ? `${hours} hour${
                                  hours !== 1 ? "s" : ""
                                }, ${minutes} minute${
                                  minutes !== 1 ? "s" : ""
                                } left`
                              : minutes > 0
                              ? `${minutes} minute${
                                  minutes !== 1 ? "s" : ""
                                } left`
                              : "⚠️ Past Deadline"}
                          </div>
                        );
                      })()}
                    </div>
                  )}

                  <div className="mt-4">
                    <h4 className="text-sm font-medium text-gray-700">
                      Abstract
                    </h4>
                    <p className="mt-1 text-sm text-gray-600 whitespace-pre-line">
                      {abstract}
                    </p>
                  </div>

                  {keywords?.length > 0 && (
                    <div className="mt-4">
                      <h4 className="text-sm font-medium text-gray-700">
                        Keywords
                      </h4>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {keywords.map((kw, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                          >
                            {kw}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
              <button
                type="button"
                className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none sm:ml-3 sm:w-auto sm:text-sm"
                onClick={onClose}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // 🧩 Updated list view — shows deadline and overdue status
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 pt-20 px-4">
        <div className="max-w-7xl mx-auto">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 pt-20 px-4">
        <div className="max-w-7xl mx-auto bg-red-50 border-l-4 border-red-400 p-4 text-red-700">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pt-20 px-4">
      <div className="max-w-7xl mx-auto pt-24">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">
          Reviewer Invitations
        </h1>

        {invitations.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm p-12 text-center">
            <h3 className="text-sm font-medium text-gray-900">
              No pending invitations
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              You'll see new review requests here when they're assigned to you.
            </p>
          </div>
        ) : (
          invitations.map((inv) => {
            const {
              id,
              title,
              abstract,
              keywords,
              invitedAt,
              deadline,
              isReReview,
              versionNumber,
              previousReviewVersion,
            } = inv;
            const isOverdue = deadline && new Date() > new Date(deadline);

            return (
              <div
                key={id}
                className="bg-white shadow overflow-hidden rounded-lg mb-4"
              >
                <div className="px-6 py-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-medium text-gray-900">
                        {title}
                      </h3>
                      {isReReview && (
                        <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                          Re-Review v{versionNumber}
                        </span>
                      )}
                    </div>
                    <span className="px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800">
                      Pending Response
                    </span>
                  </div>
                  {isReReview && (
                    <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded">
                      <p className="text-sm text-blue-800">
                        📝 <strong>Re-Review Request:</strong> You previously
                        reviewed version {previousReviewVersion} of this
                        manuscript. The author has submitted a revised version
                        (v{versionNumber}). Please review the changes.
                      </p>
                    </div>
                  )}
                  <p className="mt-2 text-sm text-gray-600 line-clamp-2">
                    {abstract}
                  </p>
                  <div className="mt-4 text-sm text-gray-500">
                    <span className="font-medium">Invited: </span>
                    {invitedAt?.toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>

                  {deadline && (
                    <div className="mt-3">
                      {(() => {
                        const startDate = inv.acceptedAt || inv.invitedAt;
                        const parsedStartDate = startDate?.toDate
                          ? startDate.toDate()
                          : new Date(startDate);
                        const parsedDeadline = deadline?.toDate
                          ? deadline.toDate()
                          : new Date(deadline);

                        const colorClass = getDeadlineColor(
                          parsedStartDate,
                          parsedDeadline
                        );
                        const remainingTime = getRemainingDays(parsedDeadline);
                        const { days, hours, minutes } = remainingTime;

                        return (
                          <div
                            className={`inline-block px-3 py-1 rounded-lg text-sm font-medium ${colorClass}`}
                          >
                            Deadline:{" "}
                            {new Date(deadline).toLocaleDateString("en-US", {
                              year: "numeric",
                              month: "long",
                              day: "numeric",
                            })}{" "}
                            {days > 0
                              ? `${days} day${
                                  days > 1 ? "s" : ""
                                }, ${hours} hour${hours !== 1 ? "s" : ""} left`
                              : hours > 0
                              ? `${hours} hour${
                                  hours !== 1 ? "s" : ""
                                }, ${minutes} minute${
                                  minutes !== 1 ? "s" : ""
                                } left`
                              : minutes > 0
                              ? `${minutes} minute${
                                  minutes !== 1 ? "s" : ""
                                } left`
                              : "⚠️ Past Deadline"}
                          </div>
                        );
                      })()}
                    </div>
                  )}

                  <div className="mt-3 flex flex-wrap gap-2">
                    {keywords.slice(0, 3).map((kw, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                      >
                        {kw}
                      </span>
                    ))}
                    {keywords.length > 3 && (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                        +{keywords.length - 3} more
                      </span>
                    )}
                  </div>
                </div>

                <div className="bg-gray-50 px-6 py-3 flex justify-between items-center">
                  <button
                    type="button"
                    onClick={() => handleViewDetails(inv)}
                    className="text-sm font-medium text-blue-600 hover:text-blue-500"
                  >
                    View Details
                  </button>
                  <div className="space-x-3">
                    <button
                      type="button"
                      onClick={() => handleDecision(id, true)}
                      disabled={processingId === id}
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 disabled:opacity-50"
                    >
                      {processingId === id ? "Processing..." : "Accept"}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDecision(id, false)}
                      disabled={processingId === id}
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700 disabled:opacity-50"
                    >
                      {processingId === id ? "Processing..." : "Decline"}
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <AbstractModal
        isOpen={!!viewingInvitation}
        onClose={handleCloseModal}
        invitation={viewingInvitation}
      />
    </div>
  );
};

export default ReviewerInvitations;
