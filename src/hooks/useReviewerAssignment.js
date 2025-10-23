// src/hooks/useReviewerAssignment.js
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase/firebase";
import { useNavigate } from "react-router-dom";

/**
 * assignReviewer(manuscriptId, manuscriptStatus, statusToDeadlineField)
 * - manuscriptStatus: current status string
 * - statusToDeadlineField: mapping object used to fetch field name in DB
 */
export const useReviewerAssignment = () => {
  const navigate = useNavigate();

  const assignReviewer = async (
    manuscriptId,
    manuscriptStatus,
    statusToDeadlineField,
    handleStatusChange = null
  ) => {
    try {
      // Early return if manuscriptStatus is not in mapping (optional improvement)
      if (!statusToDeadlineField[manuscriptStatus]) {
        console.warn(
          `No deadline field mapping for manuscript status: ${manuscriptStatus}. Using default 30 days.`
        );
      }

      const settingsRef = doc(db, "deadlineSettings", "deadlines");
      const settingsSnap = await getDoc(settingsRef);

      let defaultDays = 30;
      if (settingsSnap.exists()) {
        const settings = settingsSnap.data();
        const field = statusToDeadlineField[manuscriptStatus];
        if (field && settings[field]) {
          defaultDays = settings[field];
        }
      }

      // Safer date cloning for edge cases (optional improvement)
      const today = new Date();
      const deadlineDate = new Date(today.getTime());
      deadlineDate.setDate(deadlineDate.getDate() + defaultDays);

      navigate(
        `/admin/reviewer-list?manuscriptId=${manuscriptId}&deadline=${encodeURIComponent(
          deadlineDate.toISOString()
        )}`
      );
    } catch (error) {
      console.error("Failed to load default deadline:", error);
      alert("Could not load default deadline. Please check settings.");
    }
  };

  return { assignReviewer };
};
