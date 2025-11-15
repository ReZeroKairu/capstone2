// src/utils/dateUtils.js
export const parseDateSafe = (d) => {
  if (!d) return null;
  if (d.toDate) return d.toDate(); // Firestore Timestamp
  if (typeof d === "string") return new Date(d); // string
  return new Date(d); // already JS Date
};

/**
 * Normalize and format Firestore timestamp / Date / ISO string.
 * Returns human-friendly string (e.g. "Oct 25, 2025 14:32").
 */
export function formatFirestoreDate(raw, options = {}) {
  if (!raw) return "—";
  let date;
  try {
    if (typeof raw.toDate === "function") {
      // Handle Firestore Timestamp
      date = raw.toDate();
    } else if (raw?.seconds) {
      // Handle Firestore Timestamp in object format {seconds, nanoseconds}
      date = new Date(raw.seconds * 1000 + (raw.nanoseconds || 0) / 1000000);
    } else if (typeof raw === 'object' && raw !== null && 'toDate' in raw) {
      // Handle Firestore Timestamp in object format with toDate method
      date = raw.toDate();
    } else if (typeof raw === 'string' || typeof raw === 'number') {
      // Handle ISO string or timestamp
      date = new Date(raw);
    } else {
      // Default case, try to create a Date object
      date = new Date(raw);
    }
  } catch (error) {
    console.error('Error formatting date:', error, raw);
    return "—";
  }
  if (!date || isNaN(date.getTime())) return "—";
  // default formatting; override via options.locale or options.opts
  const locale = options.locale || undefined;
  const opts = options.opts || {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  };
  return date.toLocaleString(locale, opts);
}

// optional alias export
export { formatFirestoreDate as formatDate };
