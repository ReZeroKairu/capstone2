import { collection, addDoc, serverTimestamp, doc, getDoc } from "firebase/firestore";
import { db } from "../firebase/firebase";

/**
 * User Activity Logging Service
 * Tracks all user actions for audit and analytics
 */
export class UserLogService {
  
  /**
   * Create a user activity log entry
   * @param {string} userId - User ID who performed the action
   * @param {string} action - Action type (login, submit_manuscript, etc.)
   * @param {string} description - Human-readable description
   * @param {Object} metadata - Additional data about the action
   * @param {string} ipAddress - User's IP address (optional)
   */
  static async logUserActivity(userId, action, description, metadata = {}, ipAddress = null) {
    try {
      // Get user info for the log
      const userInfo = await this.getUserInfo(userId);
      
      const logData = {
        userId,
        userEmail: userInfo.email,
        userFullName: userInfo.fullName,
        userRole: userInfo.role,
        action,
        description,
        metadata: {
          ...metadata,
          timestamp: new Date().toISOString(),
          userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
          ipAddress
        },
        timestamp: serverTimestamp(),
        createdAt: new Date()
      };

      const logsRef = collection(db, "UserLogs");
      const logRef = await addDoc(logsRef, logData);
      
      console.log(`User activity logged: ${action} by ${userInfo.email}`);
      return logRef.id;
    } catch (error) {
      console.error("Error logging user activity:", error);
    }
  }

