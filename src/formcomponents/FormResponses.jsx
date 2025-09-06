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

const PAGE_SIZE = 5;

export default function FormResponses() {
  const [responses, setResponses] = useState([]);
  const [forms, setForms] = useState([]);
  const [selectedFormId, setSelectedFormId] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [lastVisible, setLastVisible] = useState(null);
  const [prevStack, setPrevStack] = useState([]);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [totalResponses, setTotalResponses] = useState(0);
  const [pageCursors, setPageCursors] = useState([null]);
  const [currentPage, setCurrentPage] = useState(1);

  // modal
  const [selectedResponse, setSelectedResponse] = useState(null);

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
    if (!selectedFormId) return;
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

  const fetchResponses = async (direction = "next", goToLast = false) => {
    if (!selectedFormId || !currentUser) return;
    setLoading(true);

    try {
      const constraints = [
        where("formId", "==", selectedFormId),
        where("status", "==", "Pending"),
      ];
      if (!isAdmin) constraints.push(where("userId", "==", currentUser.uid));

      if (startDate && endDate) {
        const start = Timestamp.fromDate(new Date(startDate + "T00:00:00"));
        const end = Timestamp.fromDate(new Date(endDate + "T23:59:59"));
        constraints.push(where("submittedAt", ">=", start));
        constraints.push(where("submittedAt", "<=", end));
      }

      const isSearching = searchTerm.trim() !== "";
      let startAfterDoc = null;

      if (!isSearching && totalResponses) {
        const lastPage = Math.ceil(totalResponses / PAGE_SIZE);

        if (goToLast) {
          if (lastPage === currentPage || totalResponses <= PAGE_SIZE) {
            setLoading(false);
            return;
          }
          startAfterDoc = pageCursors[lastPage - 2] || null;
        } else {
          if (direction === "next")
            startAfterDoc = pageCursors[currentPage - 1] || null;
          if (direction === "prev" && currentPage > 1)
            startAfterDoc = pageCursors[currentPage - 2] || null;
        }
      }

      const q = query(
        collection(db, "form_responses"),
        ...constraints,
        orderBy("submittedAt", "desc"),
        limit(isSearching ? 1000 : PAGE_SIZE),
        ...(startAfterDoc ? [startAfter(startAfterDoc)] : [])
      );

      const snapshot = await getDocs(q);
      const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));

      if (isSearching) {
        const term = searchTerm.toLowerCase();
        const filtered = data.filter((res) =>
          res.searchIndex?.some((f) => f?.toLowerCase().includes(term))
        );
        setResponses(filtered);
        setCurrentPage(1);
        setPageCursors([null]);
      } else {
        setResponses(data);

        if (snapshot.docs.length > 0) {
          const lastDoc = snapshot.docs[snapshot.docs.length - 1];
          const lastPage = Math.ceil(totalResponses / PAGE_SIZE);

          if (goToLast) {
            setPageCursors((prev) => {
              const newCursors = [...prev];
              newCursors[lastPage - 1] = lastDoc;
              return newCursors;
            });
            setCurrentPage(lastPage);
          } else if (direction === "next") {
            setPageCursors((prev) => {
              const newCursors = [...prev];
              newCursors[currentPage - 1] = lastDoc;
              return newCursors;
            });
            if (data.length === PAGE_SIZE) setCurrentPage((p) => p + 1);
          } else if (direction === "prev" && currentPage > 1) {
            setCurrentPage((p) => p - 1);
          }
        }
      }
    } catch (err) {
      console.error("Error fetching responses:", err.message);
    } finally {
      setLoading(false);
    }
  };

  // reset and fetch when filters or selection change
  useEffect(() => {
    setLastVisible(null);
    setPrevStack([]);
    setResponses([]);
    fetchResponses("next");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFormId, startDate, endDate, searchTerm, currentUser, isAdmin]);

  const handleKeyDown = (e) => {
    if (e.key === "Enter") fetchResponses("next");
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

  // Admin actions
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

      if (!mSnap.empty) {
        mSnap.forEach(async (ms) => {
          await updateDoc(doc(db, "manuscripts", ms.id), {
            status: "Assigning Peer Reviewer",
          });
        });
      } else {
        await addDoc(manuscriptsRef, {
          responseId: res.id,
          formId: res.formId,
          formTitle: res.formTitle,
          answeredQuestions: res.answeredQuestions || [],
          userId: res.userId,
          coAuthors: res.coAuthors || [],
          submittedAt: serverTimestamp(),
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
            message: `Your manuscript "${res.formTitle}" has been accepted by the admin.`,
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

      if (!mSnap.empty) {
        mSnap.forEach(async (ms) => {
          await updateDoc(doc(db, "manuscripts", ms.id), {
            status: "Rejected",
          });
        });
      } else {
        await addDoc(manuscriptsRef, {
          responseId: res.id,
          formId: res.formId,
          formTitle: res.formTitle,
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
            message: `Your manuscript "${res.formTitle}" has been rejected by the admin.`,
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
                className="w-full bg-transparent placeholder:text-[#9296a1] italic text-base font-medium outline-none"
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

        <div className="flex items-center gap-2 mt-4">
          <button
            disabled={currentPage === 1 || loading}
            onClick={() => {
              setCurrentPage(1);
              setPageCursors([null]);
              fetchResponses("next");
            }}
            className="px-3 py-1 bg-white text-[#7B2E19] border border-[#7B2E19] rounded-md font-semibold disabled:opacity-50"
          >
            First
          </button>

          <button
            disabled={currentPage === 1 || loading}
            onClick={() => fetchResponses("prev")}
            className="px-3 py-1 bg-white text-[#7B2E19] border border-[#7B2E19] rounded-md font-semibold disabled:opacity-50"
          >
            Prev
          </button>

          <span className="px-2 py-1 font-semibold">{currentPage}</span>

          <button
            disabled={loading || responses.length < PAGE_SIZE}
            onClick={() => fetchResponses("next")}
            className="px-3 py-1 bg-white text-[#7B2E19] border border-[#7B2E19] rounded-md font-semibold disabled:opacity-50"
          >
            Next
          </button>

          <button
            disabled={
              loading ||
              currentPage === Math.ceil(totalResponses / PAGE_SIZE) ||
              totalResponses <= PAGE_SIZE
            }
            onClick={() => fetchResponses("next", true)}
            className="px-3 py-1 bg-white text-[#7B2E19] border border-[#7B2E19] rounded-md font-semibold disabled:opacity-50"
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
                  <span>{q.answer}</span>
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
