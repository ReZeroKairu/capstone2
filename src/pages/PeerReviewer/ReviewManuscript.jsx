import { getAuth } from "firebase/auth";
import { db, storage } from "../../firebase/firebase";
import {
  collection,
  updateDoc,
  doc,
  arrayUnion,
  getDocs,
  getDoc,
} from "firebase/firestore";
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { useEffect, useState } from "react";
import {
  handlePeerReviewerDecision,
  handleReviewCompletion,
} from "../../utils/manuscriptHelpers";
import { useUserLogs } from "../../hooks/useUserLogs";

// --------------------------
// Hook to resolve file URLs
// --------------------------


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
  
  const formatFirestoreDate = (ts) =>
    ts?.toDate?.()
      ? ts.toDate().toLocaleString()
      : ts instanceof Date
      ? ts.toLocaleString()
      : "N/A";

  const decisionLabels = {
    minor: "Accept (Minor Revision)",
    major: "Accept (Major Revision)",
    publication: "For Publication",
    reject: "Rejected",
    pending: "Pending",
  };

  // Fetch user, role, manuscripts
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
        const allUsers = usersSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setUsers(Object.fromEntries(allUsers.map((u) => [u.id, u])));

        const msSnap = await getDocs(collection(db, "manuscripts"));
        let allMss = msSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

        // Assigned to reviewer OR already reviewed
        allMss = allMss.filter(
          (m) =>
            (m.assignedReviewers || []).includes(uid) ||
            m.reviewerDecisionMeta?.[uid]?.decision
        );

        // Sort by acceptedAt
        allMss = allMss.map((m) => {
          const acceptedAt = m.assignedReviewersMeta?.[uid]?.respondedAt;
          return { ...m, acceptedAt: acceptedAt ? acceptedAt.toDate?.() || acceptedAt : null };
        }).sort((a, b) => {
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
 useEffect(() => {
  const resolveAllFiles = async () => {
    const urlsMap = {};

    for (const m of manuscripts) {
      const files = (m.answeredQuestions || [])
        .filter(q => q.type === "file" && q.answer)
        .flatMap(q => Array.isArray(q.answer) ? q.answer : [q.answer]);

      urlsMap[m.id] = await Promise.all(
        files.map(async (file) => {
          if (!file) return null;

          // 1️⃣ If file is already a URL, use it directly
          if (typeof file === "object" && (file.url || file.fileUrl)) {
            return file.url || file.fileUrl;
          }

          // 2️⃣ If file is a string path
          if (typeof file === "string") {
            try {
              return await getDownloadURL(storageRef(storage, file));
            } catch {
              return buildRestUrlSafe(file);
            }
          }

          // 3️⃣ If file is an object with a storage path
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


  const logReviewerHistory = async (msRef, reviewerId, decision) => {
    await updateDoc(msRef, {
      [`reviewerHistory.${reviewerId}`]: arrayUnion({
        decision,
        decidedAt: new Date(),
      }),
    });
  };

  const handleDecisionSubmit = async (manuscriptId) => {
    const selected = manuscripts.find((m) => m.id === manuscriptId);
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
      const metadata = {
        contentType: file.type,
        contentDisposition: `attachment; filename="${file.name}"`,
      };
      await uploadBytes(fileRef, file, metadata);
      fileUrl = await getDownloadURL(fileRef);
      fileName = file.name;
    }

    const updatedDecisions = {
      ...(selected.reviewerDecisionMeta || {}),
      [reviewerId]: {
        decision,
        comment: review.comment,
        decidedAt: new Date(),
        reviewFileUrl: fileUrl,
        reviewFileName: fileName || null,
      },
    };

    const msRef = doc(db, "manuscripts", manuscriptId);
    await logReviewerHistory(msRef, reviewerId, decision);

    await updateDoc(msRef, {
      [`reviewerDecisionMeta.${reviewerId}`]: updatedDecisions[reviewerId],
      status: "Back to Admin",
      reviewerSubmissions: arrayUnion({
        reviewerId,
        comment: review.comment,
        status: "Completed",
        completedAt: new Date(),
        reviewFileUrl: fileUrl,
        reviewFileName: fileName || null,
      }),
    });

    const manuscriptTitle = selected.manuscriptTitle || selected.title || "Untitled";

    await handlePeerReviewerDecision(manuscriptId, manuscriptTitle, reviewerId, decision);
    await handleReviewCompletion(manuscriptId, manuscriptTitle, reviewerId);
    await logManuscriptReview(manuscriptId, manuscriptTitle, decision);

    setManuscripts((prev) =>
      prev.map((m) => m.id === manuscriptId ? { ...m, reviewerDecisionMeta: updatedDecisions, status: "Back to Admin" } : m)
    );

    setActiveReview(null);
    setActiveDecision((prev) => ({ ...prev, [manuscriptId]: null }));
    setReviewFiles((prev) => ({ ...prev, [manuscriptId]: null }));
  };

  const handleReviewChange = (manuscriptId, field, value) => {
    setReviews((prev) => ({
      ...prev,
      [manuscriptId]: { ...prev[manuscriptId], [field]: value },
    }));
  };

  const getManuscriptDisplayTitle = (m) =>
    m.manuscriptTitle ||
    m.title ||
    m.answeredQuestions?.find((q) => q.question?.toLowerCase().includes("manuscript title"))?.answer ||
    "Untitled";

  if (loading) return <p className="pt-28 px-6">Loading manuscripts...</p>;
  if (!manuscripts.length) return <p className="pt-28 px-6">No manuscripts assigned.</p>;
const downloadFileCandidate = async (file) => {
  if (!file) return;

  let url = null;

  // If it's already a full URL
  if (typeof file === "string" && file.startsWith("http")) {
    url = file;
  } 
  // If it's an object with url or fileUrl
  else if (file.url || file.fileUrl) {
    url = file.url || file.fileUrl;
  } 
  // If it's a Firebase storage path
  else if (file.path || file.storagePath || typeof file === "string") {
    const path = file.path || file.storagePath || file;
    try {
      url = await getDownloadURL(storageRef(storage, path));
    } catch {
      url = buildRestUrlSafe(path);
    }
  }

  if (!url) return;

  // Trigger download
  const link = document.createElement("a");
  link.href = url;
  link.download =
    file?.name || file?.fileName || (typeof file === "string" ? file.split("/").pop() : "file");
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

  return (
    <div className="px-6 py-28 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">My Assigned Manuscripts</h1>
      <ul className="space-y-4">
        {manuscripts.map((m) => {
          const myMeta = m.reviewerDecisionMeta?.[reviewerId];
          const myDecision = myMeta?.decision || "pending";
          const myDecisionLabel = decisionLabels[myDecision] || "Pending";

          const hasSubmittedReview = m.reviewerSubmissions?.some(r => r.reviewerId === reviewerId);

          const canSeeManuscript =
            userRole === "Admin" ||
            (userRole === "Peer Reviewer" && ((m.assignedReviewers || []).includes(reviewerId) || myDecision === "reject"));
          if (!canSeeManuscript) return null;

          const invitedMeta = m.assignedReviewersMeta?.[reviewerId] || {};
          const invitedById = invitedMeta?.assignedBy || invitedMeta?.invitedBy || null;
          const invitedAt = invitedMeta?.assignedAt || invitedMeta?.invitedAt || null;
          const inviter =
            invitedById && users[invitedById] ? `${users[invitedById].firstName || ""} ${users[invitedById].lastName || ""}`.trim() : invitedMeta?.assignedByName || invitedMeta?.invitedByName || "Unknown";

          const abstract = m.answeredQuestions?.find(q => q.question?.toLowerCase().includes("abstract"))?.answer || m.abstract || "—";

          return (
            <li key={m.id} className="p-4 border rounded bg-white shadow-sm flex items-center justify-between">
              <div>
                <div className="text-lg font-semibold">{getManuscriptDisplayTitle(m)}</div>
                <div className="text-xs text-gray-500 mt-1">
                  Invited by {inviter} • Invited: {formatFirestoreDate(invitedAt)} • Status: <span className="font-medium">{m.status}</span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="px-2 py-1 rounded text-xs bg-gray-100 text-gray-800">{myDecisionLabel}</span>
                <button
                  onClick={() => setActiveReview(prev => prev === m.id ? null : m.id)}
                  className="px-3 py-1 bg-blue-600 text-white rounded text-sm"
                >
                  {activeReview === m.id ? "Hide Details" : "View Details"}
                </button>
              </div>

              {activeReview === m.id && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                  <div className="bg-white rounded-2xl p-6 w-[90%] max-w-3xl shadow-xl overflow-auto max-h-[85vh]" onClick={e => e.stopPropagation()}>
                    {/* Header & Abstract */}
                    <div className="flex justify-between items-start">
                      <div>
                        <h2 className="text-xl font-bold">{getManuscriptDisplayTitle(m)}</h2>
                        <div className="text-sm text-gray-600">Invited by {inviter} • Invited at: {formatFirestoreDate(invitedAt)}</div>
                        <div className="text-sm text-gray-600 mt-1">Status: <span className="font-medium">{m.status}</span></div>
                      </div>
                      <div>
                        <button onClick={() => setActiveReview(null)} className="px-3 py-1 rounded bg-gray-200 hover:bg-gray-300">Close</button>
                      </div>
                    </div>

                    <div className="mt-4 space-y-4">
                      <div>
                        <p className="font-medium mb-2">Abstract</p>
                        <div className="text-sm text-gray-800 whitespace-pre-wrap">{abstract}</div>
                      </div>

                      {/* Manuscript Files */}
                      <div>
                        <p className="font-medium mb-2">Manuscript File(s)</p>
                       {(m.answeredQuestions || [])
  .filter(q => q.type === "file" && q.answer)
  .flatMap(q => Array.isArray(q.answer) ? q.answer : [q.answer])
  .map((file, idx) => {
    const name =
      file?.fileName ||
      file?.name ||
      (typeof file === "string" ? file.split("/").pop() : `File ${idx + 1}`);

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

                      {/* Review history & current reviewer meta */}
                      <div>
                        <p className="font-medium">Your Decision</p>
                        <div className="text-sm text-gray-700">
                          {myMeta?.comment ? (
                            <>
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
                            </>
                          ) : (
                            <p className="text-sm text-gray-600">You have not submitted your review yet.</p>
                          )}
                        </div>
                      </div>

                      {/* Review submission UI */}
                      {myDecision === "pending" && !hasSubmittedReview && (
                        <div className="border-t pt-4">
                          <p className="font-medium mb-2">Reviewer Actions</p>

                          {/* Decision buttons - always visible so reviewer can choose */}
                          <div className="flex gap-2 mb-3">
                            {["minor", "major", "publication", "reject"].map((d) => {
                              const selected = activeDecision[m.id] === d;
                              return (
                                <button
                                  key={d}
                                  onClick={() => setActiveDecision((prev) => ({ ...prev, [m.id]: d }))}
                                  className={`px-3 py-1 rounded text-white text-sm ${
                                    d === "minor"
                                      ? selected ? "bg-blue-700" : "bg-blue-500 hover:bg-blue-600"
                                      : d === "major"
                                      ? selected ? "bg-indigo-700" : "bg-indigo-500 hover:bg-indigo-600"
                                      : d === "publication"
                                      ? selected ? "bg-green-700" : "bg-green-500 hover:bg-green-600"
                                      : selected ? "bg-red-700" : "bg-red-500 hover:bg-red-600"
                                  }`}
                                >
                                  {decisionLabels[d]}
                                </button>
                              );
                            })}
                          </div>

                          {/* Show review form only after a decision is selected */}
                          {activeDecision[m.id] && (
                            <div className="flex flex-col gap-2">
                              <textarea
                                placeholder="Add your review comments"
                                className="border p-2 rounded w-full"
                                value={reviews[m.id]?.comment || ""}
                                onChange={(e) => handleReviewChange(m.id, "comment", e.target.value)}
                              />
                          
                              <input
                                type="file"
                                accept=".doc,.docx"
                                onChange={(e) => {
                                  const file = e.target.files[0];
                                  setReviewFiles((prev) => ({ ...prev, [m.id]: file }));
                                }}
                                className="border p-2 rounded"
                              />
                              {reviewFiles[m.id] && (
                                <p className="text-sm text-gray-600">Selected File: {reviewFiles[m.id].name}</p>
                              )}

                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleDecisionSubmit(m.id)}
                                  className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 text-sm"
                                >
                                  Submit Review
                                </button>
                                <button
                                  onClick={() => setActiveDecision((prev) => ({ ...prev, [m.id]: null }))}
                                  className="px-3 py-1 bg-gray-300 text-gray-800 rounded hover:bg-gray-400 text-sm"
                                >
                                  Cancel Decision
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
