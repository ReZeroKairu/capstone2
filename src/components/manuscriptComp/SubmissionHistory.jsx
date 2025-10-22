// src/components/Manuscripts/SubmissionHistory.jsx
import React from "react";
import { Download, FileText } from "lucide-react";
import { format } from "date-fns";
import { auth } from "../../firebase/firebase";

const SubmissionHistory = ({
  manuscript,
  users = [],
  downloadFileCandidate,
  role,
}) => {
  // Helper to get reviewer objects
  const getReviewerData = React.useCallback(
    (reviewerIds) =>
      reviewerIds.map((id) => users.find((u) => u.id === id)).filter(Boolean),
    [users]
  );

  const isLatestSubmission = (submission) =>
    submission.versionNumber === (manuscript.submissionHistory?.length || 0);

  // Get current user ID if logged in
  const currentUserId = auth?.currentUser?.uid;

  // Check if current user is a reviewer who hasn't accepted the latest invitation
  const isReviewer = role === "Peer Reviewer";
  const hasAcceptedLatest =
    manuscript.assignedReviewersMeta?.[currentUserId]?.acceptedAt;
  const isLatestVersion =
    (manuscript.submissionHistory?.length || 0) === manuscript.versionNumber;

  // Helper function to get reviewer display name based on role
  const getReviewerDisplayName = (reviewerId, reviewerNumber) => {
    if (role === "Admin") {
      const reviewer = users.find((u) => u.id === reviewerId);
      return reviewer
        ? `${reviewer.firstName} ${reviewer.lastName}`
        : `Reviewer ${reviewerId?.slice(-4) || ""}`;
    }

    if (role === "Peer Reviewer" && reviewerId === currentUserId) {
      const reviewer = users.find((u) => u.id === reviewerId);
      return reviewer
        ? `${reviewer.firstName} ${
            reviewer.middleName ? reviewer.middleName.charAt(0) + "." : ""
          } ${reviewer.lastName}`
        : "You";
    }

    return `Reviewer ${
      reviewerNumber || (reviewerId ? reviewerId.slice(-4) : "")
    }`;
  };

  // Gather all reviewer submissions (current and previous) per version
  const getReviewerSubmissionsForVersion = (versionNumber) => {
    const allSubmissions = [
      ...(manuscript.reviewerSubmissions || []).map((s) => ({
        ...s,
        isCurrent: true,
      })),
      ...(manuscript.previousReviewSubmissions || []).map((s) => ({
        ...s,
        isCurrent: false,
      })),
    ];

    // Filter based on role and permissions
    return allSubmissions
      .filter((submission) => {
        const submissionVersion = submission.manuscriptVersionNumber || 1;
        const isCurrentVersion = submissionVersion === manuscript.versionNumber;
        const isUnderReview = [
          "Back to Admin",
          "Under Review",
          "Peer Reviewer Assigned",
        ].includes(manuscript.status);

        // Always include for admins
        if (role === "Admin") return true;

        // For researchers
        if (role === "Researcher") {
          // Hide current version reviews if still under review
          if (isCurrentVersion && isUnderReview) {
            return false;
          }
          return true;
        }

        // For peer reviewers, only show their own reviews
        if (role === "Peer Reviewer") {
          return submission.reviewerId === currentUserId;
        }

        return false;
      })
      .filter((s) => {
        const submissionVersion = s.manuscriptVersionNumber || 1;
        return submissionVersion === versionNumber;
      })
      .map((sub, index) => ({
        ...sub,
        reviewerNumber: index + 1, // Add reviewer number for consistent display
      }))
      .sort((a, b) => {
        const aTime = a.completedAt?.toDate
          ? a.completedAt.toDate().getTime()
          : new Date(a.completedAt || a.submittedAt).getTime();
        const bTime = b.completedAt?.toDate
          ? b.completedAt.toDate().getTime()
          : new Date(b.completedAt || b.submittedAt).getTime();
        return aTime - bTime;
      });
  };

  return (
    <div className="space-y-3 mb-4">
      {Array.isArray(manuscript.submissionHistory) &&
      manuscript.submissionHistory.length > 0 ? (
        manuscript.submissionHistory
          // Filter out the latest version if reviewer hasn't accepted
          .filter((submission, idx) => {
            if (
              isReviewer &&
              !hasAcceptedLatest &&
              isLatestVersion &&
              submission.versionNumber === manuscript.versionNumber
            ) {
              return false;
            }
            return true;
          })
          .map((submission, idx) => {
            const versionNumber = submission.versionNumber || idx + 1;

            // Reviewers for this version
            const versionReviewers = submission.reviewers || [];
            const reviewerData = getReviewerData(versionReviewers);

            // Include all submissions (for all versions up to this one)
            const reviewerSubmissions =
              getReviewerSubmissionsForVersion(versionNumber);

            return (
              <div
                key={idx}
                className="bg-gray-50 p-3 rounded border border-gray-200"
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-800">
                      Version {versionNumber}
                      {idx === manuscript.submissionHistory.length - 1 && (
                        <span className="ml-2 px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded">
                          Current
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-gray-600">
                      {submission.fileName || "Manuscript file"}
                    </p>
                    <p className="text-xs text-gray-500">
                      Submitted:{" "}
                      {submission.submittedAt?.toDate
                        ? submission.submittedAt.toDate().toLocaleString()
                        : new Date(submission.submittedAt).toLocaleString()}
                    </p>

                    {submission.revisionNotes &&
                      submission.revisionNotes !== "Initial submission" && (
                        <p className="text-xs text-gray-600 italic mt-1">
                          "{submission.revisionNotes}"
                        </p>
                      )}

                    {/* Original version reviewers */}
                    {reviewerData.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-gray-300">
                        <p className="text-xs font-medium text-gray-700 mb-1">
                          Reviewers ({reviewerData.length}):
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {reviewerData.map((reviewer, rIdx) => {
                            const reviewerDecision =
                              submission.reviewerDecisionMeta?.[reviewer.id];

                            // Hide latest feedback for Researchers if Back to Admin
                            if (
                              role === "Researcher" &&
                              isLatestSubmission(submission) &&
                              manuscript.status === "Back to Admin"
                            ) {
                              return (
                                <div
                                  key={rIdx}
                                  className="text-xs bg-blue-50 px-2 py-1 rounded border border-blue-200"
                                >
                                  <span className="font-medium">
                                    {reviewer.firstName} {reviewer.lastName}
                                  </span>
                                  <span className="ml-1 text-gray-500 italic">
                                    Feedback hidden until admin finalizes
                                  </span>
                                </div>
                              );
                            }

                            return (
                              <div
                                key={rIdx}
                                className="text-xs bg-blue-50 px-2 py-1 rounded border border-blue-200"
                              >
                                <span className="font-medium">
                                  {reviewer.firstName} {reviewer.lastName}
                                </span>
                                {reviewerDecision?.decision && (
                                  <span
                                    className={`ml-1 px-1 rounded text-xs ${
                                      reviewerDecision.decision ===
                                      "publication"
                                        ? "bg-green-200 text-green-800"
                                        : reviewerDecision.decision === "minor"
                                        ? "bg-yellow-200 text-yellow-800"
                                        : reviewerDecision.decision === "major"
                                        ? "bg-orange-200 text-orange-800"
                                        : "bg-red-200 text-red-800"
                                    }`}
                                  >
                                    {reviewerDecision.decision === "publication"
                                      ? "✓ Publish"
                                      : reviewerDecision.decision === "minor"
                                      ? "Minor Rev"
                                      : reviewerDecision.decision === "major"
                                      ? "Major Rev"
                                      : "✗ Reject"}
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* All reviewer submissions / feedback */}
                    {reviewerSubmissions.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-gray-300">
                        <p className="text-xs font-medium text-gray-700 mb-1">
                          Reviewer Feedback:
                        </p>
                        <div className="space-y-2">
                          {reviewerSubmissions.map((sub, sIdx) => {
                            // Hide latest for researcher if Back to Admin
                            const hideLatestForResearcher =
                              role === "Researcher" &&
                              isLatestSubmission(submission) &&
                              manuscript.status === "Back to Admin" &&
                              sub.manuscriptVersionNumber === versionNumber &&
                              sub ===
                                reviewerSubmissions[
                                  reviewerSubmissions.length - 1
                                ];

                            if (hideLatestForResearcher) {
                              return (
                                <div
                                  key={sIdx}
                                  className="bg-white p-2 rounded border border-blue-100"
                                >
                                  <span className="font-medium text-xs">
                                    {users.find((u) => u.id === sub.reviewerId)
                                      ?.firstName ||
                                      `Reviewer ${sub.reviewerId}`}
                                  </span>
                                  <span className="ml-1 text-gray-500 italic text-xs">
                                    Latest feedback hidden until admin finalizes
                                  </span>
                                </div>
                              );
                            }

                            return (
                              <div
                                key={sIdx}
                                className="bg-white p-2 rounded border border-blue-100"
                              >
                                <p className="text-xs font-medium text-gray-800">
                                  {getReviewerDisplayName(
                                    sub.reviewerId,
                                    sub.reviewerNumber
                                  )}{" "}
                                  - Version{" "}
                                  {sub.manuscriptVersionNumber || versionNumber}
                                  {sub.isLatest && " (Latest)"}
                                </p>
                                {sub.comment && (
                                  <p className="text-xs text-gray-700 italic mt-1">
                                    "{sub.comment}"
                                  </p>
                                )}
                                {(sub.reviewFileUrl ||
                                  sub.reviewFile ||
                                  sub.reviewFilePath) && (
                                  <button
                                    onClick={() =>
                                      downloadFileCandidate(
                                        sub.reviewFileUrl ||
                                          sub.reviewFile ||
                                          sub.reviewFilePath,
                                        sub.fileName || sub.name
                                      )
                                    }
                                    className="mt-1 px-2 py-1 text-blue-600 underline text-xs rounded"
                                  >
                                    Download Review File
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  {submission.fileUrl && (
                    <button
                      onClick={() =>
                        downloadFileCandidate(
                          submission.fileUrl,
                          submission.fileName
                        )
                      }
                      className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 ml-3"
                      aria-label="Download submission file"
                    >
                      Download
                    </button>
                  )}
                </div>
              </div>
            );
          })
      ) : (
        <p className="text-gray-500 text-sm italic">
          No submission history yet.
        </p>
      )}
    </div>
  );
};

export default SubmissionHistory;
