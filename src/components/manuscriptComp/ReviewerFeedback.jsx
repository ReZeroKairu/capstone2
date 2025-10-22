// src/components/Manuscripts/ReviewerFeedback.jsx
import React from "react";

const ReviewerFeedback = ({
  manuscript,
  users = [],
  visibleReviewers = [],
  role,
  showFullName,
  setShowFullName,
  formatReviewerName,
  formatDate,
  normalizeTimestamp,
  downloadFileCandidate,
  unassignReviewer,
}) => {
  // Define isFinalState at the component level
  const isFinalState = [
    "For Revision (Minor)",
    "For Revision (Major)",
    "For Publication",
    "Rejected"
  ].includes(manuscript.status);
  // If user is a researcher and manuscript is not in final state, don't show any feedback
  if (role === "Researcher" && !isFinalState) {
    return (
      <div className="bg-blue-50 p-3 rounded-md mb-3 border text-center">
        <p className="text-sm text-gray-600">
          Reviewer feedback will be available after the admin finalizes the decision.
        </p>
      </div>
    );
  }

  return (
    <>
      {visibleReviewers.map((reviewer, reviewerIdx) => {
        const meta = manuscript.assignedReviewersMeta?.[reviewer.id] || {};
        const decisionMeta =
          manuscript.reviewerDecisionMeta?.[reviewer.id] || null;
        const assignedByUser = users.find((u) => u.id === reviewer.assignedBy);
        const assignedByName = assignedByUser
          ? `${assignedByUser.firstName} ${
              assignedByUser.middleName ? assignedByUser.middleName + " " : ""
            }${assignedByUser.lastName}`
          : reviewer.assignedBy || "—";

        // Gather all submissions for this reviewer across all versions
        const allSubmissions = (manuscript.reviewerSubmissions || [])
          .filter((s) => s.reviewerId === reviewer.id)
          .sort((a, b) => {
            const aTime = a.completedAt?.toDate
              ? a.completedAt.toDate().getTime()
              : new Date(a.completedAt || 0).getTime();
            const bTime = b.completedAt?.toDate
              ? b.completedAt.toDate().getTime()
              : new Date(b.completedAt || 0).getTime();
            return aTime - bTime;
          });

        // Determine which submissions to show based on role
        let submissionsToShow = [];
        let showNoFeedbackMessage = false;

        if (role === "Researcher") {
          // Filter out the latest version if not in final state
          const currentVersion = manuscript.versionNumber || 1;
          
          submissionsToShow = allSubmissions.filter(submission => {
            // Only show if it's not the latest version or if in final state
            const submissionVersion = submission.manuscriptVersionNumber || 1;
            return submissionVersion < currentVersion || isFinalState;
          });

          // If in final state, show all completed submissions
          if (isFinalState) {
            const completedSubmissions = allSubmissions.filter(
              submission => submission.status === "Completed"
            );
            
            if (completedSubmissions.length > 0) {
              submissionsToShow = completedSubmissions.map(submission => ({
                ...submission,
                // Override any decision-related fields to hide them
                decision: null,
                recommendation: null,
                comments: "",
                isResearcherView: true,
              }));
            }
          }
          
          showNoFeedbackMessage = submissionsToShow.length === 0;
        } else if (role === "Admin" || role === "Peer Reviewer") {
          // For admins and peer reviewers, show all their submissions
          submissionsToShow = allSubmissions;
        }

        return (
          <div
            key={reviewer.id}
            className="bg-blue-50 p-3 rounded-md mb-3 border"
          >
            {role === "Admin" ? (
              // Admin view
              <>
                <div className="flex justify-between items-start">
                  <div>
                    <span
                      className="text-blue-800 text-sm font-medium cursor-pointer"
                      onClick={() => {
                        const assignedKey = `assigned_${manuscript.id}_${reviewer.id}`;
                        setShowFullName((prev) => ({
                          ...prev,
                          [assignedKey]: !prev[assignedKey],
                        }));
                      }}
                      title="Click to toggle full name"
                    >
                      {formatReviewerName(
                        reviewer,
                        showFullName[`assigned_${manuscript.id}_${reviewer.id}`]
                      )}
                    </span>

                    <div className="text-xs text-black mt-1">
                      Assigned: {formatDate(meta.assignedAt)} by{" "}
                      {assignedByName}
                      {meta.acceptedAt && (
                        <div className="text-green-700 font-medium">
                          Accepted:{" "}
                          {formatDate(normalizeTimestamp(meta.acceptedAt))}
                        </div>
                      )}
                      {meta.declinedAt && (
                        <div className="text-red-700 font-medium">
                          Declined:{" "}
                          {formatDate(normalizeTimestamp(meta.declinedAt))}
                        </div>
                      )}
                      {meta.deadline &&
                        ![
                          "For Publication",
                          "Rejected",
                          "Peer Reviewer Rejected",
                        ].includes(manuscript.status) && (
                          <div className="text-pink-700 font-medium">
                            Deadline:{" "}
                            {formatDate(normalizeTimestamp(meta.deadline))}
                          </div>
                        )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {(() => {
                      const hasCompletedReview = allSubmissions.some(s => 
                        s.reviewerId === reviewer.id && s.status === 'Completed'
                      );
                      
                      const isFinalState = [
                        "For Revision (Minor)",
                        "For Revision (Major)",
                        "For Publication",
                        "Rejected"
                      ].includes(manuscript.status);
                      
                      if (hasCompletedReview) {
                        return (
                          <span className="text-xs px-2 py-1 rounded bg-purple-100 text-purple-800">
                            {isFinalState ? "Review Completed" : "Review Submitted"}
                          </span>
                        );
                      }
                      
                      if (!meta.invitationStatus || meta.invitationStatus === "pending") {
                        return (
                          <span className="text-xs px-2 py-1 rounded bg-yellow-100 text-yellow-800">
                            Invitation Pending
                          </span>
                        );
                      }
                      
                      if (meta.invitationStatus === "declined") {
                        return (
                          <span className="text-xs px-2 py-1 rounded bg-red-100 text-red-800">
                            Declined
                          </span>
                        );
                      }
                      
                      // If we get here, invitation is accepted
                      return (
                        <span className="text-xs px-2 py-1 rounded bg-green-100 text-green-800">
                          {manuscript.status === "Back to Admin" ? "Previously Reviewed" : "Reviewing..."}
                        </span>
                      );
                    })()}

                    <button
                      onClick={() =>
                        unassignReviewer(manuscript.id, reviewer.id)
                      }
                      className="text-xs px-2 py-1 bg-red-500 text-white rounded hover:bg-red-600 transition"
                      title="Unassign this reviewer"
                      aria-label="Unassign reviewer"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex justify-between items-center">
                <span className="text-blue-800 text-sm font-medium">
                  {showNoFeedbackMessage 
                    ? "Review in progress" 
                    : "Review completed"}
                </span>
                {!showNoFeedbackMessage && (
                  <span className="text-xs px-2 py-1 rounded bg-purple-100 text-purple-800">
                    Review Completed
                  </span>
                )}
              </div>
            )}

            {role !== "Researcher" && decisionMeta?.decision && (
              <div className="mt-2 pt-2 border-t border-blue-100 text-xs">
                <span
                  className={`px-2 py-1 rounded-full font-medium ${
                    decisionMeta.decision === "minor"
                      ? "bg-yellow-100 text-yellow-700"
                      : decisionMeta.decision === "major"
                      ? "bg-orange-100 text-orange-700"
                      : decisionMeta.decision === "publication"
                      ? "bg-green-100 text-green-700"
                      : decisionMeta.decision === "reject"
                      ? "bg-red-100 text-red-700"
                      : "bg-gray-100 text-gray-600"
                  }`}
                >
                  {decisionMeta.decision === "minor"
                    ? "Accepted with Minor Revision"
                    : decisionMeta.decision === "major"
                    ? "Accepted with Major Revision"
                    : decisionMeta.decision === "publication"
                    ? "For Publication"
                    : decisionMeta.decision === "reject"
                    ? "Rejected Manuscript"
                    : decisionMeta.decision}
                </span>{" "}
                {decisionMeta.decidedAt &&
                  `at ${formatDate(decisionMeta.decidedAt)}`}
              </div>
            )}

            {/* Submissions */}
            {submissionsToShow.length > 0 ? (
              <div className="mt-2 space-y-2">
                {submissionsToShow.map((submission, idx) => (
                  <div
                    key={`${submission.manuscriptVersionNumber || idx}-${idx}`}
                    className="border-t pt-2 first:border-0 first:pt-0"
                  >
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-semibold text-gray-800">
                        Version {submission.manuscriptVersionNumber || idx + 1}
                        {role !== "Researcher" &&
                        idx === submissionsToShow.length - 1 &&
                        submission.manuscriptVersionNumber === manuscript.versionNumber
                          ? " (Latest)"
                          : ""}
                      </span>
                      <span className="text-xs text-gray-500">
                        {submission.completedAt ? (() => {
                          try {
                            const date = submission.completedAt;
                            // Handle Firestore timestamp
                            if (date.toDate) {
                              return date.toDate().toLocaleString();
                            }
                            // Handle timestamp with seconds
                            if (date.seconds) {
                              return new Date(date.seconds * 1000).toLocaleString();
                            }
                            // Handle string or number
                            const parsedDate = new Date(date);
                            return isNaN(parsedDate.getTime()) ? '—' : parsedDate.toLocaleString();
                          } catch (e) {
                            console.error('Error formatting date:', e, submission.completedAt);
                            return '—';
                          }
                        })() : '—'}
                      </span>
                    </div>
                    {submission.comment && (
                      <div className="mt-1">
                        <p className="text-xs font-medium text-gray-700">
                          {role === "Researcher" ? "Review submitted" : "Review Comment"}:
                        </p>
                        <p className="text-xs text-gray-700 italic mt-1 pl-2 border-l-2 border-gray-200">
                          "{submission.comment}"
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : role === "Peer Reviewer" && allSubmissions.length === 0 ? (
              <div className="mt-2 text-xs text-gray-500 italic">
                No reviews submitted yet for any version.
              </div>
            ) : null}
          </div>
        );
      })}
    </>
  );
};

export default ReviewerFeedback;
