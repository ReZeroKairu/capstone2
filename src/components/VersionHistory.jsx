// src/components/Manuscripts/VersionHistory.jsx
import React, { useState } from "react";

const VersionHistory = ({
  title = "Version History",
  items = [], // array of submissions or feedback
  role,
  users = [],
  getReviewerName = (id, idx) => id,
  formatDate = (ts) => ts,
  normalizeTimestamp = (ts) => ts,
  downloadFileCandidate = () => {},
}) => {
  const [expandedReviewerIds, setExpandedReviewerIds] = useState({});
  const toggleExpand = (reviewerId) =>
    setExpandedReviewerIds((prev) => ({
      ...prev,
      [reviewerId]: !prev[reviewerId],
    }));

  // Determine unique reviewer IDs
  const reviewerIds = Array.from(new Set(items.map((i) => i.reviewerId)));

  if (!items.length) return null;

  return (
    <div className="mt-3 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
      <h4 className="text-base font-semibold text-gray-800 mb-3">{title}</h4>
      {reviewerIds.map((reviewerId, idx) => {
        const submissions = items
          .filter((s) => s.reviewerId === reviewerId)
          .sort(
            (a, b) =>
              normalizeTimestamp(a.completedAt)?.getTime() -
              normalizeTimestamp(b.completedAt)?.getTime()
          );

        if (!submissions.length) return null;
        const isExpanded = !!expandedReviewerIds[reviewerId];

        const reviewerName = getReviewerName(reviewerId, idx);

        return (
          <div
            key={reviewerId}
            className="bg-white p-3 rounded-lg border shadow-sm"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="font-medium text-gray-800">{reviewerName}</span>
              <button
                onClick={() => toggleExpand(reviewerId)}
                className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
              >
                {isExpanded
                  ? "Hide Details"
                  : `Show Versions (${submissions.length})`}
              </button>
            </div>

            {isExpanded &&
              submissions.map((submission, sIdx) => (
                <div
                  key={sIdx}
                  className="border-t pt-2 mt-2 first:mt-0 first:pt-0 first:border-0"
                >
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-semibold text-gray-800">
                      Version {sIdx + 1}
                      {sIdx === submissions.length - 1 ? " (Latest)" : ""}
                      {submission.manuscriptVersionNumber && (
                        <span className="ml-2 text-indigo-700 font-normal">
                          For Manuscript Version{" "}
                          {submission.manuscriptVersionNumber}
                        </span>
                      )}
                    </span>
                    <span className="text-xs text-gray-500">
                      {formatDate(submission.completedAt)}
                    </span>
                  </div>
                  {submission.comment && (
                    <div className="mb-2">
                      <p className="text-xs text-gray-700 italic mt-1">
                        "{submission.comment}"
                      </p>
                    </div>
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
                        Download File
                      </button>
                    </p>
                  )}
                </div>
              ))}
          </div>
        );
      })}
    </div>
  );
};

export default VersionHistory;
