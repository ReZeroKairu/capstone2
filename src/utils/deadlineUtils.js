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
    const hours = Math.floor(
      (overdueMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
    );
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
 * Matches the reviewer's implementation exactly.
 */
export const getDeadlineColor = (startDate, endDate) => {
  const s = parseDateSafe(startDate);
  const e = parseDateSafe(endDate);

  if (!s || !e) return "bg-gray-100 text-gray-700";

  const now = new Date();
  const total = e - s;
  const remaining = e - now;
  const percentLeft = remaining / total;

  // Match the reviewer's color scheme exactly
  if (remaining <= 0) {
    // Overdue
    return "bg-red-100 text-red-800";
  } else if (percentLeft < 0.1) {
    // Less than 10% time remaining
    return "bg-red-100 text-red-700";
  } else if (percentLeft < 0.3) {
    // 10% to 30% time remaining
    return "bg-yellow-100 text-yellow-700";
  } else {
    // More than 30% time remaining
    return "bg-green-100 text-green-700";
  }
};

/**
 * Get the active deadline for a manuscript based on role and status
 * For Peer Reviewers: Returns their individual deadline
 * For Admins: Returns the latest deadline among all reviewers, or falls back to manuscript-level deadlines
 */
// Main function to get the active deadline
export const getActiveDeadline = async (
  manuscript,
  role,
  currentUserId,
  isCoAuthorParam,
  isSubmitterParam
) => {
  if (!manuscript) return null;

  // For Peer Reviewers, return their individual deadline
  if (role === "Peer Reviewer" && currentUserId) {
    const reviewerMeta = manuscript.assignedReviewersMeta?.[currentUserId];

    // For Peer Reviewer Reviewing status, always return the reviewer's deadline
    if (manuscript.status === "Peer Reviewer Reviewing") {
      // First try to get the current reviewer's deadline
      if (reviewerMeta?.deadline) {
        const deadline = reviewerMeta.deadline.toDate
          ? reviewerMeta.deadline.toDate()
          : new Date(reviewerMeta.deadline);
        return deadline;
      }

      // If no individual deadline, try to get from assignedReviewersMeta
      if (manuscript.assignedReviewersMeta) {
        const currentReviewerMeta = Object.values(
          manuscript.assignedReviewersMeta
        ).find(
          (meta) => meta.userId === currentUserId || meta.id === currentUserId
        );

        if (currentReviewerMeta?.deadline) {
          const deadline = currentReviewerMeta.deadline.toDate
            ? currentReviewerMeta.deadline.toDate()
            : new Date(currentReviewerMeta.deadline);
          return deadline;
        }
      }

      // If still no deadline, log a warning
      console.warn(
        "No deadline found for reviewer in Peer Reviewer Reviewing status"
      );
    }

    // Check if manuscript is in 'Back to Admin' status and has a finalization deadline
    if (
      manuscript.status === "Back to Admin" &&
      manuscript.finalizationDeadline
    ) {
      const deadline = manuscript.finalizationDeadline.toDate
        ? manuscript.finalizationDeadline.toDate()
        : new Date(manuscript.finalizationDeadline);
      return deadline;
    }

    // For revision statuses, use the revision deadline
    if (
      (manuscript.status === "For Revision (Minor)" ||
        manuscript.status === "For Revision (Major)") &&
      manuscript.revisionDeadline
    ) {
      const deadline = manuscript.revisionDeadline.toDate
        ? manuscript.revisionDeadline.toDate()
        : new Date(manuscript.revisionDeadline);
      return deadline;
    }

    // For other statuses, return individual reviewer deadline
    const meta =
      manuscript.assignedReviewersMeta &&
      manuscript.assignedReviewersMeta[currentUserId];
    if (meta && meta.deadline) {
      const deadline = meta.deadline.toDate
        ? meta.deadline.toDate()
        : new Date(meta.deadline);
      return deadline;
    }

    // Fallback to manuscript-level review deadline if no individual deadline set
    if (manuscript.reviewDeadline) {
      const deadline = manuscript.reviewDeadline.toDate
        ? manuscript.reviewDeadline.toDate()
        : new Date(manuscript.reviewDeadline);
      return deadline;
    }

    return null;
  }

  // Handle deadlines based on manuscript status and role
  const status = manuscript.status;

  // For Back to Admin status, handle it first to ensure consistent behavior
  if (status === "Back to Admin") {
    console.log('Handling Back to Admin status');
    
    // First, try to get the finalization deadline if it exists
    if (manuscript.finalizationDeadline) {
      console.log('Using finalizationDeadline for Back to Admin status');
      if (manuscript.finalizationDeadline.toDate) {
        return manuscript.finalizationDeadline.toDate();
      } else if (typeof manuscript.finalizationDeadline === 'string') {
        return new Date(manuscript.finalizationDeadline);
      } else if (manuscript.finalizationDeadline.seconds) {
        return new Date(manuscript.finalizationDeadline.seconds * 1000);
      }
      return new Date(manuscript.finalizationDeadline);
    }
    
    // If no finalizationDeadline is set, calculate it based on settings
    console.log('No finalizationDeadline found, calculating from settings');
    const settingsRef = doc(db, "deadlineSettings", "deadlines");
    const settingsSnap = await getDoc(settingsRef);
    const finalizationDeadlineDays = settingsSnap.exists() ? 
      (settingsSnap.data().finalizationDeadline || 5) : 5;
      
    const deadline = new Date();
    deadline.setDate(deadline.getDate() + finalizationDeadlineDays);
    console.log('Calculated new finalization deadline:', deadline);
    return deadline;
  }
  
  // For revision statuses, always return the revision deadline regardless of role
  if (status === "For Revision (Minor)" || status === "For Revision (Major)") {
    console.log('Getting revision deadline for status:', status);
    console.log('Manuscript revisionDeadline:', manuscript.revisionDeadline);
    
    if (manuscript.revisionDeadline) {
      // Handle Firestore Timestamp
      if (manuscript.revisionDeadline.toDate) {
        const date = manuscript.revisionDeadline.toDate();
        console.log('Converted Firestore Timestamp to Date:', date);
        return date;
      } 
      // Handle string dates
      else if (typeof manuscript.revisionDeadline === 'string') {
        const date = new Date(manuscript.revisionDeadline);
        console.log('Converted string to Date:', date);
        return date;
      } 
      // Handle Firestore Timestamp object (seconds/nanoseconds)
      else if (manuscript.revisionDeadline.seconds) {
        const date = new Date(manuscript.revisionDeadline.seconds * 1000);
        console.log('Converted timestamp object to Date:', date);
        return date;
      } 
      // Handle JavaScript Date objects
      else if (manuscript.revisionDeadline instanceof Date) {
        console.log('Returning existing Date object:', manuscript.revisionDeadline);
        return manuscript.revisionDeadline;
      }
      // Fallback for any other case
      else {
        console.log('Using fallback date conversion');
        return new Date(manuscript.revisionDeadline);
      }
    }
    
    // If no revisionDeadline is set, calculate it based on the settings
    console.log('No revisionDeadline found, calculating new one');
    const revisionDays = await getDeadlineDaysByStatus(status);
    const deadline = new Date();
    deadline.setDate(deadline.getDate() + revisionDays);
    console.log('Calculated new deadline:', deadline);
    return deadline;
  }

  // Determine if user is submitter or co-author
  const isSubmitter =
    isSubmitterParam !== undefined
      ? isSubmitterParam
      : manuscript._isSubmitter !== undefined
      ? manuscript._isSubmitter
      : manuscript.submitterId === currentUserId;

  // Determine if user is a co-author by checking all possible sources
  const isCoAuthor = (() => {
    // Check if explicitly passed as parameter
    if (isCoAuthorParam === true) return true;

    // Check if set in manuscript object
    if (manuscript._isCoAuthor === true) return true;

    // Check coAuthors array
    if (Array.isArray(manuscript.coAuthors)) {
      const isCoAuthorInArray = manuscript.coAuthors.some(
        (coAuthor) =>
          coAuthor.userId === currentUserId || coAuthor.id === currentUserId
      );
      if (isCoAuthorInArray) return true;
    }

    return false;
  })();

  // Determine if user is a submitter
  const isSubmitterFinal =
    isSubmitterParam === true ||
    manuscript._isSubmitter === true ||
    manuscript.submitterId === currentUserId;

  // If user is admin, submitter, or co-author, show the appropriate deadline
  const hasPermission = role === "Admin" || isSubmitterFinal || isCoAuthor;

  if (!hasPermission) {
    return null;
  }

  // If user is admin, submitter, or co-author, show the appropriate deadline
  if (role === "Admin" || isSubmitterFinal || isCoAuthor) {
    // For Peer Reviewer Reviewing status, show the current reviewer's deadline
    if (manuscript.status === "Peer Reviewer Reviewing") {
      // First try to get the first assigned reviewer's deadline
      if (manuscript.assignedReviewers?.length > 0) {
        const currentReviewerId = manuscript.assignedReviewers[0];
        const reviewerMeta =
          manuscript.assignedReviewersMeta?.[currentReviewerId];

        if (reviewerMeta?.deadline) {
          const deadline = reviewerMeta.deadline.toDate
            ? reviewerMeta.deadline.toDate()
            : new Date(reviewerMeta.deadline);
          return deadline;
        }
      }

      // If no assigned reviewers, try to find any reviewer with a deadline
      if (manuscript.assignedReviewersMeta) {
        const reviewerWithDeadline = Object.entries(
          manuscript.assignedReviewersMeta
        ).find(
          ([_, meta]) => meta.deadline && meta.invitationStatus !== "declined"
        );

        if (reviewerWithDeadline) {
          const [_, meta] = reviewerWithDeadline;
          const deadline = meta.deadline.toDate
            ? meta.deadline.toDate()
            : new Date(meta.deadline);
          return deadline;
        }
      }

      // If still no deadline, log a warning and fall through to other deadline checks
      console.warn(
        "No reviewer deadline found for Peer Reviewer Reviewing status"
      );
    }

    // Handle different statuses and their respective deadlines
    switch (status) {
      case "For Revision (Minor)":
      case "For Revision (Major)":
        // For revision status, prioritize revisionDeadline
        if (manuscript.revisionDeadline) {
          const deadline = manuscript.revisionDeadline.toDate
            ? manuscript.revisionDeadline.toDate()
            : new Date(manuscript.revisionDeadline);
          return deadline;
        }
      // Fall through to check review deadline

      case "Under Review":
      case "Under Review (Resubmitted)":
        // For review status, use reviewDeadline
        if (manuscript.reviewDeadline) {
          const deadline = manuscript.reviewDeadline.toDate
            ? manuscript.reviewDeadline.toDate()
            : new Date(manuscript.reviewDeadline);
          return deadline;
        }
        // If no review deadline, try to get the earliest reviewer deadline
        if (manuscript.assignedReviewersMeta) {
          const reviewerDeadlines = Object.values(
            manuscript.assignedReviewersMeta
          )
            .filter(
              (meta) => meta.deadline && meta.invitationStatus !== "declined"
            )
            .map((meta) =>
              meta.deadline.toDate
                ? meta.deadline.toDate()
                : new Date(meta.deadline)
            );

          if (reviewerDeadlines.length > 0) {
            const earliest = new Date(
              Math.min(...reviewerDeadlines.map((d) => d.getTime()))
            );
            return earliest;
          }
        }
        break;

      case "Back to Admin":
      case "In Finalization":
      case "For Publication":
        // For finalization status, use finalizationDeadline
        if (manuscript.finalizationDeadline) {
          const deadline = manuscript.finalizationDeadline.toDate
            ? manuscript.finalizationDeadline.toDate()
            : new Date(manuscript.finalizationDeadline);
          return deadline;
        }
        break;

      default:
        break;
    }

    // If we get here, no specific deadline was found for the status
    // Try to return the most appropriate deadline based on what's available
    if (manuscript.revisionDeadline) {
      const deadline = manuscript.revisionDeadline.toDate
        ? manuscript.revisionDeadline.toDate()
        : new Date(manuscript.revisionDeadline);
      return deadline;
    }

    if (manuscript.reviewDeadline) {
      const deadline = manuscript.reviewDeadline.toDate
        ? manuscript.reviewDeadline.toDate()
        : new Date(manuscript.reviewDeadline);
      return deadline;
    }

    if (manuscript.finalizationDeadline) {
      const deadline = manuscript.finalizationDeadline.toDate
        ? manuscript.finalizationDeadline.toDate()
        : new Date(manuscript.finalizationDeadline);
      return deadline;
    }

    return null;
  }

  return null;
};

/**
 * Get the appropriate deadline days based on manuscript status
 */
export const getDeadlineDaysByStatus = async (status) => {
  try {
    const { doc, getDoc } = await import("firebase/firestore");
    const { db } = await import("../firebase/firebase");

    const settingsRef = doc(db, "deadlineSettings", "deadlines");
    const settingsSnap = await getDoc(settingsRef);

    if (!settingsSnap.exists()) {
      console.warn("No deadline settings found, using defaults");
      const defaultDeadlines = {
        "Assigning Peer Reviewer": 5,
        "Peer Reviewer Assigned": 5,
        "For Revision (Minor)": 5,
        "For Revision (Major)": 5,
        "Back to Admin": 5
      };
      return defaultDeadlines[status] || 5;
    }

    const settings = settingsSnap.data();

    const statusToField = {
      "Assigning Peer Reviewer": "invitationDeadline",
      "Peer Reviewer Assigned": "reviewDeadline",
      "For Revision (Minor)": "revisionDeadline",
      "For Revision (Major)": "revisionDeadline",
      "Back to Admin": "finalizationDeadline",
    };

    const field = statusToField[status];

    if (!field) {
      console.warn(
        `No field mapping found for status: "${status}". Using default 6 days.`
      );
      return 6;
    }

    const days = settings[field];

    return days !== undefined ? days : 6;
  } catch (error) {
    console.error("Error getting deadline settings:", error);
    return 6; // Fallback to 6 days
  }
};

/**
 * Update deadlines for all assigned reviewers when a manuscript is resubmitted
 */
export const updateReviewerDeadlines = async (manuscriptId, status) => {
  try {
    const { doc, getDoc, updateDoc, serverTimestamp } = await import(
      "firebase/firestore"
    );
    const { db } = await import("../firebase/firebase");

    // Get the manuscript
    const msRef = doc(db, "manuscripts", manuscriptId);
    const msSnap = await getDoc(msRef);

    if (!msSnap.exists()) {
      console.error("Manuscript not found");
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
    assignedReviewers.forEach((reviewerId) => {
      updates[`assignedReviewersMeta.${reviewerId}.deadline`] = newDeadline;
      updates[`assignedReviewersMeta.${reviewerId}.deadlineUpdatedAt`] =
        serverTimestamp();
    });

    // Add the manuscript-level deadline field if needed
    const statusToDeadlineField = {
      "Assigning Peer Reviewer": "invitationDeadline",
      "Peer Reviewer Assigned": "reviewDeadline",
      "For Revision (Minor)": "revisionDeadline",
      "For Revision (Major)": "revisionDeadline",
      "Back to Admin": "finalizationDeadline",
    };

    const deadlineField = statusToDeadlineField[status];
    if (deadlineField) {
      updates[deadlineField] = newDeadline;
    }

    // Update the document
    await updateDoc(msRef, {
      ...updates,
      updatedAt: serverTimestamp(),
    });

    return true;
  } catch (error) {
    console.error("Error updating reviewer deadlines:", error);
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
    console.error("Invalid date:", rawDeadline);
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
