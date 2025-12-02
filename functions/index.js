// index.js (clean, no virus scan)
const { onRequest, onCall } = require("firebase-functions/v2/https");
const { onObjectFinalized } = require("firebase-functions/v2/storage");
const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { Storage } = require("@google-cloud/storage");
const storage = new Storage();
const logger = require("firebase-functions/logger");
const tmp = require("tmp");
const fs = require("fs");

// In functions/index.js
const { notifyAdmins, createBulkNotifications } = require('./src/notificationService');
const EmailServiceBackend = require("./emailService"); // backend Resend EmailService



// Set global options
const { setGlobalOptions } = require('firebase-functions/v2');
setGlobalOptions({ 
  region: 'asia-east2',
  maxInstances: 10
});

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const MONTH_LIMIT = 3;

function getMonthKey(date = new Date()) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}


// ----------------------
// HTTP Upload Function
// ----------------------
exports.uploadFile = onRequest(async (req, res) => {
  if (req.method === "OPTIONS") {
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE");
    res.set("Access-Control-Allow-Headers", "Content-Type");
    return res.status(204).send("");
  }

  const file = req.body.file;
  if (!file) return res.status(400).send({ message: "No file provided." });

  const tmpFile = tmp.fileSync();
  fs.writeFileSync(tmpFile.name, file.data);

  try {
    const bucket = storage.bucket("pubtrack2.firebasestorage.app");
    const storagePath = `profilePics/${Date.now()}_${file.name.replace(
      /[^\w\d.-]/g,
      "_"
    )}`;
    const fileUpload = bucket.file(storagePath);
    await fileUpload.save(file.data);

    const downloadURL = `https://storage.googleapis.com/${bucket.name}/${storagePath}`;
    logger.info("File uploaded successfully");

    return res.status(200).send({ url: downloadURL, storagePath });
  } catch (err) {
    logger.error("Error uploading file:", err);
    return res.status(500).send({ message: "Failed to upload file" });
  } finally {
    tmpFile.removeCallback();
  }
});

// ----------------------
// Delete User Account
// ----------------------
exports.deleteUserAccount = onCall(async (request) => {
  const context = request.auth;
  if (!context)
    throw new functions.https.HttpsError("unauthenticated", "Not signed in");

  const requesterUid = context.uid;
  const userDoc = await admin
    .firestore()
    .collection("Users")
    .doc(requesterUid)
    .get();

  if (!userDoc.exists || userDoc.data().role !== "Admin") {
    throw new functions.https.HttpsError(
      "permission-denied",
      "Only admins can delete users."
    );
  }

  const { uid } = request.data;

  try {
    await admin.auth().deleteUser(uid);
    await admin.firestore().collection("Users").doc(uid).delete();
    return { success: true, message: "User deleted successfully" };
  } catch (error) {
    logger.error("Error deleting user", error);
    throw new functions.https.HttpsError("internal", error.message);
  }
});

// ----------------------
// Manuscript Submission Limit
// ----------------------
// ----------------------
// Manuscript Submission Limit
// ----------------------
exports.createManuscript = onCall(async (data, context) => {
  if (!context.auth || !context.auth.uid) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "Please sign in first."
    );
  }

  const uid = context.auth.uid;
  const manuscriptData = data?.manuscript;
  if (!manuscriptData) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Missing manuscript data."
    );
  }

  const userSnap = await db.collection("Users").doc(uid).get();
  if (!userSnap.exists) {
    throw new functions.https.HttpsError("not-found", "User not found.");
  }
  const userRole = userSnap.data().role || "Researcher";

  const now = admin.firestore.Timestamp.now();
  const monthKey = getMonthKey(new Date()); // UTC month key
  const counterRef = db.doc(`submissionCounters/${uid}_${monthKey}`);
  const manuscriptsRef = db.collection("manuscripts");

  // Determine monthly limit
  const MONTH_LIMIT = userRole === "Researcher" ? 6 : Infinity;

  try {
    const result = await db.runTransaction(async (tx) => {
      const snap = await tx.get(counterRef);
      let count = snap.exists ? snap.data().count || 0 : 0;

      if (count >= MONTH_LIMIT) {
        throw new functions.https.HttpsError(
          "failed-precondition",
          `You have reached your monthly limit of ${MONTH_LIMIT} manuscript submissions.`
        );
      }

      tx.set(
        counterRef,
        { uid, month: monthKey, count: count + 1, lastUpdatedAt: now },
        { merge: true }
      );

      const newDoc = manuscriptsRef.doc();
      tx.set(newDoc, {
        ...manuscriptData,
        ownerId: uid,
        role: userRole,
        createdAt: now,
        monthKey,
        createdVia: "cloud-function",
      });

      return { manuscriptId: newDoc.id, newCount: count + 1 };
    });

    return { success: true, ...result };
  } catch (err) {
    console.error("createManuscript error:", err);
    if (err instanceof functions.https.HttpsError) throw err;
    throw new functions.https.HttpsError(
      "internal",
      "Failed to create manuscript."
    );
  }
});

