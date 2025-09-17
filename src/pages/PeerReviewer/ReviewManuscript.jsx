import { useEffect, useState } from "react";
import { getAuth } from "firebase/auth";
import { db } from "../../firebase/firebase";
import {
  collection,
  updateDoc,
  doc,
  arrayUnion,
  getDocs,
  getDoc,
} from "firebase/firestore";
import {
  computeManuscriptStatus,
  filterAcceptedReviewers,
} from "../../utils/manuscriptHelpers";

export default function ReviewManuscript() {
  const [reviewerId, setReviewerId] = useState(null);
  const [manuscripts, setManuscripts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reviews, setReviews] = useState({});
  const [users, setUsers] = useState({});
  const [activeReview, setActiveReview] = useState(null);
  const [userRole, setUserRole] = useState(null);

  const formatFirestoreDate = (ts) =>
    ts?.toDate?.()
      ? ts.toDate().toLocaleString()
      : ts instanceof Date
      ? ts.toLocaleString()
      : "N/A";

  const decisionLabels = {
    accept: "Accepted",
    reject: "Rejected",
    backedOut: "Backed Out",
    pending: "Pending",
  };

  useEffect(() => {
    const fetchUserAndManuscripts = async () => {
      try {
        const auth = getAuth();
        const user = auth.currentUser;
        if (!user) return;

        const uid = user.uid;
        setReviewerId(uid);

        // Fetch user role
        const userDoc = await getDoc(doc(db, "Users", uid));
        if (userDoc.exists()) setUserRole(userDoc.data().role);

        // Fetch all users
        const usersSnap = await getDocs(collection(db, "Users"));
        const allUsers = usersSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
        const usersMap = Object.fromEntries(allUsers.map((u) => [u.id, u]));
        setUsers(usersMap);

        // Fetch all manuscripts
        const msSnap = await getDocs(collection(db, "manuscripts"));
        const allMss = msSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

        // Filter assigned manuscripts using consistent logic
        const assigned = allMss
          .filter((m) => {
            // For final status manuscripts, only show if reviewer is in current assignedReviewers
            if (["For Publication", "Peer Reviewer Rejected"].includes(m.status)) {
              return (m.assignedReviewers || []).includes(uid);
            }
            
            // For other statuses, show if they are involved in any way
            const currentlyAssigned = (m.assignedReviewers || []).includes(uid);
            const originallyAssigned = (m.originalAssignedReviewers || []).includes(uid);
            const hasDecision = m.reviewerDecisionMeta && m.reviewerDecisionMeta[uid];
            const hasSubmission = m.reviewerSubmissions && m.reviewerSubmissions.some(s => s.reviewerId === uid);
            
            return currentlyAssigned || originallyAssigned || hasDecision || hasSubmission;
          })
          .map((m) => {
            const meta = m.assignedReviewersMeta?.[uid] || {};
            const assignedByUser = usersMap[meta.assignedBy];
            return {
              ...m,
              assignedReviewersMeta: {
                ...m.assignedReviewersMeta,
                [uid]: {
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

        // Sort by assigned time descending
        const assignedSorted = assigned.sort((a, b) => {
          const aTime =
            a.assignedReviewersMeta?.[uid]?.assignedAt?.seconds || 0;
          const bTime =
            b.assignedReviewersMeta?.[uid]?.assignedAt?.seconds || 0;
          return bTime - aTime;
        });

        setManuscripts(assignedSorted);
        setLoading(false);
      } catch (err) {
        console.error("Failed to fetch user or manuscripts:", err);
        setLoading(false);
      }
    };

    fetchUserAndManuscripts();
  }, []);

  // Log reviewer history
  const logReviewerHistory = async (msRef, reviewerId, decision) => {
    await updateDoc(msRef, {
      [`reviewerHistory.${reviewerId}`]: arrayUnion({
        decision,
        decidedAt: new Date(),
      }),
    });
  };

  // Update manuscript status
  const updateManuscriptStatus = async (
    manuscriptId,
    updatedDecisions,
    completedReviewers = []
  ) => {
    const msRef = doc(db, "manuscripts", manuscriptId);
    
    // Get the current manuscript to access assignedReviewers
    const currentSnapshot = await getDoc(msRef);
    const currentData = currentSnapshot.exists() ? currentSnapshot.data() : {};
    const assignedReviewers = currentData.assignedReviewers || [];

    const newStatus = computeManuscriptStatus(
      updatedDecisions,
      assignedReviewers,
      currentData.reviewerSubmissions || []
    );

    const statusChanged = currentData.status !== newStatus;
    const decisionsChanged =
      JSON.stringify(currentData.reviewerDecisionMeta || {}) !==
      JSON.stringify(updatedDecisions);

    if (statusChanged || decisionsChanged) {
      await updateDoc(msRef, {
        ...(statusChanged && { status: newStatus }),
        ...(decisionsChanged && { reviewerDecisionMeta: updatedDecisions }),
      });
    }

    setManuscripts((prev) =>
      prev.map((m) =>
        m.id === manuscriptId
          ? { ...m, status: newStatus, reviewerDecisionMeta: updatedDecisions }
          : m
      )
    );
  };

  const handleDecision = async (manuscriptId, decision) => {
    const selected = manuscripts.find((m) => m.id === manuscriptId);
    if (!selected) return;

    const updatedDecisions = {
      ...(selected.reviewerDecisionMeta || {}),
      [reviewerId]: { decision, decidedAt: new Date() },
    };

    const msRef = doc(db, "manuscripts", manuscriptId);
    await logReviewerHistory(msRef, reviewerId, decision);
    await updateManuscriptStatus(manuscriptId, updatedDecisions);

    // Update local state immediately
    setManuscripts((prev) =>
      prev.map((m) =>
        m.id === manuscriptId
          ? { ...m, reviewerDecisionMeta: updatedDecisions }
          : m
      )
    );
  };

  const handleBackOut = async (manuscriptId) => {
    const selected = manuscripts.find((m) => m.id === manuscriptId);
    if (!selected) return;

    const msRef = doc(db, "manuscripts", manuscriptId);

    const assigned = (selected.assignedReviewers || []).filter(
      (id) => id !== reviewerId
    );
    const assignedMeta = { ...(selected.assignedReviewersMeta || {}) };
    delete assignedMeta[reviewerId];

    const updatedDecisions = { ...(selected.reviewerDecisionMeta || {}) };
    delete updatedDecisions[reviewerId];

    await logReviewerHistory(msRef, reviewerId, "backedOut");

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
          ? {
              ...m,
              assignedReviewers: assigned,
              assignedReviewersMeta: assignedMeta,
              reviewerDecisionMeta: updatedDecisions,
            }
          : m
      )
    );
  };

  const submitReview = async (manuscriptId) => {
    const review = reviews[manuscriptId];
    if (!review) return;

    const selected = manuscripts.find((m) => m.id === manuscriptId);
    if (!selected) return;

    const hasSubmittedReview = selected.reviewerSubmissions?.some(
      (r) => r.reviewerId === reviewerId
    );
    if (hasSubmittedReview) return;

    const newSubmission = {
      reviewerId,
      comment: review.comment || "",
      rating: review.rating || 0,
      status: "Completed",
      completedAt: new Date(),
    };

    const msRef = doc(db, "manuscripts", manuscriptId);

    // Add review to Firestore
    await updateDoc(msRef, {
      reviewerSubmissions: arrayUnion(newSubmission),
    });

    const updatedReviewerSubmissions = [
      ...(selected.reviewerSubmissions || []),
      newSubmission,
    ];

    const completedReviewers = updatedReviewerSubmissions.map(
      (r) => r.reviewerId
    );
    const updatedDecisions = selected.reviewerDecisionMeta || {};

    await updateManuscriptStatus(
      manuscriptId,
      updatedDecisions,
      completedReviewers
    );

    setManuscripts((prev) =>
      prev.map((m) =>
        m.id === manuscriptId
          ? { ...m, reviewerSubmissions: updatedReviewerSubmissions }
          : m
      )
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

  const inProgressStatuses = [
    "Peer Reviewer Assigned",
    "Peer Reviewer Reviewing",
    "Back to Admin",
    "For Revision",
  ];

  const inProgressManuscripts = manuscripts.filter((m) =>
    inProgressStatuses.includes(m.status)
  );

  if (!inProgressManuscripts.length)
    return <p className="pt-28 px-6">No in-progress manuscripts found.</p>;

  const getReviewerStatusLabel = (status) => {
    switch (status) {
      case "Back to Admin":
        return "Review completed";
      case "Peer Reviewer Assigned":
        return "Awaiting your response";
      case "Peer Reviewer Reviewing":
        return "Review in progress";
      case "For Revision":
        return "Author revising";
      default:
        return status;
    }
  };

  return (
    <div className="px-24 py-40">
      <h1 className="text-2xl font-bold mb-6">My Assigned Manuscripts</h1>
      <ul className="space-y-6">
        {inProgressManuscripts.map((m) => {
          const myDecision =
            m.reviewerDecisionMeta?.[reviewerId]?.decision || "pending";
          const hasSubmittedReview = m.reviewerSubmissions?.some(
            (r) => r.reviewerId === reviewerId
          );

          return (
            <li
              key={m.id}
              className="p-4 border rounded bg-white shadow-sm flex flex-col gap-3"
            >
              <p className="font-semibold">{getManuscriptDisplayTitle(m)}</p>
              <p>Status: {getReviewerStatusLabel(m.status)}</p>
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

              {m.reviewerDecisionMeta?.[reviewerId] && (
                <div className="flex flex-wrap gap-2 mt-1">
                  {(() => {
                    const meta = m.reviewerDecisionMeta[reviewerId];
                    const decisionTime = meta.decidedAt || null;
                    return (
                      <span
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
                        You: {decisionLabels[meta.decision] || "Pending"}
                        {decisionTime && (
                          <> | {formatFirestoreDate(decisionTime)}</>
                        )}
                      </span>
                    );
                  })()}
                </div>
              )}

              {userRole === "Admin" && m.reviewerDecisionMeta && (
                <div className="mt-2 text-sm text-gray-700">
                  <p className="font-medium">All Reviewer Decisions:</p>
                  <ul className="list-disc ml-4">
                    {Object.entries(m.reviewerDecisionMeta).map(
                      ([revId, meta]) => (
                        <li key={revId}>
                          {users[revId]
                            ? `${users[revId].firstName} ${users[revId].lastName}`
                            : revId}
                          : {decisionLabels[meta.decision] || meta.decision}
                        </li>
                      )
                    )}
                  </ul>
                </div>
              )}

              {m.reviewerHistory?.[reviewerId] && (
                <div className="mt-2 text-xs text-gray-600">
                  <p className="font-medium">History:</p>
                  <ul className="list-disc ml-4">
                    {m.reviewerHistory[reviewerId].map((h, idx) => (
                      <li key={idx}>
                        {decisionLabels[h.decision] || h.decision} at{" "}
                        {formatFirestoreDate(h.decidedAt)}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Action buttons */}
              {myDecision === "pending" && (
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={() => handleDecision(m.id, "accept")}
                    className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600 text-sm"
                  >
                    Accept Manuscript
                  </button>
                  <button
                    onClick={() => handleDecision(m.id, "reject")}
                    className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 text-sm"
                  >
                    Reject Manuscript
                  </button>
                  <button
                    onClick={() => handleBackOut(m.id)}
                    className="px-3 py-1 bg-yellow-500 text-white rounded hover:bg-yellow-600 text-sm"
                  >
                    Back Out
                  </button>
                </div>
              )}

              {(myDecision === "accept" || myDecision === "reject") &&
                !hasSubmittedReview &&
                (activeReview !== m.id ? (
                  <button
                    onClick={() => setActiveReview(m.id)}
                    className={`mt-2 px-3 py-1 text-white rounded text-sm ${
                      myDecision === "accept" 
                        ? "bg-blue-500 hover:bg-blue-600" 
                        : "bg-red-500 hover:bg-red-600"
                    }`}
                  >
                    {myDecision === "accept" ? "Review" : "Submit Rejection Review"}
                  </button>
                ) : (
                  <div className="flex flex-col gap-2 mt-2">
                    <textarea
                      placeholder={
                        myDecision === "accept" 
                          ? "Add your review comments" 
                          : "Add your rejection reasons and feedback"
                      }
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
                      className={`mt-2 px-3 py-1 text-white rounded text-sm ${
                        myDecision === "accept" 
                          ? "bg-green-500 hover:bg-green-600" 
                          : "bg-red-500 hover:bg-red-600"
                      }`}
                    >
                      {myDecision === "accept" 
                        ? "Submit Review & Mark Completed" 
                        : "Submit Rejection Review & Mark Completed"}
                    </button>
                  </div>
                ))}

              {(myDecision === "accept" || myDecision === "reject") && hasSubmittedReview && (
                <p className={`mt-2 font-semibold ${
                  myDecision === "accept" ? "text-green-600" : "text-red-600"
                }`}>
                  You have already submitted your {myDecision === "accept" ? "review" : "rejection review"}.
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
