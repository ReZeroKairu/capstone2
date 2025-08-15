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
} from "firebase/firestore";

const STATUS_ORDER = [
  "Pending",
  "Peer Reviewer",
  "Peer Review Complete",
  "Revisions",
  "Accepted",
  "Rejected",
];

export default function Submissions() {
  const [submissions, setSubmissions] = useState([]);
  const [page, setPage] = useState(1);
  const [lastVisible, setLastVisible] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [hasMore, setHasMore] = useState(true);
  const PAGE_SIZE = 5;

  // Auth check
  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async (user) => {
      if (user) {
        setCurrentUser(user);
        const usersSnapshot = await getDocs(collection(db, "Users"));
        const adminCheck = usersSnapshot.docs.find(
          (doc) => doc.id === user.uid && doc.data().role === "Admin"
        );
        setIsAdmin(!!adminCheck);
      } else {
        setCurrentUser(null);
        setIsAdmin(false);
      }
    });
    return () => unsub();
  }, []);

  // Fetch submissions
  useEffect(() => {
    if (!currentUser) return;

    const fetchSubmissions = async () => {
      let q = collection(db, "form_responses");
      const conditions = [];

      if (!isAdmin) conditions.push(where("userId", "==", currentUser.uid));
      if (startDate)
        conditions.push(where("submittedAt", ">=", new Date(startDate)));
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        conditions.push(where("submittedAt", "<=", end));
      }

      q = query(
        q,
        ...conditions,
        orderBy("submittedAt", "desc"),
        limit(PAGE_SIZE),
        ...(lastVisible && page > 1 ? [startAfter(lastVisible)] : [])
      );

      try {
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
          const data = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }));
          setLastVisible(snapshot.docs[snapshot.docs.length - 1]);
          setSubmissions((prev) => (page === 1 ? data : [...prev, ...data]));
          setHasMore(data.length === PAGE_SIZE);
        } else {
          if (page === 1) setSubmissions([]);
          setHasMore(false);
        }
      } catch (err) {
        console.error("Error fetching submissions:", err);
      }
    };

    fetchSubmissions();
  }, [currentUser, page, startDate, endDate, isAdmin, lastVisible]);

  const handleFilterChange = (setter) => (value) => {
    setter(value);
    setPage(1);
    setLastVisible(null);
    setSubmissions([]);
    setHasMore(true);
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return "-";
    return timestamp.toDate?.()
      ? timestamp.toDate().toLocaleString()
      : new Date(timestamp.seconds * 1000).toLocaleString();
  };

  const renderProgressBar = (status) => {
    const currentIndex = STATUS_ORDER.indexOf(status);
    return (
      <div className="flex flex-wrap items-center gap-1 mb-2">
        {STATUS_ORDER.map((s, idx) => (
          <div key={s} className="flex-1 min-w-[40px]">
            <div
              className={`h-2 rounded ${
                idx <= currentIndex ? "bg-green-500" : "bg-gray-300"
              }`}
            ></div>
            <p className="text-xs text-center mt-1">{s}</p>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="p-4 sm:p-6 md:p-8 lg:p-12 max-w-full sm:max-w-xl md:max-w-3xl lg:max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-4 text-center sm:text-left">
        Submissions Tracking
      </h1>

      {/* Filters */}
      <div className="mb-4 flex flex-col sm:flex-row gap-2">
        <label className="flex-1">
          Start Date:{" "}
          <input
            type="date"
            value={startDate}
            onChange={(e) => handleFilterChange(setStartDate)(e.target.value)}
            className="border rounded px-2 py-1 w-full sm:w-auto"
          />
        </label>
        <label className="flex-1">
          End Date:{" "}
          <input
            type="date"
            value={endDate}
            onChange={(e) => handleFilterChange(setEndDate)(e.target.value)}
            className="border rounded px-2 py-1 w-full sm:w-auto"
          />
        </label>
      </div>

      {/* Submissions */}
      <div className="flex flex-col gap-4">
        {submissions.map((sub) => (
          <div
            key={sub.id}
            className="mb-4 border p-3 rounded bg-gray-50 shadow-sm flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2"
          >
            <div className="flex-1">
              <p className="text-sm text-gray-500 mb-2 break-words">
                {sub.firstName} {sub.lastName} ({sub.role}) — Submitted at:{" "}
                {formatDate(sub.submittedAt)}
              </p>

              {renderProgressBar(sub.status)}

              <div className="mb-2">
                {sub.answeredQuestions?.map((q, idx) => (
                  <p key={idx}>
                    <strong>{q.question}:</strong> {q.answer}
                  </p>
                ))}
              </div>

              {sub.history && sub.history.length > 0 && (
                <div>
                  <strong>History:</strong>
                  {sub.history.map((h, i) => (
                    <p key={i}>
                      [{new Date(h.timestamp.seconds * 1000).toLocaleString()}]{" "}
                      {h.updatedBy} → {h.status}
                    </p>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Pagination */}
      {hasMore && (
        <div className="flex justify-center mt-4">
          <button
            disabled={!hasMore}
            onClick={() => setPage((prev) => prev + 1)}
            className="bg-blue-500 text-white px-4 py-2 rounded disabled:bg-gray-400"
          >
            Next Page
          </button>
        </div>
      )}
    </div>
  );
}
