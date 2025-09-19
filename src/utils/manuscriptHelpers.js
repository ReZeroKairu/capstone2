// manuscriptHelpers.js
import { NotificationService } from "./notificationService";

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
  reviewerSubmissions = []
) {
  if (!assignedReviewers.length) return "Assigning Peer Reviewer";

  const decisions = assignedReviewers.map(
    (id) => reviewerDecisionMeta?.[id]?.decision
  );

  // Check if all reviewers have made decisions
  const allReviewersDecided = decisions.every((d) => d && d !== "pending");
  
  // If all reviewers have decided, check if they've all submitted their reviews
  if (allReviewersDecided) {
    const submittedReviewerIds = reviewerSubmissions?.map(r => r.reviewerId) || [];
    const allReviewersSubmitted = assignedReviewers.every(id => 
      submittedReviewerIds.includes(id)
    );
    
    if (allReviewersSubmitted) {
      return "Back to Admin"; // All decisions made and all reviews submitted
    } else {
      return "Peer Reviewer Reviewing"; // Still waiting for review submissions
    }
  }

  // If some have decided but not all
  if (decisions.some((d) => d === "accept" || d === "reject")) {
    return "Peer Reviewer Reviewing";
  }

  return "Peer Reviewer Assigned"; // default if all pending
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
 */
export async function handleManuscriptStatusChange(manuscriptId, manuscriptTitle, oldStatus, newStatus, authorId, adminId) {
  if (oldStatus !== newStatus) {
    await NotificationService.notifyManuscriptStatusChange(
      manuscriptId, 
      manuscriptTitle, 
      oldStatus, 
      newStatus, 
      authorId, 
      adminId
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
  await NotificationService.notifyPeerReviewerAssignment(
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
  const adminIds = await NotificationService.getAdminUserIds();
  await NotificationService.notifyPeerReviewerDecision(
    manuscriptId, 
    manuscriptTitle, 
    reviewerId, 
    decision, 
    adminIds
  );
}

/**
 * Handle review completion with notifications
 * @param {string} manuscriptId - Manuscript ID
 * @param {string} manuscriptTitle - Manuscript title
 * @param {string} reviewerId - Reviewer ID
 */
export async function handleReviewCompletion(manuscriptId, manuscriptTitle, reviewerId) {
  const adminIds = await NotificationService.getAdminUserIds();
  await NotificationService.notifyReviewCompleted(
    manuscriptId, 
    manuscriptTitle, 
    reviewerId, 
    adminIds
  );
}

/**
 * Handle new manuscript submission with notifications
 * @param {string} manuscriptId - Manuscript ID
 * @param {string} manuscriptTitle - Manuscript title
 * @param {string} authorId - Author ID
 */
export async function handleManuscriptSubmission(manuscriptId, manuscriptTitle, authorId) {
  const adminIds = await NotificationService.getAdminUserIds();
  await NotificationService.notifyManuscriptSubmission(
    manuscriptId, 
    manuscriptTitle, 
    authorId, 
    adminIds
  );
}
