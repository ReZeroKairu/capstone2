import {
  collection,
  addDoc,
  serverTimestamp,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  writeBatch
} from "firebase/firestore";
import { db, auth } from "../firebase/firebase";

/**
 * Notification Service - Centralized notification management
 * 
 * Handles all notification-related functionality using direct Firestore writes.
 */
export class NotificationService {
  // ----------------- Static helpers -----------------
  
  /**
   * Get all admin user IDs
   * @returns {Promise<string[]>} Array of admin user IDs
   */
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
   * Get user's display name by ID
   * @param {string} userId - User ID
   * @returns {Promise<string>} User's display name
   */
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

  // ----------------- Static Methods -----------------

  /**
   * Create notifications for multiple users
   * @param {string[]} userIds - Array of user IDs
   * @param {string} type - Notification type
   * @param {string} title - Notification title
   * @param {string} message - Notification message
   * @param {Object} [metadata={}] - Additional metadata
   * @returns {Promise<Array>} Array of created notifications
   */
  static async createBulkNotifications(userIds, type, title, message, metadata = {}) {
    if (!Array.isArray(userIds) || userIds.length === 0) {
      console.error("Cannot create notifications: userIds must be a non-empty array");
      return [];
    }

    try {
      const notifications = [];
      const batch = writeBatch(db);
      const timestamp = serverTimestamp();
      const currentUserId = auth.currentUser?.uid || 'system';

      for (const userId of userIds) {
        const notificationRef = doc(collection(db, `Users/${userId}/Notifications`));
        const notificationData = {
          type,
          title,
          message,
          recipientId: userId,
          seen: false,
          createdAt: timestamp,
          metadata: {
            ...metadata,
            createdBy: currentUserId,
            timestamp: new Date().toISOString()
          }
        };
        
        batch.set(notificationRef, notificationData);
        notifications.push({ id: notificationRef.id, ...notificationData });
      }

      await batch.commit();
      console.log(`Successfully created ${notifications.length} notifications`);
      return notifications;
    } catch (error) {
      console.error('Error creating notifications:', {
        error: error.message,
        code: error.code,
        userIds,
        currentUser: auth.currentUser?.uid,
        timestamp: new Date().toISOString()
      });
      throw error;
    }
  }

