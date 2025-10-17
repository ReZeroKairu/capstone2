import { doc, updateDoc, arrayUnion } from "firebase/firestore";
import { db } from "../firebase/firebase";
import { getAuth } from "firebase/auth";

export const useManuscriptStatus = () => {
  const auth = getAuth();

  const handleStatusChange = async (manuscriptId, newStatus, note = "") => {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("User not authenticated");

      const manuscriptRef = doc(db, "manuscripts", manuscriptId);

      const updateData = {
        status: newStatus,
        lastUpdated: new Date(),
        statusHistory: arrayUnion({
          status: newStatus,
          note,
          changedBy: user.email,
          timestamp: new Date(),
        }),
      };

      // 🟢 Add final decision metadata for end statuses
      if (["For Publication", "Rejected"].includes(newStatus)) {
        updateData.finalDecisionBy = user.email;
        updateData.finalDecisionAt = new Date();
      }

      await updateDoc(manuscriptRef, updateData);

      console.log(`✅ Manuscript ${manuscriptId} updated to ${newStatus}`);
      return { success: true };
    } catch (error) {
      console.error("❌ Error updating manuscript status:", error);
      alert("Failed to update manuscript status. Please try again.");
      return { success: false, error };
    }
  };

  return { handleStatusChange };
};
