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

  const allCompleted = assigned.length > 0 && assigned.every((rid) => completed.includes(rid));
  
  if (allCompleted && data.status !== "Back to Admin") {
    // If handleStatusChange is provided, use it to update the status and set deadlines
    if (handleStatusChange) {
      await handleStatusChange(msId, "Back to Admin", "All reviews completed");
    }
  } else if (!allCompleted && data.status === "Back to Admin") {
    if (handleStatusChange) {
      await handleStatusChange(msId, "Peer Reviewer Reviewing", "Reviewers still working");
    }
  }
};
