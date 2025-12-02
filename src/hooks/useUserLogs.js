import { useCallback } from "react";
import { UserLogService } from "../utils/userLogService";
import { getAuth } from "firebase/auth";

/**
 * Custom hook for user activity logging
 */
export const useUserLogs = () => {
  const getCurrentUserId = () => {
    const auth = getAuth();
    return auth.currentUser?.uid;
  };

  // Authentication logging is now handled by UserLogService
  // which is used directly in the auth components

  // Manuscript logs
  const logManuscriptSubmission = useCallback(
    async (userId, manuscriptId, manuscriptTitle) => {
      if (userId) {
        await UserLogService.logManuscriptSubmission(
          userId,
          manuscriptId,
          manuscriptTitle
        );
      } else {
        // Fallback to getting current user ID if not provided
        const currentUserId = getCurrentUserId();
        if (currentUserId) {
          await UserLogService.logManuscriptSubmission(
            currentUserId,
            manuscriptId,
            manuscriptTitle
          );
        }
      }
    },
    []
  );

  const logManuscriptReview = useCallback(
    async (manuscriptId, manuscriptTitle, decision) => {
      const userId = getCurrentUserId();
      if (userId) {
        await UserLogService.logManuscriptReview(
          userId,
          manuscriptId,
          manuscriptTitle,
          decision
        );
      }
    },
    []
  );

  const logReviewerAssignment = useCallback(
    async (manuscriptId, manuscriptTitle, reviewerIds) => {
      const userId = getCurrentUserId();
      if (userId) {
        await UserLogService.logReviewerAssignment(
          userId,
          manuscriptId,
          manuscriptTitle,
          reviewerIds
        );
      }
    },
    []
  );

  // Profile logs
  const logProfileUpdate = useCallback(async (updatedFields) => {
    const userId = getCurrentUserId();
    if (userId) {
      await UserLogService.logUserProfileUpdate(userId, updatedFields);
    }
  }, []);

  // Feature usage logs
  const logFeatureUsage = useCallback(async (featureName, featureData = {}) => {
    const userId = getCurrentUserId();
    if (userId) {
      await UserLogService.logFeatureUsage(userId, featureName, featureData);
    }
  }, []);

  // Page view logs
  const logPageView = useCallback(async (pagePath, pageTitle) => {
    const userId = getCurrentUserId();
    if (userId) {
      await UserLogService.logPageView(userId, pagePath, pageTitle);
    }
  }, []);

  // Notification logs
  const logNotificationAction = useCallback(
    async (notificationId, action, notificationType) => {
      const userId = getCurrentUserId();
      if (userId) {
        await UserLogService.logNotificationAction(
          userId,
          notificationId,
          action,
          notificationType
        );
      }
    },
    []
  );

  const logManuscriptResubmission = useCallback(
    async (userId, manuscriptId, manuscriptTitle, version, previousVersion) => {
      if (userId) {
        await UserLogService.logManuscriptResubmission(
          userId,
          manuscriptId,
          manuscriptTitle,
          version,
          previousVersion
        );
      } else {
        // Fallback to getting current user ID if not provided
        const currentUserId = getCurrentUserId();
        if (currentUserId) {
          await UserLogService.logManuscriptResubmission(
            currentUserId,
            manuscriptId,
            manuscriptTitle,
            version,
            previousVersion
          );
        }
      }
    },
    []
  );

  return {
    logManuscriptSubmission,
    logManuscriptResubmission,
    logManuscriptReview,
    logReviewerAssignment,
    logProfileUpdate,
    logFeatureUsage,
    logPageView,
    logNotificationAction,
  };
};

export default useUserLogs;
