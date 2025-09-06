import React, { useEffect, useState } from "react";
import { db, auth } from "../firebase/firebase";
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

export default function FormResponses() {
  const [responses, setResponses] = useState([]);
  const [forms, setForms] = useState([]);
  const [selectedFormId, setSelectedFormId] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);

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

  // fetch forms for select
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

  // fetch total responses for pagination
  useEffect(() => {
    if (!selectedFormId) {
      setTotalResponses(0);
      return;
    }
    const fetchTotal = async () => {
      try {
        const constraints = [
          where("formId", "==", selectedFormId),
          where("status", "==", "Pending"),
        ];
        if (!isAdmin && currentUser) {
          constraints.push(where("userId", "==", currentUser.uid));
        }
        if (startDate && endDate) {
          const start = Timestamp.fromDate(new Date(startDate + "T00:00:00"));
          const end = Timestamp.fromDate(new Date(endDate + "T23:59:59"));
          constraints.push(where("submittedAt", ">=", start));
          constraints.push(where("submittedAt", "<=", end));
        }
        const q = query(collection(db, "form_responses"), ...constraints);
        const snapshot = await getDocs(q);
        setTotalResponses(snapshot.size);
      } catch (err) {
        console.error("Error fetching total responses:", err);
      }
    };
    fetchTotal();
  }, [selectedFormId, startDate, endDate, currentUser, isAdmin]);

  // helper: build query constraints array for current filters/search
  const buildConstraints = () => {
    const constraints = [
      where("formId", "==", selectedFormId),
      where("status", "==", "Pending"),
    ];
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

  // NEW: fetch fresh total count (used when jumping to last page)
  const fetchTotalCount = async () => {
    if (!selectedFormId) return 0;
    try {
      const constraints = buildConstraints();
      const q = query(collection(db, "form_responses"), ...constraints);
      const snap = await getDocs(q);
      setTotalResponses(snap.size);
      return snap.size;
    } catch (err) {
      console.error("Error fetching total count:", err);
      return totalResponses || 0;
    }
  };

  // ensure we have stored cursors up to page - 1 (so we can startAfter when fetching target page)
  const ensureCursorsUpTo = async (page) => {
    if (page <= 1) return;
    const needed = page - 1; // need lastDoc for pages 1..needed
    // if pageCursors already has needed entries (each entry corresponds to lastDoc of page i)
    if (pageCursors.length >= needed) return;

    let cursors = [...pageCursors];
    try {
      // start fetching from the last known cursor
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
        // if returned docs < pageSize then no more pages after this
        if (snap.docs.length < pageSize) break;
      }
      setPageCursors(cursors);
    } catch (err) {
      console.error("Error prefetching cursors:", err);
    }
  };

  // main page loader
  const loadPage = async (page = 1) => {
    if (!selectedFormId || !currentUser) return;
    const isSearching = searchTerm.trim() !== "";
    setLoading(true);
    try {
      if (isSearching) {
        // search: fetch larger set and filter client-side
        const constraints = buildConstraints();
        const q = query(
          collection(db, "form_responses"),
          ...constraints,
          orderBy("submittedAt", "desc"),
          limit(1000)
        );
        const snap = await getDocs(q);
        const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        const term = searchTerm.toLowerCase();
        const filtered = data.filter((res) =>
          res.searchIndex?.some((f) => f?.toLowerCase().includes(term))
        );
        setResponses(filtered);
        setCurrentPage(1);
        setPageCursors([]);
        return;
      }

      // normal pagination: ensure cursors up to target page - 1
      const totalPages = Math.max(1, Math.ceil(totalResponses / pageSize));
      const targetPage = Math.min(Math.max(1, page), totalPages);

      await ensureCursorsUpTo(targetPage);

      const startAfterDoc =
        targetPage > 1 ? pageCursors[targetPage - 2] || null : null;
      const constraints = buildConstraints();
      const q = query(
        collection(db, "form_responses"),
        ...constraints,
        orderBy("submittedAt", "desc"),
        limit(pageSize),
        ...(startAfterDoc ? [startAfter(startAfterDoc)] : [])
      );
      const snap = await getDocs(q);
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setResponses(data);

      // store lastDoc for this page
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
    // small delay to ensure state updates before load (not strictly necessary)
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

      setResponses((prev) =>
        prev.map((r) =>
          r.id === res.id ? { ...r, status: "Assigning Peer Reviewer" } : r
        )
      );
      setSelectedResponse((r) =>
        r && r.id === res.id ? { ...r, status: "Assigning Peer Reviewer" } : r
      );
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

      setResponses((prev) =>
        prev.map((r) => (r.id === res.id ? { ...r, status: "Rejected" } : r))
      );
      setSelectedResponse((r) =>
        r && r.id === res.id ? { ...r, status: "Rejected" } : r
      );
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
              className="w-full appearance-none bg-yellow-200 text-[#211B17] font-semibold text-lg rounded-lg px-4 py-2 pr-10 focus:outline-none"
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

        {/* Page size selector */}
        <div className="flex items-center gap-2 mb-4">
          <label className="text-sm text-gray-700 font-medium">
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
            className="border rounded px-2 py-1"
          >
            <option value={5}>5</option>
            <option value={10}>10</option>
            <option value={15}>15</option>
            <option value={20}>20</option>
          </select>
        </div>

        <div className="bg-[#f3f2ee] rounded-md overflow-hidden">
          {responses.length === 0 && !loading && selectedFormId && (
            <div className="p-6 text-center text-gray-600">
              No responses found.
            </div>
          )}

          {responses.map((res, idx) => {
            const fullName = `${res.firstName || ""} ${
              res.lastName || ""
            }`.trim();
            const submittedAtText =
              res.submittedAt?.toDate?.()?.toLocaleString() ||
              (res.submittedAt?.seconds
                ? new Date(res.submittedAt.seconds * 1000).toLocaleString()
                : "");

            return (
              <div
                key={res.id}
                className={`flex items-center gap-4 px-4 py-3 text-[#211B17] ${
                  idx === responses.length - 1 ? "" : "border-b"
                } border-[#7B2E19]/30`}
              >
                <div className="flex-1 truncate text-sm">
                  {highlightText(res.email || "")}
                </div>
                <div className="flex-1 truncate text-sm">
                  {highlightText(fullName)}
                </div>
                <div className="flex-none text-xs text-gray-600">
                  {submittedAtText}
                </div>
                <div className="flex-none ml-2">
                  <button
                    onClick={() => setSelectedResponse(res)}
                    className="text-[#7B2E19] underline font-medium text-sm"
                  >
                    View Response
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Advanced Pagination */}
        <div className="flex items-center justify-center gap-2 mt-4">
          <button
            disabled={currentPage === 1 || loading}
            onClick={() => loadPage(1)}
            className="px-3 py-1 bg-white text-[#7B2E19] border border-[#7B2E19] rounded-md font-semibold transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            First
          </button>

          <button
            disabled={currentPage === 1 || loading}
            onClick={() => loadPage(currentPage - 1)}
            className="px-3 py-1 bg-white text-[#7B2E19] border border-[#7B2E19] rounded-md font-semibold transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
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
                className={`px-3 py-1 rounded-md font-semibold ${
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
            className="px-3 py-1 bg-white text-[#7B2E19] border border-[#7B2E19] rounded-md font-semibold transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
          </button>

          <button
            disabled={loading || currentPage === totalPages || totalPages === 1}
            onClick={async () => {
              // refresh total, prefetch cursors up to last page, then load it
              const total = await fetchTotalCount();
              const lastPage = Math.max(1, Math.ceil(total / pageSize));
              if (lastPage === currentPage) return;
              // ensure cursors exist up to lastPage - 1
              await ensureCursorsUpTo(lastPage);
              await loadPage(lastPage);
            }}
            className="px-3 py-1 bg-white text-[#7B2E19] border border-[#7B2E19] rounded-md font-semibold transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Last
          </button>
        </div>

        {loading && (
          <div className="mt-3 text-sm text-gray-500">Loading...</div>
        )}
      </div>

      {selectedResponse && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/20"
          onClick={() => setSelectedResponse(null)}
        >
          <div
            className="bg-[#fafbfc] rounded-md p-5 max-w-md w-full shadow-lg border"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-sm text-gray-600 mb-3">
              User: {selectedResponse.firstName} {selectedResponse.lastName} |
              Email: {selectedResponse.email} | Role:{" "}
              {selectedResponse.role || "N/A"} | Submitted at:{" "}
              {selectedResponse.submittedAt?.toDate?.()?.toLocaleString() ||
                (selectedResponse.submittedAt?.seconds
                  ? new Date(
                      selectedResponse.submittedAt.seconds * 1000
                    ).toLocaleString()
                  : "")}
            </div>

            <div className="space-y-2 mb-3">
              {(selectedResponse.answeredQuestions || []).map((q, idx) => (
                <div key={idx} className="text-sm">
                  <span className="font-bold">{q.question}:</span>{" "}
                  <span>{formatAnswer(q.answer)}</span>
                </div>
              ))}
            </div>

            <div className="mb-2 text-sm font-semibold">
              Status:{" "}
              <span className="font-normal">
                {selectedResponse.status || "Pending"}
              </span>
            </div>

            <div className="mb-2 text-sm font-semibold">History:</div>
            <div className="mb-3 text-sm">
              {(selectedResponse.history || []).length === 0 && (
                <div className="text-sm text-gray-500 mb-2">
                  No history yet.
                </div>
              )}
              {(selectedResponse.history || []).map((h, i) => (
                <div key={i} className="text-sm text-gray-700">
                  [
                  {h.timestamp?.seconds
                    ? new Date(h.timestamp.seconds * 1000).toLocaleString()
                    : ""}
                  ] {h.updatedBy} → {h.status}
                </div>
              ))}
            </div>

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
