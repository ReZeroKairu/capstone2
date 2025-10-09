import { getAuth } from "firebase/auth";
import { db, storage } from "../../firebase/firebase";
import {
  collection,
  updateDoc,
  doc,
  arrayUnion,
  getDocs,
  getDoc,
  Timestamp,
} from "firebase/firestore";
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { useEffect, useState } from "react";
import {
  handlePeerReviewerDecision,
  handleReviewCompletion,
} from "../../utils/manuscriptHelpers";
import { useUserLogs } from "../../hooks/useUserLogs";
import { getDeadlineColor, getRemainingDays } from "../../utils/deadlineUtils";

// --------------------------
// REST URL fallback helper
// --------------------------
const buildRestUrlSafe = (rawPath) => {
  if (!rawPath) return null;
  const path = rawPath.toString().trim().replace(/^\/+|\/+$/g, "").replace(/\/{2,}/g, "/");
  const bucket = storage?.app?.options?.storageBucket || "pubtrack2.firebasestorage.app";
  return `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodeURIComponent(path)}?alt=media`;
};

// --------------------------
// Helper: Safe file download
// --------------------------
const downloadFileCandidate = async (file) => {
  if (!file) return;

  let url = null;
  if (typeof file === "string" && file.startsWith("http")) url = file;
  else if (file.url || file.fileUrl) url = file.url || file.fileUrl;
  else {
    const path = file.path || file.storagePath || file;
    try {
      url = await getDownloadURL(storageRef(storage, path));
    } catch {
      url = buildRestUrlSafe(path);
    }
  }

  if (!url) return;

  const link = document.createElement("a");
  link.href = url;
  link.download =
    file?.name || file?.fileName || (typeof file === "string" ? file.split("/").pop() : "file");
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

// --------------------------
// Helper: Render deadline badge
// --------------------------
const DeadlineBadge = ({ startDate, endDate }) => {
  if (!startDate || !endDate) return null;
  const colorClass = getDeadlineColor(startDate, endDate);
  const remaining = getRemainingDays(endDate, startDate);

  return (
    <div
      className={`inline-block px-3 py-1 mb-2 rounded-lg text-xs font-medium transition-colors duration-300 ${colorClass}`}
    >
      Deadline:{" "}
      {endDate.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })}{" "}
      {remaining > 0 ? `(${remaining} day${remaining > 1 ? "s" : ""} left)` : "⚠️ Past Deadline"}
    </div>
  );
};

