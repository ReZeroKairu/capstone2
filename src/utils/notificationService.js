import { collection, addDoc, serverTimestamp, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { db } from "../firebase/firebase";

/**
 * Notification Service - Centralized notification management
 */
export class NotificationService {
  
  /**
   * Create a notification for a specific user
   * @param {string} userId - Target user ID
   * @param {string} type - Notification type (manuscript_status, assignment, etc.)
   * @param {string} title - Notification title
   * @param {string} message - Notification message
   * @param {Object} metadata - Additional data (manuscriptId, etc.)
   */
  static async createNotification(userId, type, title, message, metadata = {}) {
    try {
      const notificationData = {
        type,
        title,
        message,
        seen: false,
        timestamp: serverTimestamp(),
        metadata: {
          ...metadata,
          createdAt: new Date().toISOString()
        }
      };

      const notificationsRef = collection(db, "Users", userId, "Notifications");
      await addDoc(notificationsRef, notificationData);
      
      console.log(`Notification created for user ${userId}: ${title}`);
    } catch (error) {
      console.error("Error creating notification:", error);
    }
  }

  /**
   * Create notifications for multiple users
   * @param {Array} userIds - Array of user IDs
   * @param {string} type - Notification type
   * @param {string} title - Notification title
   * @param {string} message - Notification message
   * @param {Object} metadata - Additional data
   */
  static async createBulkNotifications(userIds, type, title, message, metadata = {}) {
    const promises = userIds.map(userId => 
      this.createNotification(userId, type, title, message, metadata)
    );
    
    try {
      await Promise.all(promises);
      console.log(`Bulk notifications created for ${userIds.length} users`);
    } catch (error) {
      console.error("Error creating bulk notifications:", error);
    }
  }

  /**
   * Get user's display name for notifications
   * @param {string} userId - User ID
   * @returns {Promise<string>} User's display name
   */
  static async getUserDisplayName(userId) {
    try {
      const userDoc = await getDoc(doc(db, "Users", userId));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        return `${userData.firstName || ""} ${userData.lastName || ""}`.trim() || userData.email || "Unknown User";
      }
      return "Unknown User";
    } catch (error) {
      console.error("Error fetching user display name:", error);
      return "Unknown User";
    }
  }

  /**
   * Manuscript status change notifications
   */
  static async notifyManuscriptStatusChange(manuscriptId, manuscriptTitle, oldStatus, newStatus, authorId, adminId) {
    const statusMessages = {
      "Pending": "Your manuscript has been submitted and is pending review.",
      "Assigning Peer Reviewer": "Your manuscript is being assigned to peer reviewers.",
      "Peer Reviewer Assigned": "Peer reviewers have been assigned to your manuscript.",
      "Peer Reviewer Reviewing": "Your manuscript is currently under peer review.",
      "Back to Admin": "Peer review is complete. Your manuscript is back with the admin for final decision.",
      "For Revision": "Your manuscript requires revisions based on peer review feedback.",
      "For Publication": "🎉 Congratulations! Your manuscript has been accepted for publication.",
      "Rejected": "Your manuscript has been rejected. Please review the feedback provided.",
      "Peer Reviewer Rejected": "Your manuscript has been rejected by peer reviewers."
    };

    const message = statusMessages[newStatus] || `Your manuscript status has been updated to: ${newStatus}`;
    
    // Determine the best action URL based on status
    let actionUrl = "/manuscripts";
    if (["For Publication", "Rejected", "Peer Reviewer Rejected"].includes(newStatus)) {
      actionUrl = "/dashboard"; // Final statuses go to dashboard for celebration/review
    }
    
    // Notify the author
    await this.createNotification(
      authorId,
      "manuscript_status",
      `Manuscript Status Update: ${manuscriptTitle}`,
      message,
      { 
        manuscriptId, 
        manuscriptTitle, 
        oldStatus, 
        newStatus,
        actionUrl,
        userRole: "Researcher" // Hint for routing
      }
    );

    // If it's a final decision, also notify admin if different from author
    if (["For Publication", "Rejected", "Peer Reviewer Rejected"].includes(newStatus) && adminId && adminId !== authorId) {
      const adminMessage = `Manuscript "${manuscriptTitle}" has been finalized with status: ${newStatus}`;
      await this.createNotification(
        adminId,
        "manuscript_final",
        `Manuscript Finalized: ${manuscriptTitle}`,
        adminMessage,
        { 
          manuscriptId, 
          manuscriptTitle, 
          newStatus,
          actionUrl: "/manuscripts",
          userRole: "Admin"
        }
      );
    }
  }

  /**
   * Notify researchers about manuscript submission
   */
  static async notifyManuscriptSubmission(manuscriptId, manuscriptTitle, authorId, adminIds) {
    const authorName = await this.getUserDisplayName(authorId);
    
    // Notify all admins about new submission
    const adminMessage = `New manuscript "${manuscriptTitle}" has been submitted by ${authorName}`;
    
    await this.createBulkNotifications(
      adminIds,
      "new_submission",
      "New Manuscript Submission",
      adminMessage,
      {
        manuscriptId,
        manuscriptTitle,
        authorId,
        actionUrl: "/formresponses", // Redirect to form responses for review
        userRole: "Admin"
      }
    );
  }

  /**
   * Notify peer reviewers about assignment
   */
  static async notifyPeerReviewerAssignment(manuscriptId, manuscriptTitle, reviewerIds, assignedByAdminId) {
    const adminName = await this.getUserDisplayName(assignedByAdminId);
    
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
        userRole: "Peer Reviewer"
      }
    );
  }

  /**
   * Notify admin about peer reviewer decisions
   */
  static async notifyPeerReviewerDecision(manuscriptId, manuscriptTitle, reviewerId, decision, adminIds) {
    const reviewerName = await this.getUserDisplayName(reviewerId);
    const decisionText = decision === "accept" ? "accepted" : decision === "reject" ? "rejected" : "backed out of";
    
    const message = `${reviewerName} has ${decisionText} the manuscript "${manuscriptTitle}"`;
    
    await this.createBulkNotifications(
      adminIds,
      "reviewer_decision",
      `Peer Reviewer ${decision === "accept" ? "Acceptance" : decision === "reject" ? "Rejection" : "Withdrawal"}`,
      message,
      { 
        manuscriptId, 
        manuscriptTitle, 
        reviewerId, 
        decision,
        actionUrl: "/manuscripts",
        userRole: "Admin"
      }
    );
  }

  /**
   * Notify admin about completed reviews
   */
  static async notifyReviewCompleted(manuscriptId, manuscriptTitle, reviewerId, adminIds) {
    const reviewerName = await this.getUserDisplayName(reviewerId);
    
    const message = `${reviewerName} has completed their review for "${manuscriptTitle}"`;
    
    await this.createBulkNotifications(
      adminIds,
      "review_completed",
      "Review Completed",
      message,
      { 
        manuscriptId, 
        manuscriptTitle, 
        reviewerId,
        actionUrl: "/manuscripts",
        userRole: "Admin"
      }
    );
  }

  /**
   * Notify about deadline reminders
   */
  static async notifyDeadlineReminder(userIds, type, title, message, metadata = {}) {
    await this.createBulkNotifications(
      userIds,
      "deadline_reminder",
      title,
      message,
      { 
        ...metadata,
        actionUrl: metadata.actionUrl || "/admin/deadlines" // Default to deadlines page for admins
      }
    );
  }

  /**
   * Get all admin user IDs
   */
  static async getAdminUserIds() {
    try {
      const usersRef = collection(db, "Users");
      const querySnapshot = await getDocs(query(usersRef, where("role", "==", "Admin")));
      return querySnapshot.docs.map(doc => doc.id);
    } catch (error) {
      console.error("Error fetching admin users:", error);
      return [];
    }
  }
}

export default NotificationService;
