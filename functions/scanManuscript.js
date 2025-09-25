// scanManuscripts.js
const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { NodeClam } = require("clamav.js");
const { Storage } = require("@google-cloud/storage");
const tmp = require("tmp");

const storage = new Storage();
const clam = new NodeClam().init({
  removeInfected: false,
  quarantineInfected: false,
  debugMode: false,
  clamdscan: { host: "127.0.0.1", port: 3310, timeout: 60000 },
});

exports.scanManuscriptUploads = functions.storage.object().onFinalize(async (object) => {
  const bucketName = object.bucket;
  const filePath = object.name;

  if (!filePath.startsWith("manuscripts/")) return null;

  const file = storage.bucket(bucketName).file(filePath);

  console.log(`Scanning uploaded file: ${filePath}`);

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
          storagePath: null
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
