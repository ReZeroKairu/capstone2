// manuscriptHelpers.js
import { db } from '../firebase/firebase';
import { doc, getDoc, setDoc, serverTimestamp, collection } from 'firebase/firestore';
import { notificationService } from "./notificationService";

/**
 * Compute final manuscript status based on reviewer decisions and submissions.
 * @param {Object} reviewerDecisionMeta - { reviewerId: { decision } }
 * @param {Array} assignedReviewers - array of reviewer IDs
 * @param {Array} reviewerSubmissions - array of completed reviews (optional)
 * @returns {string} final manuscript status
 */
export function computeManuscriptStatus(
  reviewerDecisionMeta = {},
  assignedReviewers = [],
  reviewerSubmissions = [],
  originalReviewers = [] // add this parameter
) {
  // Combine current and original reviewers to account for past decisions
  const allReviewers = [...new Set([...assignedReviewers, ...originalReviewers])];

  if (!allReviewers.length) return "Assigning Peer Reviewer";

  const decisions = allReviewers.map(
    (id) => reviewerDecisionMeta?.[id]?.decision
  );

  const allReviewersDecided = decisions.every((d) => d && d !== "pending");

  if (allReviewersDecided) {
    const submittedReviewerIds = reviewerSubmissions?.map(r => r.reviewerId) || [];
    const allReviewersSubmitted = assignedReviewers.every(id =>
      submittedReviewerIds.includes(id)
    );

    if (allReviewersSubmitted) return "Back to Admin";
    else return "Peer Reviewer Reviewing";
  }

  if (decisions.some((d) => d === "accept" || d === "reject")) {
    return "Peer Reviewer Reviewing";
  }

  return "Peer Reviewer Assigned";
}


/**
 * Filters assigned reviewers for "For Publication"
 * Only keeps reviewers who accepted
 */
export function filterAcceptedReviewers(
  reviewerDecisionMeta = {},
  assignedReviewersData = []
) {
  return assignedReviewersData.filter(
    (r) => reviewerDecisionMeta?.[r.id]?.decision === "accept"
  );
}

/**
 * Filters assigned reviewers for "Peer Reviewer Rejected"
 * Only keeps reviewers who rejected
 */
export function filterRejectedReviewers(
  reviewerDecisionMeta = {},
  assignedReviewersData = []
) {
  return assignedReviewersData.filter(
    (r) => reviewerDecisionMeta?.[r.id]?.decision === "reject"
  );
}

/**
 * Handle manuscript status change with notifications
 * @param {string} manuscriptId - Manuscript ID
 * @param {string} manuscriptTitle - Manuscript title
 * @param {string} oldStatus - Previous status
 * @param {string} newStatus - New status
 * @param {string} authorId - Author user ID
 * @param {string} adminId - Admin user ID (optional)
 * @param {Array} reviewerIds - Array of reviewer IDs (optional)
 */
export async function handleManuscriptStatusChange(manuscriptId, manuscriptTitle, oldStatus, newStatus, authorId, adminId, reviewerIds = []) {
  if (oldStatus !== newStatus) {
    await notificationService.notifyManuscriptStatusChange(
      manuscriptId, 
      manuscriptTitle, 
      oldStatus, 
      newStatus, 
      authorId, 
      adminId,
      reviewerIds
    );
  }
}

/**
 * Handle peer reviewer assignment with notifications
 * @param {string} manuscriptId - Manuscript ID
 * @param {string} manuscriptTitle - Manuscript title
 * @param {Array} reviewerIds - Array of reviewer IDs
 * @param {string} assignedByAdminId - Admin who assigned reviewers
 */
export async function handlePeerReviewerAssignment(manuscriptId, manuscriptTitle, reviewerIds, assignedByAdminId) {
  await notificationService.notifyPeerReviewerAssignment(
    manuscriptId, 
    manuscriptTitle, 
    reviewerIds, 
    assignedByAdminId
  );
}

/**
 * Handle peer reviewer decision with notifications
 * @param {string} manuscriptId - Manuscript ID
 * @param {string} manuscriptTitle - Manuscript title
 * @param {string} reviewerId - Reviewer ID
 * @param {string} decision - Decision (accept/reject/backedOut)
 */
