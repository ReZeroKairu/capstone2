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

        // Gather all submissions for this reviewer
        const allSubmissions = (manuscript.reviewerSubmissions || [])
          .filter((s) => s.reviewerId === reviewer.id)
          .sort((a, b) => {
            const aTime = a.completedAt?.toDate
              ? a.completedAt.toDate().getTime()
              : new Date(a.completedAt).getTime();
            const bTime = b.completedAt?.toDate
              ? b.completedAt.toDate().getTime()
              : new Date(b.completedAt).getTime();
            return aTime - bTime;
          });

        // Determine which submissions to show
        let submissionsToShow = allSubmissions;
        let showNoFeedbackMessage = false;

        if (role === "Researcher") {
          // Show all completed submissions for researchers
          submissionsToShow = allSubmissions.filter(
            (submission) =>
              submission.status === "Completed" ||
              submission.isFinalized === true
          );

          showNoFeedbackMessage = submissionsToShow.length === 0;
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
                    {decisionMeta?.decision ? (
                      <span className="text-xs px-2 py-1 rounded bg-purple-100 text-purple-800">
                        Review Completed
                      </span>
                    ) : (
                      <span
                        className={`text-xs px-2 py-1 rounded ${
                          !meta.invitationStatus ||
                          meta.invitationStatus === "pending"
                            ? "bg-yellow-100 text-yellow-800"
                            : meta.invitationStatus === "accepted"
                            ? "bg-green-100 text-green-800"
                            : "bg-red-100 text-red-800"
                        }`}
                      >
                        {!meta.invitationStatus ||
                        meta.invitationStatus === "pending"
                          ? "Invitation Pending"
                          : meta.invitationStatus === "accepted"
                          ? "Reviewing..."
                          : "Declined"}
                      </span>
                    )}

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
              // Researcher view
              <div className="flex justify-between items-center">
                <div>
                  <span className="text-blue-800 text-sm font-medium">
                    {showNoFeedbackMessage
                      ? "Review in progress"
                      : "Review submitted"}
                  </span>
                  {!showNoFeedbackMessage && decisionMeta?.decision && (
                    <div className="text-xs text-gray-500 mt-1">
                      {decisionMeta.decision === "minor" &&
                        "Minor revisions requested"}
                      {decisionMeta.decision === "major" &&
                        "Major revisions requested"}
                      {decisionMeta.decision === "publication" &&
                        "Accepted for publication"}
                      {decisionMeta.decision === "reject" &&
                        "Revisions required"}
                    </div>
                  )}
                </div>
                {!showNoFeedbackMessage && (
                  <span className="text-xs px-2 py-1 rounded bg-purple-100 text-purple-800">
                    Review Completed
                  </span>
                )}
              </div>
            )}

            {/* Decision for Admin/PeerReviewer */}
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
            {submissionsToShow.length > 0 && (
              <div className="mt-2 space-y-2">
                {submissionsToShow.map((submission, idx) => (
                  <div
                    key={idx}
                    className="border-t pt-2 first:border-0 first:pt-0"
                  >
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-semibold text-gray-800">
                        Version {submission.manuscriptVersionNumber || idx + 1}
                        {role !== "Researcher" &&
                        idx === allSubmissions.length - 1
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
                      <p className="text-xs text-gray-700 italic mt-1">
                        "{submission.comment}"
                      </p>
                    )}
                    {(submission.reviewFileUrl ||
                      submission.reviewFile ||
                      submission.reviewFilePath) && (
                      <p className="mt-1">
                        <button
                          onClick={() =>
                            downloadFileCandidate(
                              submission.reviewFileUrl ||
                                submission.reviewFile ||
                                submission.reviewFilePath,
                              submission.fileName || submission.name
                            )
                          }
                          className="text-blue-600 underline text-xs"
                        >
                          Download Review File
                        </button>
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </>
  );
};

export default ReviewerFeedback;
