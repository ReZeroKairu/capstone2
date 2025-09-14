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
  const [reviews, setReviews] = useState({});
  const [decisions, setDecisions] = useState({});

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

        // filter & strip submitter info
        const assigned = allMss
          .filter((m) => m.assignedReviewers?.includes(reviewerId))
          .map((m) => ({
            id: m.id,
            manuscriptTitle: m.manuscriptTitle || null,
            title: m.title || null,
            formTitle: m.formTitle || null,
            answeredQuestions: m.answeredQuestions || [],
            submittedAt: m.submittedAt || null,
            status: m.status || "Pending",
            assignedReviewers: m.assignedReviewers || [],
            reviewerSubmissions: m.reviewerSubmissions || [],
          }));

        setManuscripts(assigned);
        setLoading(false);
      } catch (err) {
        console.error("Error fetching manuscripts:", err);
        setLoading(false);
      }
    };

    fetchAssignedManuscripts();
  }, [reviewerId]);

  const handleReviewChange = (manuscriptId, field, value) => {
    setReviews((prev) => ({
      ...prev,
      [manuscriptId]: {
        ...prev[manuscriptId],
        [field]: value,
      },
    }));
  };

  const handleDecision = async (manuscriptId, decision) => {
    try {
      // ✅ instantly update local state so buttons vanish immediately
      setDecisions((prev) => ({ ...prev, [manuscriptId]: decision }));

      const msRef = doc(db, "manuscripts", manuscriptId);
      const selected = manuscripts.find((m) => m.id === manuscriptId);

      let newStatus = "";
      if (decision === "accept") {
        newStatus = "Peer Reviewer is Reviewing";
      } else {
        newStatus = "Peer Reviewer Rejected";
      }

      await updateDoc(msRef, { status: newStatus });

      setManuscripts((prev) =>
        prev.map((m) =>
          m.id === manuscriptId ? { ...m, status: newStatus } : m
        )
      );
    } catch (err) {
      console.error("Error setting decision:", err);
    }
  };

  const submitReview = async (manuscriptId) => {
    const review = reviews[manuscriptId];
    if (!review || decisions[manuscriptId] !== "accept") return;

    try {
      const msRef = doc(db, "manuscripts", manuscriptId);
      const selected = manuscripts.find((m) => m.id === manuscriptId);

      await updateDoc(msRef, {
        reviewerSubmissions: arrayUnion({
          reviewerId,
          comment: review.comment || "",
          rating: review.rating || 0,
          status: "Completed",
          completedAt: new Date(),
        }),
        assignedReviewers: (selected.assignedReviewers || []).filter(
          (id) => id !== reviewerId
        ),
        status:
          (selected.assignedReviewers || []).length === 1
            ? "Back to Admin"
            : selected.status,
      });

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

  // ✅ Utility to pick best manuscript title available
  const getManuscriptDisplayTitle = (m) => {
    return (
      m.manuscriptTitle ||
      m.title ||
      m.answeredQuestions?.find((q) =>
        q.question?.toLowerCase().includes("manuscript title")
      )?.answer ||
      m.formTitle ||
      "Untitled"
    );
  };

  if (loading) return <p className="pt-28 px-6">Loading manuscripts...</p>;
  if (!manuscripts.length)
    return <p className="pt-28 px-6">No assigned manuscripts found.</p>;

  return (
    <div className=" px-24 py-40">
      <h1 className="text-2xl font-bold mb-6">My Assigned Manuscripts</h1>
      <ul className="space-y-6">
        {manuscripts.map((m) => (
          <li
            key={m.id}
            className="p-4 border rounded bg-white shadow-sm flex flex-col gap-3"
          >
            {/* ✅ Always prefers manuscriptTitle */}
            <p className="font-semibold">{getManuscriptDisplayTitle(m)}</p>
            <p>Status: {m.status}</p>
            <p>
              Submitted:{" "}
              {m.submittedAt
                ? new Date(m.submittedAt.seconds * 1000).toLocaleDateString()
                : "N/A"}
            </p>

            {/* ✅ Accept/Reject buttons only show if not already decided/rejected/reviewing */}
            {!decisions[m.id] &&
              m.status !== "Peer Reviewer Rejected" &&
              m.status !== "Peer Reviewer is Reviewing" &&
              m.assignedReviewers?.includes(reviewerId) && (
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={() => handleDecision(m.id, "accept")}
                    className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600 text-sm"
                  >
                    Accept
                  </button>
                  <button
                    onClick={() => handleDecision(m.id, "reject")}
                    className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 text-sm"
                  >
                    Reject
                  </button>
                </div>
              )}

            {decisions[m.id] === "accept" && (
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

            {decisions[m.id] === "reject" && (
              <p className="mt-2 text-red-600 font-semibold">
                You have rejected this manuscript.
              </p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