  /**
   * Get user information for logging
   */
  static async getUserInfo(userId) {
    try {
      const userDoc = await getDoc(doc(db, "Users", userId));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        return {
          email: userData.email || "Unknown",
          fullName: `${userData.firstName || ""} ${userData.middleName || ""} ${userData.lastName || ""}`.trim() || "Unknown User",
          role: userData.role || "User"
        };
      }
      return { email: "Unknown", fullName: "Unknown User", role: "User" };
    } catch (error) {
      console.error("Error fetching user info for logging:", error);
      return { email: "Unknown", fullName: "Unknown User", role: "User" };
    }
  }

  // === AUTHENTICATION LOGS ===
  
  static async logLogin(userId, loginMethod = "email") {
    return this.logUserActivity(
      userId,
      "user_login",
      "User logged in",
      { loginMethod }
    );
  }

  static async logLogout(userId) {
    return this.logUserActivity(
      userId,
      "user_logout",
      "User logged out"
    );
  }

  static async logRegistration(userId, registrationMethod = "email") {
    return this.logUserActivity(
      userId,
      "user_registration",
      "New user registered",
      { registrationMethod }
    );
  }

  // === MANUSCRIPT LOGS ===
  
  static async logManuscriptSubmission(userId, manuscriptId, manuscriptTitle) {
    return this.logUserActivity(
      userId,
      "manuscript_submitted",
      `Submitted manuscript: "${manuscriptTitle}"`,
      { 
        manuscriptId, 
        manuscriptTitle,
        actionType: "submission"
      }
    );
  }

  static async logManuscriptStatusChange(userId, manuscriptId, manuscriptTitle, oldStatus, newStatus, changedBy) {
    return this.logUserActivity(
      userId,
      "manuscript_status_changed",
      `Manuscript "${manuscriptTitle}" status changed from "${oldStatus}" to "${newStatus}"`,
      { 
        manuscriptId, 
        manuscriptTitle, 
        oldStatus, 
        newStatus,
        changedBy,
        actionType: "status_change"
      }
    );
  }

  static async logManuscriptReview(userId, manuscriptId, manuscriptTitle, decision) {
    return this.logUserActivity(
      userId,
      "manuscript_reviewed",
      `Reviewed manuscript: "${manuscriptTitle}" - Decision: ${decision}`,
      { 
        manuscriptId, 
        manuscriptTitle, 
        decision,
        actionType: "review"
      }
    );
  }

  static async logReviewerAssignment(adminId, manuscriptId, manuscriptTitle, reviewerIds) {
    return this.logUserActivity(
      adminId,
      "reviewer_assigned",
      `Assigned ${reviewerIds.length} reviewer(s) to manuscript: "${manuscriptTitle}"`,
      { 
        manuscriptId, 
        manuscriptTitle, 
        reviewerIds,
        reviewerCount: reviewerIds.length,
        actionType: "assignment"
      }
    );
  }

  // === USER MANAGEMENT LOGS ===
  
  static async logUserRoleChange(adminId, targetUserId, oldRole, newRole) {
    const targetUserInfo = await this.getUserInfo(targetUserId);
    return this.logUserActivity(
      adminId,
      "user_role_changed",
      `Changed user role for ${targetUserInfo.fullName} (${targetUserInfo.email}) from "${oldRole}" to "${newRole}"`,
      { 
        targetUserId, 
        targetUserEmail: targetUserInfo.email,
        targetUserName: targetUserInfo.fullName,
        oldRole, 
        newRole,
        actionType: "role_change"
      }
    );
  }

  static async logUserProfileUpdate(userId, updatedFields) {
    return this.logUserActivity(
      userId,
      "profile_updated",
      `Updated profile fields: ${Object.keys(updatedFields).join(", ")}`,
      { 
        updatedFields,
        fieldCount: Object.keys(updatedFields).length,
        actionType: "profile_update"
      }
    );
  }

  static async logUserDeactivation(adminId, targetUserId, reason) {
    const targetUserInfo = await this.getUserInfo(targetUserId);
    return this.logUserActivity(
      adminId,
      "user_deactivated",
      `Deactivated user: ${targetUserInfo.fullName} (${targetUserInfo.email}) - Reason: ${reason}`,
      { 
        targetUserId, 
        targetUserEmail: targetUserInfo.email,
        targetUserName: targetUserInfo.fullName,
        reason,
        actionType: "deactivation"
      }
    );
  }

  // === SYSTEM LOGS ===
  
  static async logFormCreation(userId, formId, formTitle) {
    return this.logUserActivity(
      userId,
      "form_created",
      `Created new form: "${formTitle}"`,
      { 
        formId, 
        formTitle,
        actionType: "form_creation"
      }
    );
  }

  static async logFormResponse(userId, formId, responseId, formTitle) {
    return this.logUserActivity(
      userId,
      "form_response_submitted",
      `Submitted response to form: "${formTitle}"`,
      { 
        formId, 
        responseId,
        formTitle,
        actionType: "form_response"
      }
    );
  }

  static async logNotificationAction(userId, notificationId, action, notificationType) {
    return this.logUserActivity(
      userId,
      "notification_action",
      `${action} notification of type: ${notificationType}`,
      { 
        notificationId, 
        notificationType,
        notificationAction: action,
        actionType: "notification"
      }
    );
  }

  // === SECURITY LOGS ===
  
  static async logSecurityEvent(userId, eventType, description, severity = "medium") {
    return this.logUserActivity(
      userId,
      "security_event",
      `Security event: ${description}`,
      { 
        eventType, 
        severity,
        actionType: "security"
      }
    );
  }

  static async logFailedLogin(email, reason, ipAddress) {
    return this.logUserActivity(
      "anonymous",
      "failed_login",
      `Failed login attempt for email: ${email} - Reason: ${reason}`,
      { 
        email, 
        reason,
        ipAddress,
        actionType: "security"
      }
    );
  }

  // === BULK LOGGING ===
  
  static async logBulkAction(userId, action, description, affectedItems) {
    return this.logUserActivity(
      userId,
      "bulk_action",
      `${description} - Affected ${affectedItems.length} items`,
      { 
        bulkAction: action,
        affectedItems,
        itemCount: affectedItems.length,
        actionType: "bulk"
      }
    );
  }

  // === ANALYTICS HELPERS ===
  
  static async logPageView(userId, pagePath, pageTitle) {
    return this.logUserActivity(
      userId,
      "page_view",
      `Viewed page: ${pageTitle || pagePath}`,
      { 
        pagePath, 
        pageTitle,
        actionType: "navigation"
      }
    );
  }

  static async logFeatureUsage(userId, featureName, featureData = {}) {
    return this.logUserActivity(
      userId,
      "feature_usage",
      `Used feature: ${featureName}`,
      { 
        featureName,
        featureData,
        actionType: "feature"
      }
    );
  }
}
