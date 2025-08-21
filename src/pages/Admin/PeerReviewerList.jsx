import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { db } from "../../firebase/firebase";
import {
  collection,
  getDocs,
  doc,
  updateDoc,
  getDoc,
  query,
  where,
} from "firebase/firestore";

export default function PeerReviewerList() {
  const [reviewers, setReviewers] = useState([]);
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const manuscriptId = params.get("manuscriptId"); // manuscript to assign

  const fetchReviewers = async () => {
    try {
      const usersSnap = await getDocs(collection(db, "Users"));
      const allUsers = usersSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

      const reviewersOnly = allUsers.filter((u) => u.role === "Peer Reviewer");

      const reviewersWithCount = await Promise.all(
        reviewersOnly.map(async (r) => {
          const manuscriptsSnap = await getDocs(
            query(
              collection(db, "manuscripts"),
              where("assignedReviewers", "array-contains", r.id)
            )
          );
          return { ...r, assignedCount: manuscriptsSnap.size };
        })
      );

      setReviewers(reviewersWithCount);
    } catch (err) {
      console.error("Error fetching reviewers:", err);
    }
  };

  useEffect(() => {
    fetchReviewers();
  }, []);

  const handleAssign = async (reviewerId) => {
    try {
      if (!manuscriptId) {
        alert("No manuscript selected for assignment.");
        return;
      }

      const msRef = doc(db, "manuscripts", manuscriptId);
      const msSnap = await getDoc(msRef);
      if (!msSnap.exists()) {
        alert("Manuscript not found.");
        return;
      }

      const assignedReviewers = msSnap.data().assignedReviewers || [];

      if (!assignedReviewers.includes(reviewerId)) {
        await updateDoc(msRef, {
          assignedReviewers: [...assignedReviewers, reviewerId],
          status: "Peer Reviewer Assigned",
        });
      }

      // Refresh reviewers with updated count instead of navigating away
      fetchReviewers();
      alert("Reviewer successfully assigned!");
    } catch (err) {
      console.error("Error assigning reviewer:", err);
      alert("Failed to assign reviewer. See console for details.");
    }
  };

  return (
    <div className="pt-20 px-10">
      <h1 className="text-xl font-bold mb-4">Select Peer Reviewer</h1>
      {reviewers.length === 0 ? (
        <p>No peer reviewers found.</p>
      ) : (
        <ul className="space-y-4">
          {reviewers.map((r) => (
            <li
              key={r.id}
              className="p-4 border rounded flex justify-between items-center"
            >
              <div>
                <p className="font-medium">
                  {r.name || `${r.firstName} ${r.lastName}`}
                </p>
                {r.email && <p className="text-sm text-gray-600">{r.email}</p>}
                <p className="text-sm text-gray-500">
                  Assigned manuscripts: {r.assignedCount || 0}
                </p>
              </div>
              <button
                onClick={() => handleAssign(r.id)}
                className="px-3 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
              >
                Assign to this Reviewer
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
