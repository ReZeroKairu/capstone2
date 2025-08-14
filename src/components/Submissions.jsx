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
  const PAGE_SIZE = 5;

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async (user) => {
      if (user) {
        setCurrentUser(user);
        const usersSnapshot = await getDocs(collection(db, "Users"));
        const adminCheck = usersSnapshot.docs.find(
          (doc) => doc.id === user.uid && doc.data().role === "Admin"
        );
        setIsAdmin(!!adminCheck);
      }
    });

    return () => unsub();
  }, []);

  useEffect(() => {
    const fetchSubmissions = async () => {
      if (!currentUser) return;

      let q;
      if (isAdmin) {
        q = query(
          collection(db, "form_responses"),
          orderBy("submittedAt", "desc"),
          limit(PAGE_SIZE)
        );
      } else {
        q = query(
          collection(db, "form_responses"),
          where("userId", "==", currentUser.uid),
          orderBy("submittedAt", "desc"),
          limit(PAGE_SIZE)
        );
      }

      if (startDate && endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        q = query(
          collection(db, "form_responses"),
          where("submittedAt", ">=", start),
          where("submittedAt", "<=", end),
          orderBy("submittedAt", "desc"),
          limit(PAGE_SIZE)
        );
      }

      if (lastVisible && page > 1) {
        q = query(q, startAfter(lastVisible));
      }

      const snapshot = await getDocs(q);
      if (!snapshot.empty)
        setLastVisible(snapshot.docs[snapshot.docs.length - 1]);

      const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      if (page === 1) setSubmissions(data);
      else setSubmissions((prev) => [...prev, ...data]);
    };

    fetchSubmissions();
  }, [currentUser, page, startDate, endDate, lastVisible, isAdmin]);

  const renderProgressBar = (status) => {
    const currentIndex = STATUS_ORDER.indexOf(status);
    return (
      <div className="flex items-center space-x-2 mb-2">
        {STATUS_ORDER.map((s, idx) => (
          <div key={s} className="flex-1">
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
    <div className="p-28 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Submissions Tracking</h1>

      <div className="mb-4 flex gap-2">
        <label>
          Start Date:{" "}
          <input
            type="date"
            value={startDate}
            onChange={(e) => {
              setStartDate(e.target.value);
              setPage(1);
              setLastVisible(null);
              setSubmissions([]);
            }}
          />
        </label>
        <label>
          End Date:{" "}
          <input
            type="date"
            value={endDate}
            onChange={(e) => {
              setEndDate(e.target.value);
              setPage(1);
              setLastVisible(null);
              setSubmissions([]);
            }}
          />
        </label>
      </div>

      {submissions.map((sub) => (
        <div key={sub.id} className="mb-4 border p-3 rounded bg-gray-50">
          <p className="text-sm text-gray-500 mb-2">
            {sub.firstName} {sub.lastName} ({sub.role}) — Submitted at:{" "}
            {sub.submittedAt?.toDate?.()?.toLocaleString() ||
              new Date(sub.submittedAt.seconds * 1000).toLocaleString()}
          </p>

          {renderProgressBar(sub.status)}

          <div className="mb-2">
            {sub.answeredQuestions?.map((q, idx) => (
              <p key={idx}>
                <strong>{q.question}:</strong> {q.answer}
              </p>
            ))}
          </div>

          <div>
            <strong>History:</strong>
            {sub.history?.map((h, i) => (
              <p key={i}>
                [{new Date(h.timestamp.seconds * 1000).toLocaleString()}]{" "}
                {h.updatedBy} → {h.status}
              </p>
            ))}
          </div>
        </div>
      ))}

      {submissions.length > 0 && (
        <div className="flex justify-center mt-4">
          <button
            disabled={submissions.length < PAGE_SIZE}
            onClick={() => setPage((prev) => prev + 1)}
            className="bg-blue-500 text-white px-3 py-1 rounded disabled:bg-gray-400"
          >
            Next Page
          </button>
        </div>
      )}
    </div>
  );
}
