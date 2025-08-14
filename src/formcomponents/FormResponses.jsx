// src/formcomponents/FormResponses.jsx
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
} from "firebase/firestore";

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

  // Check admin role
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

  // Fetch forms
  useEffect(() => {
    const fetchForms = async () => {
      const formSnapshot = await getDocs(collection(db, "forms"));
      setForms(formSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    };
    fetchForms();
  }, []);

  // Fetch responses
  const fetchResponses = async (direction = "next") => {
    if (!selectedFormId || !currentUser) return;
    setLoading(true);

    let constraints = [where("formId", "==", selectedFormId)];
    if (!isAdmin) {
      constraints.push(where("userId", "==", currentUser.uid));
    }

    if (startDate && endDate) {
      const start = Timestamp.fromDate(new Date(startDate + "T00:00:00"));
      const end = Timestamp.fromDate(new Date(endDate + "T23:59:59"));
      constraints.push(where("submittedAt", ">=", start));
      constraints.push(where("submittedAt", "<=", end));
    }

    let q = query(
      collection(db, "form_responses"),
      ...constraints,
      orderBy("submittedAt", "desc"),
      limit(PAGE_SIZE)
    );

    if (!searchTerm && direction === "next" && lastVisible) {
      q = query(q, startAfter(lastVisible));
    }

    const snapshot = await getDocs(q);
    const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

    // Update prevStack for previous page
    if (!searchTerm) {
      if (direction === "next" && lastVisible) {
        setPrevStack((prev) => [...prev, lastVisible]);
      } else if (direction === "prev" && prevStack.length > 0) {
        setPrevStack((prev) => prev.slice(0, -1));
      }
      setLastVisible(snapshot.docs[snapshot.docs.length - 1] || null);
    }

    // For search, fetch all matching results across all pages
    if (searchTerm.trim() !== "") {
      const term = searchTerm.toLowerCase();

      // Firestore can't do full-text search, so fetch all filtered by constraints
      // and then in-memory filter for search term
      let fullQuery = query(
        collection(db, "form_responses"),
        ...constraints,
        orderBy("submittedAt", "desc")
      );
      const fullSnapshot = await getDocs(fullQuery);
      const fullData = fullSnapshot.docs
        .map((doc) => ({ id: doc.id, ...doc.data() }))
        .filter(
          (r) =>
            `${r.firstName || ""} ${r.lastName || ""}`
              .toLowerCase()
              .includes(term) || r.email?.toLowerCase().includes(term)
        );
      setResponses(fullData);
      setLastVisible(null);
      setPrevStack([]);
    } else {
      // normal pagination
      setResponses(data);
    }

    setLoading(false);
  };

  // Reset pagination when filters change
  useEffect(() => {
    setLastVisible(null);
    setPrevStack([]);
    setResponses([]);
    if (selectedFormId) fetchResponses("next");
  }, [selectedFormId, startDate, endDate, currentUser, isAdmin, searchTerm]);

  // Highlighting search term
  const highlightText = (text) => {
    if (!searchTerm) return text;
    const parts = text.split(new RegExp(`(${searchTerm})`, "gi"));
    return parts.map((part, i) =>
      part.toLowerCase() === searchTerm.toLowerCase() ? (
        <mark key={i} className="bg-yellow-200">
          {part}
        </mark>
      ) : (
        <span key={i}>{part}</span>
      )
    );
  };

  if (!isAdmin && !currentUser) {
    return (
      <p className="p-28 text-red-500">
        You do not have permission to view responses.
      </p>
    );
  }

  return (
    <div className="p-28 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Form Responses</h1>

      {/* Form selection */}
      <select
        value={selectedFormId}
        onChange={(e) => setSelectedFormId(e.target.value)}
        className="border p-2 mb-4 w-full"
      >
        <option value="">Select a form</option>
        {forms.map((f) => (
          <option key={f.id} value={f.id}>
            {f.title}
          </option>
        ))}
      </select>

      {/* Date filter */}
      <div className="mb-4 flex gap-2">
        <label>
          Start Date:{" "}
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </label>
        <label>
          End Date:{" "}
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </label>
      </div>

      {/* Search input */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Search by name or email..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="border p-2 w-full"
        />
      </div>

      {responses.length === 0 && !loading && selectedFormId && (
        <p>No responses found.</p>
      )}

      {/* Response list */}
      {responses.map((res) => {
        const fullName = `${res.firstName || ""} ${res.lastName || ""}`;
        return (
          <div key={res.id} className="mb-4 border p-3 rounded bg-gray-50">
            <p className="text-sm text-gray-500 mb-2">
              User: {highlightText(fullName)} | Email:{" "}
              {highlightText(res.email)} | Role: {res.role || "N/A"} | Submitted
              at:{" "}
              {res.submittedAt?.toDate?.()?.toLocaleString() ||
                new Date(res.submittedAt.seconds * 1000).toLocaleString()}
            </p>

            <div className="mb-2">
              {res.answeredQuestions?.map((q, idx) => (
                <p key={idx}>
                  <strong>{q.question}:</strong> {q.answer}
                </p>
              ))}
            </div>

            <div>
              <strong>Status:</strong> {res.status || "Pending"}
            </div>

            <div>
              <strong>History:</strong>
              {res.history?.map((h, i) => (
                <p key={i}>
                  [{new Date(h.timestamp.seconds * 1000).toLocaleString()}]{" "}
                  {h.updatedBy} → {h.status}
                </p>
              ))}
            </div>
          </div>
        );
      })}

      {/* Pagination buttons */}
      {!searchTerm && responses.length > 0 && (
        <div className="flex justify-center mt-4 gap-2">
          <button
            disabled={prevStack.length === 0 || loading}
            onClick={() => fetchResponses("prev")}
            className="bg-gray-500 text-white px-3 py-1 rounded disabled:bg-gray-300"
          >
            Previous Page
          </button>
          <button
            disabled={responses.length < PAGE_SIZE || loading}
            onClick={() => fetchResponses("next")}
            className="bg-blue-500 text-white px-3 py-1 rounded disabled:bg-gray-400"
          >
            Next Page
          </button>
        </div>
      )}
    </div>
  );
}
