// src/utils/recalcManuscriptStatus.js
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "../firebase/firebase";

export const recalcManuscriptStatus = async (msId) => {
  const msRef = doc(db, "manuscripts", msId);
  const docSnap = await getDoc(msRef);
  if (!docSnap.exists()) return;

  const data = docSnap.data();
  const assigned = data.assignedReviewers || [];
  const completed = data.reviewerSubmissions?.map((r) => r.reviewerId) || [];

  const allCompleted = assigned.every((rid) => completed.includes(rid));

  if (allCompleted && data.status !== "Back to Admin") {
    await updateDoc(msRef, { status: "Back to Admin" });
  } else if (!allCompleted && data.status === "Back to Admin") {
    await updateDoc(msRef, { status: "Peer Reviewer Reviewing" });
  }
};