// --------------------------
// Modal component
// --------------------------
const ReviewModal = ({
  manuscript,
  reviewerId,
  users,
  activeDecision,
  setActiveDecision,
  reviews,
  handleReviewChange,
  reviewFiles,
  setReviewFiles,
  handleDecisionSubmit,
  closeModal,
}) => {
  const myMeta = manuscript.reviewerDecisionMeta?.[reviewerId];
  const myDecision = myMeta?.decision || "pending";
  const hasSubmittedReview = manuscript.reviewerSubmissions?.some(r => r.reviewerId === reviewerId);

  const invitedMeta = manuscript.assignedReviewersMeta?.[reviewerId] || {};
  const invitedById = invitedMeta?.assignedBy || invitedMeta?.invitedBy || null;
  const invitedAt = invitedMeta?.assignedAt || invitedMeta?.invitedAt || null;
  const acceptedAt = invitedMeta?.respondedAt || null;
  const deadline = invitedMeta?.deadline ? new Date(invitedMeta.deadline?.toDate?.() || invitedMeta.deadline) : null;

  const inviter =
    invitedById && users[invitedById]
      ? `${users[invitedById].firstName || ""} ${users[invitedById].lastName || ""}`.trim()
      : invitedMeta?.assignedByName || invitedMeta?.invitedByName || "Unknown";

  const abstract =
    manuscript.answeredQuestions?.find(q => q.question?.toLowerCase().includes("abstract"))?.answer ||
    manuscript.abstract ||
    "—";

  const parseDateSafe = (d) => {
    if (!d) return null;
    if (d.toDate) return d.toDate();
    if (typeof d === "string") return new Date(d);
    return new Date(d);
  };

  const startDate = myDecision === "pending" && !hasSubmittedReview ? new Date() : parseDateSafe(acceptedAt) || parseDateSafe(invitedAt);
  const endDate = parseDateSafe(deadline);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div
        className="bg-white rounded-2xl p-6 w-[90%] max-w-3xl shadow-xl overflow-auto max-h-[85vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-xl font-bold">{manuscript.manuscriptTitle || manuscript.title || "Untitled"}</h2>
            <div className="text-sm text-gray-600">
              Invited by {inviter} • Invited at: {invitedAt ? parseDateSafe(invitedAt).toLocaleString() : "—"}
            </div>
            <div className="text-sm text-gray-600 mt-1">
              Status: <span className="font-medium">{manuscript.status}</span>
            </div>
          </div>
          <button onClick={closeModal} className="px-3 py-1 rounded bg-gray-200 hover:bg-gray-300">Close</button>
        </div>

        <div className="mt-4 space-y-4">
          {/* Abstract */}
          <div>
            <p className="font-medium mb-2">Abstract</p>
            <div className="text-sm text-gray-800 whitespace-pre-wrap">{abstract}</div>
          </div>

          {/* Manuscript Files */}
          <div>
            <p className="font-medium mb-2">Manuscript File(s)</p>
            {(manuscript.answeredQuestions || [])
              .filter(q => q.type === "file" && q.answer)
              .flatMap(q => Array.isArray(q.answer) ? q.answer : [q.answer])
              .map((file, idx) => {
                const name = file?.fileName || file?.name || (typeof file === "string" ? file.split("/").pop() : `File ${idx + 1}`);
                return (
                  <button
                    key={idx}
                    onClick={() => downloadFileCandidate(file)}
                    className="text-blue-600 hover:text-blue-800 underline flex items-center mb-1"
                  >
                    <svg
                      className="w-4 h-4 mr-1"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                      />
                    </svg>
                    {name}
                  </button>
                );
              })}
          </div>

          {/* Deadline */}
          {startDate && endDate && <DeadlineBadge startDate={startDate} endDate={endDate} />}

          {/* Reviewer Actions */}
          {myDecision === "pending" && !hasSubmittedReview && (
            <div className="border-t pt-4">
              <p className="font-medium mb-2">Reviewer Actions</p>
              <div className="flex gap-2 mb-3">
                {["minor", "major", "publication", "reject"].map(d => {
                  const selected = activeDecision[manuscript.id] === d;
                  const colors = {
                    minor: ["bg-blue-500 hover:bg-blue-600", "bg-blue-700"],
                    major: ["bg-indigo-500 hover:bg-indigo-600", "bg-indigo-700"],
                    publication: ["bg-green-500 hover:bg-green-600", "bg-green-700"],
                    reject: ["bg-red-500 hover:bg-red-600", "bg-red-700"]
                  };
                  return (
                    <button
                      key={d}
                      onClick={() => setActiveDecision(prev => ({ ...prev, [manuscript.id]: d }))}
                      className={`px-3 py-1 rounded text-white text-sm ${selected ? colors[d][1] : colors[d][0]}`}
                    >
                      {d.charAt(0).toUpperCase() + d.slice(1)}
                    </button>
                  );
                })}
              </div>

              {activeDecision[manuscript.id] && (
                <div className="flex flex-col gap-2">
                  <textarea
                    placeholder="Add your review comments"
                    className="border p-2 rounded w-full"
                    value={reviews[manuscript.id]?.comment || ""}
                    onChange={e => handleReviewChange(manuscript.id, "comment", e.target.value)}
                  />
                  <input
                    type="file"
                    accept=".doc,.docx"
                    onChange={e => setReviewFiles(prev => ({ ...prev, [manuscript.id]: e.target.files[0] }))}
                    className="border p-2 rounded"
                  />
                  {reviewFiles[manuscript.id] && (
                    <p className="text-sm text-gray-600">Selected File: {reviewFiles[manuscript.id].name}</p>
                  )}
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleDecisionSubmit(manuscript.id)}
                      className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 text-sm"
                    >
                      Submit Review
                    </button>
                    <button
                      onClick={() => setActiveDecision(prev => ({ ...prev, [manuscript.id]: null }))}
                      className="px-3 py-1 bg-gray-300 text-gray-800 rounded hover:bg-gray-400 text-sm"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Display submitted review */}
          {myMeta?.comment && (
            <div>
              <p className="font-medium">Your Submitted Review</p>
              <p className="whitespace-pre-wrap">{myMeta.comment}</p>
              {myMeta.reviewFileUrl && (
                <p className="mt-1">
                  <a
                    href={myMeta.reviewFileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 underline"
                  >
                    Download Your Review File
                  </a>
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// --------------------------
// Main Component
// --------------------------
export default function ReviewManuscript() {
  const [reviewerId, setReviewerId] = useState(null);
  const [manuscripts, setManuscripts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reviews, setReviews] = useState({});
  const [users, setUsers] = useState({});
  const [activeReview, setActiveReview] = useState(null);
  const [activeDecision, setActiveDecision] = useState({});
  const [reviewFiles, setReviewFiles] = useState({});
  const [userRole, setUserRole] = useState(null);
  const { logManuscriptReview } = useUserLogs();
  const [manuscriptFileUrls, setManuscriptFileUrls] = useState({});

  const decisionLabels = {
    minor: "Accept (Minor Revision)",
    major: "Accept (Major Revision)",
    publication: "For Publication",
    reject: "Rejected",
    pending: "Pending",
  };

  // Fetch user and manuscripts
  useEffect(() => {
    const fetchUserAndManuscripts = async () => {
      try {
        const auth = getAuth();
        const user = auth.currentUser;
        if (!user) return;

        const uid = user.uid;
        setReviewerId(uid);

        const userDoc = await getDoc(doc(db, "Users", uid));
        if (userDoc.exists()) setUserRole(userDoc.data().role);

        const usersSnap = await getDocs(collection(db, "Users"));
        const allUsers = usersSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        setUsers(Object.fromEntries(allUsers.map(u => [u.id, u])));

        const msSnap = await getDocs(collection(db, "manuscripts"));
        let allMss = msSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        allMss = allMss.filter(
          m =>
            (m.assignedReviewers || []).includes(uid) ||
            m.reviewerDecisionMeta?.[uid]?.decision
        );

        allMss = allMss
          .map(m => {
            const acceptedAt = m.assignedReviewersMeta?.[uid]?.respondedAt;
            return { ...m, acceptedAt: acceptedAt ? acceptedAt.toDate?.() || acceptedAt : null };
          })
          .sort((a, b) => {
            if (!a.acceptedAt) return 1;
            if (!b.acceptedAt) return -1;
            return b.acceptedAt - a.acceptedAt;
          });

        setManuscripts(allMss);
        setLoading(false);
      } catch (err) {
        console.error("Failed to fetch user or manuscripts:", err);
        setLoading(false);
      }
    };
    fetchUserAndManuscripts();
  }, []);

  // Resolve manuscript files
  useEffect(() => {
    const resolveAllFiles = async () => {
      const urlsMap = {};
      for (const m of manuscripts) {
        const files = (m.answeredQuestions || [])
          .filter(q => q.type === "file" && q.answer)
          .flatMap(q => (Array.isArray(q.answer) ? q.answer : [q.answer]));

        urlsMap[m.id] = await Promise.all(
          files.map(async file => {
            if (!file) return null;
            if (typeof file === "object" && (file.url || file.fileUrl)) return file.url || file.fileUrl;
            if (typeof file === "string") {
              try {
                return await getDownloadURL(storageRef(storage, file));
              } catch {
                return buildRestUrlSafe(file);
              }
            }
            const path = file.path || file.storagePath || null;
            if (!path) return null;
            try {
              return await getDownloadURL(storageRef(storage, path));
            } catch {
              return buildRestUrlSafe(path);
            }
          })
        );
      }
      setManuscriptFileUrls(urlsMap);
    };
    if (manuscripts.length) resolveAllFiles();
  }, [manuscripts]);

  // Log reviewer history
  const logReviewerHistory = async (msRef, reviewerId, decision) => {
    await updateDoc(msRef, {
      [`reviewerHistory.${reviewerId}`]: arrayUnion({ decision, decidedAt: new Date() }),
    });
  };

  // Submit decision
  const handleDecisionSubmit = async (manuscriptId) => {
    const selected = manuscripts.find(m => m.id === manuscriptId);
    if (!selected) return;

    const decision = activeDecision[manuscriptId];
    const review = reviews[manuscriptId];
    if (!decision || !review?.comment) {
      alert("Please provide your review comments before submitting.");
      return;
    }

    let fileUrl = null;
    let fileName = null;

    if (reviewFiles[manuscriptId]) {
      const file = reviewFiles[manuscriptId];
      if (file.size > 30 * 1024 * 1024) {
        alert("File size exceeds 30MB. Please upload a smaller file.");
        return;
      }
      const fileRef = storageRef(storage, `reviews/${manuscriptId}/${reviewerId}-${file.name}`);
      const metadata = { contentType: file.type, contentDisposition: `attachment; filename="${file.name}"` };
      await uploadBytes(fileRef, file, metadata);
      fileUrl = await getDownloadURL(fileRef);
      fileName = file.name;
    }

    const updatedDecisions = {
      ...(selected.reviewerDecisionMeta || {}),
      [reviewerId]: { decision, comment: review.comment, decidedAt: new Date(), reviewFileUrl: fileUrl, reviewFileName: fileName || null },
    };

    const msRef = doc(db, "manuscripts", manuscriptId);
    await logReviewerHistory(msRef, reviewerId, decision);

    const respondedAt = new Date();
    const reviewDeadline = Timestamp.fromDate(new Date(respondedAt.getTime() + 4 * 24 * 60 * 60 * 1000));

    await updateDoc(msRef, {
      [`reviewerDecisionMeta.${reviewerId}`]: updatedDecisions[reviewerId],
      status: "Back to Admin",
      [`assignedReviewersMeta.${reviewerId}.respondedAt`]: respondedAt,
      [`assignedReviewersMeta.${reviewerId}.deadline`]: reviewDeadline,
      reviewerSubmissions: arrayUnion({
        reviewerId,
        comment: review.comment,
        status: "Completed",
        completedAt: new Date(),
        reviewFileUrl: fileUrl,
        reviewFileName: fileName || null,
      }),
    });

    await handlePeerReviewerDecision(manuscriptId, selected.manuscriptTitle || selected.title || "Untitled", reviewerId, decision);
    await handleReviewCompletion(manuscriptId, selected.manuscriptTitle || selected.title || "Untitled", reviewerId);
    await logManuscriptReview(manuscriptId, selected.manuscriptTitle || selected.title || "Untitled", decision);

    setManuscripts(prev => prev.map(m => m.id === manuscriptId ? { ...m, reviewerDecisionMeta: updatedDecisions, status: "Back to Admin" } : m));
    setActiveReview(null);
    setActiveDecision(prev => ({ ...prev, [manuscriptId]: null }));
    setReviewFiles(prev => ({ ...prev, [manuscriptId]: null }));
  };

  const handleReviewChange = (manuscriptId, field, value) => {
    setReviews(prev => ({ ...prev, [manuscriptId]: { ...prev[manuscriptId], [field]: value } }));
  };

  const getManuscriptDisplayTitle = (m) =>
    m.manuscriptTitle || m.title || m.answeredQuestions?.find(q => q.question?.toLowerCase().includes("manuscript title"))?.answer || "Untitled";

  if (loading) return <p className="pt-28 px-6">Loading manuscripts...</p>;
  if (!manuscripts.length) return <p className="pt-28 px-6">No manuscripts assigned.</p>;

  return (
    <div className="px-6 py-28 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">My Assigned Manuscripts</h1>
      <ul className="space-y-4">
        {manuscripts.map(m => {
          const myMeta = m.reviewerDecisionMeta?.[reviewerId];
          const myDecision = myMeta?.decision || "pending";
          const myDecisionLabel = decisionLabels[myDecision] || "Pending";
          const hasSubmittedReview = m.reviewerSubmissions?.some(r => r.reviewerId === reviewerId);
          const canSeeManuscript = userRole === "Admin" || (userRole === "Peer Reviewer" && ((m.assignedReviewers || []).includes(reviewerId) || myDecision === "reject"));
          if (!canSeeManuscript) return null;

          return (
            <li key={m.id} className="p-4 border rounded bg-white shadow-sm flex items-center justify-between">
              <div>
                {/* Deadline badge above title */}
                {m.assignedReviewersMeta?.[reviewerId]?.deadline && (() => {
  const parseDateSafe = (d) => {
    if (!d) return null;
    if (d.toDate) return d.toDate();         // Firestore Timestamp
    if (typeof d === "string") return new Date(d); // string
    return new Date(d);                      // already JS Date
  };

  const startDate = parseDateSafe(m.assignedReviewersMeta[reviewerId]?.respondedAt) 
                    || parseDateSafe(m.assignedReviewersMeta[reviewerId]?.assignedAt) 
                    || new Date();

  const endDate = parseDateSafe(m.assignedReviewersMeta[reviewerId]?.deadline);

  if (!startDate || !endDate) return null;

  return <DeadlineBadge startDate={startDate} endDate={endDate} />;
})()}

                <div className="text-lg font-semibold">{getManuscriptDisplayTitle(m)}</div>
                <div className="text-xs text-gray-500 mt-1">
                  Invited by {users[m.assignedReviewersMeta?.[reviewerId]?.assignedBy || m.assignedReviewersMeta?.[reviewerId]?.invitedBy]?.firstName || "Unknown"} • Status: <span className="font-medium">{m.status}</span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span className="px-2 py-1 rounded text-xs bg-gray-100 text-gray-800">{myDecisionLabel}</span>
                <button onClick={() => setActiveReview(prev => prev === m.id ? null : m.id)} className="px-3 py-1 bg-blue-600 text-white rounded text-sm">
                  {activeReview === m.id ? "Hide Details" : "View Details"}
                </button>
              </div>

              {activeReview === m.id && (
                <ReviewModal
                  manuscript={m}
                  reviewerId={reviewerId}
                  users={users}
                  activeDecision={activeDecision}
                  setActiveDecision={setActiveDecision}
                  reviews={reviews}
                  handleReviewChange={handleReviewChange}
                  reviewFiles={reviewFiles}
                  setReviewFiles={setReviewFiles}
                  handleDecisionSubmit={handleDecisionSubmit}
                  closeModal={() => setActiveReview(null)}
                />
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
