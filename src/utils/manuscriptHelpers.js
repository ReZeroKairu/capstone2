// manuscriptHelpers.js

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
