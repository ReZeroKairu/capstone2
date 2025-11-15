import {
  collection,
  addDoc,
  serverTimestamp,
  doc,
  getDoc,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { db } from "../firebase/firebase";

/**
 * Notification Service - Centralized notification management
 */
export class NotificationService {
  static async getAdminUserIds() {
    try {
      const usersRef = collection(db, 'Users');
      const q = query(usersRef, where('role', '==', 'Admin'));
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => doc.id);
    } catch (error) {
      console.error('Error fetching admin user IDs:', error);
      return [];
    }
  }
  /**
   * Create notifications for multiple users at once
   * @param {Array<string>} userIds - Array of user IDs to notify
   * @param {string} type - Notification type
   * @param {string} title - Notification title
   * @param {string} message - Notification message
   * @param {Object} [metadata={}] - Additional metadata
   * @returns {Promise<Array>} Array of notification references
   */
  async createBulkNotifications(userIds, type, title, message, metadata = {}) {
    if (!Array.isArray(userIds) || userIds.length === 0) {
      console.error("Cannot create notifications: userIds must be a non-empty array");
      return [];
    }

    try {
      const batch = [];
      const notificationsRef = collection(db, 'Notifications');
      const { actionUrl, ...restMetadata } = metadata;
      const timestamp = serverTimestamp();
      const createdAt = new Date().toISOString();

      // Prepare all notifications in a batch
      const notifications = userIds.map(userId => ({
        userId,
        type,
        title,
        message,
        seen: false,
        timestamp,
        ...(actionUrl && { actionUrl }),
        metadata: {
          ...restMetadata,
          createdAt,
        },
      }));

      // Add all notifications to the batch
      const results = [];
      for (const notification of notifications) {
        const docRef = await addDoc(notificationsRef, notification);
        results.push({ id: docRef.id, ...notification });
      }

      return results;
    } catch (error) {
      console.error("Error creating bulk notifications:", error);
      throw error;
    }
  }

  async createNotification(userId, type, title, message, metadata = {}) {
    try {
      if (!userId) {
        console.error("Cannot create notification: userId is required");
        return null;
      }

      // Extract actionUrl from metadata if it exists
      const { actionUrl, ...restMetadata } = metadata;

      const notificationData = {
        type,
        title,
        message,
        seen: false,
        timestamp: serverTimestamp(),
        ...(actionUrl && { actionUrl }), // Add actionUrl at root level if it exists
        metadata: {
          ...restMetadata,
          createdAt: new Date().toISOString(),
        },
      };

      const notificationsRef = collection(db, "Users", userId, "Notifications");
      const docRef = await addDoc(notificationsRef, notificationData);

      return { id: docRef.id, ...notificationData };
    } catch (error) {
      console.error("❌ Error creating notification:", {
        error: error.message,
        userId,
        type,
        title,
        stack: error.stack,
      });
      return null;
    }
  }

  static async createBulkNotifications(
    userIds,
    type,
    title,
    message,
    metadata = {}
  ) {
    if (!Array.isArray(userIds)) {
      userIds = userIds ? [userIds] : [];
    }

    try {
      // Create an instance to call the instance method
      const instance = new NotificationService();
      const notifications = await Promise.all(
        userIds.map(userId => instance.createNotification(
          userId, 
          type, 
          title, 
          message, 
          metadata
        ))
      );
      
      return notifications;
    } catch (error) {
      console.error("Error creating bulk notifications:", error);
      throw error;
    }
  }

  static async getUserDisplayName(userId) {
    try {
      const userDoc = await getDoc(doc(db, "Users", userId));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        return `${userData.firstName} ${userData.lastName}`.trim();
      }
      return 'Unknown User';
    } catch (error) {
      console.error('Error getting user display name:', error);
      return 'Unknown User';
    }
  }

  // ----------------- Manuscript Notifications -----------------

  static async notifyManuscriptStatusChange(
    manuscriptId,
    manuscriptTitle,
    oldStatus,
    newStatus,
    authorId,
    adminId,
    reviewerIds = [],
    isResubmission = false,
    coAuthorIds = []
  ) {
    const statusMessages = {
      Pending: "Your manuscript has been submitted and is pending review.",
      'For Revision (Minor)': "The status of your manuscript has been updated to For Revision (Minor).",
      'For Revision (Major)': "The status of your manuscript has been updated to For Revision (Major).",
    };

    const notificationType = isResubmission
      ? "Manuscript Resubmission"
      : "Manuscript Status Update";

    let title, message;

    if (isResubmission) {
      title = `Manuscript Resubmitted: ${manuscriptTitle}`;
      message = `Manuscript "${manuscriptTitle}" has been resubmitted for review.`;
    } else {
      title = `Status update for manuscript "${manuscriptTitle}"`;
      message = statusMessages[newStatus] || `The status of your manuscript has been updated to ${newStatus}.`;
    }

    try {
      // Notify author and co-authors
      const authorAndCoAuthors = [authorId, ...coAuthorIds].filter(Boolean);
      
      if (authorAndCoAuthors.length > 0) {
        await NotificationService.createBulkNotifications(
          authorAndCoAuthors,
          notificationType,
          title,
          message,
          {
            manuscriptId,
            manuscriptTitle,
            oldStatus,
            newStatus,
            isResubmission,
            actionUrl: `/manuscripts?manuscriptId=${manuscriptId}`,
            isCoAuthor: true
          }
        );
      } else {
        console.warn('No authors or co-authors to notify');
      }

   
      // Handle special status cases
      if (newStatus === "Finalized") {
        const adminMessage = `Manuscript "${manuscriptTitle}" has been finalized with status: ${newStatus}`;
        const instance = new NotificationService();
        await instance.createNotification(
          adminId,
          "manuscript_final",
          `Manuscript Finalized: ${manuscriptTitle}`,
          adminMessage,
          {
            manuscriptId,
            manuscriptTitle,
            newStatus,
            actionUrl: "/manuscripts",
            userRole: "Admin",
          }
        );
      }
    } catch (error) {
      console.error('Error sending notifications:', error);
      throw error; // Re-throw to be handled by the caller
    }
  }

  static async notifyManuscriptSubmission(
    manuscriptId,
    manuscriptTitle,
    authorId,
    adminIds
  ) {
    try {
      const authorName = await NotificationService.getUserDisplayName(authorId);
      
      // Notify the author
      const authorMessage = `Your manuscript "${manuscriptTitle}" has been successfully submitted and is now pending review.`;
      await NotificationService.createBulkNotifications(
        [authorId],
        "submission_confirmation",
        "Manuscript Submitted Successfully",
        authorMessage,
        {
          manuscriptId,
          manuscriptTitle,
          actionUrl: `/manuscripts?manuscriptId=${manuscriptId}`,
          userRole: "Author",
          status: "Pending Review"
        }
      );

      // Notify admins
      const adminMessage = `New manuscript "${manuscriptTitle}" has been submitted by ${authorName}`;
      await NotificationService.createBulkNotifications(
        adminIds,
        "new_submission",
        "New Manuscript Submission",
        adminMessage,
        {
          manuscriptId,
          manuscriptTitle,
          authorId,
          actionUrl: "/formresponses",
          userRole: "Admin",
        }
      );
    } catch (error) {
      console.error('Error in notifyManuscriptSubmission:', error);
      throw error;
    }
  }

  static async notifyPeerReviewerAssignment(
    manuscriptId,
    manuscriptTitle,
    reviewerIds,
    assignedByAdminId
  ) {
    const adminName = await NotificationService.getUserDisplayName(assignedByAdminId);
    const message = `You have been assigned to review the manuscript "${manuscriptTitle}" by ${adminName}`;
    await this.createBulkNotifications(
      reviewerIds,
      "reviewer_assignment",
      "New Manuscript Assignment",
      message,
      {
        manuscriptId,
        manuscriptTitle,
        assignedBy: assignedByAdminId,
        actionUrl: "/review-manuscript",
        userRole: "Peer Reviewer",
      }
    );
  }

  static async notifyReviewerResubmission(
    manuscriptId,
    manuscriptTitle,
    reviewerIds,
    versionNumber
  ) {
    const message = `A revised version (v${versionNumber}) of the manuscript "${manuscriptTitle}" you previously reviewed has been resubmitted. Please review the changes.`;
    await this.createBulkNotifications(
      reviewerIds,
      "manuscript_resubmission",
      "Revised Manuscript Ready for Re-Review",
      message,
      {
        manuscriptId,
        manuscriptTitle,
        versionNumber,
        isReReview: true,
        actionUrl: "/reviewer-invitations",
        userRole: "Peer Reviewer",
      }
    );
  }

  // ----------------- Peer Reviewer Decisions -----------------

  async notifyPeerReviewerAccept(
    manuscriptId,
    manuscriptTitle,
    reviewerId,
    adminIds
  ) {
    const reviewerName = await NotificationService.getUserDisplayName(reviewerId);
    const message = `${reviewerName} has accepted to review the manuscript "${manuscriptTitle}"`;
    await NotificationService.createBulkNotifications(
      adminIds,
      "reviewer_accept",
      "Peer Reviewer Accepted",
      message,
      {
        manuscriptId,
        manuscriptTitle,
        reviewerId,
        actionUrl: `/manuscripts?manuscriptId=${manuscriptId}`,
        userRole: "Admin",
      }
    );
  }

  async notifyPeerReviewerDecline(
    manuscriptId,
    manuscriptTitle,
    reviewerId,
    adminIds
  ) {
    const reviewerName = await NotificationService.getUserDisplayName(reviewerId);
    const message = `${reviewerName} has declined to review the manuscript "${manuscriptTitle}"`;
    await NotificationService.createBulkNotifications(
      adminIds,
      "reviewer_decline",
      "Peer Reviewer Declined",
      message,
      {
        manuscriptId,
        manuscriptTitle,
        reviewerId,
        actionUrl: `/manuscripts?manuscriptId=${manuscriptId}`,
        userRole: "Admin",
      }
    );
  }

  async notifyPeerReviewerDecision(
    manuscriptId,
    manuscriptTitle,
    reviewerId,
    adminIds,
    accepted
  ) {
    if (accepted) {
      await this.notifyPeerReviewerAccept(
        manuscriptId,
        manuscriptTitle,
        reviewerId,
        adminIds
      );
    } else {
      await this.notifyPeerReviewerDecline(
        manuscriptId,
        manuscriptTitle,
        reviewerId,
        adminIds
      );
    }
  }

  static async notifyReviewCompleted(
    manuscriptId,
    manuscriptTitle,
    reviewerId,
    adminIds
  ) {
    const reviewerName = await NotificationService.getUserDisplayName(reviewerId);
    const message = `${reviewerName} has completed the review of "${manuscriptTitle}"`;
    await NotificationService.createBulkNotifications(
      adminIds,
      "review_completed",
      "Review Completed",
      message,
      {
        manuscriptId,
        manuscriptTitle,
        reviewerId,
        actionUrl: `/manuscripts?manuscriptId=${manuscriptId}`,
        userRole: "Admin",
      }
    );
  }

  // ----------------- Utility -----------------

  async getAdminUserIds() {
    try {
      const usersRef = collection(db, "Users");
      const q = query(usersRef, where("role", "==", "Admin"));
      
      const querySnapshot = await getDocs(q);
      
      const adminIds = [];
      querySnapshot.forEach((doc) => {
        adminIds.push(doc.id);
      });
      
      return adminIds;
    } catch (error) {
      console.error("Error fetching admin users:", error);
      console.error("Error details:", {
        message: error.message,
        stack: error.stack,
        code: error.code,
        name: error.name
      });
      return [];
    }
  }
}

// Export the NotificationService class as default
export default NotificationService;

// Create and export a singleton instance
export const notificationService = new NotificationService();
