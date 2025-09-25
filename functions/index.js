// index.js (enhanced uploadFile with immediate ClamAV scan)
const { onRequest, onCall } = require("firebase-functions/v2/https");
const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { Storage } = require("@google-cloud/storage");
const storage = new Storage();
const logger = require("firebase-functions/logger");
const { NodeClam } = require("clamav.js");
const tmp = require("tmp");

// Initialize Firebase Admin safely
if (!admin.apps.length) {
  admin.initializeApp();
}

// Initialize ClamAV scanner
const clam = new NodeClam().init({
  removeInfected: false,
  quarantineInfected: false,
  debugMode: false,
  clamdscan: {
    host: "127.0.0.1",
    port: 3310,
    timeout: 60000,
  },
});

// ========================================================
// HTTP Upload Function (with pre-upload scan)
// ========================================================
exports.uploadFile = onRequest(async (req, res) => {
  if (req.method === "OPTIONS") {
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE");
    res.set("Access-Control-Allow-Headers", "Content-Type");
    return res.status(204).send("");
  }

  const file = req.body.file;
  if (!file) return res.status(400).send("No file provided.");

  // Save to a temporary file to scan
  const tmpFile = tmp.fileSync();
  const fs = require("fs");
  fs.writeFileSync(tmpFile.name, file.data);

  try {
    const { isInfected, viruses } = await clam.scanFile(tmpFile.name);
    if (isInfected) {
      logger.warn(`Infected file detected: ${file.name}, viruses: ${viruses}`);
      return res.status(400).send({
        message: "Upload rejected: file is infected",
        viruses,
      });
    }

    // File is clean, upload to Storage
    const bucket = storage.bucket("your-bucket-name");
    const storagePath = `profilePics/${Date.now()}_${file.name.replace(/[^\w\d.-]/g, "_")}`;
    const fileUpload = bucket.file(storagePath);
    const stream = fileUpload.createWriteStream();

    stream.on("finish", async () => {
      logger.info("File uploaded successfully");
      res.status(200).send({
        message: "File uploaded successfully",
        url: `https://storage.googleapis.com/${bucket.name}/${storagePath}`,
        storagePath,
      });
    });

    stream.on("error", (err) => {
      logger.error("Error uploading file", err);
      res.status(500).send("Error uploading file");
    });

    stream.end(file.data);
  } catch (err) {
    logger.error("Error scanning file", err);
    return res.status(500).send("Error scanning file");
  } finally {
    tmpFile.removeCallback();
  }
});

// ========================================================
// Secure Delete User Function
// (unchanged)
// ========================================================
exports.deleteUserAccount = onCall(async (request) => {
  const context = request.auth;
  if (!context) throw new functions.https.HttpsError("unauthenticated", "Not signed in");

  const requesterUid = context.uid;
  const userDoc = await admin.firestore().collection("Users").doc(requesterUid).get();

  if (!userDoc.exists || userDoc.data().role !== "Admin") {
    throw new functions.https.HttpsError("permission-denied", "Only admins can delete users.");
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

// ========================================================
// ClamAV Background Scan (optional extra safety)
// ========================================================
exports.scanManuscriptUploads = functions.storage.object().onFinalize(async (object) => {
  const bucketName = object.bucket;
  const filePath = object.name;
  if (!filePath.startsWith("manuscripts/")) return null;

  const file = storage.bucket(bucketName).file(filePath);
  console.log(`Background scanning uploaded file: ${filePath}`);

  const tmpFile = tmp.fileSync();
  await file.download({ destination: tmpFile.name });

  try {
    const { isInfected, viruses } = await clam.scanFile(tmpFile.name);
    if (isInfected) {
      console.log(`Infected file detected: ${filePath}, viruses: ${viruses}`);
      await file.delete();

      const responses = await admin.firestore().collection("form_responses")
        .where("storagePath", "==", filePath).get();

      responses.forEach(async (docSnap) => {
        await docSnap.ref.update({
          status: "Rejected - Infected File",
          infectedViruses: viruses,
          fileUrl: null,
          storagePath: null,
        });
      });

      return null;
    } else {
      console.log("File is clean.");
      return null;
    }
  } catch (err) {
    console.error("Error scanning file:", err);
  } finally {
    tmpFile.removeCallback();
  }
});
