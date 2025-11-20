import { getFunctions, httpsCallable } from "firebase/functions";

/**
 * Email utility functions for the frontend
 */
class EmailService {
  constructor() {
    this.functions = getFunctions();
  }

  /**
   * Send reviewer invitation email
   * @param {Object} emailData - Email data object
   * @param {string} emailData.reviewerEmail - Reviewer's email address
   * @param {string} emailData.reviewerName - Reviewer's full name
   * @param {string} emailData.manuscriptTitle - Manuscript title
   * @param {string} emailData.deadlineDate - Formatted deadline date
   * @param {string} emailData.manuscriptId - Manuscript ID
   * @param {string} emailData.adminName - Admin's name
   * @returns {Promise<Object>} - Result of email send operation
   */
  async sendReviewerInvitation(emailData) {
    try {
      const sendReviewerInvitationEmail = httpsCallable(
        this.functions,
        "sendReviewerInvitationEmail"
      );
      const result = await sendReviewerInvitationEmail(emailData);
      return result.data;
    } catch (error) {
      console.error("Error sending reviewer invitation email:", error);
      throw error;
    }
  }

  /**
   * Send general notification email
   * @param {Object} emailData - Email data object
   * @param {string} emailData.to - Recipient email
   * @param {string} emailData.subject - Email subject
   * @param {string} emailData.htmlBody - HTML email body
   * @param {string} emailData.textBody - Plain text email body (optional)
   * @returns {Promise<Object>} - Result of email send operation
   */
  async sendNotification(emailData) {
    try {
      const sendNotificationEmail = httpsCallable(
        this.functions,
        "sendNotificationEmail"
      );
      const result = await sendNotificationEmail(emailData);
      return result.data;
    } catch (error) {
      console.error("Error sending notification email:", error);
      throw error;
    }
  }

  /**
   * Format deadline date for email
   * @param {Date} date - Date object
   * @returns {string} - Formatted date string
   */
  static formatDeadlineDate(date) {
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }

  /**
   * Validate email data before sending
   * @param {Object} emailData - Email data to validate
   * @returns {boolean} - True if valid
   */
  static validateEmailData(emailData) {
    const required = [
      "reviewerEmail",
      "reviewerName",
      "manuscriptTitle",
      "deadlineDate",
      "manuscriptId",
    ];
    return required.every(
      (field) => emailData[field] && emailData[field].trim() !== ""
    );
  }

  /**
   * Create reviewer invitation email data object
   * @param {Object} reviewer - Reviewer object
   * @param {Object} manuscript - Manuscript object
   * @param {Date} deadlineDate - Deadline date
   * @param {Object} admin - Admin user object
   * @returns {Object} - Email data object
   */
  static createInvitationData(reviewer, manuscript, deadlineDate, admin) {
    return {
      reviewerEmail: reviewer.email,
      reviewerName: `${reviewer.firstName} ${reviewer.lastName}`,
      manuscriptTitle: manuscript.title || "Untitled Manuscript",
      deadlineDate: this.formatDeadlineDate(deadlineDate),
      manuscriptId: manuscript.id,
      adminName: admin?.displayName || admin?.email || "Admin",
    };
  }
}

export default EmailService;