  /**
   * Create a single notification
   * @param {string} userId - User ID
   * @param {string} type - Notification type
   * @param {string} title - Notification title
   * @param {string} message - Notification message
   * @param {Object} [metadata={}] - Additional metadata
   * @returns {Promise<Object|null>} Created notification or null on error
   */
  static async createNotification(userId, type, title, message, metadata = {}) {
    try {
      const results = await this.createBulkNotifications([userId], type, title, message, metadata);
      return results[0] || null;
    } catch (error) {
      console.error('Error creating notification:', {
        error: error.message,
        userId,
        type,
        currentUser: auth.currentUser?.uid
      });
      return null;
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

  // ----------------- Instance methods (preserved) -----------------

  /**
   * Create notifications for multiple users using direct Firestore writes
   * 
   * Returns: Array of notification objects that succeeded (each contains id, userId, metadata, _path, etc.)
   */
  async createBulkNotifications(userIds, type, title, message, metadata = {}) {
    if (!Array.isArray(userIds) || userIds.length === 0) {
      console.error("Cannot create notifications: userIds must be a non-empty array");
      return [];
    }

    const currentUserId = auth.currentUser?.uid || 'system';
    const clientTimestamp = new Date().toISOString();

    // ----------------- Fallback: local Firestore writes (File 1 logic) -----------------
    try {
      const { actionUrl, ...restMetadata } = metadata;
      const timestamp = serverTimestamp();

      const notificationPromises = userIds.map(async (userId) => {
        try {
          const notificationData = {
            type,
            title,
            message,
            recipientId: userId,
            seen: false,
            timestamp: serverTimestamp(), // Use serverTimestamp() for Firestore timestamp
            ...(actionUrl && { actionUrl }),
            metadata: {
              ...restMetadata,
              createdAt: serverTimestamp(),
              createdBy: currentUserId,
              _debug: {
                createdBy: currentUserId,
                createdFor: userId,
                timestamp: serverTimestamp()
              }
            }
          };

          // Store in user's notification subcollection
          const userNotificationsRef = collection(db, "Users", userId, "Notifications");
          const docRef = await addDoc(userNotificationsRef, notificationData);

          return {
            id: docRef.id,
            userId,
            ...notificationData,
            _path: `Users/${userId}/Notifications/${docRef.id}`
          };
        } catch (error) {
          console.error(`Error creating notification for user ${userId}:`, {
            error: error.message,
            code: error.code,
            userId,
            currentUser: currentUserId,
            timestamp: clientTimestamp
          });
          return null;
        }
      });

      const notifications = await Promise.all(notificationPromises);
      const successfulNotifications = notifications.filter(Boolean);

      if (successfulNotifications.length !== userIds.length) {
        console.warn(`Some notifications failed to send. Success: ${successfulNotifications.length}/${userIds.length}`);
      }

      return successfulNotifications;
    } catch (error) {
      console.error("Error in createBulkNotifications fallback:", {
        error: error.message,
        code: error.code,
        stack: error.stack,
        userIds,
        currentUser: auth.currentUser?.uid,
        timestamp: new Date().toISOString()
      });
      throw error;
    }
  }

  /**
   * Single notification helper (preserved behavior from File 1).
   * Returns notification object { id, ... } or null on failure.
   */
  async createNotification(userId, type, title, message, metadata = {}) {
    try {
      if (!userId) {
        console.error("Cannot create notification: userId is required");
        return null;
      }

      // Try cloud function via static wrapper first for single recipient,
      // to keep consistent semantics with bulk (but fallback to local if necessary)
      try {
        const fnPayload = {
          userIds: [userId],
          type,
          title,
          message,
          metadata: {
            ...metadata,
            createdBy: auth.currentUser?.uid || 'system',
            timestamp: new Date().toISOString()
          }
        };

        if (functions) {
          const createNotifications = httpsCallable(functions, 'createBulkNotifications');
          const result = await createNotifications(fnPayload);
          const data = result?.data;

          // If cloud function returns created notification info for this single user, normalize and return it
          if (data) {
            // Accept array or object
            if (Array.isArray(data) && data.length > 0) return data[0];
            if (Array.isArray(data.notifications) && data.notifications.length > 0) return data.notifications[0];
            if (data.created && Array.isArray(data.created) && data.created.length > 0) return data.created[0];
            if (typeof data === 'object' && data.id) return data;
            // otherwise fall through to local creation
            console.warn('createNotification: cloud function returned unexpected shape, falling back to local creation.', {
              shape: Object.keys(data || {})
            });
          }
        }
      } catch (error) {
        console.error('createNotification cloud function failed, falling back to local write:', {
          message: error?.message,
          code: error?.code
        });
      }

      // Fallback to local Firestore write (preserves File 1 behavior)
      const { actionUrl, ...restMetadata } = metadata;

      const notificationData = {
        type,
        title,
        message,
        recipientId: userId,
        seen: false,
        timestamp: serverTimestamp(),
        ...(actionUrl && { actionUrl }),
        metadata: {
          ...restMetadata,
          createdAt: new Date().toISOString(),
          _debug: {
            createdBy: auth.currentUser?.uid || 'system',
            createdFor: userId,
            timestamp: new Date().toISOString()
          }
        },
      };

      const notificationsRef = collection(db, "Users", userId, "Notifications");
      console.log("Creating notification with data:", {
        userId,
        notificationData,
        currentUser: auth.currentUser?.uid
      });

      const docRef = await addDoc(notificationsRef, notificationData);
      return { id: docRef.id, ...notificationData };
    } catch (error) {
      console.error("❌ Error creating notification:", {
        error: error.message,
        userId,
        type,
        title,
        currentUser: auth.currentUser?.uid,
        stack: error.stack,
      });
      return null;
    }
  }

  // ----------------- Manuscript Notifications (preserved) -----------------

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
      const notificationService = new NotificationService();
      const authorAndCoAuthors = [authorId, ...coAuthorIds].filter(Boolean);

      if (authorAndCoAuthors.length > 0) {
        await notificationService.createBulkNotifications(
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

      if (newStatus === "Finalized") {
        const adminMessage = `Manuscript "${manuscriptTitle}" has been finalized with status: ${newStatus}`;
        await notificationService.createNotification(
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
      throw error;
    }
  }

  static async notifyManuscriptSubmission(manuscriptId, manuscriptTitle, authorId, adminIds) {
    try {
      const notificationService = new NotificationService();
      const authorName = await NotificationService.getUserDisplayName(authorId);

      // Notify the author
      await notificationService.createBulkNotifications(
        [authorId],
        "submission_confirmation",
        "Manuscript Submitted Successfully",
        `Your manuscript "${manuscriptTitle}" has been successfully submitted and is now pending review.`,
        {
          manuscriptId,
          manuscriptTitle,
          actionUrl: `/manuscripts?manuscriptId=${manuscriptId}`,
          userRole: "Author",
          status: "Pending Review"
        }
      );

      // Notify admins
      await notificationService.createBulkNotifications(
        adminIds,
        "new_submission",
        "New Manuscript Submission",
        `New manuscript "${manuscriptTitle}" has been submitted by ${authorName}`,
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

  static async notifyPeerReviewerAssignment(manuscriptId, manuscriptTitle, reviewerIds, assignedByAdminId) {
    const notificationService = new NotificationService();
    const adminName = await NotificationService.getUserDisplayName(assignedByAdminId);

    await notificationService.createBulkNotifications(
      reviewerIds,
      "reviewer_assignment",
      "New Manuscript Assignment",
      `You have been assigned to review the manuscript "${manuscriptTitle}" by ${adminName}`,
      {
        manuscriptId,
        manuscriptTitle,
        assignedBy: assignedByAdminId,
        actionUrl: "/review-manuscript",
        userRole: "Peer Reviewer",
      }
    );
  }

  static async notifyReviewerResubmission(manuscriptId, manuscriptTitle, reviewerIds, versionNumber) {
    const notificationService = new NotificationService();

    await notificationService.createBulkNotifications(
      reviewerIds,
      "manuscript_resubmission",
      "Revised Manuscript Ready for Re-Review",
      `A revised version (v${versionNumber}) of the manuscript "${manuscriptTitle}" you previously reviewed has been resubmitted. Please review the changes.`,
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

  // Instance methods for peer reviewer decisions (preserved)
  async notifyPeerReviewerAccept(manuscriptId, manuscriptTitle, reviewerId, adminIds) {
    const reviewerName = await NotificationService.getUserDisplayName(reviewerId);

    await this.createBulkNotifications(
      adminIds,
      "reviewer_accept",
      "Peer Reviewer Accepted",
      `${reviewerName} has accepted to review the manuscript "${manuscriptTitle}"`,
      {
        manuscriptId,
        manuscriptTitle,
        reviewerId,
        actionUrl: `/manuscripts?manuscriptId=${manuscriptId}`,
        userRole: "Admin",
      }
    );
  }

  async notifyPeerReviewerDecision(manuscriptId, manuscriptTitle, reviewerId, adminIds, accepted) {
    if (accepted) {
      await this.notifyPeerReviewerAccept(manuscriptId, manuscriptTitle, reviewerId, adminIds);
    } else {
      await this.notifyPeerReviewerDecline(manuscriptId, manuscriptTitle, reviewerId, adminIds);
    }
  }

  async notifyPeerReviewerDecline(manuscriptId, manuscriptTitle, reviewerId, adminIds) {
    const reviewerName = await NotificationService.getUserDisplayName(reviewerId);

    await this.createBulkNotifications(
      adminIds,
      "reviewer_decline",
      "Peer Reviewer Declined",
      `${reviewerName} has declined to review the manuscript "${manuscriptTitle}"`,
      {
        manuscriptId,
        manuscriptTitle,
        reviewerId,
        actionUrl: `/manuscripts?manuscriptId=${manuscriptId}`,
        userRole: "Admin",
      }
    );
  }

  static async notifyReviewCompleted(manuscriptId, manuscriptTitle, reviewerId, adminIds) {
    const notificationService = new NotificationService();
    const reviewerName = await NotificationService.getUserDisplayName(reviewerId);

    await notificationService.createBulkNotifications(
      adminIds,
      "review_completed",
      "Review Completed",
      `${reviewerName} has completed the review of "${manuscriptTitle}"`,
      {
        manuscriptId,
        manuscriptTitle,
        reviewerId,
        actionUrl: `/manuscripts?manuscriptId=${manuscriptId}`,
        userRole: "Admin",
      }
    );
  }

  // ----------------- Utility (instance) -----------------
  async getAdminUserIdsInstance() {
    // preserved instance version from File 1 for compatibility if your code used notificationService.getAdminUserIds()
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

// Create and export a singleton instance for backwards compatibility
export const notificationService = new NotificationService();
