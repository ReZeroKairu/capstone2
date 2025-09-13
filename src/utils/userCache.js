// utils/userCache.js
import { getDoc, doc } from "firebase/firestore";
import { db } from "../firebase/firebase";

// In-memory cache for user info
export const userCache = {};

/**
 * Fetch user full name and email safely.
 * Cached to avoid repeated Firestore calls.
 */
export const getUserInfo = async (userId) => {
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
