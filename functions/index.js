// Import the required modules
const { onRequest } = require("firebase-functions/v2/https");
const { onCall } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { Storage } = require("@google-cloud/storage");
const storage = new Storage();
const logger = require("firebase-functions/logger");

// Initialize Firebase Admin SDK (safe check for multiple initializations)
if (!admin.apps.length) {
  admin.initializeApp();
}

// ========================================================
// File Upload Function
// ========================================================
exports.uploadFile = onRequest((req, res) => {
  // Allow CORS for preflight requests
  if (req.method === "OPTIONS") {
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE");
    res.set("Access-Control-Allow-Headers", "Content-Type");
    return res.status(204).send("");
  }

  // Check if the file is present in the request body
  const file = req.body.file;
  if (!file) {
    return res.status(400).send("No file provided.");
  }

  const bucket = storage.bucket("your-bucket-name"); // 🔹 Replace with your Firebase Storage bucket name
  const fileUpload = bucket.file(`profilePics/${file.name}`); // Save to 'profilePics' folder

  // Create a write stream for the file upload
  const stream = fileUpload.createWriteStream();

  // Handle successful upload
  stream.on("finish", () => {
    logger.info("File uploaded successfully");
    res.status(200).send({
      message: "File uploaded successfully",
      url: `https://storage.googleapis.com/${bucket.name}/profilePics/${file.name}`,
    });
  });

  // Handle errors during file upload
  stream.on("error", (err) => {
    logger.error("Error uploading file", err);
    res.status(500).send("Error uploading file");
  });

  // End the stream by sending the file data
  stream.end(file.data);
});

// ========================================================
// Secure Delete User Function
// ========================================================
exports.deleteUserAccount = onCall(async (request) => {
  const context = request.auth;
  if (!context) {
    throw new functions.https.HttpsError("unauthenticated", "Not signed in");
  }

  const requesterUid = context.uid;

  // Get requester's role from Firestore
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
    // Delete from Firebase Authentication
    await admin.auth().deleteUser(uid);

    // Delete Firestore document
    await admin.firestore().collection("Users").doc(uid).delete();

    return { success: true, message: "User deleted successfully" };
  } catch (error) {
    logger.error("Error deleting user", error);
    throw new functions.https.HttpsError("internal", error.message);
  }
});
