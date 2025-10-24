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

  // Gather all reviewer submissions for a specific version
  const getReviewerSubmissionsForVersion = (versionNumber) => {
    // Use a Set to track unique submission IDs we've already seen
    const seenSubmissionIds = new Set();
    
    // Get all submissions from all possible sources, removing duplicates
    const allSubmissions = [
      ...(manuscript.reviewerSubmissions || []),
      ...(manuscript.previousReviewSubmissions || []),
      ...(manuscript.submissionHistory?.flatMap(sh => sh.reviewerSubmissions || []) || [])
    ].filter(submission => {
      // Filter out duplicates by submission ID or by unique combination of fields
      if (!submission) return false;
      
      const submissionId = submission.id || 
        `${submission.reviewerId}_${submission.manuscriptVersionNumber || '1'}_${submission.completedAt || submission.submittedAt}`;
      
      if (seenSubmissionIds.has(submissionId)) return false;
      seenSubmissionIds.add(submissionId);
      return true;
    });

    // Filter submissions for the specific version and permissions
    return allSubmissions
      .filter(submission => {
        const submissionVersion = submission.manuscriptVersionNumber || 1;
        return submissionVersion === versionNumber;
      })
      .filter(submission => {
        // Filter based on role and permissions
        if (role === "Admin") return true;
        if (role === "Researcher") return true;
        if (role === "Peer Reviewer") {
          return submission.reviewerId === currentUserId;
        }
        return false;
      })
      .map((sub, index) => ({
        ...sub,
        reviewerNumber: index + 1,
        isCurrent: true
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

  // Check if we should hide the latest feedback for researchers
  const statusesToHideFeedback = ["Back to Admin", "Assigning Peer Reviewer", "Peer Reviewer Reviewing", "Peer Reviewer Assigned"];
  const shouldHideLatestFeedback = role === "Researcher" && statusesToHideFeedback.includes(manuscript.status);
  const latestVersion = manuscript.submissionHistory?.length || 0;

  return (
    <div className="space-y-3 mb-4">
      {Array.isArray(manuscript.submissionHistory) &&
      manuscript.submissionHistory.length > 0 ? (
        manuscript.submissionHistory
          // Filter submissions based on user role and permissions
          .filter((submission, idx) => {
            // If user is an admin, show all submissions
            if (role === "Admin") return true;
            
            // For researchers, show all submissions but we'll hide the latest feedback in the render
            if (role === "Researcher") return true;
            
            // For peer reviewers
            if (role === "Peer Reviewer") {
              const isLatestVersion = submission.versionNumber === latestVersion;
              const hasAcceptedInvitation = manuscript.assignedReviewersMeta?.[currentUserId]?.acceptedAt;
              
              // Always show the latest version if they've accepted the invitation
              if (isLatestVersion) {
                return hasAcceptedInvitation;
              }
              
              // For previous versions, check if they've reviewed them before
              const hasReviewedThisVersion = (manuscript.reviewerSubmissions || []).some(
                s => s.reviewerId === currentUserId && 
                     s.manuscriptVersionNumber === submission.versionNumber
              );
              
              // Also check previous review submissions if they exist
              const hasReviewedInHistory = (manuscript.previousReviewSubmissions || []).some(
                s => s.reviewerId === currentUserId && 
                     s.manuscriptVersionNumber === submission.versionNumber
              );
              
              // Show if they've reviewed this version before, regardless of current invitation status
              return hasReviewedThisVersion || hasReviewedInHistory;
            }
            
            return false;
          })
          .map((submission, idx) => {
            const versionNumber = submission.versionNumber || idx + 1;

            // Get submissions for this version only
            const reviewerSubmissions = getReviewerSubmissionsForVersion(versionNumber);
            
            // Only show the submission info if there are actual reviews
            const hasReviews = reviewerSubmissions.length > 0;

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
                        <div className="mt-2">
                          <p className="text-xs font-medium text-gray-700 mb-1">Revision Notes:</p>
                          <p className="text-xs text-gray-600 italic">
                            "{submission.revisionNotes}"
                          </p>
                        </div>
                      )}

                    {/* All reviewer submissions / feedback */}
                    {reviewerSubmissions.length > 0 && (
                      <>
                        {((role !== "Researcher" || 
                           versionNumber !== latestVersion || 
                           !shouldHideLatestFeedback) && (
                          <div className="mt-2 pt-2 border-t border-gray-300">
                            <p className="text-xs font-medium text-gray-700 mb-1">
                              Reviewer Feedback:
                            </p>
                            <div className="space-y-2">
                              {reviewerSubmissions
                                .filter(sub => sub.manuscriptVersionNumber === versionNumber)
                                .map((sub, sIdx) => (
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
                                ))}
                            </div>
                          </div>
                        ))}
                      </>
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
