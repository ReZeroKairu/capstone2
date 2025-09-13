import {
  collection,
  addDoc,
  serverTimestamp,
  getDoc,
  doc,
} from "firebase/firestore";
import { db } from "../firebase/firebase";

const userLogRef = collection(db, "UserLog");

// Enhanced in-memory cache for user info
const userCache = {};

/**
 * Fetches user info safely.
 * - Only queries Firestore once per user.
 * - Returns { fullName, email }.
 * - Does NOT modify logs or fill missing fields in them.
 */
const getUserInfo = async (userId) => {
  if (!userId) return { fullName: "", email: "" };
  if (userCache[userId]) return userCache[userId];

  try {
    const userDoc = await getDoc(doc(db, "Users", userId));
    if (!userDoc.exists()) return { fullName: "", email: "" };

    const data = userDoc.data();
    const info = {
      fullName: [data.firstName, data.middleName, data.lastName]
        .filter(Boolean)
        .map((s) => s.trim())
        .join(" "),
      email: (data.email ?? "").trim(),
    };

    userCache[userId] = info;
    return info;
  } catch (err) {
    console.error("Error fetching user info:", err);
    return { fullName: "", email: "" };
  }
};

// Logs a generic user action. Names are only taken from explicit parameters.
export const logUserAction = async ({
  actingUserId,
  actingUserIsAdmin = false,
  targetUserId = null,
  email = "",
  action = "",
  metadata = {},
  newFirstName = "",
  previousFirstName = "",
  newMiddleName = "",
  previousMiddleName = "",
  newLastName = "",
  previousLastName = "",
}) => {
  try {
    let actingUserFullName = "";
    let actingUserEmail = "";
    if (actingUserId) {
      const info = await getUserInfo(actingUserId);
      actingUserFullName = info.fullName;
      actingUserEmail = info.email;
    }

    let targetUserEmail = "";
    if (!actingUserIsAdmin && targetUserId) {
      const info = await getUserInfo(targetUserId);
      targetUserEmail = info.email;
    }

    const fullName = [newFirstName, newMiddleName, newLastName]
      .map((s) => s.trim())
      .filter(Boolean)
      .join(" ");

    const previousFullName = [
      previousFirstName,
      previousMiddleName,
      previousLastName,
    ]
      .map((s) => s.trim())
      .filter(Boolean)
      .join(" ");

    const logEntry = {
      actingUserFullName,
      actingUserEmail,
      adminId: actingUserIsAdmin ? actingUserId : null,
      userId: !actingUserIsAdmin ? targetUserId || actingUserId || null : null,
      email: email || targetUserEmail || actingUserEmail,
      action: action || "",
      metadata: metadata || {},
      timestamp: serverTimestamp(),
      newFirstName,
      previousFirstName,
      newMiddleName,
      previousMiddleName,
      newLastName,
      previousLastName,
      fullName,
      previousFullName,
    };

    await addDoc(userLogRef, logEntry);
    console.log(`✅ Logged action: ${action}`, logEntry);
  } catch (err) {
    console.error("❌ Failed to log action:", err);
  }
};

// Logs only changed fields for profile updates
export const logProfileUpdate = async ({
  actingUserId,
  actingUserIsAdmin = false,
  targetUserId,
  before,
  after,
}) => {
  const changedFields = {};
  const logData = {
    actingUserId,
    actingUserIsAdmin,
    targetUserId,
    action: "Profile Update",
  };

  ["firstName", "middleName", "lastName"].forEach((key) => {
    const beforeValue = (before[key] ?? "").trim();
    const afterValue = (after[key] ?? "").trim();
    if (beforeValue !== afterValue) {
      changedFields[key] = { before: beforeValue, after: afterValue };
      logData[`previous${key.charAt(0).toUpperCase() + key.slice(1)}`] =
        beforeValue;
      logData[`new${key.charAt(0).toUpperCase() + key.slice(1)}`] = afterValue;
    }
  });

  if (Object.keys(changedFields).length === 0) return null;

  logData.metadata = changedFields;
  await logUserAction(logData);
};
