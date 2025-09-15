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

  const updateManuscriptStatus = async (
    manuscriptId,
    updatedDecisions,
    completedReviewers = []
  ) => {
    const msRef = doc(db, "manuscripts", manuscriptId);

    const activeDecisions = Object.entries(updatedDecisions).filter(
      ([_, meta]) => meta.decision !== "backedOut"
    );

    const activeAcceptedReviewers = activeDecisions
      .filter(([_, meta]) => meta.decision === "accept")
      .map(([id]) => id);

    let newStatus;
    if (activeAcceptedReviewers.length === 0) {
      newStatus = activeDecisions.some(([, d]) => d.decision === "reject")
        ? "Peer Reviewer Rejected"
        : "Peer Reviewer Assigned";
    } else if (
      activeAcceptedReviewers.every((id) => completedReviewers.includes(id))
    ) {
      newStatus = "Back to Admin";
    } else {
      newStatus = "Peer Reviewer Reviewing";
    }

    await updateDoc(msRef, { status: newStatus });

    setManuscripts((prev) =>
      prev.map((m) =>
        m.id === manuscriptId
          ? { ...m, status: newStatus, reviewerDecisionMeta: updatedDecisions }
          : m
      )
    );
  };

  const handleDecision = async (manuscriptId, decision) => {
    setDecisions((prev) => ({ ...prev, [manuscriptId]: decision }));
    const selected = manuscripts.find((m) => m.id === manuscriptId);
    const updatedDecisions = {
      ...(selected.reviewerDecisionMeta || {}),
      [reviewerId]: { decision, decidedAt: new Date() },
    };
    await updateDoc(doc(db, "manuscripts", manuscriptId), {
      [`reviewerDecisionMeta.${reviewerId}`]: {
        decision,
        decidedAt: serverTimestamp(),
      },
    });
    await updateManuscriptStatus(manuscriptId, updatedDecisions);
  };

  const handleBackOut = async (manuscriptId) => {
    setDecisions((prev) => ({ ...prev, [manuscriptId]: "backedOut" }));
    const selected = manuscripts.find((m) => m.id === manuscriptId);
    const updatedDecisions = {
      ...(selected.reviewerDecisionMeta || {}),
      [reviewerId]: { decision: "backedOut", decidedAt: new Date() },
    };

    await updateDoc(doc(db, "manuscripts", manuscriptId), {
      [`reviewerDecisionMeta.${reviewerId}`]: {
        decision: "backedOut",
        decidedAt: serverTimestamp(),
      },
    });

    const completedReviewers =
      selected.reviewerSubmissions?.map((r) => r.reviewerId) || [];
    await updateManuscriptStatus(
      manuscriptId,
      updatedDecisions,
      completedReviewers
    );

    setManuscripts((prev) =>
      prev.map((m) =>
        m.id === manuscriptId
          ? { ...m, reviewerDecisionMeta: updatedDecisions }
          : m
      )
    );
  };

  const submitReview = async (manuscriptId) => {
    const review = reviews[manuscriptId];
    if (!review) return;

    const selected = manuscripts.find((m) => m.id === manuscriptId);
    await updateDoc(doc(db, "manuscripts", manuscriptId), {
      reviewerSubmissions: arrayUnion({
        reviewerId,
        comment: review.comment || "",
        rating: review.rating || 0,
        status: "Completed",
        completedAt: new Date(),
      }),
    });

    const completedReviewers =
      selected.reviewerSubmissions?.map((r) => r.reviewerId) || [];
    completedReviewers.push(reviewerId);

    const updatedDecisions = selected.reviewerDecisionMeta || {};
    await updateManuscriptStatus(
      manuscriptId,
      updatedDecisions,
      completedReviewers
    );
    setActiveReview(null);
  };

  const handleReviewChange = (manuscriptId, field, value) => {
    setReviews((prev) => ({
      ...prev,
      [manuscriptId]: {
        ...prev[manuscriptId],
        [field]: value,
      },
    }));
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
        {manuscripts.map((m) => {
          const myDecision =
            m.reviewerDecisionMeta?.[reviewerId]?.decision || "pending";
          return (
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

              {/* Reviewer decisions tracker */}
              {m.reviewerDecisionMeta && (
                <div className="flex flex-wrap gap-2 mt-1">
                  {Object.entries(m.reviewerDecisionMeta).map(([id, meta]) => {
                    const decisionTime =
                      meta.decidedAt || meta.timestamp || null;
                    return (
                      <span
                        key={id}
                        className={`px-2 py-1 rounded text-white text-xs ${
                          meta.decision === "accept"
                            ? "bg-green-500"
                            : meta.decision === "reject"
                            ? "bg-red-500"
                            : meta.decision === "backedOut"
                            ? "bg-yellow-500"
                            : "bg-gray-400"
                        }`}
                      >
                        {users[id]?.firstName || id}:{" "}
                        {meta.decision || "Pending"}
                        {meta.decision === "accept" && decisionTime && (
                          <>
                            {" "}
                            | Accepted at: {formatFirestoreDate(decisionTime)}
                          </>
                        )}
                        {meta.decision === "reject" && decisionTime && (
                          <>
                            {" "}
                            | Rejected at: {formatFirestoreDate(decisionTime)}
                          </>
                        )}
                      </span>
                    );
                  })}
                </div>
              )}

              {/* Accept/Reject/Back Out buttons (only if reviewer hasn't acted) */}
              {myDecision === "pending" && (
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
                  <button
                    onClick={() => handleBackOut(m.id)}
                    className="px-3 py-1 bg-yellow-500 text-white rounded hover:bg-yellow-600 text-sm"
                  >
                    Back Out
                  </button>
                </div>
              )}

              {/* Review button only if reviewer accepted */}
              {myDecision === "accept" &&
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
                ))}

              {myDecision === "reject" && (
                <p className="mt-2 text-red-600 font-semibold">
                  You have rejected this manuscript.
                </p>
              )}

              {myDecision === "backedOut" && (
                <p className="mt-2 text-yellow-600 font-semibold">
                  You have backed out from this manuscript.
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
// File: src/pages/PeerReviewer/ReviewManuscript.jsx
