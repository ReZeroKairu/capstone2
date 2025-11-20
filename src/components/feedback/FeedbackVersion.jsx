import React, { useCallback } from "react";
import { FeedbackItem } from "./FeedbackItem";

// Statuses where all feedback should be visible to researchers
const showAllFeedbackStatuses = [
  "For Revision (Minor)",
  "For Revision (Major)",
  "Non-Acceptance",
  "For Publication",
  "Rejected",
];

export const FeedbackVersion = ({
  version,
  versionFeedbacks,
  isAdmin,
  isLatestVersion,
  isExpanded,
  onToggle,
  onEditFeedback,
  onDeleteFeedback,
  userRole,
  currentUser,
  manuscriptStatus = "",
}) => {
  const handleToggle = useCallback(
    (e) => {
      // Safely handle the event if it exists
      if (e && typeof e.preventDefault === "function") {
        e.preventDefault();
        e.stopPropagation();
      }

      // Only allow toggling if:
      // 1. User is admin, OR
      // 2. It's the latest version and status is in showAllFeedbackStatuses, OR
      // 3. It's not the latest version (showing previous feedback)
      const canToggle =
        isAdmin ||
        (isLatestVersion &&
          showAllFeedbackStatuses.includes(manuscriptStatus)) ||
        !isLatestVersion;

      if (canToggle) {
        onToggle(version, isLatestVersion);
      }
    },
    [onToggle, version, isLatestVersion, isAdmin, manuscriptStatus]
  );

  // Handle keyboard events for accessibility
  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        handleToggle(e);
      }
    },
    [handleToggle]
  );

  if (!versionFeedbacks || !Array.isArray(versionFeedbacks)) {
    return null;
  }

  // Determine if this version should be clickable
  const isClickable =
    isAdmin ||
    (isLatestVersion && showAllFeedbackStatuses.includes(manuscriptStatus)) ||
    !isLatestVersion;

  return (
    <div className="feedback-version mb-4 transition-all duration-200 ease-in-out hover:shadow-md">
      <div
        className={`feedback-version-header flex justify-between items-center p-4 rounded-lg ${
          isClickable
            ? "cursor-pointer hover:bg-gray-50"
            : "cursor-default opacity-80"
        }
          ${
            isExpanded
              ? "bg-white border-b-0 rounded-b-none border border-gray-200"
              : "bg-white border border-gray-200 shadow-sm"
          }`}
        onClick={isClickable ? handleToggle : undefined}
        onKeyDown={isClickable ? handleKeyDown : undefined}
        role={isClickable ? "button" : "article"}
        tabIndex={isClickable ? 0 : -1}
        aria-expanded={isExpanded}
        aria-controls={`feedback-version-${version}-content`}
      >
        <div className="flex items-center space-x-3">
          <div className="flex items-center">
            <span className="text-lg font-semibold text-gray-800">
              Version {version}
            </span>
            {isLatestVersion && isAdmin && (
              <span className="ml-3 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                Current
              </span>
            )}
            {isLatestVersion &&
              !isAdmin &&
              showAllFeedbackStatuses.includes(manuscriptStatus) && (
                <span className="ml-3 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  Latest Feedback
                </span>
              )}
            {!isAdmin &&
              isLatestVersion &&
              !showAllFeedbackStatuses.includes(manuscriptStatus) && (
                <span className="ml-3 px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                  Under Review
                </span>
              )}
          </div>
        </div>
        <div className="flex items-center">
          {isClickable ? (
            <div className="p-1.5 rounded-full hover:bg-gray-100 transition-colors">
              {isExpanded ? (
                <svg
                  className="w-5 h-5 text-gray-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 15l7-7 7 7"
                  />
                </svg>
              ) : (
                <svg
                  className="w-5 h-5 text-gray-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              )}
            </div>
          ) : (
            <div className="p-1.5 rounded-full">
              <svg
                className="w-5 h-5 text-gray-400"
                fill="currentColor"
                viewBox="0 0 20 20"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  fillRule="evenodd"
                  d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
          )}
        </div>
      </div>

      <div
        id={`feedback-version-${version}-content`}
        className={`feedback-version-content overflow-hidden transition-all duration-300 ease-in-out ${
          isExpanded
            ? "max-h-[5000px] opacity-100 visible"
            : "max-h-0 opacity-0 invisible"
        }`}
        style={{
          borderLeft: "1px solid #e5e7eb",
          borderRight: "1px solid #e5e7eb",
          borderBottom: "1px solid #e5e7eb",
          borderBottomLeftRadius: "0.5rem",
          borderBottomRightRadius: "0.5rem",
          backgroundColor: "#f9fafb",
          transitionProperty: "max-height, opacity, visibility",
          transitionTimingFunction: "cubic-bezier(0.4, 0, 0.2, 1)",
        }}
      >
        {isExpanded && versionFeedbacks.length > 0 && (
          <div className="divide-y divide-gray-200">
            {[...versionFeedbacks]
              .sort(
                (a, b) =>
                  (b.timestamp?.toDate?.() || 0) -
                  (a.timestamp?.toDate?.() || 0)
              )
              .map((feedback) => (
                <div key={feedback.id} className="py-2">
                  <FeedbackItem
                    item={feedback}
                    isAdmin={isAdmin}
                    onEdit={onEditFeedback}
                    onDelete={onDeleteFeedback}
                    userRole={userRole}
                    currentUser={currentUser}
                  />
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default FeedbackVersion;
