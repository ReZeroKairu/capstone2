// src/pages/PeerReviewer/helpers/reviewerActions.js
import { db } from "../../../firebase/firebase";
import {
  doc,
  updateDoc,
  arrayUnion,
  arrayRemove,
  deleteField,
} from "firebase/firestore";
import { recalcManuscriptStatus } from "../../../utils/recalcManuscriptStatus";

/**
 * Assign a reviewer to a manuscript. Recalculates manuscript status afterwards.
 * @param {string} manuscriptId - The ID of the manuscript
 * @param {string} reviewerId - The ID of the reviewer to assign
 * @param {string} assignedBy - The ID of the user who assigned the reviewer
 * @param {Function} handleStatusChange - Optional function to handle status changes
 */
export const assignReviewer = async (
  manuscriptId,
  reviewerId,
  assignedBy = "adminId",
  handleStatusChange = null
) => {
  const msRef = doc(db, "manuscripts", manuscriptId);

  await updateDoc(msRef, {
    assignedReviewers: arrayUnion(reviewerId),
    [`assignedReviewersMeta.${reviewerId}`]: {
      assignedBy,
      assignedAt: new Date(),
      invitationStatus: "pending",
    },
  });

  await recalcManuscriptStatus(manuscriptId, handleStatusChange);
};

/**
 * Unassign reviewer and recalc status.
 * @param {string} manuscriptId - The ID of the manuscript
 * @param {string} reviewerId - The ID of the reviewer to unassign
 * @param {Function} handleStatusChange - Optional function to handle status changes
 * @param {Object} options - Additional options
 * @param {boolean} options.skipConfirmation - Whether to skip the confirmation dialog
 * @param {string} options.reviewerName - The name of the reviewer for the confirmation message
 * @returns {Promise<boolean>} - Returns true if unassigned, false if cancelled
 */
export const unassignReviewer = async (
  manuscriptId, 
  reviewerId, 
  handleStatusChange = null, 
  { skipConfirmation = false, reviewerName = 'this reviewer' } = {}
) => {
  try {
    // Show confirmation dialog if not skipped
    if (!skipConfirmation) {
      const confirmUnassign = window.confirm(
        `Are you sure you want to unassign ${reviewerName}? This action cannot be undone.`
      );
      if (!confirmUnassign) return false;
    }

    const msRef = doc(db, "manuscripts", manuscriptId);
    const msDoc = await getDoc(msRef);
    
    if (!msDoc.exists()) {
      throw new Error('Manuscript not found');
    }

    const manuscriptData = msDoc.data();
    const reviewerMeta = manuscriptData.assignedReviewersMeta?.[reviewerId];

    // Only proceed if the reviewer is actually assigned
    if (!manuscriptData.assignedReviewers?.includes(reviewerId)) {
      console.warn(`Reviewer ${reviewerId} is not assigned to manuscript ${manuscriptId}`);
      return false;
    }

    await updateDoc(msRef, {
      assignedReviewers: arrayRemove(reviewerId),
      [`assignedReviewersMeta.${reviewerId}`]: deleteField(),
      // Also remove from any other relevant fields if they exist
      ...(reviewerMeta?.invitationStatus === 'accepted' && {
        // If the reviewer had already accepted, we might want to update other fields
        // For example, if you track accepted reviewers separately:
        // acceptedReviewers: arrayRemove(reviewerId),
      }),
      lastUpdated: new Date(),
    });

    // Recalculate the manuscript status
    await recalcManuscriptStatus(manuscriptId, handleStatusChange);
    
    console.log(`Successfully unassigned reviewer ${reviewerId} from manuscript ${manuscriptId}`);
    return true;
    
  } catch (error) {
    console.error('Error unassigning reviewer:', error);
    
    // Show error to user if in browser context
    if (typeof window !== 'undefined') {
      alert(`Failed to unassign reviewer: ${error.message || 'An unexpected error occurred'}`);
    }
    
    throw error; // Re-throw to allow caller to handle if needed
  }
};
