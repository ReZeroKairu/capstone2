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
 */
export const assignReviewer = async (
  manuscriptId,
  reviewerId,
  assignedBy = "adminId"
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

  await recalcManuscriptStatus(manuscriptId);
};

/**
 * Unassign reviewer and recalc status.
 */
export const unassignReviewer = async (manuscriptId, reviewerId) => {
  const msRef = doc(db, "manuscripts", manuscriptId);

  await updateDoc(msRef, {
    assignedReviewers: arrayRemove(reviewerId),
    [`assignedReviewersMeta.${reviewerId}`]: deleteField(),
  });

  await recalcManuscriptStatus(manuscriptId);
};