// ----------------------
// Email Service Functions
// ----------------------

/**
 * Send reviewer invitation email
 *//**
 * Send reviewer invitation email
 */
exports.sendReviewerInvitationEmail = onCall(
  {
    region: "asia-east2",
    enforceAppCheck: false, // Set to true if using App Check
    cors: true
  },
  async (request) => {
    const context = request.auth;
    if (!context) {
      throw new functions.https.HttpsError("unauthenticated", "Not signed in");
    }

    try {
      const {
        reviewerEmail,
        reviewerName,
        manuscriptTitle,
        deadlineDate,
        manuscriptId,
        adminName
      } = request.data;

      // Input validation
      if (!reviewerEmail || !reviewerName || !manuscriptTitle || !deadlineDate || !manuscriptId) {
        throw new functions.https.HttpsError(
          "invalid-argument",
          "Missing required fields: reviewerEmail, reviewerName, manuscriptTitle, deadlineDate, and manuscriptId are required"
        );
      }

      // Send the email using the EmailServiceBackend
      const result = await EmailServiceBackend.sendReviewerInvitation({
        reviewerEmail,
        reviewerName,
        manuscriptTitle,
        deadlineDate,
        manuscriptId,
        adminName: adminName || 'Admin'
      });

      logger.info(`Reviewer invitation email sent successfully to ${reviewerEmail}`);

      return {
        success: true,
        messageId: result.messageId,
        message: "Invitation email sent successfully",
      };
    } catch (error) {
      logger.error("Error in sendReviewerInvitationEmail:", error);
      throw new functions.https.HttpsError(
        "internal",
        error.message || "Failed to send invitation email"
      );
    }
  }
);

/**
 * Send general notification email
 */
/**
 * Create a notification for a user
 */
exports.createNotification = onCall(async (request) => {
  const context = request.auth;
  if (!context) {
    throw new functions.https.HttpsError("unauthenticated", "Not signed in");
  }

  const { userId, type, title, message, metadata = {} } = request.data;

  // Input validation
  if (!userId || !type || !title || !message) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Missing required fields: userId, type, title, and message are required"
    );
  }

  try {
    const notificationData = {
      type,
      title,
      message,
      recipientId: userId,
      seen: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      ...metadata
    };

    // Add notification to the user's subcollection
    const notificationRef = await admin.firestore()
      .collection('Users')
      .doc(userId)
      .collection('Notifications')
      .add(notificationData);

    logger.info(`Notification created for user ${userId}`);

    return { 
      success: true, 
      notificationId: notificationRef.id,
      message: "Notification created successfully"
    };
  } catch (error) {
    logger.error("Error creating notification:", error);
    throw new functions.https.HttpsError(
      "internal", 
      "Failed to create notification",
      { error: error.message }
    );
  }
});// Export notification functions
// At the very end of the file:
exports.notifyAdmins = notifyAdmins;
exports.createBulkNotifications = createBulkNotifications;