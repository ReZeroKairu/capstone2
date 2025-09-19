import { useCallback } from 'react';
import { UserLogService } from '../utils/userLogService';
import { getAuth } from 'firebase/auth';

/**
 * Custom hook for user activity logging
 */
export const useUserLogs = () => {
  
  const getCurrentUserId = () => {
    const auth = getAuth();
    return auth.currentUser?.uid;
  };

  // Authentication logs
  const logLogin = useCallback(async (loginMethod = "email") => {
    const userId = getCurrentUserId();
    if (userId) {
      await UserLogService.logLogin(userId, loginMethod);
    }
  }, []);

  const logLogout = useCallback(async () => {
    const userId = getCurrentUserId();
    if (userId) {
      await UserLogService.logLogout(userId);
    }
  }, []);

  // Manuscript logs
  const logManuscriptSubmission = useCallback(async (manuscriptId, manuscriptTitle) => {
    const userId = getCurrentUserId();
    if (userId) {
      await UserLogService.logManuscriptSubmission(userId, manuscriptId, manuscriptTitle);
    }
  }, []);

  const logManuscriptReview = useCallback(async (manuscriptId, manuscriptTitle, decision) => {
    const userId = getCurrentUserId();
    if (userId) {
      await UserLogService.logManuscriptReview(userId, manuscriptId, manuscriptTitle, decision);
    }
  }, []);

  const logReviewerAssignment = useCallback(async (manuscriptId, manuscriptTitle, reviewerIds) => {
    const userId = getCurrentUserId();
    if (userId) {
      await UserLogService.logReviewerAssignment(userId, manuscriptId, manuscriptTitle, reviewerIds);
    }
  }, []);

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
  const logNotificationAction = useCallback(async (notificationId, action, notificationType) => {
    const userId = getCurrentUserId();
    if (userId) {
      await UserLogService.logNotificationAction(userId, notificationId, action, notificationType);
    }
  }, []);

  return {
    logLogin,
    logLogout,
    logManuscriptSubmission,
    logManuscriptReview,
    logReviewerAssignment,
    logProfileUpdate,
    logFeatureUsage,
    logPageView,
    logNotificationAction
  };
};

export default useUserLogs;
