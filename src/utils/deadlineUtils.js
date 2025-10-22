// src/utils/deadlineUtils.js
import { parseDateSafe } from "./dateUtils";
import { auth } from "../firebase/firebase";

/**
 * Get remaining time between now and endDate.
 * Returns an object: {days, hours, minutes, totalMs}
 */
export const getRemainingTime = (endDate) => {
  const now = new Date();
  const diff = parseDateSafe(endDate) - now;
  if (diff <= 0) return { days: 0, hours: 0, minutes: 0, totalMs: 0 };

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  return { days, hours, minutes, totalMs: diff };
};

/**
 * Determine the badge color based on percentage of time left.
 */
export const getDeadlineColor = (startDate, endDate) => {
  const s = parseDateSafe(startDate);
  const e = parseDateSafe(endDate);

  if (!s || !e) return "bg-gray-200 text-gray-700";

  const now = new Date();
  const total = e - s;
  const remaining = e - now;

  if (total <= 0) return "bg-gray-200 text-gray-700";

  const percentLeft = remaining / total;

  if (percentLeft <= 0) return "bg-red-200 text-red-800";
  if (percentLeft < 0.25) return "bg-red-100 text-red-700";
  if (percentLeft < 0.6) return "bg-yellow-100 text-yellow-700";
  return "bg-green-100 text-green-700";
};

/**
 * Get the active deadline for a manuscript based on role and status
 */
export const getActiveDeadline = (manuscript, role) => {
  if (!manuscript) return null;

  if (role === "Peer Reviewer") {
    const meta = manuscript.assignedReviewersMeta?.[auth.currentUser.uid];
    return meta?.deadline ? new Date(meta.deadline) : null;
  }

  // Admin sees deadlines for finalization/revision
  if (
    ["Back to Admin", "For Revision (Minor)", "For Revision (Major)"].includes(
      manuscript.status
    )
  ) {
    return manuscript.finalizationDeadline
      ? new Date(manuscript.finalizationDeadline)
      : null;
  }

  // Default review deadline
  return manuscript.reviewDeadline ? new Date(manuscript.reviewDeadline) : null;
};

export function getRemainingDays(rawDeadline) {
  if (!rawDeadline) return null;

  // normalize to JS Date
  let date;
  if (typeof rawDeadline?.toDate === "function") {
    date = rawDeadline.toDate();
  } else if (rawDeadline?.seconds) {
    date = new Date(rawDeadline.seconds * 1000);
  } else {
    date = new Date(rawDeadline);
  }
  if (isNaN(date)) return null;

  const diff = date.getTime() - Date.now();
  const isPast = diff <= 0;
  const remainingMs = Math.max(diff, 0);

  const s = Math.floor(remainingMs / 1000);
  const days = Math.floor(s / 86400);
  const hours = Math.floor((s % 86400) / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;

  const formatted = `${days}d ${String(hours).padStart(2, "0")}h ${String(
    mins
  ).padStart(2, "0")}m ${String(secs).padStart(2, "0")}s`;

  return { remainingMs, isPast, formatted, days, hours, mins, secs, date };
}

/**
 * Parse a deadline value coming from Firestore.
 * raw may be:
 * - Firestore Timestamp (has toDate)
 * - { seconds } object
 * - ISO string / Date
 * - number: interpreted as
 *     * epoch-ms if > 1e12
 *     * epoch-seconds if > 1e9
 *     * days-offset (small integer) otherwise -> adds days to baseDate or now
 *
 * baseDate (optional) should be a Date / Timestamp / seconds-object / ISO string
 */
export function parseDeadline(raw, baseDate = null) {
  if (raw == null) return null;

  // Firestore Timestamp
  if (typeof raw?.toDate === "function") return raw.toDate();

  // seconds-object (Firestore legacy shape)
  if (raw?.seconds) return new Date(raw.seconds * 1000);

  // number handling
  if (typeof raw === "number") {
    // epoch-milliseconds
    if (raw > 1e12) return new Date(raw);
    // epoch-seconds
    if (raw > 1e9) return new Date(raw * 1000);
    // treat as days offset
    const days = raw;
    let base = null;
    if (baseDate) {
      if (typeof baseDate?.toDate === "function") base = baseDate.toDate();
      else if (baseDate?.seconds) base = new Date(baseDate.seconds * 1000);
      else base = new Date(baseDate);
    } else {
      base = new Date();
    }
    if (isNaN(base.getTime())) return null;
    const target = new Date(base.getTime() + days * 24 * 60 * 60 * 1000);
    return target;
  }

  // try Date / ISO string
  try {
    const d = new Date(raw);
    return isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}
