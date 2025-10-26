// src/pages/PeerReviewer/ReviewManuscript.jsx
import { useEffect, useState, useMemo } from "react";
import { getAuth } from "firebase/auth";
import { db, storage } from "../../firebase/firebase";
import {
  collection,
  updateDoc,
  doc,
  arrayUnion,
  getDocs,
  getDoc,
  arrayRemove,
  deleteField,
} from "firebase/firestore";

import {
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
} from "firebase/storage";

import ReviewModal from "./ReviewModal";
import { DeadlineBadge } from "./DeadlineBadge";

import {
  handlePeerReviewerDecision,
  handleReviewCompletion,
} from "../../utils/manuscriptHelpers";
import { useUserLogs } from "../../hooks/useUserLogs";
import { getDeadlineColor, getRemainingTime } from "../../utils/deadlineUtils";
import { parseDateSafe } from "../../utils/dateUtils";
import { recalcManuscriptStatus } from "../../utils/recalcManuscriptStatus";
import { useManuscriptStatus } from "../../hooks/useManuscriptStatus";
import PaginationControls from "../../components/PaginationControls";

import {
  buildRestUrlSafe,
  resolveStoragePathToUrl,
  downloadFileCandidate,
} from "./helpers/fileHelpers";
import { assignReviewer, unassignReviewer } from "./helpers/reviewerActions";

/**
 * Main ReviewManuscript page component — refactored into /pages/PeerReviewer
 * Keeps full fidelity with the original logic you provided.
 */
