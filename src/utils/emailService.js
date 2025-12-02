import { httpsCallable } from "firebase/functions";

class EmailService {
  constructor(functions) {
    this.functions = functions;
  }

  async sendReviewerInvitation(emailData) {
    try {
      // Create a reference to the callable function
      const sendEmail = httpsCallable(this.functions, 'sendReviewerInvitationEmail');
      
      // Call the function with the email data
      const result = await sendEmail({
        reviewerEmail: emailData.reviewerEmail,
        reviewerName: emailData.reviewerName,
        manuscriptTitle: emailData.manuscriptTitle,
        deadlineDate: emailData.deadlineDate,
        manuscriptId: emailData.manuscriptId,
        adminName: emailData.adminName
      });
      
      return result.data;
    } catch (error) {
      console.error("Error in sendReviewerInvitation:", {
        error,
        message: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  async sendNotification(emailData) {
    try {
      const sendEmail = httpsCallable(this.functions, 'sendNotificationEmail');
      const result = await sendEmail({
        to: emailData.to,
        subject: emailData.subject,
        htmlBody: emailData.htmlBody,
        textBody: emailData.textBody
      });
      return result.data;
    } catch (error) {
      console.error("Error in sendNotification:", {
        error,
        message: error.message,
        stack: error.stack
      });
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
