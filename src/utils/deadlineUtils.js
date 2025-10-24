// src/utils/deadlineUtils.js
import { parseDateSafe } from "./dateUtils";
import { auth } from "../firebase/firebase";

/**
 * Get remaining time between now and endDate.
 * Returns an object: {days, hours, minutes, totalMs}
 */
export const getRemainingTime = (endDate) => {
  const now = new Date();
  const end = parseDateSafe(endDate);
  const diff = end - now;
  const isOverdue = diff <= 0;
  
  if (isOverdue) {
    const overdueMs = Math.abs(diff);
    const days = Math.floor(overdueMs / (1000 * 60 * 60 * 24));
    const hours = Math.floor((overdueMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((overdueMs % (1000 * 60 * 60)) / (1000 * 60));
    return { days, hours, minutes, totalMs: overdueMs, isOverdue: true };
  }

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  return { days, hours, minutes, totalMs: diff, isOverdue: false };
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
 * For Peer Reviewers: Returns their individual deadline
 * For Admins: Returns the latest deadline among all reviewers, or falls back to manuscript-level deadlines
 */
export const getActiveDeadline = (manuscript, role, currentUserId) => {
  if (!manuscript) return null;

  // For Peer Reviewers, return their individual deadline
  if (role === "Peer Reviewer" && currentUserId) {
    const meta = manuscript.assignedReviewersMeta?.[currentUserId];
    if (meta?.deadline) {
      return meta.deadline?.toDate ? meta.deadline.toDate() : new Date(meta.deadline);
    }
    // Fallback to manuscript-level review deadline if no individual deadline set
    return manuscript.reviewDeadline 
      ? (manuscript.reviewDeadline.toDate ? manuscript.reviewDeadline.toDate() : new Date(manuscript.reviewDeadline))
      : null;
  }

  // Handle deadlines based on manuscript status and role
  const status = manuscript.status;
  
  // For Admin and Researcher roles
  if (role === "Admin" || role === "Researcher") {
    // 1. Check for revision deadlines first
    if (["For Revision (Minor)", "For Revision (Major)"].includes(status)) {
      if (manuscript.revisionDeadline) {
        return manuscript.revisionDeadline.toDate
          ? manuscript.revisionDeadline.toDate()
          : new Date(manuscript.revisionDeadline);
      }
    } 
    // 2. Check for finalization deadline
    else if (status === "Back to Admin" || status === "In Finalization") {
      if (manuscript.finalizationDeadline) {
        return manuscript.finalizationDeadline.toDate 
          ? manuscript.finalizationDeadline.toDate() 
          : new Date(manuscript.finalizationDeadline);
      }
    }
    // 3. For review phase, use reviewDeadline
    else if (["Peer Reviewer Assigned", "Peer Reviewer Reviewing"].includes(status)) {
      if (manuscript.reviewDeadline) {
        return manuscript.reviewDeadline.toDate
          ? manuscript.reviewDeadline.toDate()
          : new Date(manuscript.reviewDeadline);
      }
    }

    // 4. Fallback to latest reviewer deadline if available
    if (manuscript.assignedReviewersMeta) {
      let latestDeadline = null;
      
      Object.values(manuscript.assignedReviewersMeta).forEach(meta => {
        if (meta?.deadline) {
          const deadline = meta.deadline.toDate ? meta.deadline.toDate() : new Date(meta.deadline);
          if (!latestDeadline || deadline > latestDeadline) {
            latestDeadline = deadline;
          }
        }
      });
      
      if (latestDeadline) return latestDeadline;
    }
  }

  // Default to manuscript-level review deadline if no individual deadlines found
  return manuscript.reviewDeadline 
    ? (manuscript.reviewDeadline.toDate ? manuscript.reviewDeadline.toDate() : new Date(manuscript.reviewDeadline))
    : null;
};

/**
 * Get the appropriate deadline days based on manuscript status
 */
export const getDeadlineDaysByStatus = async (status) => {
  try {
    const { doc, getDoc } = await import('firebase/firestore');
    const { db } = await import('../firebase/firebase');
    
    const settingsRef = doc(db, 'deadlineSettings', 'deadlines');
    const settingsSnap = await getDoc(settingsRef);
    
    if (!settingsSnap.exists()) {
      console.warn('No deadline settings found, using defaults');
      return {
        'Assigning Peer Reviewer': 5,
        'Peer Reviewer Assigned': 5,
        'For Revision (Minor)': 5,
        'For Revision (Major)': 5,
        'Back to Admin': 5,
      }[status] || 5;
    }
    
    const settings = settingsSnap.data();
    console.log('Retrieved deadline settings:', settings);
    
    const statusToField = {
      'Assigning Peer Reviewer': 'invitationDeadline',
      'Peer Reviewer Assigned': 'reviewDeadline',
      'For Revision (Minor)': 'revisionDeadline',
      'For Revision (Major)': 'revisionDeadline',
      'Back to Admin': 'finalizationDeadline',
    };
    
    const field = statusToField[status];
    console.log(`Status: "${status}" maps to field: "${field}"`);
    
    if (!field) {
      console.warn(`No field mapping found for status: "${status}". Using default 6 days.`);
      return 6;
    }
    
    const days = settings[field];
    console.log(`Retrieved ${days} days for ${field}`);
    
    return days !== undefined ? days : 6;
  } catch (error) {
    console.error('Error getting deadline settings:', error);
    return 6 // Fallback to 6 days
  }
};

/**
 * Update deadlines for all assigned reviewers when a manuscript is resubmitted
 */
export const updateReviewerDeadlines = async (manuscriptId, status) => {
  try {
    const { doc, getDoc, updateDoc, serverTimestamp } = await import('firebase/firestore');
    const { db } = await import('../firebase/firebase');
    
    // Get the manuscript
    const msRef = doc(db, 'manuscripts', manuscriptId);
    const msSnap = await getDoc(msRef);
    
    if (!msSnap.exists()) {
      console.error('Manuscript not found');
      return false;
    }
    
    const manuscript = { id: msSnap.id, ...msSnap.data() };
    const assignedReviewers = manuscript.assignedReviewers || [];
    
    if (assignedReviewers.length === 0) {
      return true; // No reviewers to update
    }
    
    // Get the appropriate deadline days based on status
    const deadlineDays = await getDeadlineDaysByStatus(status);
    const newDeadline = new Date();
    newDeadline.setDate(newDeadline.getDate() + deadlineDays);
    
    // Prepare updates for each reviewer
    const updates = {};
    assignedReviewers.forEach(reviewerId => {
      updates[`assignedReviewersMeta.${reviewerId}.deadline`] = newDeadline;
      updates[`assignedReviewersMeta.${reviewerId}.deadlineUpdatedAt`] = serverTimestamp();
    });
    
    // Add the manuscript-level deadline field if needed
    const statusToDeadlineField = {
      'Assigning Peer Reviewer': 'invitationDeadline',
      'Peer Reviewer Assigned': 'reviewDeadline',
      'For Revision (Minor)': 'revisionDeadline',
      'For Revision (Major)': 'revisionDeadline',
      'Back to Admin': 'finalizationDeadline',
    };
    
    const deadlineField = statusToDeadlineField[status];
    if (deadlineField) {
      updates[deadlineField] = newDeadline;
    }
    
    // Update the document
    await updateDoc(msRef, {
      ...updates,
      updatedAt: serverTimestamp()
    });
    
    return true;
  } catch (error) {
    console.error('Error updating reviewer deadlines:', error);
    return false;
  }
};

export function getRemainingDays(rawDeadline) {
  if (!rawDeadline) return { days: 0, hours: 0, minutes: 0, isPast: true };

  // normalize to JS Date
  let date;
  if (typeof rawDeadline?.toDate === "function") {
    date = rawDeadline.toDate();
  } else if (rawDeadline?.seconds) {
    date = new Date(rawDeadline.seconds * 1000);
  } else {
    date = new Date(rawDeadline);
  }
  
  if (isNaN(date.getTime())) {
    console.error('Invalid date:', rawDeadline);
    return { days: 0, hours: 0, minutes: 0, isPast: true };
  }

  const diff = date.getTime() - Date.now();
  const isPast = diff <= 0;
  const remainingMs = Math.max(diff, 0);

  const s = Math.floor(remainingMs / 1000);
  const days = Math.floor(s / 86400);
  const hours = Math.floor((s % 86400) / 3600);
  const minutes = Math.floor((s % 3600) / 60);

  const secs = s % 60;

  const formatted = `${days}d ${String(hours).padStart(2, "0")}h ${String(
    minutes
  ).padStart(2, "0")}m ${String(secs).padStart(2, "0")}s`;

  return { remainingMs, isPast, formatted, days, hours, minutes, secs, date };
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
