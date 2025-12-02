const nodemailer = require("nodemailer");
const axios = require("axios");
const functions = require("firebase-functions");
require("dotenv").config();

// ----------------------
// ----------------------
// SMTP Transport Setup
// ----------------------

const smtpTransporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || functions.config().smtp.host,
  port: Number(process.env.SMTP_PORT || functions.config().smtp.port),
  secure: false,
  auth: {
    user: process.env.SMTP_USER || functions.config().smtp.user,
    pass: process.env.SMTP_PASS || functions.config().smtp.pass,
  },
});

// ----------------------
// EmailServiceBackend
// ----------------------
const EmailServiceBackend = {
  /**
   * Send reviewer invitation
   */
  async sendReviewerInvitation({
    reviewerEmail,
    reviewerName,
    manuscriptTitle,
    deadlineDate,
    manuscriptId,
    adminName,
  }) {
    const subject = `Invitation to review: ${manuscriptTitle}`;
    const reviewLink = `https://pubtrack.vercel.app/reviewer-invitations`;
    const htmlBody = `
      <p>Hi ${reviewerName},</p>
      <p>You have been invited by ${adminName} to review the manuscript titled:</p>
      <p><strong>${manuscriptTitle}</strong></p>
      <p>Deadline: ${deadlineDate}</p>
      <p><a href="${reviewLink}">Click here to review</a></p>
      <p>Thank you!</p>
    `;

    // Try Resend API first
    try {
      const response = await axios.post(
        "https://api.resend.com/emails",
        {
          from: process.env.SMTP_FROM,
          to: reviewerEmail,
          subject,
          html: htmlBody,
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
        }
      );
      return { messageId: response.data.id || "resend-success" };
    } catch (err) {
      console.warn("Resend failed, falling back to SMTP:", err.message);

      // Fallback to SMTP
      const info = await smtpTransporter.sendMail({
        from: process.env.SMTP_FROM,
        to: reviewerEmail,
        subject,
        html: htmlBody,
      });
      return { messageId: info.messageId };
    }
  },

  /**
   * Send general notification email
   */
  async sendNotification({ to, subject, htmlBody, textBody }) {
    try {
      const response = await axios.post(
        "https://api.resend.com/emails",
        {
          from: process.env.SMTP_FROM,
          to,
          subject,
          html: htmlBody,
          text: textBody,
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
        }
      );
      return { messageId: response.data.id || "resend-success" };
    } catch (err) {
      console.warn("Resend failed, falling back to SMTP:", err.message);

      const info = await smtpTransporter.sendMail({
        from: process.env.SMTP_FROM,
        to,
        subject,
        html: htmlBody,
        text: textBody,
      });
      return { messageId: info.messageId };
    }
  },
};

module.exports = EmailServiceBackend;
