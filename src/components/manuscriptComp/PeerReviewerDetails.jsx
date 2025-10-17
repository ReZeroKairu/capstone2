// src/components/Manuscripts/PeerReviewDetails.jsx
import React from "react";

const PeerReviewDetails = ({
  manuscript,
  role,
  users,
  currentUserId,
  expandedReviewerIds,
  setExpandedReviewerIds,
  downloadFileCandidate,
  formatDate,
}) => {
  // Determine reviewers based on role
  const reviewerIds =
    role === "Admin"
      ? Array.from(
          new Set([
            ...(manuscript.originalAssignedReviewers || []),
            ...(manuscript.assignedReviewers || []),
          ])
        )
      : role === "Peer Reviewer"
      ? [currentUserId]
      : role === "Researcher"
      ? Array.from(
          new Set(
            (manuscript.reviewerSubmissions || []).map((s) => s.reviewerId)
          )
        )
      : [];

  // Combine all review sources but no "archived" tag
  const allReviews = [
    ...(manuscript.reviewerSubmissions || []),
    ...(manuscript.previousReviewSubmissions || []),
    ...(manuscript.submissionHistory || []).flatMap(
      (submission) => submission.reviews || []
    ),
  ];

  // Group reviews by reviewer
  const reviewsByReviewer = reviewerIds
    .map((reviewerKey) => {
      const reviewerObj = users.find((u) => u.id === reviewerKey);

      const reviewerReviews = allReviews
        .filter((r) => r.reviewerId === reviewerKey)
        .sort((a, b) => {
          const aTime = new Date(a.completedAt || a.submissionDate).getTime();
          const bTime = new Date(b.completedAt || b.submissionDate).getTime();
          return aTime - bTime;
        });

      if (!reviewerReviews.length) return null;

      // Group by version and get latest per version
      const reviewsByVersion = reviewerReviews.reduce((acc, review) => {
        const version = review.manuscriptVersionNumber || 1;
        if (!acc[version]) acc[version] = [];
        acc[version].push(review);
        return acc;
      }, {});

      const latestPerVersion = Object.entries(reviewsByVersion).map(
        ([, reviews]) =>
          reviews.sort(
            (a, b) =>
              new Date(b.completedAt || b.submissionDate) -
              new Date(a.completedAt || a.submissionDate)
          )[0]
      );

      return {
        reviewerKey,
        reviewerObj,
        reviews: latestPerVersion,
      };
    })
    .filter(Boolean);

  return (
    <div className="space-y-3">
      {reviewsByReviewer.map(({ reviewerKey, reviewerObj, reviews }, index) => {
        const lastReview = reviews[reviews.length - 1];

        // Display name by role
        const reviewerName =
          role === "Admin"
            ? reviewerObj
              ? `${reviewerObj.firstName || ""} ${
                  reviewerObj.middleName || ""
                } ${reviewerObj.lastName || ""}`.trim()
              : `Reviewer ${index + 1}`
            : role === "Peer Reviewer" && reviewerKey === currentUserId
            ? "Your Review"
            : `Reviewer ${index + 1}`;

        // Hide latest feedback for researcher if not finalized
        const hideLatestForResearcher =
          role === "Researcher" &&
          manuscript.status === "Back to Admin" &&
          reviews.length > 0 &&
          lastReview.manuscriptVersionNumber === manuscript.versionNumber;

        if (hideLatestForResearcher) {
          return (
            <div
              key={reviewerKey}
              className="bg-white p-3 rounded-lg border shadow-sm"
            >
              <span className="font-medium">{reviewerName}</span>
              <span className="ml-2 text-gray-500 italic text-xs">
                Latest feedback hidden until admin finalizes
              </span>
            </div>
          );
        }

        return (
          <div
            key={reviewerKey}
            className="bg-white rounded-lg border shadow-sm p-3"
          >
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-medium text-gray-800 text-sm">
                {reviewerName}
              </h3>
              {role === "Admin" && (
                <span className="text-xs text-gray-500">
                  {lastReview.status || "Completed"}
                </span>
              )}
            </div>

            {reviews.map((review, idx) => {
              const versionText = review.manuscriptVersionNumber
                ? `Version ${review.manuscriptVersionNumber}`
                : `Review ${idx + 1}`;

              return (
                <div
                  key={`${reviewerKey}-${idx}`}
                  className="border-t border-gray-100 pt-2 mt-2"
                >
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-semibold text-gray-700">
                      {versionText}
                    </span>
                    <span className="text-xs text-gray-500">
                      {formatDate(review.completedAt)}
                    </span>
                  </div>

                  {/* Show comment for Admin or that reviewer */}
                  {review.comment &&
                    (role === "Admin" ||
                      (role === "Peer Reviewer" &&
                        reviewerKey === currentUserId)) && (
                      <p className="text-xs text-gray-700 italic mt-1">
                        "{review.comment}"
                      </p>
                    )}

                  {/* Review file download (visible to Admin + Researcher) */}
                  {(role === "Admin" ||
                    role === "Researcher" ||
                    (role === "Peer Reviewer" &&
                      reviewerKey === currentUserId)) &&
                    (review.reviewFileUrl ||
                      review.reviewFile ||
                      review.reviewFilePath) && (
                      <div className="mt-1">
                        <button
                          onClick={() =>
                            downloadFileCandidate(
                              review.reviewFileUrl ||
                                review.reviewFile ||
                                review.reviewFilePath,
                              review.fileName ||
                                `review_v${
                                  review.manuscriptVersionNumber || "1"
                                }.pdf`
                            )
                          }
                          className="text-blue-600 hover:text-blue-800 text-xs flex items-center"
                        >
                          <svg
                            className="w-4 h-4 mr-1"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                            />
                          </svg>
                          Download Review File
                        </button>
                      </div>
                    )}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
};

export default PeerReviewDetails;
