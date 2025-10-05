import React, { useEffect, useState } from "react";
import { db, auth } from "../firebase/firebase";
import { useLocation, useNavigate } from "react-router-dom";

import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  startAfter,
  limit,
  Timestamp,
  doc,
  updateDoc,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";
import { MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import { getDownloadURL, ref } from "firebase/storage";
import { storage } from "../firebase/firebase"; // ✅ make sure you export storage in firebase.js

export default function FormResponses() {
  const [responses, setResponses] = useState([]);
  const [forms, setForms] = useState([]);
  const [selectedFormId, setSelectedFormId] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
const location = useLocation();
const navigate = useNavigate();

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);

  const [totalResponses, setTotalResponses] = useState(0);
  const [pageSize, setPageSize] = useState(5);

  // Pagination: pageCursors[i] = lastDoc of page (i+1)
  const [pageCursors, setPageCursors] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);


  // modal
  const [selectedResponse, setSelectedResponse] = useState(null);
  const formatAnswer = (answer) => {
    if (answer === null || answer === undefined) return "";
    if (Array.isArray(answer)) {
      return answer
        .map((a) => {
          if (a === null || a === undefined) return "";
          if (typeof a === "object") {
            if (a.name) return a.email ? `${a.name} (${a.email})` : a.name;
            return JSON.stringify(a);
          }
          return String(a);
        })
        .filter(Boolean)
        .join(", ");
    }
    if (typeof answer === "object") {
      if (answer.name)
        return answer.email ? `${answer.name} (${answer.email})` : answer.name;
      return JSON.stringify(answer);
    }
    return String(answer);
  };
  // fetch current user & role
  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async (user) => {
      if (!user) {
        setCurrentUser(null);
        setIsAdmin(false);
        return;
      }
      setCurrentUser(user);
      try {
        const userSnapshot = await getDocs(
          query(collection(db, "Users"), where("__name__", "==", user.uid))
        );
        const userData = userSnapshot.docs[0]?.data();
        setIsAdmin(userData?.role === "Admin");
      } catch (err) {
        console.error("Error checking user role:", err);
      }
    });
    return () => unsub();
  }, []);

  // fetch total responses for pagination
  useEffect(() => {
    const fetchForms = async () => {
      try {
        const snapshot = await getDocs(collection(db, "forms"));
        setForms(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch (err) {
        console.error("Error fetching forms:", err);
      }
    };
    fetchForms();
  }, []);

  // fetch total responses for pagination, now works for all forms if none selected
  const fetchTotalCount = async () => {
    try {
      const constraints = [where("status", "==", "Pending")];
      if (selectedFormId)
        constraints.push(where("formId", "==", selectedFormId));
      if (!isAdmin && currentUser)
        constraints.push(where("userId", "==", currentUser.uid));
      if (startDate && endDate) {
        const start = Timestamp.fromDate(new Date(startDate + "T00:00:00"));
        const end = Timestamp.fromDate(new Date(endDate + "T23:59:59"));
        constraints.push(where("submittedAt", ">=", start));
        constraints.push(where("submittedAt", "<=", end));
      }
      const snapshot = await getDocs(
        query(collection(db, "form_responses"), ...constraints)
      );
      setTotalResponses(snapshot.size);
      return snapshot.size;
    } catch (err) {
      console.error("Error fetching total responses:", err);
      return 0;
    }
  };
useEffect(() => {
  const refreshPage = async () => {
    console.log("Refresh event received!"); // Debug: should log when notification clicked
    setPageCursors([]); // clear cursors to force fresh fetch
    await fetchTotalCount(); // update total responses
    await loadPage(1);       // reload first page
  };

  window.addEventListener("refreshFormResponses", refreshPage);

  // Cleanup listener on unmount
  return () => window.removeEventListener("refreshFormResponses", refreshPage);
}, [currentUser, isAdmin, selectedFormId, startDate, endDate, searchTerm]);


// ✅ KEEP this one as-is
useEffect(() => {
  fetchTotalCount();
}, [selectedFormId, startDate, endDate, currentUser, isAdmin]);
  // helper: build query constraints array for current filters/search
  const buildConstraints = () => {
    const constraints = [where("status", "==", "Pending")];
    if (selectedFormId) constraints.push(where("formId", "==", selectedFormId));
    if (!isAdmin && currentUser)
      constraints.push(where("userId", "==", currentUser.uid));
    if (startDate && endDate) {
      const start = Timestamp.fromDate(new Date(startDate + "T00:00:00"));
      const end = Timestamp.fromDate(new Date(endDate + "T23:59:59"));
      constraints.push(where("submittedAt", ">=", start));
      constraints.push(where("submittedAt", "<=", end));
    }
    return constraints;
  };

  // ensure cursors for pagination
  const ensureCursorsUpTo = async (page) => {
    if (page <= 1) return;
    const needed = page - 1;
    if (pageCursors.length >= needed) return;

    let cursors = [...pageCursors];
    try {
      while (cursors.length < needed) {
        const startAfterDoc =
          cursors.length === 0 ? null : cursors[cursors.length - 1];
        const constraints = buildConstraints();
        const q = query(
          collection(db, "form_responses"),
          ...constraints,
          orderBy("submittedAt", "desc"),
          limit(pageSize),
          ...(startAfterDoc ? [startAfter(startAfterDoc)] : [])
        );
        const snap = await getDocs(q);
        if (snap.empty) break;
        const lastDoc = snap.docs[snap.docs.length - 1];
        cursors.push(lastDoc);
        if (snap.docs.length < pageSize) break;
      }
      setPageCursors(cursors);
    } catch (err) {
      console.error("Error prefetching cursors:", err);
    }
  };

  // main page loader

    const loadPage = async (page = 1) => {
  if (!currentUser) return;

  const isSearching = searchTerm.trim() !== "";
  setLoading(true);

  try {
    const constraints = buildConstraints();

    // 🔹 SEARCH MODE with client-side pagination
    if (isSearching) {
      const q = query(
        collection(db, "form_responses"),
        ...constraints,
        orderBy("submittedAt", "desc"),
        limit(1000) // cap search results
      );
      const snap = await getDocs(q);

      const data = await Promise.all(
        snap.docs.map(async (d) => {
          const docData = { id: d.id, ...d.data() };

          // resolve file answers
          if (docData.answeredQuestions) {
            docData.answeredQuestions = await Promise.all(
              docData.answeredQuestions.map(async (q) => {
               if (q.type === "file" && q.answer) {
  const answersArray = Array.isArray(q.answer) ? q.answer : [q.answer];
  const filesWithUrls = await Promise.all(
    answersArray.map(async (f) => {
      try {
        const filePath =
          f?.storagePath ||
          f?.path ||
          (typeof f === "string" ? f : null);

        if (!filePath) return f;

        const url = await getDownloadURL(ref(storage, filePath));

        if (typeof f === "string") {
          return {
            name: filePath.split("/").pop(),
            url,
            path: filePath,
          };
        }
        return { ...f, url };
      } catch (err) {
        console.warn("⚠️ File missing in storage:", f);
        // fallback so UI doesn't break
        return {
          name: (typeof f === "string" ? f : f?.name) || "Unavailable file",
          url: null,
          path: f?.path || f?.storagePath || null,
          missing: true,
        };
      }
    })
  );

  return {
    ...q,
    answer:
      filesWithUrls.length === 1 && !Array.isArray(q.answer)
        ? filesWithUrls[0]
        : filesWithUrls,
  };
}

                return q;
              })
            );
          }

          return docData;
        })
      );

      // filter search results
      const term = searchTerm.toLowerCase();
      const filtered = data.filter((res) => {
        const fullName = `${res.firstName || ""} ${res.lastName || ""}`.trim();
        const manuscriptTitle =
          res.manuscriptTitle ||
          res.answeredQuestions?.find((q) =>
            q.question?.toLowerCase().trim().startsWith("manuscript title")
          )?.answer ||
          res.formTitle ||
          "Untitled";

        const fieldsToSearch = [
          res.email,
          fullName,
          manuscriptTitle,
          res.formTitle,
          ...(res.searchIndex || []),
        ];

        return fieldsToSearch.some((f) => f?.toLowerCase().includes(term));
      });

      // 🔹 client-side pagination
      const total = filtered.length;
      const totalPages = Math.max(1, Math.ceil(total / pageSize));
      const targetPage = Math.min(Math.max(1, page), totalPages);

      const startIndex = (targetPage - 1) * pageSize;
      const paginated = filtered.slice(startIndex, startIndex + pageSize);

      setResponses(paginated);
      setTotalResponses(total);
      setCurrentPage(targetPage);
      setPageCursors([]); // no cursors needed for search
      return;
    }

    // 🔹 NORMAL MODE with Firestore cursor-based pagination
    const totalPages = Math.max(1, Math.ceil(totalResponses / pageSize));
    const targetPage = Math.min(Math.max(1, page), totalPages);

    await ensureCursorsUpTo(targetPage);

    const startAfterDoc =
      targetPage > 1 ? pageCursors[targetPage - 2] || null : null;

    const q = query(
      collection(db, "form_responses"),
      ...constraints,
      orderBy("submittedAt", "desc"),
      limit(pageSize),
      ...(startAfterDoc ? [startAfter(startAfterDoc)] : [])
    );
    const snap = await getDocs(q);

    const data = await Promise.all(
      snap.docs.map(async (d) => {
        const docData = { id: d.id, ...d.data() };

        if (docData.answeredQuestions) {
          docData.answeredQuestions = await Promise.all(
            docData.answeredQuestions.map(async (q) => {
              if (q.type === "file" && q.answer) {
                const answersArray = Array.isArray(q.answer)
                  ? q.answer
                  : [q.answer];
                const filesWithUrls = await Promise.all(
                  answersArray.map(async (f) => {
                    try {
                      const filePath =
                        f?.storagePath ||
                        f?.path ||
                        (typeof f === "string" ? f : null);
                      if (!filePath) return f;
                      const url = await getDownloadURL(ref(storage, filePath));
                      if (typeof f === "string") {
                        return {
                          name: filePath.split("/").pop(),
                          url,
                          path: filePath,
                        };
                      }
                      return { ...f, url };
                    } catch (err) {
                      console.error("Error fetching file URL:", err, f);
                      return f;
                    }
                  })
                );
                return {
                  ...q,
                  answer:
                    filesWithUrls.length === 1 && !Array.isArray(q.answer)
                      ? filesWithUrls[0]
                      : filesWithUrls,
                };
              }
              return q;
            })
          );
        }

        return docData;
      })
    );

    setResponses(data);

    if (snap.docs.length > 0) {
      const lastDoc = snap.docs[snap.docs.length - 1];
      setPageCursors((prev) => {
        const copy = [...prev];
        copy[targetPage - 1] = lastDoc;
        return copy;
      });
    }

    setCurrentPage(targetPage);
  } catch (err) {
    console.error("Error loading page:", err);
  } finally {
    setLoading(false);
  }
};

  // reset and fetch when filters or selection change
  useEffect(() => {
    setResponses([]);
    setPageCursors([]);
    setCurrentPage(1);
    loadPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    selectedFormId,
    startDate,
    endDate,
    searchTerm,
    currentUser,
    isAdmin,
    pageSize,
  ]);
  const handleKeyDown = (e) => {
    if (e.key === "Enter") loadPage(1);
  };

  const highlightText = (text) => {
    if (!searchTerm) return text;
    const escaped = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const parts = text.split(new RegExp(`(${escaped})`, "gi"));
    return parts.map((part, i) =>
      part.toLowerCase() === searchTerm.toLowerCase() ? (
        <mark key={i} className="bg-yellow-200 text-[#211B17] px-0.5 rounded">
          {part}
        </mark>
      ) : (
        <span key={i}>{part}</span>
      )
    );
  };

  // Admin actions (unchanged)
  // Admin actions (fixed to use Manuscript Title)
  const handleAccept = async (res) => {
    try {
      const resRef = doc(db, "form_responses", res.id);
      await updateDoc(resRef, { status: "Assigning Peer Reviewer" });

      await addDoc(collection(db, "form_responses", res.id, "history"), {
        timestamp: serverTimestamp(),
        updatedBy: currentUser.uid,
        status: "Assigning Peer Reviewer",
      });

      const manuscriptsRef = collection(db, "manuscripts");
      const mQ = query(manuscriptsRef, where("responseId", "==", res.id));
      const mSnap = await getDocs(mQ);

      // preserve original submission time if available
      const responseSubmittedAt = res.submittedAt
        ? res.submittedAt
        : serverTimestamp();

      // 🔹 derive manuscript title robustly
      const manuscriptTitle =
        res.manuscriptTitle ||
        res.answeredQuestions?.find(
          (q) =>
            q?.isManuscriptTitle ||
            q?.question?.toLowerCase?.().trim?.().startsWith("manuscript title")
        )?.answer ||
        res.formTitle ||
        "Untitled";

      if (!mSnap.empty) {
        mSnap.forEach(async (ms) => {
          // set status, title, and record acceptedAt timestamp
          await updateDoc(doc(db, "manuscripts", ms.id), {
            title: manuscriptTitle,
            status: "Assigning Peer Reviewer",
            acceptedAt: serverTimestamp(),
            email: res.email || "", // 🔹 save email
          });
        });
      } else {
        await addDoc(manuscriptsRef, {
          responseId: res.id,
          formId: res.formId,
          formTitle: res.formTitle,
          title: manuscriptTitle, // 🔹 save it on the manuscript
          answeredQuestions: res.answeredQuestions || [],
          userId: res.userId,
          coAuthors: res.coAuthors || [],
          submittedAt: responseSubmittedAt, // preserve original submission time when possible
          acceptedAt: serverTimestamp(), // mark acceptance timestamp
          status: "Assigning Peer Reviewer",
          email: res.email || "", // 🔹 save email
        });
      }

      const notifyUsers = [
        res.userId,
        ...(res.coAuthors?.map((c) => c.id) || []),
      ];
      await Promise.all(
        notifyUsers.map((uid) =>
          addDoc(collection(db, "Users", uid, "Notifications"), {
            message: `Your manuscript "${manuscriptTitle}" has been accepted by the admin.`,
            seen: false,
            timestamp: serverTimestamp(),
          })
        )
      );

   setResponses((prev) => prev.filter((r) => r.id !== res.id));
setSelectedResponse(null);
setTotalResponses((prev) => Math.max(0, prev - 1));

    } catch (err) {
      console.error("Error accepting response:", err);
    }
  };

  const handleReject = async (res) => {
    try {
      const resRef = doc(db, "form_responses", res.id);
      await updateDoc(resRef, { status: "Rejected" });

      await addDoc(collection(db, "form_responses", res.id, "history"), {
        timestamp: serverTimestamp(),
        updatedBy: currentUser.uid,
        status: "Rejected",
      });

      const manuscriptsRef = collection(db, "manuscripts");
      const mQ = query(manuscriptsRef, where("responseId", "==", res.id));
      const mSnap = await getDocs(mQ);

      // 🔹 derive manuscript title robustly
      const manuscriptTitle =
        res.manuscriptTitle ||
        res.answeredQuestions?.find(
          (q) =>
            q?.isManuscriptTitle ||
            q?.question?.toLowerCase?.().trim?.().startsWith("manuscript title")
        )?.answer ||
        res.formTitle ||
        "Untitled";

      if (!mSnap.empty) {
        mSnap.forEach(async (ms) => {
          await updateDoc(doc(db, "manuscripts", ms.id), {
            title: manuscriptTitle,
            status: "Rejected",
            email: res.email || "", // 🔹 save email
          });
        });
      } else {
        await addDoc(manuscriptsRef, {
          responseId: res.id,
          formId: res.formId,
          formTitle: res.formTitle,
          title: manuscriptTitle, // 🔹 save it on the manuscript
          answeredQuestions: res.answeredQuestions || [],
          userId: res.userId,
          coAuthors: res.coAuthors || [],
          submittedAt: serverTimestamp(),
          status: "Rejected",
          email: res.email || "", // 🔹 save email
        });
      }

      const notifyUsers = [
        res.userId,
        ...(res.coAuthors?.map((c) => c.id) || []),
      ];
      await Promise.all(
        notifyUsers.map((uid) =>
          addDoc(collection(db, "Users", uid, "Notifications"), {
            message: `Your manuscript "${manuscriptTitle}" has been rejected by the admin.`,
            seen: false,
            timestamp: serverTimestamp(),
          })
        )
      );
setResponses((prev) => prev.filter((r) => r.id !== res.id));
setSelectedResponse(null);
setTotalResponses((prev) => Math.max(0, prev - 1));


    } catch (err) {
      console.error("Error rejecting response:", err);
    }
  };

  if (!currentUser) {
    return (
      <p className="p-28 text-red-500">Please log in to view responses.</p>
    );
  }

  // Pagination numbers
  const totalPages = Math.max(1, Math.ceil(totalResponses / pageSize));
  const pageNumbers = [];
  for (let i = 1; i <= totalPages; i++) {
    if (
      i === 1 ||
      i === totalPages ||
      (i >= currentPage - 2 && i <= currentPage + 2)
    ) {
      pageNumbers.push(i);
    } else if (
      (i === currentPage - 3 && currentPage - 3 > 1) ||
      (i === currentPage + 3 && currentPage + 3 < totalPages)
    ) {
      pageNumbers.push("...");
    }
  }

  return (
    <div className="min-h-screen bg-white font-sans">
      <div className="h-24" />
      <div className="max-w-4xl mx-auto px-4 pb-8">
        <h1 className="text-2xl font-semibold mb-1 text-[#211B17]">
          Form Responses
        </h1>
        <div className="text-sm italic text-[#4b4540] mb-4">Form</div>

        <div className="flex flex-col gap-4 mb-4">
          <div className="relative">
            <select
              value={selectedFormId}
              onChange={(e) => setSelectedFormId(e.target.value)}
              className="w-full appearance-none bg-yellow-400 text-[#211B17] font-semibold text-lg rounded-lg px-4 py-2 pr-10 focus:outline-none"
            >
              <option value="">Select a form</option>
              {forms.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.title}
                </option>
              ))}
            </select>
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[#7B2E19] pointer-events-none">
              ▼
            </span>
          </div>
          <div className="mb-2 italic text-gray-600 text-sm">
            {selectedFormId
              ? `Showing responses for: ${
                  forms.find((f) => f.id === selectedFormId)?.title ||
                  "Selected Form"
                }`
              : "Showing all responses from all forms"}
          </div>

          <div className="flex gap-3 items-center">
            <div className="flex-1 relative border-2 border-[#7B2E19] rounded-xl p-2 flex items-center">
              <MagnifyingGlassIcon className="w-6 h-6 shrink-0 mr-2 text-[#F9D563]" />
              <input
                type="text"
                placeholder="Search by name or email"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={handleKeyDown}
                className="w-full bg-transparent placeholder:text-[#92996a1] italic text-base font-medium outline-none"
              />
            </div>

            <div className="flex gap-2">
              <label className="text-sm flex items-center gap-2">
                <span className="text-gray-600">Start</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="border rounded-md px-2 py-1"
                />
              </label>
              <label className="text-sm flex items-center gap-2">
                <span className="text-gray-600">End</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="border rounded-md px-2 py-1"
                />
              </label>
            </div>
          </div>
        </div>

        <div className="bg-[#f3f2ee] rounded-md overflow-hidden">
          <table className="min-w-full bg-[#f3f2ee] rounded-md overflow-hidden">
            <thead className="bg-yellow-400 text-[#211B17]">
              <tr>
                <th className="px-4 py-2 text-left">Email</th>
                <th className="px-4 py-2 text-left">Name</th>
                <th className="px-4 py-2 text-left">Submitted At</th>
                <th className="px-4 py-2 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {responses.length === 0 && !loading ? (
                <tr>
                  <td
                    colSpan={4} // span all columns
                    className="text-center text-gray-600 py-6"
                  >
                    No responses found.
                  </td>
                </tr>
              ) : (
                responses.map((res) => {
                  const fullName = `${res.firstName || ""} ${
                    res.middleName || ""
                  } ${res.lastName || ""}`.trim();
                  const submittedAtText =
                    res.submittedAt?.toDate?.()?.toLocaleString() ||
                    (res.submittedAt?.seconds
                      ? new Date(
                          res.submittedAt.seconds * 1000
                        ).toLocaleString()
                      : "");

                  return (
                   <tr key={res.id} className="border-b border-[#7B2E19]/30">
 <td className="px-4 py-2">
  {res.userId ? (
    <button
      onClick={() => navigate(`/profile/${res.userId}`)}
      className="text-red-800 underline cursor-pointer hover:text-red-900 active:text-red-950 transition-colors"
    >
      {highlightText(res.email || "")}
    </button>
  ) : (
    highlightText(res.email || "")
  )}
</td>

  <td className="px-4 py-2">{highlightText(fullName)}</td>
  <td className="px-4 py-2 text-gray-600 text-sm">{submittedAtText}</td>
  <td className="px-4 py-2">
    <button
      onClick={() => setSelectedResponse(res)}
      className="text-[#7B2E19] underline font-medium text-sm"
    >
      View Response
    </button>
  </td>
</tr>

                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {loading && (
          <div className="mt-3 text-sm text-gray-500">Loading...</div>
        )}
        {/* Advanced Pagination */}
        <div className="mt-4 p-2 bg-yellow-400 shadow-lg flex flex-col sm:flex-row justify-between items-center rounded-sm">
          <div className="flex items-center gap-2 flex-wrap">
            <label className="text-sm font-bold text-red-900 ">
              Page Size:
            </label>
            <select
              value={pageSize}
              onChange={(e) => {
                const sz = Number(e.target.value);
                setPageSize(sz);
                setPageCursors([]);
                setCurrentPage(1);
              }}
              className="border-2 bg-yellow-400 rounded-lg border-red-900 px-2 py-1 focus:outline-none focus:border-red-900 focus:ring-1 focus:ring-red-900"
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={15}>15</option>
              <option value={20}>20</option>
            </select>
          </div>
          <div className="flex items-center">
            <button
              disabled={currentPage === 1 || loading}
              onClick={() => loadPage(1)}
              className="px-3 py-1 mr-3 bg-white text-[#7B2E19] border border-[#7B2E19] rounded-md font-semibold transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              First
            </button>

            <button
              disabled={currentPage === 1 || loading}
              onClick={() => loadPage(currentPage - 1)}
              className="px-3 py-1 mr-3 bg-white text-[#7B2E19] border border-[#7B2E19] rounded-md font-semibold transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Prev
            </button>

            {/* Page Numbers with ellipsis */}
            {pageNumbers.map((pageNum, idx) =>
              pageNum === "..." ? (
                <span key={`ellipsis-${idx}`} className="px-2">
                  ...
                </span>
              ) : (
                <button
                  key={pageNum}
                  onClick={() => loadPage(pageNum)}
                  className={`px-3 py-1 mr-3 rounded-sm font-semibold ${
                    currentPage === pageNum
                      ? "bg-yellow-200 text-[#7B2E19] border border-[#7B2E19]"
                      : "bg-white text-[#7B2E19] border border-[#7B2E19]"
                  }`}
                  disabled={loading}
                >
                  {pageNum}
                </button>
              )
            )}

            <button
              disabled={loading || currentPage === totalPages}
              onClick={() => loadPage(currentPage + 1)}
              className="px-3 py-1 mr-3 bg-white text-[#7B2E19] border border-[#7B2E19] rounded-md font-semibold transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>

            <button
              disabled={
                loading || currentPage === totalPages || totalPages === 1
              }
              onClick={async () => {
                // refresh total, prefetch cursors up to last page, then load it
                const total = await fetchTotalCount();
                const lastPage = Math.max(1, Math.ceil(total / pageSize));
                if (lastPage === currentPage) return;
                // ensure cursors exist up to lastPage - 1
                await ensureCursorsUpTo(lastPage);
                await loadPage(lastPage);
              }}
              className="px-3 py-1 mr-3 bg-white text-[#7B2E19] border border-[#7B2E19] rounded-md font-semibold transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Last
            </button>
          </div>
        </div>
      </div>

      {selectedResponse && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/20"
          onClick={() => setSelectedResponse(null)}
        >
          <div
            className="bg-[#fafbfc] rounded-md p-5 max-w-lg w-full shadow-lg border overflow-y-auto max-h-[80vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* User info */}
            <div className="text-sm text-gray-600 mb-3">
              <strong>User:</strong> {selectedResponse.firstName}{" "}
              {selectedResponse.lastName} | <strong>Email:</strong>{" "}
              {selectedResponse.email} | <strong>Role:</strong>{" "}
              {selectedResponse.role || "N/A"} | <strong>Submitted at:</strong>{" "}
              {selectedResponse.submittedAt?.toDate?.()?.toLocaleString() ||
                (selectedResponse.submittedAt?.seconds
                  ? new Date(
                      selectedResponse.submittedAt.seconds * 1000
                    ).toLocaleString()
                  : "")}
            </div>

            {/* Answers */}
            <div className="space-y-3 mb-3">
              {(selectedResponse.answeredQuestions || []).map((q, idx) => (
                <div
                  key={idx}
                  className="bg-gray-50 p-3 rounded-md border border-gray-200"
                >
                  <div className="font-semibold mb-1">{q.question}</div>
                  <div className="text-gray-800 text-sm">
                    {(() => {
                      if (!q.answer) return "—"; // empty
                      switch (q.type) {
                        case "text":
                        case "textarea":
                        case "radio":
                        case "select":
                          return q.answer;
                        case "checkbox":
                        case "multi-select":
                          return Array.isArray(q.answer)
                            ? q.answer.join(", ")
                            : q.answer;
                       case "file":
  return Array.isArray(q.answer) ? (
    q.answer.map((f, i) => (
      <a
        key={i}
        href={f.url}          // the Firebase Storage download URL
        download={f.name}     // triggers download with the original file name
        className="text-blue-600 underline mr-2"
      >
        {f.name || `File ${i + 1}`}
      </a>
    ))
  ) : (
    <a
      href={q.answer.url}    // single file download URL
      download={q.answer.name} // triggers download
      className="text-blue-600 underline"
    >
      {q.answer.name || "File"}
    </a>
  );

                        default:
                          return JSON.stringify(q.answer);
                      }
                    })()}
                  </div>
                </div>
              ))}
            </div>

            {/* Status */}
            <div className="mb-2 text-sm font-semibold">
              Status:{" "}
              <span className="font-normal">
                {selectedResponse.status || "Pending"}
              </span>
            </div>

            {/* History */}
            <div className="mb-2 text-sm font-semibold">History:</div>
            <div className="mb-3 text-sm">
              {(selectedResponse.history || []).length === 0 && (
                <div className="text-gray-500">No history yet.</div>
              )}
              {(selectedResponse.history || []).map((h, i) => (
                <div key={i} className="text-gray-700">
                  [
                  {h.timestamp?.seconds
                    ? new Date(h.timestamp.seconds * 1000).toLocaleString()
                    : ""}
                  ] {h.updatedBy} → {h.status}
                </div>
              ))}
            </div>

            {/* Admin actions */}
            {isAdmin && selectedResponse.status === "Pending" && (
              <div className="flex gap-3">
                <button
                  onClick={() => handleAccept(selectedResponse)}
                  className="px-4 py-2 bg-green-500 text-white rounded-md font-semibold"
                >
                  Accept
                </button>
                <button
                  onClick={() => handleReject(selectedResponse)}
                  className="px-4 py-2 bg-red-500 text-white rounded-md font-semibold"
                >
                  Reject
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
