// src/pages/PeerReviewer/helpers/reviewerActions.js
import { db } from "../../../firebase/firebase";
import {
  doc,
  updateDoc,
  arrayUnion,
  arrayRemove,
  deleteField,
} from "firebase/firestore";
import { recalcManuscriptStatus } from "../../../utils/recalcManuscriptStatus";

/**
 * Assign a reviewer to a manuscript. Recalculates manuscript status afterwards.
 * @param {string} manuscriptId - The ID of the manuscript
 * @param {string} reviewerId - The ID of the reviewer to assign
 * @param {string} assignedBy - The ID of the user who assigned the reviewer
 * @param {Function} handleStatusChange - Optional function to handle status changes
 */
export const assignReviewer = async (
  manuscriptId,
  reviewerId,
  assignedBy = "adminId",
  handleStatusChange = null
) => {
  const msRef = doc(db, "manuscripts", manuscriptId);

  await updateDoc(msRef, {
    assignedReviewers: arrayUnion(reviewerId),
    [`assignedReviewersMeta.${reviewerId}`]: {
      assignedBy,
      assignedAt: new Date(),
      invitationStatus: "pending",
    },
  });

  await recalcManuscriptStatus(manuscriptId, handleStatusChange);
};

/**
 * Unassign reviewer and recalc status.
 * @param {string} manuscriptId - The ID of the manuscript
 * @param {string} reviewerId - The ID of the reviewer to unassign
 * @param {Function} handleStatusChange - Optional function to handle status changes
 */
export const unassignReviewer = async (manuscriptId, reviewerId, handleStatusChange = null) => {
  const msRef = doc(db, "manuscripts", manuscriptId);

  await updateDoc(msRef, {
    assignedReviewers: arrayRemove(reviewerId),
    [`assignedReviewersMeta.${reviewerId}`]: deleteField(),
  });

  await recalcManuscriptStatus(manuscriptId, handleStatusChange);
};
