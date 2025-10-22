import { doc, updateDoc, arrayUnion } from "firebase/firestore";
import { db } from "../firebase/firebase";

/**
 * Updates manuscript deadlines dynamically depending on type.
 *
 * @param {string} manuscriptId - Firestore document ID
 * @param {string} type - "finalization" | "revision-minor" | "revision-major"
 * @param {number} days - number of days for deadline (default 7)
 */
export const updateManuscriptDeadline = async (
  manuscriptId,
  type,
  days = 7
) => {
  const msRef = doc(db, "manuscripts", manuscriptId);
  const start = new Date();
  const end = new Date();
  end.setDate(start.getDate() + days);

  let updateData = {};

  if (type === "finalization") {
    updateData = { "deadlines.finalization": { start, end } };
  } else if (type === "revision-minor" || type === "revision-major") {
    updateData = {
      deadlines: {
        revision: arrayUnion({
          type,
          start,
          end,
          completedAt: null,
        }),
      },
    };
  }

  await updateDoc(msRef, updateData);
};
