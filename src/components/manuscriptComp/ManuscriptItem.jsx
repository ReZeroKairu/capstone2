// src/components/Manuscripts/ManuscriptItem.jsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { doc, updateDoc, getDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../firebase/firebase";
import SubmissionHistory from "./SubmissionHistory";
import ReviewerFeedback from "./ReviewerFeedback";
import ManuscriptModal from "./ManuscriptModal";
import { useFileDownloader } from "../../hooks/useFileDownloader";
import { useReviewerAssignment } from "../../hooks/useReviewerAssignment";
import { useManuscriptStatus } from "../../hooks/useManuscriptStatus";
import {
  filterAcceptedReviewers,
  filterRejectedReviewers,
} from "../../utils/manuscriptHelpers";
import PeerReviewerDetails from "./PeerReviewerDetails";
import ManuscriptStatusBadge from "../ManuscriptStatusBadge";
import DeadlineBadge from "./DeadlineBadge";
import StatusActionButtons from "./StatusActionButtons";

const statusToDeadlineField = {
  "Assigning Peer Reviewer": "invitationDeadline",
  "Peer Reviewer Assigned": "reviewDeadline",
  "For Revision (Minor)": "revisionDeadline",
  "For Revision (Major)": "revisionDeadline",
  "Back to Admin": "finalizationDeadline",
};

