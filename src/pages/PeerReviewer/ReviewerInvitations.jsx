import { useState, useEffect } from "react";
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
} from "firebase/firestore";
import { db } from "../../firebase/firebase";
import { getAuth } from "firebase/auth";
import { getDeadlineColor, getRemainingDays } from "../../utils/deadlineUtils";

import { Timestamp } from "firebase/firestore";

const ReviewerInvitations = () => {
  const [invitations, setInvitations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [processingId, setProcessingId] = useState(null);
  const [viewingInvitation, setViewingInvitation] = useState(null);

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
                const meta = data.assignedReviewersMeta?.[currentUser.uid] || {};

                if (meta.invitationStatus === "responded") return null;

                const abstractAnswer =
                  data.answeredQuestions?.find(
                    (q) => q.question === "Abstract"
                  )?.answer || "No abstract available";

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

                // ✅ Handle deadline
               let deadline = null;
if (meta.deadline) {
  // Firestore Timestamp
  if (meta.deadline.toDate) {
    deadline = meta.deadline.toDate();
  } 
  // If seconds/milliseconds object
  else if (meta.deadline.seconds) {
    deadline = new Date(meta.deadline.seconds * 1000);
  } 
  // If already a string or Date-like
  else {
    deadline = new Date(meta.deadline);
  }
}

// Optional sanity check
if (isNaN(deadline)) {
  console.warn("Invalid deadline for manuscript", docRef.id, meta.deadline);
  deadline = null;
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

  const handleDecision = async (manuscriptId, decision) => {
    if (!currentUser || !manuscriptId) return;

    setProcessingId(manuscriptId);
    setError(null);

    try {
      const invitation = invitations.find((inv) => inv.id === manuscriptId);
      if (!invitation) throw new Error("Invitation not found.");

      const msRef = doc(db, "manuscripts", manuscriptId);

      const safeInvitedAt =
        invitation.originalInvitedAt ||
        invitation.meta?.invitedAt ||
        serverTimestamp();

      const respondedAt = new Date();


const reviewDeadline = Timestamp.fromDate(
  new Date(respondedAt.getTime() + 4 * 24 * 60 * 60 * 1000)
);


const updateData = {
  [`assignedReviewersMeta.${currentUser.uid}`]: {
    ...invitation.meta,
    invitationStatus: decision ? "accepted" : "rejected",
    acceptedAt: decision ? respondedAt : null, // ✅ add this line
    respondedAt: respondedAt,
    decision: decision ? "accepted" : "rejected",
    invitedAt: safeInvitedAt,
    deadline: invitation.meta.deadline || reviewDeadline, // keep existing or set new
  },
  ...(decision && { status: "Peer Reviewer Assigned" }),
};


await updateDoc(msRef, updateData);


      let adminIds = await NotificationService.getAdminUserIds();

      if (!Array.isArray(adminIds)) {
        console.warn("adminIds was not an array, converting to array", adminIds);
        adminIds = adminIds ? [adminIds] : [];
      }

      if (adminIds.length > 0) {
        await NotificationService.notifyPeerReviewerDecision(
          manuscriptId,
          invitation.title,
          currentUser.uid,
          adminIds,
          decision
        );
      }

      setInvitations((prev) =>
        prev.filter((inv) => inv.id !== manuscriptId)
      );

      if (decision) {
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
    const { title, abstract, keywords, invitedAt, deadline } = invitation;

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
                <h3 className="text-lg leading-6 font-medium text-gray-900">
                  {title}
                </h3>
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
const startDate = parseDate(inv.acceptedAt) || parseDate(inv.invitedAt) || new Date();
const endDate = parseDate(inv.deadline);
const colorClass = getDeadlineColor(startDate, endDate);
const remaining = getRemainingDays(endDate, startDate);



      return (
      <div
  className={`inline-block px-3 py-1 rounded-lg text-sm font-medium transition-colors duration-300 ${colorClass}`}
>

          Deadline:{" "}
          {new Date(deadline).toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
          })}{" "}
          {remaining > 0
            ? `(${remaining} day${remaining > 1 ? "s" : ""} left)`
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
            const { id, title, abstract, keywords, invitedAt, deadline } = inv;
            const isOverdue = deadline && new Date() > new Date(deadline);

            return (
              <div
                key={id}
                className="bg-white shadow overflow-hidden rounded-lg mb-4"
              >
                <div className="px-6 py-5">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-medium text-gray-900">{title}</h3>
                    <span className="px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800">
                      Pending Response
                    </span>
                  </div>
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
const parsedStartDate = startDate?.toDate ? startDate.toDate() : new Date(startDate);
const parsedDeadline = deadline?.toDate ? deadline.toDate() : new Date(deadline);

const colorClass = getDeadlineColor(parsedStartDate, parsedDeadline);
const remaining = getRemainingDays(parsedDeadline, parsedStartDate);


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
          {remaining > 0
            ? `(${remaining} day${remaining > 1 ? "s" : ""} left)`
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
