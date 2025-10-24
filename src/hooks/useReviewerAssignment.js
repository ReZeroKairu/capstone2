// src/hooks/useReviewerAssignment.js
import { doc, getDoc, updateDoc, arrayUnion, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase/firebase";
import { useNavigate } from "react-router-dom";

/**
 * assignReviewer(manuscriptId, reviewerId, deadline, options = {})
 * - manuscriptId: ID of the manuscript to assign the reviewer to
 * - reviewerId: ID of the reviewer to assign
 * - deadline: Deadline date as a Date object or ISO string
 * - options: Additional options like invitation message, etc.
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

      // Calculate default deadline
      const today = new Date();
      const defaultDeadline = new Date(today);
      defaultDeadline.setDate(defaultDeadline.getDate() + defaultDays);

      navigate(
        `/admin/reviewer-list?manuscriptId=${manuscriptId}&deadline=${encodeURIComponent(
          defaultDeadline.toISOString()
        )}`
      );
    } catch (error) {
      console.error("Error in assignReviewer:", error);
      throw error;
    }
  };

  const assignReviewerWithDeadline = async (
    manuscriptId,
    reviewerId,
    deadline,
    options = {}
  ) => {
    try {
      const manuscriptRef = doc(db, "manuscripts", manuscriptId);
      const deadlineDate = deadline instanceof Date ? deadline : new Date(deadline);
      
      // Update the manuscript document
      const updateData = {
        [`assignedReviewers.${reviewerId}`]: true,
        [`assignedReviewersMeta.${reviewerId}`]: {
          assignedAt: serverTimestamp(),
          deadline: deadlineDate,
          invitationStatus: 'pending',
          ...options
        },
        updatedAt: serverTimestamp()
      };

      await updateDoc(manuscriptRef, updateData);
      
      return true;
    } catch (error) {
      console.error("Error assigning reviewer with deadline:", error);
      throw error;
    }
  };

  const updateReviewerDeadline = async (manuscriptId, reviewerId, newDeadline) => {
    try {
      const manuscriptRef = doc(db, "manuscripts", manuscriptId);
      const deadlineDate = newDeadline instanceof Date ? newDeadline : new Date(newDeadline);
      
      await updateDoc(manuscriptRef, {
        [`assignedReviewersMeta.${reviewerId}.deadline`]: deadlineDate,
        updatedAt: serverTimestamp()
      });
      
      return true;
    } catch (error) {
      console.error("Error updating reviewer deadline:", error);
      throw error;
    }
  };

  const getLatestReviewerDeadline = (manuscript) => {
    if (!manuscript?.assignedReviewersMeta) return null;
    
    let latestDeadline = null;
    
    Object.values(manuscript.assignedReviewersMeta).forEach(meta => {
      if (meta.deadline) {
        const deadlineDate = meta.deadline?.toDate ? meta.deadline.toDate() : new Date(meta.deadline);
        if (!latestDeadline || deadlineDate > new Date(latestDeadline)) {
          latestDeadline = meta.deadline;
        }
      }
    });
    
    return latestDeadline;
  };

  return { 
    assignReviewer, 
    assignReviewerWithDeadline, 
    updateReviewerDeadline,
    getLatestReviewerDeadline 
  };
};
