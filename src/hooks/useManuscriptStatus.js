import { doc, updateDoc, arrayUnion, getDoc } from "firebase/firestore";
import { db } from "../firebase/firebase";
import { getAuth } from "firebase/auth";

// Status constants
const REVISION_STATUSES = {
  MINOR_REVISION: "For Revision (Minor)",
  MAJOR_REVISION: "For Revision (Major)",
  IN_FINALIZATION: "In Finalization",
  FINALIZED: "Finalized"
};

export const useManuscriptStatus = () => {
  const auth = getAuth();

  const handleStatusChange = async (manuscriptId, newStatus, note = "") => {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("User not authenticated");

      const manuscriptRef = doc(db, "manuscripts", manuscriptId);
      const currentTime = new Date();

      const updateData = {
        status: newStatus,
        lastUpdated: currentTime,
        statusHistory: arrayUnion({
          status: newStatus,
          note,
          changedBy: user.email,
          timestamp: currentTime,
        }),
      };

      // Set deadlines based on status
      if ([REVISION_STATUSES.MINOR_REVISION, REVISION_STATUSES.MAJOR_REVISION].includes(newStatus)) {
        // Get default revision deadline from settings
        const deadlineDoc = await getDoc(doc(db, "deadlineSettings", "deadlines"));
        const revisionDeadlineDays = deadlineDoc.data()?.revisionDeadline || 14;
        
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
        updateData.finalDecisionBy = user.email;
        updateData.finalDecisionAt = currentTime;
        updateData.revisionDeadline = null;
        updateData.finalizationDeadline = null;
      }

      await updateDoc(manuscriptRef, updateData);
      console.log(`✅ Manuscript ${manuscriptId} updated to ${newStatus}`);
      return { success: true };
    } catch (error) {
      console.error("❌ Error updating manuscript status:", error);
      return { success: false, error };
    }
  };

  return { 
    handleStatusChange,
    REVISION_STATUSES // Export the status constants for use in other components
  };
};