// src/utils/recalcManuscriptStatus.js
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase/firebase";

/**
 * Recalculates the manuscript status based on reviewer completion
 * @param {string} msId - The manuscript ID
 * @param {Function} handleStatusChange - Function to handle status changes (from useManuscriptStatus hook)
 */
export const recalcManuscriptStatus = async (msId, handleStatusChange) => {
  const msRef = doc(db, "manuscripts", msId);
  const docSnap = await getDoc(msRef);
  if (!docSnap.exists()) return;

  const data = docSnap.data();
  const assigned = data.assignedReviewers || [];
  const completed = data.reviewerSubmissions?.map((r) => r.reviewerId) || [];
  const assignedMeta = data.assignedReviewersMeta || {};

  // Check if there are any reviewers who have accepted their invitations
  const hasAcceptedReviewers = Object.values(assignedMeta).some(
    meta => meta.invitationStatus === 'accepted'
  );

  // Check if there are any pending reviewers
  const hasPendingReviewers = Object.values(assignedMeta).some(
    meta => meta.invitationStatus === 'pending'
  );

  // Get current version of the manuscript
  const currentVersion = data.versionNumber || 1;
  
  // Check which reviewers have completed the current version
  const completedCurrentVersion = data.reviewerSubmissions?.some(
    sub => (sub.manuscriptVersionNumber || 1) === currentVersion
  ) || false;

  // Check if all assigned reviewers have completed their reviews for current version
  const allCompleted = assigned.length > 0 && assigned.every(rid => {
    // Check if reviewer has submitted for current version
    return data.reviewerSubmissions?.some(
      sub => sub.reviewerId === rid && 
            (sub.manuscriptVersionNumber || 1) === currentVersion
    );
  });

  // Check if any reviewers are still working (accepted but not completed)
  const hasActiveReviewers = assigned.some(rid => {
    const meta = assignedMeta[rid];
    return meta?.invitationStatus === 'accepted' && 
           !data.reviewerSubmissions?.some(
             sub => sub.reviewerId === rid && 
                   (sub.manuscriptVersionNumber || 1) === currentVersion
           );
  });
  
  // If there are no assigned reviewers, set to "Assigning Peer Reviewer"
  if (assigned.length === 0) {
    if (handleStatusChange && data.status !== "Assigning Peer Reviewer") {
      await handleStatusChange(msId, "Assigning Peer Reviewer", "No reviewers assigned");
    }
    return;
  }

  // If there are assigned reviewers but none have accepted yet, set to "Assigning Peer Reviewer"
  if (!hasAcceptedReviewers && hasPendingReviewers) {
    if (handleStatusChange && data.status !== "Assigning Peer Reviewer") {
      await handleStatusChange(msId, "Assigning Peer Reviewer", "Awaiting reviewer acceptance");
    }
    return;
  }

  // If there are no active reviewers (all accepted reviewers have completed)
  // but we still have pending reviewers, go back to "Assigning Peer Reviewer"
  if (!hasActiveReviewers && hasPendingReviewers) {
    if (handleStatusChange && data.status !== "Assigning Peer Reviewer") {
      await handleStatusChange(msId, "Assigning Peer Reviewer", "Awaiting reviewer acceptance");
    }
    return;
  }

  // If all assigned reviewers have completed their reviews, set to "Back to Admin"
  if (allCompleted && data.status !== "Back to Admin") {
    if (handleStatusChange) {
      await handleStatusChange(msId, "Back to Admin", "All reviews completed");
    }
  } 
  // If not all reviews are completed and status is "Back to Admin", change to "Peer Reviewer Reviewing"
  else if (!allCompleted && data.status === "Back to Admin") {
    if (handleStatusChange) {
      await handleStatusChange(msId, "Peer Reviewer Reviewing", "Reviewers still working");
    }
  }
  // If there are accepted reviewers but status is still "Assigning Peer Reviewer", update to "Peer Reviewer Reviewing"
  else if (hasAcceptedReviewers && data.status === "Assigning Peer Reviewer") {
    if (handleStatusChange) {
      await handleStatusChange(msId, "Peer Reviewer Reviewing", "Review in progress");
    }
  }
};