export async function handlePeerReviewerDecision(manuscriptId, manuscriptTitle, reviewerId, decision) {
  const adminIds = await notificationService.getAdminUserIds();
  await notificationService.notifyPeerReviewerDecision(
    manuscriptId, 
    manuscriptTitle, 
    reviewerId, 
    adminIds, 
    decision === 'accept'
  );
}

/**
 * Handle review completion with notifications
 * @param {string} manuscriptId - Manuscript ID
 * @param {string} manuscriptTitle - Manuscript title
 * @param {string} reviewerId - Reviewer ID
 */
export async function handleReviewCompletion(manuscriptId, manuscriptTitle, reviewerId) {
  try {
    console.log('Starting review completion for manuscript:', manuscriptId);
    
    // 1. Get the manuscript data first
    const manuscriptRef = doc(db, 'manuscripts', manuscriptId);
    const manuscriptSnap = await getDoc(manuscriptRef);
    
    if (!manuscriptSnap.exists()) {
      console.error('Manuscript not found for archiving:', manuscriptId);
      return;
    }

    const manuscriptData = manuscriptSnap.data();
    
    // 2. Get the author ID from manuscript data
    const authorId = manuscriptData.authorId;
    if (!authorId) {
      console.error('Author ID not found in manuscript data');
      return;
    }
    
    // 3. Find the specific review being completed
    const review = manuscriptData.reviewerSubmissions?.find(
      sub => sub.reviewerId === reviewerId && sub.status === 'Completed'
    );

    if (!review) {
      console.error('Completed review not found for archiving');
      return;
    }

    // 4. Get admin IDs for notification
    const adminIds = await notificationService.getAdminUserIds();
    console.log('Admin IDs for notification:', adminIds);

    // 5. Create a unique ID for this review using manuscriptId, reviewerId, and version
    const versionNumber = review.manuscriptVersionNumber || 1;
    const reviewId = `${manuscriptId}_${reviewerId}_v${versionNumber}`;
    const reviewRef = doc(db, 'completedReviews', reviewId);

    // 6. Create/update archive document in completedReviews collection
    const archiveData = {
      id: reviewId,
      manuscriptId,
      manuscriptTitle,
      versionNumber,
      reviewerId,
      decision: manuscriptData.reviewerDecisionMeta?.[reviewerId]?.decision || 'pending',
      recommendation: manuscriptData.reviewerDecisionMeta?.[reviewerId]?.recommendation || null,
      status: review.status,
      comment: review.comment || '',
      reviewFileUrl: review.reviewFileUrl || null,
      reviewFileName: review.reviewFileName || null,
      completedAt: review.completedAt || serverTimestamp(),
      archivedAt: serverTimestamp(),
      authorId: authorId, // Use the authorId we got from manuscript data
      manuscriptStatus: manuscriptData.status,
      assignedReviewers: manuscriptData.assignedReviewers || [],
      originalAssignedReviewers: manuscriptData.originalAssignedReviewers || [],
      reviewerDecisionMeta: manuscriptData.reviewerDecisionMeta || {}
    };

    console.log('Saving review with data:', archiveData);

    // 7. Save the review
    await setDoc(reviewRef, archiveData, { merge: true });

    // 8. Send notification to admins
    try {
      console.log('Sending review completed notification...');
      await notificationService.notifyReviewCompleted(
        manuscriptId, 
        manuscriptTitle, 
        reviewerId, 
        adminIds
      );
      console.log('Notification sent successfully');
    } catch (notifError) {
      console.error('Error sending notification:', notifError);
      // Continue even if notification fails
    }

    console.log('Review archived successfully');
  } catch (error) {
    console.error('Error in handleReviewCompletion:', error);
    // Don't throw to avoid breaking the review submission flow
  }
}

/**
 * Handle new manuscript submission with notifications
 * @param {string} manuscriptId - Manuscript ID
 * @param {string} manuscriptTitle - Manuscript title
 * @param {string} authorId - Author ID
 */
export async function handleManuscriptSubmission(manuscriptId, manuscriptTitle, authorId) {
  const adminIds = await notificationService.getAdminUserIds();
  await notificationService.notifyManuscriptSubmission(
    manuscriptId, 
    manuscriptTitle, 
    authorId, 
    adminIds
  );
}
