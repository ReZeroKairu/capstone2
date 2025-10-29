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
  static async createNotification(userId, type, title, message, metadata = {}) {
    try {
      if (!userId) {
        console.error("Cannot create notification: userId is required");
        return null;
      }

      const notificationData = {
        type,
        title,
        message,
        seen: false,
        timestamp: serverTimestamp(),
        metadata: {
          ...metadata,
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

    const promises = userIds.map((userId) =>
      this.createNotification(userId, type, title, message, metadata)
    );

    try {
      await Promise.all(promises);
      console.log(`Bulk notifications created for ${userIds.length} users`);
    } catch (error) {
      console.error("Error creating bulk notifications:", error);
    }
  }

  static async getUserDisplayName(userId) {
    try {
      const userDoc = await getDoc(doc(db, "Users", userId));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        return (
          `${userData.firstName || ""} ${userData.lastName || ""}`.trim() ||
          userData.email ||
          "Unknown User"
        );
      }
      return "Unknown User";
    } catch (error) {
      console.error("Error fetching user display name:", error);
      return "Unknown User";
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
    isResubmission = false // ✅ Added default value to fix reference error
  ) {
    const statusMessages = {
      Pending: "Your manuscript has been submitted and is pending review.",
    };

    const notificationType = isResubmission
      ? "Manuscript Resubmission"
      : "Manuscript Status Update";

    let title, message;

    if (isResubmission) {
      title = `Manuscript Resubmitted: ${manuscriptTitle}`;
      message = `Manuscript "${manuscriptTitle}" has been resubmitted for review.`;
    } else {
      title = `Manuscript ${statusMessages[newStatus] || `Status: ${newStatus}`}`;
      message = `Manuscript "${manuscriptTitle}" ${
        statusMessages[newStatus] || `status changed to ${newStatus}`
      }.`;
    }

    // Notify author
    await this.createNotification(authorId, notificationType, title, message, {
      manuscriptId,
      manuscriptTitle,
      oldStatus,
      newStatus,
      isResubmission,
      actionUrl: `/manuscripts/${manuscriptId}`,
    });

    // Notify admins
    const adminIds = await this.getAdminUserIds();
    await this.createBulkNotifications(
      adminIds,
      notificationType,
      title,
      message,
      {
        manuscriptId,
        manuscriptTitle,
        oldStatus,
        newStatus,
        isResubmission,
        actionUrl: `/manuscripts/${manuscriptId}`,
      }
    );

    // ✅ Removed stray parenthesis and properly wrapped the admin notification logic
    if (newStatus === "Finalized") {
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
          userRole: "Admin",
        }
      );
    }

    // Notify reviewers when manuscript is sent for revision
    if (
      (newStatus === "For Revision (Minor)" ||
        newStatus === "For Revision (Major)") &&
      reviewerIds &&
      reviewerIds.length > 0
    ) {
      const revisionType = newStatus.includes("Minor") ? "minor" : "major";
      const reviewerMessage = `The manuscript "${manuscriptTitle}" you reviewed has been sent for ${revisionType} revisions.`;
      await this.createBulkNotifications(
        reviewerIds,
        "manuscript_revision",
        `Manuscript Requires ${
          revisionType.charAt(0).toUpperCase() + revisionType.slice(1)
        } Revisions: ${manuscriptTitle}`,
        reviewerMessage,
        {
          manuscriptId,
          manuscriptTitle,
          revisionType,
          actionUrl: "/manuscripts",
        }
      );
    }
  }

  static async notifyManuscriptSubmission(
    manuscriptId,
    manuscriptTitle,
    authorId,
    adminIds
  ) {
    const authorName = await this.getUserDisplayName(authorId);
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
        actionUrl: "/formresponses",
        userRole: "Admin",
      }
    );
  }

  static async notifyPeerReviewerAssignment(
    manuscriptId,
    manuscriptTitle,
    reviewerIds,
    assignedByAdminId
  ) {
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

  static async notifyPeerReviewerAccept(
    manuscriptId,
    manuscriptTitle,
    reviewerId,
    adminIds
  ) {
    const reviewerName = await this.getUserDisplayName(reviewerId);
    const message = `${reviewerName} has accepted to review the manuscript "${manuscriptTitle}"`;
    await this.createBulkNotifications(
      adminIds,
      "reviewer_accept",
      "Peer Reviewer Accepted",
      message,
      {
        manuscriptId,
        manuscriptTitle,
        reviewerId,
        actionUrl: "/manuscripts",
        userRole: "Admin",
      }
    );
  }

  static async notifyPeerReviewerDecline(
    manuscriptId,
    manuscriptTitle,
    reviewerId,
    adminIds
  ) {
    const reviewerName = await this.getUserDisplayName(reviewerId);
    const message = `${reviewerName} has declined to review the manuscript "${manuscriptTitle}"`;
    await this.createBulkNotifications(
      adminIds,
      "reviewer_decline",
      "Peer Reviewer Declined",
      message,
      {
        manuscriptId,
        manuscriptTitle,
        reviewerId,
        actionUrl: "/manuscripts",
        userRole: "Admin",
      }
    );
  }

  static async notifyPeerReviewerDecision(
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
        userRole: "Admin",
      }
    );
  }

  // ----------------- Utility -----------------

  static async getAdminUserIds() {
    try {
      const usersRef = collection(db, "Users");
      const querySnapshot = await getDocs(
        query(usersRef, where("role", "==", "Admin"))
      );
      const adminIds = querySnapshot.docs.map((doc) => doc.id);
      return adminIds.length ? adminIds : [];
    } catch (error) {
      console.error("Error fetching admin users:", error);
      return [];
    }
  }
}

export default new NotificationService();
