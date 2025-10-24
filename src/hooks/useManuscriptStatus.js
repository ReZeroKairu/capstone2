import { doc, updateDoc, arrayUnion, getDoc } from "firebase/firestore";
import { db } from "../firebase/firebase";
import { useAuth } from "../authcontext/AuthContext";

// Status constants
export const REVISION_STATUSES = {
  MINOR_REVISION: "For Revision (Minor)",
  MAJOR_REVISION: "For Revision (Major)",
  PEER_REVIEW: "Peer Reviewer Reviewing",
  BACK_TO_ADMIN: "Back to Admin",
  IN_FINALIZATION: "In Finalization",
  FINALIZED: "Finalized"
};

export const useManuscriptStatus = () => {
  const { currentUser } = useAuth();

  /**
   * Check if all currently assigned reviewers have completed their reviews
   * and no active reviewers are pending
   */
  const checkAllReviewsCompleted = (manuscript) => {
    if (!manuscript.assignedReviewers?.length) return false;
    
    // Get all completed reviews
    const completedReviews = manuscript.reviewerSubmissions?.filter(
      submission => submission.status === "Completed"
    ) || [];
    
    // Get unique reviewer IDs who have completed reviews
    const uniqueCompletedReviewerIds = [...new Set(completedReviews.map(r => r.reviewerId))];
    
    // Get all reviewers who have been assigned and not declined
    const activeReviewers = manuscript.assignedReviewers.filter(reviewerId => {
      const reviewerMeta = manuscript.assignedReviewersMeta?.[reviewerId];
      return reviewerMeta?.invitationStatus !== 'declined';
    });
    
    // Check if all active reviewers have completed their reviews
    return activeReviewers.length > 0 && 
           activeReviewers.every(reviewerId => 
             uniqueCompletedReviewerIds.includes(reviewerId)
           );
  };

  const handleStatusChange = async (manuscriptId, newStatus, note = "") => {
    try {
      if (!currentUser) {
        throw new Error("No user session. Please refresh the page and try again.");
      }

      const manuscriptRef = doc(db, "manuscripts", manuscriptId);
      const manuscriptDoc = await getDoc(manuscriptRef);
      
      if (!manuscriptDoc.exists()) {
        throw new Error("Manuscript not found");
      }
      
      const manuscript = { id: manuscriptDoc.id, ...manuscriptDoc.data() };
      const currentTime = new Date();

      const updateData = {
        status: newStatus,
        lastUpdated: currentTime,
        statusHistory: arrayUnion({
          status: newStatus,
          note,
          changedBy: currentUser.email,
          timestamp: currentTime,
        }),
      };

      // Handle Back to Admin status when all reviews are completed
      if (newStatus === REVISION_STATUSES.BACK_TO_ADMIN) {
        if (!checkAllReviewsCompleted(manuscript)) {
          throw new Error("Cannot set to 'Back to Admin' - not all reviews are completed");
        }
        
        // Set finalization deadline
        const deadlineDoc = await getDoc(doc(db, "deadlineSettings", "deadlines"));
        const finalizationDeadlineDays = deadlineDoc.data()?.finalizationDeadline || 5;
        const deadlineDate = new Date();
        deadlineDate.setDate(deadlineDate.getDate() + finalizationDeadlineDays);
        
        updateData.finalizationDeadline = deadlineDate;
        updateData.finalizationStartedAt = currentTime;
      }
      // Set deadlines based on status
      else if ([REVISION_STATUSES.MINOR_REVISION, REVISION_STATUSES.MAJOR_REVISION].includes(newStatus)) {
        // Get default revision deadline from settings
        const deadlineDoc = await getDoc(doc(db, "deadlineSettings", "deadlines"));
        const settings = deadlineDoc.data() || {};
        console.log('Retrieved deadline settings:', settings);
        
        const revisionDeadlineDays = settings.revisionDeadline || 14;
        console.log(`Setting revision deadline to ${revisionDeadlineDays} days from now`);
        
        // Calculate deadline date
        const deadlineDate = new Date();
        deadlineDate.setDate(deadlineDate.getDate() + revisionDeadlineDays);
        
        updateData.revisionDeadline = deadlineDate;
        updateData.revisionRequestedAt = currentTime;
      } 
      // Handle finalization deadline
      else if (newStatus === REVISION_STATUSES.IN_FINALIZATION) {
        const deadlineDoc = await getDoc(doc(db, "deadlineSettings", "deadlines"));
        const finalizationDeadlineDays = deadlineDoc.data()?.finalizationDeadline || 5;
        
        const deadlineDate = new Date();
        deadlineDate.setDate(deadlineDate.getDate() + finalizationDeadlineDays);
        
        updateData.finalizationDeadline = deadlineDate;
        updateData.finalizationStartedAt = currentTime;
      }
      // Clear deadlines when manuscript is finalized or rejected
      else if (["For Publication", "Rejected"].includes(newStatus)) {
        updateData.finalDecisionBy = currentUser.email;
        updateData.finalDecisionAt = currentTime;
        updateData.revisionDeadline = null;
        updateData.finalizationDeadline = null;
      }

      await updateDoc(manuscriptRef, updateData);
      
      // If this is a review submission, check if all reviews are completed
      if (newStatus === "Completed" && manuscript.status === REVISION_STATUSES.PEER_REVIEW) {
        const updatedDoc = await getDoc(manuscriptRef);
        const updatedManuscript = { id: updatedDoc.id, ...updatedDoc.data() };
        
        if (checkAllReviewsCompleted(updatedManuscript)) {
          // Automatically transition to "Back to Admin" when all reviews are completed
          await handleStatusChange(manuscriptId, REVISION_STATUSES.BACK_TO_ADMIN, "All reviews completed");
          console.log(`✅ All reviews completed. Manuscript ${manuscriptId} updated to Back to Admin`);
          return { success: true, statusUpdated: true };
        }
      }
      
      console.log(`✅ Manuscript ${manuscriptId} updated to ${newStatus}`);
      return { success: true, statusUpdated: false };
    } catch (error) {
      console.error("❌ Error updating manuscript status:", error);
      return { success: false, error };
    }
  };

  return { 
    handleStatusChange,
    checkAllReviewsCompleted,
    REVISION_STATUSES
  };
};