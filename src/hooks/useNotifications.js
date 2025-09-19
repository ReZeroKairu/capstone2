import { useCallback } from 'react';
import { 
  handleManuscriptSubmission, 
  handleManuscriptStatusChange, 
  handlePeerReviewerAssignment 
} from '../utils/manuscriptHelpers';

/**
 * Custom hook for handling notifications in admin and other components
 */
export const useNotifications = () => {
  
  /**
   * Trigger notification when a new manuscript is submitted
   */
  const notifyManuscriptSubmission = useCallback(async (manuscriptId, manuscriptTitle, authorId) => {
    try {
      await handleManuscriptSubmission(manuscriptId, manuscriptTitle, authorId);
    } catch (error) {
      console.error('Error sending manuscript submission notification:', error);
    }
  }, []);

  /**
   * Trigger notification when manuscript status changes
   */
  const notifyStatusChange = useCallback(async (manuscriptId, manuscriptTitle, oldStatus, newStatus, authorId, adminId) => {
    try {
      await handleManuscriptStatusChange(manuscriptId, manuscriptTitle, oldStatus, newStatus, authorId, adminId);
    } catch (error) {
      console.error('Error sending status change notification:', error);
    }
  }, []);

  /**
   * Trigger notification when peer reviewers are assigned
   */
  const notifyReviewerAssignment = useCallback(async (manuscriptId, manuscriptTitle, reviewerIds, adminId) => {
    try {
      await handlePeerReviewerAssignment(manuscriptId, manuscriptTitle, reviewerIds, adminId);
    } catch (error) {
      console.error('Error sending reviewer assignment notification:', error);
    }
  }, []);

  return {
    notifyManuscriptSubmission,
    notifyStatusChange,
    notifyReviewerAssignment
  };
};

export default useNotifications;