export default function ReviewManuscript() {
  const [reviewerId, setReviewerId] = useState(null);
  const [manuscripts, setManuscripts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reviews, setReviews] = useState({});
  const [users, setUsers] = useState({});
  const [activeReview, setActiveReview] = useState(null);
  const [activeDecision, setActiveDecision] = useState({});
  const [reviewFiles, setReviewFiles] = useState({});
  const [userRole, setUserRole] = useState(null);
  const { logManuscriptReview } = useUserLogs();
  const [manuscriptFileUrls, setManuscriptFileUrls] = useState({});
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [manuscriptsPerPage, setManuscriptsPerPage] = useState(5); // Default to 5 items per page
  const [searchTerm, setSearchTerm] = useState("");

  const decisionLabels = {
    minor: "Accept (Minor Revision)",
    major: "Accept (Major Revision)",
    publication: "For Publication",
    reject: "Rejected",
    pending: "Pending",
  };

  // Fetch user and manuscripts
  useEffect(() => {
    const fetchUserAndManuscripts = async () => {
      try {
        const auth = getAuth();
        const user = auth.currentUser;
        if (!user) {
          setLoading(false);
          return;
        }

        const uid = user.uid;
        setReviewerId(uid);

        const userDoc = await getDoc(doc(db, "Users", uid));
        if (userDoc.exists()) setUserRole(userDoc.data().role);

        const usersSnap = await getDocs(collection(db, "Users"));
        const allUsers = usersSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setUsers(Object.fromEntries(allUsers.map((u) => [u.id, u])));

        const msSnap = await getDocs(collection(db, "manuscripts"));
        let allMss = msSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

        // Filter manuscripts where reviewer is assigned OR has made a decision
        allMss = allMss.filter(
          (m) =>
            (m.assignedReviewers || []).includes(uid) ||
            m.reviewerDecisionMeta?.[uid]?.decision
        );

        // Further filter: only show if invitation is accepted OR already submitted review
        allMss = allMss.filter((m) => {
          const meta = m.assignedReviewersMeta?.[uid];
          const hasSubmitted = m.reviewerSubmissions?.some(
            (r) => r.reviewerId === uid
          );
          const invitationStatus = meta?.invitationStatus || "pending";
          const hasAccepted =
            invitationStatus === "accepted" || meta?.decision === "accepted";

          // Show if accepted OR already submitted (for historical records)
          return hasAccepted || hasSubmitted;
        });

        allMss = allMss
          .map((m) => {
            const acceptedAt = m.assignedReviewersMeta?.[uid]?.respondedAt;
            return {
              ...m,
              acceptedAt: acceptedAt
                ? acceptedAt.toDate?.() || acceptedAt
                : null,
            };
          })
          .sort((a, b) => {
            if (!a.acceptedAt) return 1;
            if (!b.acceptedAt) return -1;
            return b.acceptedAt - a.acceptedAt;
          });

        setManuscripts(allMss);
        setLoading(false);
      } catch (err) {
        console.error("Failed to fetch user or manuscripts:", err);
        setLoading(false);
      }
    };
    fetchUserAndManuscripts();
  }, []);

  // Resolve manuscript files to URLs
  useEffect(() => {
    if (!manuscripts.length) return;

    const resolveAllFiles = async () => {
      const urlsMap = {};

      for (const m of manuscripts) {
        const files = (m.answeredQuestions || [])
          .filter((q) => q.type === "file" && q.answer)
          .flatMap((q) => (Array.isArray(q.answer) ? q.answer : [q.answer]));

        urlsMap[m.id] = await Promise.all(
          files.map(async (file) => {
            if (!file) return null;

            // Already a full URL
            if (typeof file === "string" && file.startsWith("http"))
              return file;
            if (file.url || file.fileUrl) return file.url || file.fileUrl;

            // Otherwise, get from storage path
            const path = file.path || file.storagePath || file;
            if (!path) return null;

            try {
              return await getDownloadURL(storageRef(storage, path));
            } catch {
              return buildRestUrlSafe(path); // Fallback
            }
          })
        );
      }

      setManuscriptFileUrls(urlsMap);
    };

    resolveAllFiles().catch((err) =>
      console.error("Failed to resolve manuscript files:", err)
    );
  }, [manuscripts]);

  // Log reviewer history helper (kept local)
  const logReviewerHistory = async (msRef, reviewerId, decision) => {
    await updateDoc(msRef, {
      [`reviewerHistory.${reviewerId}`]: arrayUnion({
        decision,
        decidedAt: new Date(),
      }),
    });
  };

  // Get handleStatusChange from useManuscriptStatus
  const { handleStatusChange } = useManuscriptStatus();

  // State for tracking submission status
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Submit decision - preserved in component (keeps state updates intact)
  const handleDecisionSubmit = async (manuscriptId, versionNumber) => {
    // Show confirmation dialog
    const confirmSubmit = window.confirm(
      "Are you sure you want to submit your review? This action cannot be undone."
    );
    if (!confirmSubmit) return;

    const selected = manuscripts.find((m) => m.id === manuscriptId);
    if (!selected) {
      alert("Manuscript not found. Please refresh the page and try again.");
      return;
    }

    const decision = activeDecision[manuscriptId];
    const review = reviews[manuscriptId];
    if (!decision || !review?.comment) {
      alert(
        "Please provide your review comments and decision before submitting."
      );
      return;
    }

    // Set loading state
    setIsSubmitting(true);

    try {
      let fileUrl = null;
      let fileName = null;

      if (reviewFiles[manuscriptId]) {
        const file = reviewFiles[manuscriptId];
        if (file.size > 30 * 1024 * 1024) {
          alert("File size exceeds 30MB. Please upload a smaller file.");
          return;
        }
        const fileRef = storageRef(
          storage,
          `reviews/${manuscriptId}/${reviewerId}-${file.name}`
        );
        const metadata = {
          contentType: file.type,
          contentDisposition: `attachment; filename="${file.name}"`,
        };
        await uploadBytes(fileRef, file, metadata);
        fileUrl = await getDownloadURL(fileRef);
        fileName = file.name;
      }

      const updatedDecisions = {
        ...(selected.reviewerDecisionMeta || {}),
        [reviewerId]: {
          decision,
          comment: review.comment,
          decidedAt: new Date(),
          reviewFileUrl: fileUrl,
          reviewFileName: fileName || null,
        },
      };

      const msRef = doc(db, "manuscripts", manuscriptId);
      await logReviewerHistory(msRef, reviewerId, decision);

      const respondedAt = new Date();

      // Use the version passed from the modal
      const manuscriptVersion = versionNumber || 1;

      // Update meta and submission
      await updateDoc(msRef, {
        [`reviewerDecisionMeta.${reviewerId}`]: updatedDecisions[reviewerId],
        [`assignedReviewersMeta.${reviewerId}.respondedAt`]: respondedAt,
        reviewerSubmissions: arrayUnion({
          reviewerId,
          comment: review.comment,
          status: "Completed",
          completedAt: new Date(),
          reviewFileUrl: fileUrl,
          reviewFileName: fileName || null,
          manuscriptVersionNumber: manuscriptVersion,
        }),
      });

      // Recalculate status with handleStatusChange to ensure proper status updates
      await recalcManuscriptStatus(manuscriptId, handleStatusChange);

      // Peer reviewer hooks
      await handlePeerReviewerDecision(
        manuscriptId,
        selected.manuscriptTitle || selected.title || "Untitled",
        reviewerId,
        decision
      );
      await handleReviewCompletion(
        manuscriptId,
        selected.manuscriptTitle || selected.title || "Untitled",
        reviewerId
      );
      await logManuscriptReview(
        manuscriptId,
        selected.manuscriptTitle || selected.title || "Untitled",
        decision
      );

      // Show success message
      alert("Your review has been submitted successfully!");
    } catch (error) {
      console.error("Error submitting review:", error);
      alert(`Failed to submit review: ${error.message || "Please try again."}`);
    } finally {
      // Reset loading state
      setIsSubmitting(false);
    }

    // Update local state with the new review submission
    setManuscripts((prev) =>
      prev.map((m) =>
        m.id === manuscriptId
          ? {
              ...m,
              reviewerDecisionMeta: {
                ...m.reviewerDecisionMeta,
                [reviewerId]: {
                  decision,
                  comment: review.comment,
                  decidedAt: new Date(),
                  reviewFileUrl: reviewFiles[manuscriptId]?.fileUrl || null,
                  reviewFileName: reviewFiles[manuscriptId]?.fileName || null,
                },
              },
              reviewerSubmissions: [
                ...(m.reviewerSubmissions || []),
                {
                  reviewerId,
                  comment: review.comment,
                  status: "Completed",
                  completedAt: new Date(),
                  reviewFileUrl: reviewFiles[manuscriptId]?.fileUrl || null,
                  reviewFileName: reviewFiles[manuscriptId]?.fileName || null,
                  manuscriptVersionNumber: versionNumber || 1,
                },
              ],
            }
          : m
      )
    );
    setActiveReview(null);
    setActiveDecision((prev) => ({ ...prev, [manuscriptId]: null }));
    setReviewFiles((prev) => ({ ...prev, [manuscriptId]: null }));
  };

  const handleReviewChange = (manuscriptId, field, value) => {
    setReviews((prev) => ({
      ...prev,
      [manuscriptId]: { ...prev[manuscriptId], [field]: value },
    }));
  };

  const getManuscriptDisplayTitle = (m) =>
    m.manuscriptTitle ||
    m.title ||
    m.answeredQuestions?.find((q) =>
      q.question?.toLowerCase().includes("manuscript title")
    )?.answer ||
    "Untitled";

  const visibleManuscripts = useMemo(() => {
    return manuscripts.filter((m) => {
      const myMeta = m.reviewerDecisionMeta?.[reviewerId];
      const myDecision = myMeta?.decision || "pending";

      // Admin sees all manuscripts
      if (userRole === "Admin") return true;

      // Peer Reviewer sees only active review tasks
      if (userRole === "Peer Reviewer") {
        const isAssigned = (m.assignedReviewers || []).includes(reviewerId);
        const isActiveStatus = ![
          "For Publication",
          "Rejected",
          "Peer Reviewer Rejected",
          "Back to Admin",
        ].includes(m.status);

        return isAssigned && isActiveStatus;
      }

      return true;
    });
  }, [manuscripts, reviewerId, userRole]);

  // Filter manuscripts by search term
  const filteredManuscripts = useMemo(() => {
    if (!searchTerm) return visibleManuscripts;
    const searchLower = searchTerm.toLowerCase();
    return visibleManuscripts.filter(ms => {
      const title = (ms.manuscriptTitle || ms.title || "").toLowerCase();
      return title.includes(searchLower);
    });
  }, [visibleManuscripts, searchTerm]);

  // Pagination logic
  const totalItems = filteredManuscripts.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / manuscriptsPerPage));
  const startIndex = (currentPage - 1) * manuscriptsPerPage;
  const paginatedManuscripts = filteredManuscripts.slice(
    startIndex,
    startIndex + parseInt(manuscriptsPerPage)
  );

  // Reset to first page when search or filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [filteredManuscripts.length, manuscriptsPerPage]);

  if (loading) return <p>Loading manuscripts...</p>;
  if (!visibleManuscripts.length)
    return (
      <div className="pt-28 px-6 text-center text-gray-600">
        <p className="text-lg font-semibold mb-2">No manuscripts to review.</p>
        <p>
          If you've accepted invitations or are expecting assignments, they will
          appear here once available.
        </p>
      </div>
    );

  return (
    <div className="px-6 py-28 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <h1 className="text-2xl font-bold">My Assigned Manuscripts</h1>
        <div className="w-full sm:w-64">
          <input
            type="text"
            placeholder="Search by title..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>
      <ul className="space-y-4 mb-6">
        {paginatedManuscripts.map((m) => {
          const myMeta = m.reviewerDecisionMeta?.[reviewerId];
          const myDecision = myMeta?.decision || "pending";
          const myDecisionLabel = decisionLabels[myDecision] || "Pending";
          const hasSubmittedReview = m.reviewerSubmissions?.some(
            (r) => r.reviewerId === reviewerId
          );
          const canSeeManuscript =
            userRole === "Admin" ||
            (userRole === "Peer Reviewer" &&
              ((m.assignedReviewers || []).includes(reviewerId) ||
                myDecision === "reject"));
          if (!canSeeManuscript) return null;

          return (
            <li
              key={m.id}
              className="p-4 border rounded bg-white shadow-sm flex items-center justify-between"
            >
              <div>
                {/* Deadline badge above title */}
                {m.assignedReviewersMeta?.[reviewerId]?.deadline &&
                  ![
                    "For Publication",
                    "Rejected",
                    "Peer Reviewer Rejected",
                    "Back to Admin",
                    "Completed",
                  ].includes(m.status) && (
                    <DeadlineBadge
                      startDate={(() => {
                        // Try to get the respondedAt date first
                        const respondedAt =
                          m.assignedReviewersMeta?.[reviewerId]?.respondedAt;
                        if (respondedAt) {
                          const parsed = parseDateSafe(respondedAt);
                          if (parsed && !isNaN(parsed.getTime())) return parsed;
                        }

                        // Fall back to assignedAt
                        const assignedAt =
                          m.assignedReviewersMeta?.[reviewerId]?.assignedAt;
                        if (assignedAt) {
                          const parsed = parseDateSafe(assignedAt);
                          if (parsed && !isNaN(parsed.getTime())) return parsed;
                        }

                        // Default to current date if no valid dates found
                        return new Date();
                      })()}
                      endDate={(() => {
                        const deadline =
                          m.assignedReviewersMeta?.[reviewerId]?.deadline;
                        if (deadline) {
                          const parsed = parseDateSafe(deadline);
                          if (parsed && !isNaN(parsed.getTime())) return parsed;
                        }
                        return null;
                      })()}
                    />
                  )}

                <div className="text-lg font-semibold">
                  {getManuscriptDisplayTitle(m)}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  <div>
                    Invited by{" "}
                    {users[
                      m.assignedReviewersMeta?.[reviewerId]?.assignedBy ||
                        m.assignedReviewersMeta?.[reviewerId]?.invitedBy
                    ]?.firstName || "Unknown"}{" "}
                    • Status: <span className="font-medium">{m.status}</span>
                  </div>
                  {m.assignedReviewersMeta?.[reviewerId]?.respondedAt && (
                    <div>
                      Responded:{" "}
                      {new Date(
                        m.assignedReviewersMeta[reviewerId].respondedAt
                          .seconds * 1000
                      ).toLocaleString()}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span className="px-2 py-1 rounded text-xs bg-gray-100 text-gray-800">
                  {myDecisionLabel}
                </span>
                <button
                  onClick={() =>
                    setActiveReview((prev) => (prev === m.id ? null : m.id))
                  }
                  className="px-3 py-1 bg-blue-600 text-white rounded text-sm"
                >
                  {activeReview === m.id ? "Hide Details" : "View Details"}
                </button>
              </div>

              {activeReview === m.id && (
                <ReviewModal
                  manuscript={m}
                  versionNumber={m.submissionHistory?.length || 1}
                  reviewerId={reviewerId}
                  users={users}
                  activeDecision={activeDecision}
                  setActiveDecision={setActiveDecision}
                  reviews={reviews}
                  handleReviewChange={handleReviewChange}
                  reviewFiles={reviewFiles}
                  setReviewFiles={setReviewFiles}
                  handleDecisionSubmit={handleDecisionSubmit}
                  closeModal={() => setActiveReview(null)}
                  manuscriptFileUrls={manuscriptFileUrls}
                />
              )}
            </li>
          );
        })}
      </ul>

      {/* Pagination Controls */}
      {totalItems > 0 && (
        <div className="mt-6">
          <PaginationControls
            currentPage={currentPage}
            setCurrentPage={setCurrentPage}
            totalPages={totalPages}
            manuscriptsPerPage={manuscriptsPerPage}
            setManuscriptsPerPage={setManuscriptsPerPage}
          />
        </div>
      )}
    </div>
  );
}
