// src/utils/dateUtils.js
export const parseDateSafe = (d) => {
  if (!d) return null;
  if (d.toDate) return d.toDate(); // Firestore Timestamp
  if (typeof d === "string") return new Date(d); // string
  return new Date(d); // already JS Date
};
