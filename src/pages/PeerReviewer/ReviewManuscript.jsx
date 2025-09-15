import { useEffect, useState } from "react";
import { getAuth } from "firebase/auth";
import { db } from "../../firebase/firebase";
import {
  collection,
  updateDoc,
  doc,
  arrayUnion,
  serverTimestamp,
  getDocs,
} from "firebase/firestore";

export default function ReviewManuscript() {
  const [reviewerId, setReviewerId] = useState(null);
  const [manuscripts, setManuscripts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reviews, setReviews] = useState({});
  const [decisions, setDecisions] = useState({});
  const [users, setUsers] = useState({});
  const [activeReview, setActiveReview] = useState(null);

  const formatFirestoreDate = (ts) =>
    ts?.toDate?.()
      ? ts.toDate().toLocaleString()
      : ts instanceof Date
      ? ts.toLocaleString()
      : "N/A";

  useEffect(() => {
    const auth = getAuth();
    const user = auth.currentUser;
    if (user) setReviewerId(user.uid);
  }, []);

  useEffect(() => {
    if (!reviewerId) return;

    const fetchAssignedManuscripts = async () => {
      try {
        const usersSnap = await getDocs(collection(db, "Users"));
        const allUsers = usersSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
        const usersMap = Object.fromEntries(allUsers.map((u) => [u.id, u]));
        setUsers(usersMap);

        const msSnap = await getDocs(collection(db, "manuscripts"));
        const allMss = msSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

        const assigned = allMss
          .filter((m) => m.assignedReviewers?.includes(reviewerId))
          .map((m) => {
            const meta = m.assignedReviewersMeta?.[reviewerId] || {};
            const assignedByUser = usersMap[meta.assignedBy];
            return {
              ...m,
              assignedReviewersMeta: {
                ...m.assignedReviewersMeta,
                [reviewerId]: {
                  ...meta,
                  assignedByName: assignedByUser
                    ? `${assignedByUser.firstName} ${
                        assignedByUser.middleName
                          ? assignedByUser.middleName + " "
                          : ""
                      }${assignedByUser.lastName}`
                    : meta.assignedBy || "—",
                },
              },
            };
          });

        const assignedSorted = assigned.sort((a, b) => {
          const aMeta = a.assignedReviewersMeta?.[reviewerId] || {};
          const bMeta = b.assignedReviewersMeta?.[reviewerId] || {};
          const aTime =
            aMeta.assignedAt?.seconds || aMeta.assignedAt?.toMillis?.() || 0;
          const bTime =
            bMeta.assignedAt?.seconds || bMeta.assignedAt?.toMillis?.() || 0;
          return bTime - aTime;
        });

        setManuscripts(assignedSorted);
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
      setDecisions((prev) => ({ ...prev, [manuscriptId]: decision }));

      const msRef = doc(db, "manuscripts", manuscriptId);
      const newStatus =
        decision === "accept"
          ? "Peer Reviewer Reviewing"
          : "Peer Reviewer Rejected";

      const reviewerDecisionMetaUpdate = {};
      reviewerDecisionMetaUpdate[`reviewerDecisionMeta.${reviewerId}`] = {
        decision,
        decidedAt: serverTimestamp(),
      };

      await updateDoc(msRef, {
        status: newStatus,
        ...reviewerDecisionMetaUpdate,
      });

      setManuscripts((prev) =>
        prev.map((m) =>
          m.id === manuscriptId
            ? {
                ...m,
                status: newStatus,
                reviewerDecisionMeta: {
                  ...m.reviewerDecisionMeta,
                  [reviewerId]: {
                    decision,
                    decidedAt: new Date(),
                  },
                },
              }
            : m
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
          completedAt: serverTimestamp(),
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

      setActiveReview(null);
    } catch (err) {
      console.error("Error submitting review:", err);
    }
  };

  const getManuscriptDisplayTitle = (m) =>
    m.manuscriptTitle ||
    m.title ||
    m.answeredQuestions?.find((q) =>
      q.question?.toLowerCase().includes("manuscript title")
    )?.answer ||
    m.formTitle ||
    "Untitled";

  if (loading) return <p className="pt-28 px-6">Loading manuscripts...</p>;
  if (!manuscripts.length)
    return <p className="pt-28 px-6">No assigned manuscripts found.</p>;

  return (
    <div className="px-24 py-40">
      <h1 className="text-2xl font-bold mb-6">My Assigned Manuscripts</h1>
      <ul className="space-y-6">
        {manuscripts.map((m) => (
          <li
            key={m.id}
            className="p-4 border rounded bg-white shadow-sm flex flex-col gap-3"
          >
            <p className="font-semibold">{getManuscriptDisplayTitle(m)}</p>
            <p>Status: {m.status}</p>
            <p>
              Submitted:{" "}
              {m.submittedAt ? formatFirestoreDate(m.submittedAt) : "N/A"}
            </p>

            {m.assignedReviewersMeta?.[reviewerId] && (
              <p>
                Assigned at:{" "}
                {formatFirestoreDate(
                  m.assignedReviewersMeta[reviewerId].assignedAt
                )}
                <br />
                Assigned by:{" "}
                {m.assignedReviewersMeta[reviewerId].assignedByName}
              </p>
            )}

            {/* Accept/Reject buttons for Peer Reviewer Assigned */}
            {m.status === "Peer Reviewer Assigned" && !decisions[m.id] && (
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

            {/* Show Review button if status is Peer Reviewer Reviewing */}
            {(m.status === "Peer Reviewer Reviewing" ||
              decisions[m.id] === "accept") &&
              (activeReview !== m.id ? (
                <button
                  onClick={() => setActiveReview(m.id)}
                  className="mt-2 px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
                >
                  Review
                </button>
              ) : (
                <div className="flex flex-col gap-2 mt-2">
                  <textarea
                    id={`reviewComment-${m.id}`}
                    name={`reviewComment-${m.id}`}
                    placeholder="Add your review comments"
                    className="border p-2 rounded w-full"
                    value={reviews[m.id]?.comment || ""}
                    onChange={(e) =>
                      handleReviewChange(m.id, "comment", e.target.value)
                    }
                  />
                  <input
                    id={`reviewRating-${m.id}`}
                    name={`reviewRating-${m.id}`}
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
              ))}

            {/* Show rejected message */}
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