const ManuscriptItem = ({
  manuscript = {},
  role,
  users = [],
  handleAssign = () => {},
  unassignReviewer = () => {},
  showFullName,
  setShowFullName,
  manuscriptFileUrls = [],
  currentUserId,
  ...props
}) => {
  const { handleStatusChange: handleStatusUpdate } = useManuscriptStatus();
  const navigate = useNavigate();
  
  if (!manuscript || Object.keys(manuscript).length === 0) return null;

  const {
    id,
    title,
    answeredQuestions = [],
    firstName,
    middleName = "",
    lastName,
    role: userRole,
    email,
    submittedAt,
    acceptedAt,
    status,
  } = manuscript;

  const [showModal, setShowModal] = useState(false);
  const [expandedReviewerIds, setExpandedReviewerIds] = useState({});
  const [expandedSubmissionHistory, setExpandedSubmissionHistory] =
    useState(false);
  const [expandedPeerReviewerDetails, setExpandedPeerReviewerDetails] =
    useState(false);

  const { downloadFileCandidate } = useFileDownloader();
  const { assignReviewer } = useReviewerAssignment();

  const normalizeTimestamp = (ts) => {
    if (!ts) return null;
    if (typeof ts.toDate === "function") return ts.toDate();
    if (ts.seconds) return new Date(ts.seconds * 1000);
    if (typeof ts === "string" || ts instanceof Date) return new Date(ts);
    return null;
  };

  const formatDate = (ts) => {
    if (!ts) return "—";
    if (ts.toDate) return ts.toDate().toLocaleString();
    if (ts.seconds) return new Date(ts.seconds * 1000).toLocaleString();
    if (ts instanceof Date) return ts.toLocaleString();
    return ts;
  };

  const formatReviewerName = (reviewer, full) =>
    full
      ? `${reviewer.firstName} ${reviewer.middleName} ${reviewer.lastName}`.trim()
      : `${reviewer.firstName} ${
          reviewer.middleName ? reviewer.middleName.charAt(0) + "." : ""
        } ${reviewer.lastName}`.trim();

  const manuscriptTitle =
    title ||
    answeredQuestions?.find((q) =>
      q.question?.toLowerCase().trim().startsWith("manuscript title")
    )?.answer ||
    "Untitled";

  const hasReviewer = manuscript.assignedReviewers?.length > 0;
  const hasRejection =
    manuscript.reviewerDecisionMeta &&
    Object.values(manuscript.reviewerDecisionMeta).some(
      (d) => d.decision === "reject"
    );

  const researcherVisibleStatuses = [
    "For Revision (Minor)",
    "For Revision (Major)",
    "For Publication",
    "Rejected",
  ];

  // ----------------------------
  // Determine if current user can see the manuscript
  // ----------------------------
  const canSeeManuscript = (() => {
    if (!currentUserId) return false; // wait until auth is ready
    if (role === "Admin") return true;
    if (!status) return true;

    if (role === "Peer Reviewer") {
      const myMeta = manuscript.assignedReviewersMeta?.[currentUserId];
      const completedReview = manuscript.reviewerSubmissions?.some(
        (r) => r.reviewerId === currentUserId && r.status === "Completed"
      );

      // Show if review is completed
      if (completedReview) return true;

      // Show if reviewer was assigned and did NOT decline
      if (myMeta && myMeta.invitationStatus !== "declined") return true;

      // Show manuscript if reviewer was involved in the review process
      if (status === "For Publication") {
        // Check if reviewer completed a review
        const completedReview = manuscript.reviewerSubmissions?.some(
          (r) => r.reviewerId === currentUserId && r.status === "Completed"
        );

        // Or was assigned and didn't explicitly reject
        const rejected =
          manuscript.reviewerDecisionMeta?.[currentUserId]?.decision ===
          "reject";

        return completedReview || !rejected;
      }

      // For revision statuses
      if (["For Revision (Minor)", "For Revision (Major)"].includes(status)) {
        const rejected =
          manuscript.reviewerDecisionMeta?.[currentUserId]?.decision ===
          "reject";
        return !rejected;
      }

      return false;
    }

    if (role === "Researcher") {
      // Researchers can always see their own manuscript
      if (manuscript.submitterId === currentUserId) return true;

      // Otherwise, only see finalized statuses
      const visibleStatuses = [
        "For Revision (Minor)",
        "For Revision (Major)",
        "For Publication",
        "Rejected",
      ];
      return visibleStatuses.includes(status);
    }

    return true;
  })();

  if (!canSeeManuscript) return null;

  // ----------------------------
  // Determine which reviewers are visible to current user
  // ----------------------------
  const visibleReviewers = Object.entries(
    manuscript.assignedReviewersMeta || {}
  )
    .filter(([reviewerId, meta]) => {
      if (role === "Admin") return true;

      if (role === "Peer Reviewer") {
        if (reviewerId !== currentUserId) return false;

        const completedReview = manuscript.reviewerSubmissions?.some(
          (r) => r.reviewerId === currentUserId && r.status === "Completed"
        );

        return (
          completedReview ||
          ["pending", "accepted"].includes(meta.invitationStatus) ||
          manuscript.status === "For Publication"
        );
      }

      if (role === "Researcher") {
        return meta.invitationStatus === "accepted";
      }

      return true;
    })
    .map(([reviewerId, meta]) => {
      const user = users.find((u) => u.id === reviewerId) || {};
      return {
        id: reviewerId,
        firstName: user.firstName || "",
        middleName: user.middleName || "",
        lastName: user.lastName || "",
        email: user.email || "",
        invitationStatus: meta.invitationStatus,
        assignedAt: meta.assignedAt,
        acceptedAt: meta.acceptedAt,
        declinedAt: meta.declinedAt,
        respondedAt: meta.respondedAt,
        assignedBy: meta.assignedBy || "—",
      };
    });

  // This is now handled by StatusActionButtons
  const showAssignButton = false;

  const toggleReviewerExpand = (reviewerId) =>
    setExpandedReviewerIds((prev) => ({
      ...prev,
      [reviewerId]: !prev[reviewerId],
    }));

  const getActiveDeadline = (manuscript, role) => {
    if (role === "Peer Reviewer")
      return manuscript?.deadlines?.review?.end || null;
    if (role === "Admin") {
      if (manuscript.status === "Back to Admin")
        return manuscript?.deadlines?.finalization?.end;
      if (manuscript.status?.includes("Revision")) {
        const latestRevision = manuscript?.deadlines?.revision?.slice(-1)[0];
        return latestRevision?.end;
      }
    }
    return null;
  };

  const handleStatusChange = async (manuscriptId, newStatus, note = '') => {
    console.log('handleStatusChange called with:', { 
      manuscriptId, 
      newStatus,
      note,
      currentUserId
    });
    
    if (!manuscriptId || !newStatus) {
      console.error('Missing required parameters for handleStatusChange');
      return { success: false, error: 'Missing required parameters' };
    }
    
    try {
      // First try to use the handleStatusUpdate from useManuscriptStatus
      if (handleStatusUpdate) {
        console.log('Using handleStatusUpdate from useManuscriptStatus');
        const result = await handleStatusUpdate(manuscriptId, newStatus, note || `Status changed to ${newStatus}`);
        if (result && result.success) {
          console.log('Status updated successfully using useManuscriptStatus');
          return { success: true };
        }
        return result || { success: false, error: 'Failed to update status' };
      }
      
      // Fallback to the prop function if available
      if (typeof props.handleStatusChange === 'function') {
        console.log('Using handleStatusChange from props');
        const result = await props.handleStatusChange(manuscriptId, newStatus, note);
        if (result && result.success) {
          console.log('Status updated successfully using prop function');
          return { success: true };
        }
        return result || { success: false, error: 'Failed to update status' };
      }
      
      // Last resort: direct update (without handling deadlines)
      console.warn('Using direct document update as fallback - deadlines may not be set correctly');
      const msRef = doc(db, "manuscripts", manuscriptId);
      console.log('Updating document directly...');
      await updateDoc(msRef, {
        status: newStatus,
        lastUpdated: serverTimestamp()
      });

      let updatedAssignedReviewers = [];
      let updatedAssignedMeta = {};

      // ---------- Handle status-specific reviewer updates ----------
      if (newStatus === "For Publication") {
        const acceptedReviewerIds = filterAcceptedReviewers(
          ms.reviewerDecisionMeta,
          (ms.assignedReviewers || []).map((id) => ({ id }))
        ).map((r) => r.id);

        // Include reviewers who already completed their review
        const completedReviewerIds =
          ms.reviewerSubmissions
            ?.filter((r) => r.status === "Completed")
            .map((r) => r.reviewerId) || [];

        const allVisibleReviewerIds = Array.from(
          new Set([...acceptedReviewerIds, ...completedReviewerIds])
        );

        updatedAssignedReviewers = buildReviewerObjects(allVisibleReviewerIds);

        updatedAssignedMeta = {
          ...ms.assignedReviewersMeta,
          ...Object.fromEntries(
            updatedAssignedReviewers.map((r) => [
              r.id,
              ms.assignedReviewersMeta?.[r.id] || {
                assignedAt: r.assignedAt,
                assignedBy: r.assignedBy,
              },
            ])
          ),
        };

        await updateReviewerStats(
          updatedAssignedReviewers,
          "acceptedManuscripts"
        );
      } else if (newStatus === "Peer Reviewer Rejected") {
        const rejectedReviewerIds = filterRejectedReviewers(
          ms.reviewerDecisionMeta,
          (ms.assignedReviewers || []).map((id) => ({ id }))
        ).map((r) => r.id);

        updatedAssignedReviewers = buildReviewerObjects(rejectedReviewerIds);

        updatedAssignedMeta = Object.fromEntries(
          updatedAssignedReviewers.map((r) => [
            r.id,
            ms.assignedReviewersMeta?.[r.id] || {
              assignedAt: r.assignedAt,
              assignedBy: r.assignedBy,
            },
          ])
        );

        await updateReviewerStats(
          updatedAssignedReviewers,
          "rejectedManuscripts"
        );
      } else if (
        ["For Revision (Minor)", "For Revision (Major)"].includes(newStatus)
      ) {
        // For new revisions, we need to reset the review data
        const currentReviewers = ms.assignedReviewers || [];

        // If coming from "Back to Admin", keep the current reviewers
        if (ms.status === "Back to Admin") {
          updatedAssignedReviewers = buildReviewerObjects(currentReviewers);
          updatedAssignedMeta = { ...ms.assignedReviewersMeta };
        } else {
          // For major revisions, only keep reviewers who accepted
          const acceptedReviewerIds =
            newStatus === "For Revision (Major)"
              ? filterAcceptedReviewers(
                  ms.reviewerDecisionMeta,
                  currentReviewers.map((id) => ({ id }))
                ).map((r) => r.id)
              : [];

          updatedAssignedReviewers = buildReviewerObjects(acceptedReviewerIds);
          updatedAssignedMeta = Object.fromEntries(
            updatedAssignedReviewers.map((r) => [
              r.id,
              ms.assignedReviewersMeta?.[r.id] || {
                assignedAt: serverTimestamp(),
                assignedBy: currentUserId || 'system',
              },
            ])
          );
        }
      }

      // ---------- Auto-change to "Back to Admin" only when appropriate ----------
      const autoOverrideStatuses = [
        "For Publication",
        "Peer Reviewer Rejected",
        "Rejected",
      ];
      if (!autoOverrideStatuses.includes(newStatus)) {
        const completedReviews =
          ms.reviewerSubmissions?.filter((r) => r.status === "Completed")
            .length || 0;

        const declinedReviews = Object.values(
          ms.assignedReviewersMeta || {}
        ).filter((m) => m.invitationStatus === "declined").length;

        const totalAssigned = ms.assignedReviewers?.length || 0;

        if (completedReviews + declinedReviews === totalAssigned) {
          newStatus = "Back to Admin";
        }
      }

      const updateData = {
        status: newStatus,
        assignedReviewers: updatedAssignedReviewers.map((r) => r.id),
        assignedReviewersMeta: updatedAssignedMeta,
        originalAssignedReviewers: ms.assignedReviewers || [],
        originalAssignedReviewersMeta: ms.assignedReviewersMeta || {},
        reviewerSubmissions: ms.reviewerSubmissions || [],
        finalDecisionAt: new Date(),
        finalDecisionBy: "Admin",
        lastUpdated: new Date().toISOString()
      };

      console.log('Attempting to update document with:', JSON.parse(JSON.stringify(updateData)));
      
      try {
        await updateDoc(msRef, updateData);
        console.log('Document updated successfully');
      } catch (updateError) {
        console.error('Error in updateDoc:', {
          error: updateError,
          errorMessage: updateError.message,
          errorStack: updateError.stack,
          updateData: JSON.parse(JSON.stringify(updateData))
        });
        throw updateError; // Re-throw to be caught by the outer catch
      }
    } catch (err) {
      console.error("Error in handleStatusChange:", {
        error: err,
        errorMessage: err.message,
        errorStack: err.stack,
        manuscriptId,
        newStatus,
        currentUserId
      });
      
      // Show error to user
      alert(`Failed to update status: ${err.message}`);
    }
  };

  return (
    <li className="border rounded-xl shadow-md hover:shadow-xl transition-all bg-gradient-to-br from-white to-gray-50 w-full sm:w-auto p-4">
      {/* Header */}
      <div className="flex justify-between items-center">
        <p className="font-bold text-lg sm:text-xl break-words text-gray-900">
          {manuscriptTitle}
        </p>

        <div className="flex items-center gap-2">
          {(() => {
            const deadlineField = statusToDeadlineField[status];
            const deadlineValue = deadlineField ? manuscript[deadlineField] : null;
            const hideDeadlineForStatuses = [
              "For Publication",
              "Rejected",
              "Peer Reviewer Rejected"
            ];
            
            if (deadlineField && deadlineValue && !hideDeadlineForStatuses.includes(status)) {
              return (
                <DeadlineBadge
                  start={new Date()}
                  end={deadlineValue}
                  formatDate={formatDate}
                />
              );
            }
            return null;
          })()}

          {hasRejection &&
            (status === "Back to Admin" || status === "Rejected") && (
              <span className="px-3 py-1 rounded-full text-xs sm:text-sm font-semibold shadow-sm bg-red-100 text-red-800">
                Rejected by Peer Reviewer
              </span>
            )}
          <ManuscriptStatusBadge
            status={status}
            className="ml-2"
          />
        </div>
      </div>

      {/* Author & Meta Info */}
      <div className="mt-2 text-sm sm:text-base text-gray-600 break-words space-y-0.5">
        {(role !== "Peer Reviewer" || !currentUserId) ? (
          <>
            <p>
              By{" "}
              {role === "Admin" ? (
                <span
                  className="font-semibold text-red-800 cursor-pointer hover:text-red-900 active:text-red-950 transition-colors hover:underline"
                  onClick={() =>
                    navigate(
                      `/profile/${manuscript.submitterId || manuscript.id}`
                    )
                  }
                  title="View Profile"
                >
                  {firstName || "Unknown"}{" "}
                  {middleName ? middleName.charAt(0) + "." : ""}{" "}
                  {lastName || ""}
                </span>
              ) : (
                <span className="font-semibold text-gray-800">
                  {firstName || "Unknown"}{" "}
                  {middleName ? middleName.charAt(0) + "." : ""}{" "}
                  {lastName || ""}
                </span>
              )}{" "}
              ({userRole || "N/A"})
            </p>
            {email && <p>Email: {email}</p>}
            {submittedAt && <p>Submitted: {formatDate(submittedAt)}</p>}
            {acceptedAt && <p>Accepted: {formatDate(acceptedAt)}</p>}
          </>
        ) : (
          <>
            {(manuscript.assignedReviewersMeta?.[currentUserId] || 
              (manuscript.previousReviewers?.includes(currentUserId) && 
               ["For Publication", "Rejected", "Peer Reviewer Rejected"].includes(manuscript.status))) &&
              (() => {
                const isPreviousReviewer = manuscript.previousReviewers?.includes(currentUserId) && 
                                          !manuscript.assignedReviewers?.includes(currentUserId);
                const meta = manuscript.assignedReviewersMeta?.[currentUserId] || 
                           (isPreviousReviewer ? {
                             assignedAt: manuscript.submittedAt,
                             acceptedAt: manuscript.submittedAt
                           } : {});
                
                const assignedAt = normalizeTimestamp(meta.assignedAt);
                const acceptedAt = normalizeTimestamp(meta.acceptedAt);
                const declinedAt = normalizeTimestamp(meta.declinedAt);
                const respondedAt = normalizeTimestamp(meta.respondedAt);
                const activeDeadline = getActiveDeadline(manuscript, role);

                return (
                  <>
                    {assignedAt && <p>Invited: {formatDate(assignedAt)}</p>}
                    {acceptedAt && (
                      <p className="text-green-700 font-medium">
                        Accepted: {formatDate(acceptedAt)}
                      </p>
                    )}
                    {declinedAt && (
                      <p className="text-red-700 font-medium">
                        Declined: {formatDate(declinedAt)}
                      </p>
                    )}
                    {respondedAt && !acceptedAt && !declinedAt && (
                      <p>Responded: {formatDate(respondedAt)}</p>
                    )}

                    {manuscript.reviewerSubmissions?.some(
                      (r) =>
                        r.reviewerId === currentUserId &&
                        r.status === "Completed"
                    ) ||
                    [
                      "Back to Admin",
                      "For Publication",
                      "Rejected",
                      "Peer Reviewer Rejected",
                    ].includes(manuscript.status) ? (
                      <p className="text-green-700 font-medium">
                        {isPreviousReviewer ? "✅ Previously Reviewed" : "✅ Review Completed"}
                      </p>
                    ) : null}

                    {activeDeadline && assignedAt && (
                      <DeadlineBadge
                        start={assignedAt}
                        end={activeDeadline}
                        formatDate={formatDate}
                      />
                    )}
                  </>
                );
              })()}
          </>
        )}
      </div>

      {/* Reviewer Feedback */}
      {visibleReviewers.length > 0 && role !== "Peer Reviewer" && (
        <div className="mt-4">
          <h4 className="font-semibold text-gray-700 mb-2">
            Reviewer Feedback
          </h4>
          <ReviewerFeedback
            manuscript={manuscript}
            users={users}
            visibleReviewers={visibleReviewers}
            role={role}
            showFullName={showFullName}
            setShowFullName={setShowFullName}
            formatReviewerName={formatReviewerName}
            formatDate={formatDate}
            normalizeTimestamp={normalizeTimestamp}
            downloadFileCandidate={downloadFileCandidate}
            unassignReviewer={unassignReviewer}
          />
        </div>
      )}

      {/* Peer Reviewer Details */}
      {(role === "Admin" ||
        (role === "Researcher" && researcherVisibleStatuses.includes(status)) ||
        role === "Peer Reviewer") &&
        [
          "For Publication",
          "For Revision (Minor)",
          "For Revision (Major)",
          "Peer Reviewer Rejected",
          "Rejected",
          "Back to Admin",
        ].includes(status) && (
          <div className="mt-3 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
            <button
              className="mb-3 px-4 py-1 bg-indigo-100 text-indigo-700 rounded font-medium text-sm hover:bg-indigo-200"
              onClick={() => setExpandedPeerReviewerDetails((v) => !v)}
            >
              {expandedPeerReviewerDetails
                ? "Hide Peer Review Details"
                : "Show Peer Review Details"}
            </button>

            {expandedPeerReviewerDetails && (
              <PeerReviewerDetails
                manuscript={manuscript}
                role={role}
                users={users}
                currentUserId={currentUserId}
                expandedReviewerIds={expandedReviewerIds}
                setExpandedReviewerIds={setExpandedReviewerIds}
                downloadFileCandidate={downloadFileCandidate}
                formatDate={formatDate}
              />
            )}
          </div>
        )}

      {/* Actions */}
      <div className="mt-3 flex flex-col sm:flex-row sm:items-center gap-2">
        {role !== "Peer Reviewer" && (
          <button
            onClick={() => setShowModal(true)}
            className="px-4 py-2 bg-yellow-400 text-[#211B17] rounded-lg hover:bg-yellow-500 transition font-medium text-sm sm:text-base"
          >
            View Response
          </button>
        )}

        {role === "Researcher" &&
          ["For Revision (Minor)", "For Revision (Major)"].includes(status) && (
            <button
              onClick={() => navigate(`/researcher/resubmit/${id}`)}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium text-sm sm:text-base"
            >
              Resubmit Revised Manuscript
            </button>
          )}
      </div>

      {/* Status Action Buttons - Moved below the card */}
      {role === "Admin" && status !== "Pending" && (
        <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <h3 className="text-lg font-medium text-gray-800 mb-3">Manuscript Status</h3>
          <StatusActionButtons
            id={id}
            status={status}
            assignReviewer={assignReviewer}
            statusToDeadlineField={statusToDeadlineField}
            handleStatusChange={handleStatusChange}
            hasReviewer={hasReviewer}
            unassignReviewer={unassignReviewer}
          />
        </div>
      )}

      {/* Submission History - Show for all manuscripts, but only if user has appropriate role */}
      {manuscript && (
        (role === "Admin" || 
         role === "Researcher" ||
         (role === "Peer Reviewer" && 
          (() => {
            const isAssigned = manuscript.assignedReviewers?.includes(currentUserId);
            const isPreviousReviewer = (manuscript.previousReviewers || []).includes(currentUserId);
            const myDecision = manuscript.reviewerDecisionMeta?.[currentUserId]?.decision;
            const hasDeclined = manuscript.declinedReviewers?.includes(currentUserId);
            const hasReviewedBefore = isPreviousReviewer || (manuscript.reviewerSubmissions || []).some(s => s.reviewerId === currentUserId);
            
            // Only hide if they declined AND never reviewed it before
            if (hasDeclined && !hasReviewedBefore) return false;
            
            // If currently assigned, always show
            if (isAssigned) return true;
            
            // If previously reviewed, check for conflicting decisions
            if (isPreviousReviewer) {
              // Hide if reviewer rejected but manuscript was published
              if (manuscript.status === "For Publication" && myDecision === "reject") {
                return false;
              }
              // Hide if reviewer approved but manuscript was rejected
              if (["Rejected", "Peer Reviewer Rejected"].includes(manuscript.status) && 
                  myDecision && myDecision !== "reject") {
                return false;
              }
              // Otherwise, show the manuscript
              return true;
            }
            
            // For current submissions, check if they have access
            const hasSubmitted = (manuscript.reviewerSubmissions || []).some(s => s.reviewerId === currentUserId);
            if (hasSubmitted) {
              // Apply the same conflict rules for current submissions
              if (manuscript.status === "For Publication") {
                return myDecision && myDecision !== "reject";
              }
              if (["Rejected", "Peer Reviewer Rejected"].includes(manuscript.status)) {
                return myDecision === "reject";
              }
              return true;
            }
            
            return false;
          })()
         )
        ) && (
          <div className="mt-4 border-t pt-3">
            <button
              className="mb-2 px-4 py-1 bg-blue-100 text-blue-700 rounded font-medium text-sm hover:bg-blue-200"
              onClick={() => setExpandedSubmissionHistory((v) => !v)}
            >
              {expandedSubmissionHistory
                ? `Hide Submission History`
                : `Show Submission History (${manuscript.submissionHistory?.length || 0})`}
            </button>

            {expandedSubmissionHistory && (
              <SubmissionHistory
                manuscript={manuscript}
                users={users}
                downloadFileCandidate={downloadFileCandidate}
                role={role}
              />
            )}
          </div>
        )
      )}

      {/* View Response Modal */}
      {showModal && (
        <ManuscriptModal
          manuscript={manuscript}
          onClose={() => setShowModal(false)}
          downloadFileCandidate={downloadFileCandidate}
          formatDate={formatDate}
        />
      )}
    </li>
  );
};

export default ManuscriptItem;
