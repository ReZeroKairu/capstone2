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

// Helper to resolve file URL from manuscript object
function useManuscriptFile(manuscript) {
  const [fileUrl, setFileUrl] = useState(null);
  const [fileName, setFileName] = useState(null);

  useEffect(() => {
    let mounted = true;
    async function resolveFile() {
      if (!manuscript) return;
      // Find file answer in answeredQuestions
      const fileQ = (manuscript.answeredQuestions || []).find(
        (q) => q.type === "file" && q.answer
      );
      let path = null;
      let name = null;
      if (fileQ) {
        if (typeof fileQ.answer === "string") {
          path = fileQ.answer;
          name = fileQ.fileName || path.split("/").pop();
        } else if (typeof fileQ.answer === "object") {
          path =
            fileQ.answer.path ||
            fileQ.answer.storagePath ||
            fileQ.answer.fileUrl ||
            fileQ.answer.url ||
            null;
          name =
            fileQ.answer.name || fileQ.fileName || (path ? path.split("/").pop() : "Manuscript File");
        }
      }

      // Fallback to top-level storagePath/fileUrl if present
      if (!path) {
        path = manuscript.storagePath || manuscript.fileUrl || manuscript.file || null;
        name = manuscript.fileName || (path ? path.split("/").pop() : "Manuscript File");
      }

      if (!path) {
        if (mounted) {
          setFileUrl(null);
          setFileName(null);
        }
        return;
      }

      try {
        const url = await getDownloadURL(storageRef(storage, path));
        if (mounted) {
          setFileUrl(url);
          setFileName(name);
        }
      } catch (err) {
        // fallback REST URL (may require token / proper ACL)
        const bucket = storage?.app?.options?.storageBucket || "pubtrack2.appspot.com";
        const rest = `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodeURIComponent(
          path
        )}?alt=media`;
        if (mounted) {
          setFileUrl(rest);
          setFileName(name);
        }
      }
    }
    resolveFile();
    return () => {
      mounted = false;
    };
  }, [manuscript]);

  return { fileUrl, fileName };
}

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

        // Include manuscripts assigned to the reviewer OR where the reviewer has already made a decision
        let assigned = allMss.filter(
          (m) =>
            (m.assignedReviewers || []).includes(uid) ||
            m.reviewerDecisionMeta?.[uid]?.decision
        );

        // Add 'acceptedAt' for sorting
        assigned = assigned.map((m) => {
          const myMeta = m.assignedReviewersMeta?.[uid];
          const acceptedAt = myMeta?.respondedAt
            ? myMeta.respondedAt instanceof Date
              ? myMeta.respondedAt
              : myMeta.respondedAt.toDate?.() || new Date()
            : null;
          return { ...m, acceptedAt };
        });

        // Sort by acceptedAt descending
        assigned.sort((a, b) => {
          if (!a.acceptedAt) return 1;
          if (!b.acceptedAt) return -1;
          return b.acceptedAt - a.acceptedAt;
        });

        setManuscripts(assigned);
        setLoading(false);
      } catch (err) {
        console.error("Failed to fetch user or manuscripts:", err);
        setLoading(false);
      }
    };

    fetchUserAndManuscripts();
  }, []);

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
    let fileName = null; // store original filename
    if (reviewFiles[manuscriptId]) {
      const file = reviewFiles[manuscriptId];
      if (file.size > 30 * 1024 * 1024) {
        alert("File size exceeds 30MB. Please upload a smaller file.");
        return;
      }
      const fileRef = storageRef(storage, `reviews/${manuscriptId}/${reviewerId}-${file.name}`);

      // include contentDisposition so downloads from Firebase include the original filename
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
         rating: review.rating || 0,
         decidedAt: new Date(),
         reviewFileUrl: fileUrl,
         reviewFileName: fileName || null,
       },
     };

     const msRef = doc(db, "manuscripts", manuscriptId);
     await logReviewerHistory(msRef, reviewerId, decision);

    await updateDoc(msRef, {
      [`reviewerDecisionMeta.${reviewerId}`]: {
        decision,
        comment: review.comment,
        rating: review.rating || 0,
        decidedAt: new Date(),
        reviewFileUrl: fileUrl,
        reviewFileName: fileName || null,
      },
      status: "Back to Admin",
      reviewerSubmissions: arrayUnion({
        reviewerId,
        comment: review.comment,
        rating: review.rating || 0,
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
      prev.map((m) =>
        m.id === manuscriptId
          ? {
              ...m,
              reviewerDecisionMeta: updatedDecisions,
              status: "Back to Admin",
            }
          : m
      )
    );

    setActiveReview(null);
    setActiveDecision((prev) => ({ ...prev, [manuscriptId]: null }));
    setReviewFiles((prev) => ({ ...prev, [manuscriptId]: null }));
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
    "Untitled";

  // Ensure storage path doesn't start/end with '/' or contain '//' before encoding
const buildRestUrlSafe = (rawPath) => {
  if (!rawPath) return null;
  let p = String(rawPath).trim();
  p = p.replace(/^\/+/, "").replace(/\/{2,}/g, "/").replace(/\/$/, "");
  const bucket = storage?.app?.options?.storageBucket || "pubtrack2.appspot.com";
  return `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodeURIComponent(p)}?alt=media`;
};

  if (loading) return <p className="pt-28 px-6">Loading manuscripts...</p>;
  if (!manuscripts.length) return <p className="pt-28 px-6">No manuscripts assigned.</p>;

  return (
    <div className="px-6 py-28 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">My Assigned Manuscripts</h1>

      <ul className="space-y-4">
        {manuscripts.map((m) => {
          const myMeta = m.reviewerDecisionMeta?.[reviewerId];
          const myDecision = myMeta?.decision || "pending";
          const myDecisionLabel = decisionLabels[myDecision] || "Pending";

          const hasSubmittedReview = m.reviewerSubmissions?.some(
            (r) => r.reviewerId === reviewerId
          );

          const canSeeManuscript =
            userRole === "Admin" ||
            (userRole === "Peer Reviewer" &&
              ((m.assignedReviewers || []).includes(reviewerId) || myDecision === "reject"));

          if (!canSeeManuscript) return null;

          // invited meta for this reviewer (who invited them and when)
          const invitedMeta = m.assignedReviewersMeta?.[reviewerId] || {};
          const invitedById = invitedMeta?.assignedBy || invitedMeta?.invitedBy || null;
          const invitedAt = invitedMeta?.assignedAt || invitedMeta?.invitedAt || null;
          const inviter =
            invitedById && users[invitedById]
              ? `${users[invitedById].firstName || ""} ${users[invitedById].lastName || ""}`.trim()
              : invitedMeta?.assignedByName || invitedMeta?.invitedByName || "Unknown";

          // abstract extraction (if present)
          const abstract =
            m.answeredQuestions?.find((q) =>
              q.question?.toLowerCase().includes("abstract")
            )?.answer || m.abstract || "—";

          return (
            <li
              key={m.id}
              className="p-4 border rounded bg-white shadow-sm flex items-center justify-between"
            >
              <div>
                <div className="text-lg font-semibold">{getManuscriptDisplayTitle(m)}</div>
                <div className="text-xs text-gray-500 mt-1">
                  {/* double-blind: show inviter + invited at and status only */}
                  Invited by {inviter} • Invited: {formatFirestoreDate(invitedAt)} • Status:{" "}
                  <span className="font-medium">{m.status}</span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span className="px-2 py-1 rounded text-xs bg-gray-100 text-gray-800">
                  {myDecisionLabel}
                </span>

                <button
                  onClick={() => setActiveReview((prev) => (prev === m.id ? null : m.id))}
                  className="px-3 py-1 bg-blue-600 text-white rounded text-sm"
                >
                  {activeReview === m.id ? "Hide Details" : "View Details"}
                </button>
              </div>

              {/* Details drawer/modal for this manuscript (inline expandable) */}
              {activeReview === m.id && (
                <div className="absolute inset-0 bg-black/40 z-40 flex items-center justify-center">
                  <div
                    className="bg-white rounded-md p-6 w-[90%] max-w-3xl shadow-lg overflow-auto max-h-[80vh]"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h2 className="text-xl font-bold">{getManuscriptDisplayTitle(m)}</h2>
                        <div className="text-sm text-gray-600">
                          Invited by {inviter} • Invited at: {formatFirestoreDate(invitedAt)}
                        </div>
                        <div className="text-sm text-gray-600 mt-1">
                          Status: <span className="font-medium">{m.status}</span>
                        </div>
                      </div>
                      <div>
                        <button
                          onClick={() => setActiveReview(null)}
                          className="px-3 py-1 rounded bg-gray-200 hover:bg-gray-300"
                        >
                          Close
                        </button>
                      </div>
                    </div>

                    <div className="mt-4 space-y-4">
                      {/* Abstract */}
                      <div>
                        <p className="font-medium mb-2">Abstract</p>
                        <div className="text-sm text-gray-800 whitespace-pre-wrap">{abstract}</div>
                      </div>

                      {/* File(s) */}
                      <div>
                        <p className="font-medium mb-2">Manuscript File(s)</p>
                        {(m.answeredQuestions || [])
                          .filter((q) => q.type === "file" && q.answer)
                          .flatMap((q) => (Array.isArray(q.answer) ? q.answer : [q.answer]))
                          .map((file, idx) => {
                            // file may be storage path string or object
                            const path =
                              typeof file === "string"
                                ? file
                                : file?.storagePath || file?.path || file?.fileUrl || file?.url || null;
                            const name = file?.fileName || file?.name || (path ? path.split("/").pop() : `File ${idx + 1}`);
                            // build href: prefer full url in stored object, otherwise fallback to REST (will often work)
                            const href = file?.url || file?.fileUrl || (path ? buildRestUrlSafe(path) : null);

                            return href ? (
                              <div key={idx} className="mb-1">
                                <a
                                  href={href}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-600 underline"
                                  download
                                >
                                  {name}
                                </a>
                                {file?.fileSize && (
                                  <span className="text-xs text-gray-500 ml-2">
                                    {Math.round(file.fileSize / 1024)} KB
                                  </span>
                                )}
                              </div>
                            ) : (
                              <div key={idx} className="text-sm text-gray-600">
                                {name} (unavailable)
                              </div>
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
                              <p className="mt-1">Rating: {myMeta.rating ?? "N/A"}</p>
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
                                type="number"
                                min="0"
                                max="5"
                                placeholder="Rating (0-5)"
                                className="border p-2 rounded w-32"
                                value={reviews[m.id]?.rating || ""}
                                onChange={(e) => handleReviewChange(m.id, "rating", e.target.value)}
                              />
                              <input
                                type="file"
                                accept=".pdf,.doc,.docx,.txt"
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
