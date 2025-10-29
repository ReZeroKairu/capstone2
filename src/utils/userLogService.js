import {
  collection,
  addDoc,
  serverTimestamp,
  doc,
  getDoc,
} from "firebase/firestore";
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
  static async logUserActivity(
    userId,
    action,
    description,
    metadata = {},
    email = null,
    ipAddress = null
  ) {
    try {
      // Get user info for the log
      const userInfo = await this.getUserInfo(userId);

      // Use provided email or fall back to userInfo
      const userEmail = email || userInfo.email;

      const logData = {
        userId,
        userEmail,
        userFullName: userInfo.fullName,
        userRole: userInfo.role,
        action,
        description,
        metadata: {
          ...metadata,
          timestamp: new Date().toISOString(),
          userAgent:
            typeof navigator !== "undefined" ? navigator.userAgent : null,
          ipAddress,
        },
        timestamp: serverTimestamp(),
        createdAt: new Date(),
      };

      const logsRef = collection(db, "UserLog");
      const logRef = await addDoc(logsRef, logData);
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
          fullName:
            `${userData.firstName || ""} ${userData.middleName || ""} ${
              userData.lastName || ""
            }`.trim() || "Unknown User",
          role: userData.role || "User",
        };
      }
      return { email: "Unknown", fullName: "Unknown User", role: "User" };
    } catch (error) {
      console.error("Error fetching user info for logging:", error);
      return { email: "Unknown", fullName: "Unknown User", role: "User" };
    }
  }

  // === AUTHENTICATION LOGS ===

  static async logUserLogin(userId, email, method = "email") {
    const safeEmail = email || (await this.getUserEmail(userId)) || "Unknown";
    return this.logUserActivity(
      userId,
      "User Signed In",
      `User signed in via ${method}`,
      {
        loginMethod: method,
        actionType: "authentication",
        email: safeEmail, // Ensure email is in metadata
      },
      safeEmail // Also pass as separate parameter
    );
  }

  static async logUserLogout(userId, email) {
    const safeEmail = email || (await this.getUserEmail(userId)) || "Unknown";
    return this.logUserActivity(
      userId,
      "User Signed Out",
      "User signed out",
      {
        actionType: "authentication",
        email: safeEmail, // Ensure email is in metadata
      },
      safeEmail // Also pass as separate parameter
    );
  }

  static async logLoginFailure(email, reason, method = "email") {
    const safeEmail = email || "Unknown";
    return this.logUserActivity(
      "anonymous",
      "Login Failed",
      `Failed login attempt via ${method}: ${reason}`,
      {
        email: safeEmail,
        loginMethod: method,
        reason,
        actionType: "authentication",
        severity: "warning",
      },
      safeEmail
    );
  }

  static async logRegistration(userId, registrationMethod = "email") {
    try {
      const safeEmail = (await this.getUserEmail(userId)) || "New User";
      return this.logUserActivity(
        userId,
        "User Registered",
        `User registered via ${registrationMethod}`,
        {
          registrationMethod,
          actionType: "authentication",
          email: safeEmail,
        },
        safeEmail
      );
    } catch (error) {
      console.error("Error in logRegistration:", error);
      return this.logUserActivity(
        userId,
        "User Registered",
        `User registered via ${registrationMethod}`,
        {
          registrationMethod,
          actionType: "authentication",
          error: "Failed to fetch user email",
          errorDetails: error.message,
        }
      );
    }
  }

  // === MANUSCRIPT LOGS ===

  static async logManuscriptSubmission(
    userId,
    manuscriptId,
    manuscriptTitle,
    userEmail = null
  ) {
    try {
      const safeEmail =
        userEmail || (await this.getUserEmail(userId)) || "Unknown";

      return this.logUserActivity(
        userId,
        "Manuscript Submitted",
        `Submitted manuscript: ${manuscriptTitle}`,
        {
          manuscriptId,
          manuscriptTitle,
          actionType: "submission",
          category: "manuscript",
          email: safeEmail, // Ensure email is in metadata
        },
        safeEmail
      );
    } catch (error) {
      console.error("Error in logManuscriptSubmission:", error);
      return this.logUserActivity(
        userId,
        "Sub",
        `Submitted manuscript: ${manuscriptTitle}`,
        {
          manuscriptId,
          manuscriptTitle,
          actionType: "submission",
          category: "manuscript",
          error: "Failed to fetch user email",
          errorDetails: error.message,
        }
      );
    }
  }

  static async logManuscriptReview(
    userId,
    manuscriptId,
    manuscriptTitle,
    decision
  ) {
    try {
      const safeEmail = (await this.getUserEmail(userId)) || "Unknown";

      return this.logUserActivity(
        userId,
        "Manuscript Reviewed",
        `Decision: ${decision}`,
        {
          manuscriptId,
          manuscriptTitle,
          decision,
          actionType: "review",
          category: "manuscript",
          severity: decision.toLowerCase().includes("reject")
            ? "warning"
            : "info",
          email: safeEmail, // Ensure email is in metadata
        },
        safeEmail
      );
    } catch (error) {
      console.error("Error in logManuscriptReview:", error);
      return this.logUserActivity(
        userId,
        "Manuscript Reviewed",
        `Decision: ${decision}`,
        {
          manuscriptId,
          manuscriptTitle,
          decision,
          actionType: "review",
          category: "manuscript",
          severity: decision.toLowerCase().includes("reject")
            ? "warning"
            : "info",
          error: "Failed to fetch user email",
          errorDetails: error.message,
        }
      );
    }
  }

  static async logReviewerAssignment(
    adminId,
    manuscriptId,
    manuscriptTitle,
    reviewerIds
  ) {
    const safeEmail = await this.getUserEmail(adminId);

    return this.logUserActivity(
      adminId,
      "Reviewers Assigned",
      `Assigned ${reviewerIds.length} reviewer(s) to manuscript`,
      {
        manuscriptId,
        manuscriptTitle,
        reviewerCount: reviewerIds.length,
        actionType: "assignment",
        category: "review",
      },
      safeEmail
    );
  }

  // === USER MANAGEMENT LOGS ===

  static async logUserProfileUpdate(userId, updatedFields) {
    try {
      const safeEmail = (await this.getUserEmail(userId)) || "Unknown";

      return this.logUserActivity(
        userId,
        "Profile Updated",
        "User updated their profile information",
        {
          ...updatedFields, // Include all updated fields in metadata
          actionType: "profile_update",
          email: safeEmail, // Also include email in metadata for consistency
        },
        safeEmail // Pass email as separate parameter
      );
    } catch (error) {
      console.error("Error in logUserProfileUpdate:", error);
      // Fallback to basic logging if there's an error getting email
      return this.logUserActivity(
        userId,
        "Profile Updated",
        "User updated their profile information",
        {
          ...updatedFields,
          actionType: "profile_update",
          error: "Failed to fetch user email",
          errorDetails: error.message,
        }
      );
    }
  }

  static async logUserRoleChange(adminId, targetUserId, oldRole, newRole) {
    const [adminEmail, targetEmail] = await Promise.all([
      this.getUserEmail(adminId),
      this.getUserEmail(targetUserId),
    ]);

    return this.logUserActivity(
      adminId,
      "User Role Updated",
      `Changed role from ${oldRole} to ${newRole}`,
      {
        targetUserId,
        targetEmail,
        oldRole,
        newRole,
        actionType: "user_management",
        category: "user",
        severity: "high",
      },
      adminEmail
    );
  }

  static async logUserDeactivation(adminId, targetUserId, reason) {
    const [adminEmail, targetEmail] = await Promise.all([
      this.getUserEmail(adminId),
      this.getUserEmail(targetUserId),
    ]);

    return this.logUserActivity(
      adminId,
      "User Deactivated",
      `Deactivated user: ${targetEmail} - Reason: ${reason}`,
      {
        targetUserId,
        targetEmail,
        reason,
        actionType: "user_management",
        category: "user",
        severity: "high",
      },
      adminEmail
    );
  }

  // === SYSTEM LOGS ===

  static async logFormCreation(userId, formId, formTitle) {
    try {
      const safeEmail = (await this.getUserEmail(userId)) || "Unknown";
      return this.logUserActivity(
        userId,
        "Form Created",
        `Created new form: ${formTitle}`,
        {
          formId,
          formTitle,
          actionType: "form_creation",
          category: "system",
          email: safeEmail,
        },
        safeEmail
      );
    } catch (error) {
      console.error("Error in logFormCreation:", error);
      return this.logUserActivity(
        userId,
        "Form Created",
        `Created new form: ${formTitle}`,
        {
          formId,
          formTitle,
          actionType: "form_creation",
          category: "system",
          error: "Failed to fetch user email",
          errorDetails: error.message,
        }
      );
    }
  }

  static async logFormResponse(userId, formId, responseId, formTitle) {
    try {
      const safeEmail = (await this.getUserEmail(userId)) || "Unknown";
      return this.logUserActivity(
        userId,
        "Form Response Submitted",
        `Submitted response to form: "${formTitle}"`,
        {
          formId,
          responseId,
          formTitle,
          actionType: "form_response",
          category: "system",
          email: safeEmail,
        },
        safeEmail
      );
    } catch (error) {
      console.error("Error in logFormResponse:", error);
      return this.logUserActivity(
        userId,
        "Form Response Submitted",
        `Submitted response to form: "${formTitle}"`,
        {
          formId,
          responseId,
          formTitle,
          actionType: "form_response",
          category: "system",
          error: "Failed to fetch user email",
          errorDetails: error.message,
        }
      );
    }
  }

  static async logNotificationAction(
    userId,
    notificationId,
    action,
    notificationType
  ) {
    return this.logUserActivity(
      userId,
      "notification_action",
      `${action} notification of type: ${notificationType}`,
      {
        notificationId,
        notificationType,
        notificationAction: action,
        actionType: "notification",
      }
    );
  }

  // === HELPER METHODS ===

  static async getUserEmail(userId) {
    if (!userId || userId === "anonymous") return "Unknown";

    try {
      const userDoc = await getDoc(doc(db, "Users", userId));
      if (userDoc.exists()) {
        return userDoc.data().email || "Unknown";
      }
      return "Unknown";
    } catch (error) {
      console.error("Error fetching user email:", error);
      return "Unknown";
    }
  }

  // === SECURITY LOGS ===

  static async logSecurityEvent(
    userId,
    eventType,
    description,
    severity = "medium"
  ) {
    const safeEmail = await this.getUserEmail(userId);

    return this.logUserActivity(
      userId,
      "Security Event",
      description,
      {
        eventType,
        severity,
        actionType: "security",
        category: "system",
      },
      safeEmail
    );
  }

  static async logFailedLogin(email, reason, ipAddress) {
    // Ensure email is not null or undefined
    const safeEmail = email || "Unknown";

    return this.logUserActivity(
      "anonymous",
      "failed_login",
      `Failed login attempt for email: ${safeEmail} - Reason: ${reason}`,
      {
        email: safeEmail,
        reason,
        ipAddress: ipAddress || "Not available",
        actionType: "security",
      },
      safeEmail // Pass email as the 5th parameter to ensure it's stored in userEmail
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
        actionType: "bulk",
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
        actionType: "navigation",
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
        actionType: "feature",
      }
    );
  }
}

export default UserLogService;
