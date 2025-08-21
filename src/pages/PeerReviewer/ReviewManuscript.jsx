import { useEffect, useState } from "react";
import { getAuth } from "firebase/auth";
import { db } from "../../firebase/firebase";
import {
  collection,
  getDocs,
  updateDoc,
  doc,
  arrayUnion,
} from "firebase/firestore";

export default function ReviewManuscript() {
  const [reviewerId, setReviewerId] = useState(null);
  const [manuscripts, setManuscripts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reviews, setReviews] = useState({}); // Track comments & ratings per manuscript

  // Get logged-in reviewer ID
  useEffect(() => {
    const auth = getAuth();
    const user = auth.currentUser;
    if (user) setReviewerId(user.uid);
  }, []);

  // Fetch manuscripts assigned to this reviewer
  useEffect(() => {
    if (!reviewerId) return;

    const fetchAssignedManuscripts = async () => {
      try {
        const msSnap = await getDocs(collection(db, "manuscripts"));
        const allMss = msSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

        const assigned = allMss.filter((m) =>
          m.assignedReviewers?.includes(reviewerId)
        );

        setManuscripts(assigned);
        setLoading(false);
      } catch (err) {
        console.error("Error fetching manuscripts:", err);
        setLoading(false);
      }
    };

    fetchAssignedManuscripts();
  }, [reviewerId]);

  // Update local review state as reviewer types
  const handleReviewChange = (manuscriptId, field, value) => {
    setReviews((prev) => ({
      ...prev,
      [manuscriptId]: {
        ...prev[manuscriptId],
        [field]: value,
      },
    }));
  };

  const submitReview = async (manuscriptId) => {
    const review = reviews[manuscriptId];
    if (!review) return;

    try {
      const msRef = doc(db, "manuscripts", manuscriptId);

      // Add reviewer review to Firestore
      await updateDoc(msRef, {
        reviewerSubmissions: arrayUnion({
          reviewerId,
          comment: review.comment || "",
          rating: review.rating || 0,
          status: "Completed",
          completedAt: new Date(),
        }),
        assignedReviewers: manuscripts
          .find((m) => m.id === manuscriptId)
          .assignedReviewers.filter((id) => id !== reviewerId),
        status:
          manuscripts.find((m) => m.id === manuscriptId).assignedReviewers
            .length === 1
            ? "Back to Admin"
            : manuscripts.find((m) => m.id === manuscriptId).status,
      });

      // Update local state
      setManuscripts((prev) =>
        prev.map((m) =>
          m.id === manuscriptId
            ? {
                ...m,
                assignedReviewers: m.assignedReviewers.filter(
                  (id) => id !== reviewerId
                ),
                reviewerSubmissions: [
                  ...(m.reviewerSubmissions || []),
                  {
                    reviewerId,
                    comment: review.comment || "",
                    rating: review.rating || 0,
                    status: "Completed",
                    completedAt: new Date(),
                  },
                ],
                status:
                  m.assignedReviewers.length === 1 ? "Back to Admin" : m.status,
              }
            : m
        )
      );
    } catch (err) {
      console.error("Error submitting review:", err);
    }
  };

  if (loading) return <p className="pt-28 px-6">Loading manuscripts...</p>;
  if (!manuscripts.length)
    return <p className="pt-28 px-6">No assigned manuscripts found.</p>;

  return (
    <div className="pt-36 px-24">
      <h1 className="text-2xl font-bold mb-6">My Assigned Manuscripts</h1>
      <ul className="space-y-6">
        {manuscripts.map((m) => (
          <li
            key={m.id}
            className="p-4 border rounded bg-white shadow-sm flex flex-col gap-3"
          >
            <p className="font-semibold">{m.title || m.formTitle}</p>
            <p>Status: {m.status}</p>
            <p>
              Submitted:{" "}
              {m.submittedAt
                ? new Date(m.submittedAt.seconds * 1000).toLocaleDateString()
                : "N/A"}
            </p>

            {m.assignedReviewers?.includes(reviewerId) && (
              <div className="flex flex-col gap-2 mt-2">
                <textarea
                  placeholder="Add your review comments"
                  className="border p-2 rounded w-full"
                  value={reviews[m.id]?.comment || ""}
                  onChange={(e) =>
                    handleReviewChange(m.id, "comment", e.target.value)
                  }
                />
                <input
                  type="number"
                  min="0"
                  max="5"
                  placeholder="Rating (0-5)"
                  className="border p-2 rounded w-32"
                  value={reviews[m.id]?.rating || ""}
                  onChange={(e) =>
                    handleReviewChange(m.id, "rating", e.target.value)
                  }
                />
                <button
                  onClick={() => submitReview(m.id)}
                  className="mt-2 px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600 text-sm"
                >
                  Submit Review & Mark Completed
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
