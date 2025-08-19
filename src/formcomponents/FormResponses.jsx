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

  // Fetch current user & check admin role
  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async (user) => {
      if (!user) return setCurrentUser(null);
      setCurrentUser(user);

      const userSnapshot = await getDocs(
        query(collection(db, "Users"), where("__name__", "==", user.uid))
      );
      const userData = userSnapshot.docs[0]?.data();
      setIsAdmin(userData?.role === "Admin");
    });

    return () => unsub();
  }, []);

  // Fetch available forms
  useEffect(() => {
    const fetchForms = async () => {
      const snapshot = await getDocs(collection(db, "forms"));
      setForms(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    };
    fetchForms();
  }, []);

  // Fetch responses (with pagination & search)
  // Fetch responses (with pagination & search)
  const fetchResponses = async (direction = "next") => {
    if (!selectedFormId || !currentUser) return;
    setLoading(true);

    try {
      // Always fetch only Pending responses for FormResponses
      let constraints = [
        where("formId", "==", selectedFormId),
        where("status", "==", "Pending"), // ✅ Only Pending here
      ];

      if (!isAdmin) constraints.push(where("userId", "==", currentUser.uid));

      if (startDate && endDate) {
        const start = Timestamp.fromDate(new Date(startDate + "T00:00:00"));
        const end = Timestamp.fromDate(new Date(endDate + "T23:59:59"));
        constraints.push(where("submittedAt", ">=", start));
        constraints.push(where("submittedAt", "<=", end));
      }

      const isSearching = searchTerm.trim() !== "";

      let q = query(
        collection(db, "form_responses"),
        ...constraints,
        orderBy("submittedAt", "desc"),
        limit(isSearching ? 1000 : PAGE_SIZE)
      );

      if (!isSearching && direction === "next" && lastVisible) {
        q = query(q, startAfter(lastVisible));
      }

      const snapshot = await getDocs(q);
      let data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

      if (isSearching) {
        const term = searchTerm.toLowerCase();
        data = data.filter((res) =>
          res.searchIndex?.some((field) => field.includes(term))
        );
        setPrevStack([]);
        setLastVisible(null);
        setResponses(data);
      } else {
        if (direction === "prev") {
          const prevPage = prevStack[prevStack.length - 1];
          setPrevStack((prev) => prev.slice(0, -1));
          setLastVisible(prevPage || null);
          setResponses(data);
        } else {
          setResponses(direction === "next" ? [...responses, ...data] : data);
          if (snapshot.docs.length > 0) {
            setPrevStack((prev) => [...prev, lastVisible]);
            setLastVisible(snapshot.docs[snapshot.docs.length - 1]);
          }
        }
      }
    } catch (err) {
      console.error("Error fetching responses:", err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLastVisible(null);
    setPrevStack([]);
    setResponses([]);
    fetchResponses("next");
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
        <mark key={i} className="bg-yellow-200">
          {part}
        </mark>
      ) : (
        <span key={i}>{part}</span>
      )
    );
  };

  // Admin: Accept submission
  const handleAccept = async (res) => {
    try {
      const resRef = doc(db, "form_responses", res.id);

      // Update status at the root level
      await updateDoc(resRef, { status: "Accepted" });

      // Add history entry in subcollection
      await addDoc(collection(db, "form_responses", res.id, "history"), {
        timestamp: serverTimestamp(),
        updatedBy: currentUser.uid,
        status: "Accepted",
      });

      // Check if manuscript already exists for this response
      const manuscriptsRef = collection(db, "manuscripts");
      const q = query(manuscriptsRef, where("responseId", "==", res.id));
      const snapshot = await getDocs(q);

      if (!snapshot.empty) {
        // Update existing manuscript status
        snapshot.forEach(async (docSnap) => {
          await updateDoc(doc(db, "manuscripts", docSnap.id), {
            status: "Accepted",
          });
        });
      } else {
        // Add to manuscripts collection if it doesn't exist
        await addDoc(manuscriptsRef, {
          responseId: res.id,
          formId: res.formId,
          formTitle: res.formTitle,
          answeredQuestions: res.answeredQuestions,
          userId: res.userId,
          submittedAt: serverTimestamp(),
          status: "Accepted",
        });
      }

      // Notify researcher
      await addDoc(collection(db, "Users", res.userId, "Notifications"), {
        message: `Your manuscript "${res.formTitle}" has been accepted by the admin.`,
        seen: false,
        timestamp: serverTimestamp(),
      });

      // Update local state
      setResponses((prev) =>
        prev.map((r) => (r.id === res.id ? { ...r, status: "Accepted" } : r))
      );
    } catch (err) {
      console.error("Error accepting response:", err);
    }
  };

  // Admin: Reject submission
  const handleReject = async (res) => {
    try {
      const resRef = doc(db, "form_responses", res.id);

      // Update status at the root level
      await updateDoc(resRef, { status: "Rejected" });

      // Add history entry in subcollection
      await addDoc(collection(db, "form_responses", res.id, "history"), {
        timestamp: serverTimestamp(),
        updatedBy: currentUser.uid,
        status: "Rejected",
      });

      // Check if manuscript already exists for this response
      const manuscriptsRef = collection(db, "manuscripts");
      const q = query(manuscriptsRef, where("responseId", "==", res.id));
      const snapshot = await getDocs(q);

      if (!snapshot.empty) {
        // Update existing manuscript status
        snapshot.forEach(async (docSnap) => {
          await updateDoc(doc(db, "manuscripts", docSnap.id), {
            status: "Rejected",
          });
        });
      } else {
        // Add to manuscripts collection if it doesn't exist
        await addDoc(manuscriptsRef, {
          responseId: res.id,
          formId: res.formId,
          formTitle: res.formTitle,
          answeredQuestions: res.answeredQuestions,
          userId: res.userId,
          submittedAt: serverTimestamp(),
          status: "Rejected",
        });
      }

      // Notify researcher
      await addDoc(collection(db, "Users", res.userId, "Notifications"), {
        message: `Your manuscript "${res.formTitle}" has been rejected by the admin.`,
        seen: false,
        timestamp: serverTimestamp(),
      });

      // Update local state
      setResponses((prev) =>
        prev.map((r) => (r.id === res.id ? { ...r, status: "Rejected" } : r))
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
    <div className="p-28 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Form Responses</h1>

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

      <div className="mb-4 flex gap-2">
        <label>
          Start Date:{" "}
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            onKeyDown={handleKeyDown}
          />
        </label>
        <label>
          End Date:{" "}
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            onKeyDown={handleKeyDown}
          />
        </label>
      </div>

      <div className="mb-4">
        <input
          type="text"
          placeholder="Search by name or email..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onKeyDown={handleKeyDown}
          className="border p-2 w-full"
        />
      </div>

      {responses.length === 0 && !loading && selectedFormId && (
        <p>No responses found.</p>
      )}

      {responses.map((res) => {
        const fullName = `${res.firstName || ""} ${res.lastName || ""}`;
        return (
          <div key={res.id} className="mb-4 border p-3 rounded bg-gray-50">
            <p className="text-sm text-gray-500 mb-2">
              User: {highlightText(fullName)} | Email:{" "}
              {highlightText(res.email || "")} | Role: {res.role || "N/A"} |
              Submitted at:{" "}
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

            {/* Admin Accept/Reject Buttons */}
            {isAdmin && res.status === "Pending" && (
              <div className="mt-2 flex gap-2">
                <button
                  onClick={() => handleAccept(res)}
                  className="bg-green-500 text-white px-3 py-1 rounded"
                >
                  Accept
                </button>
                <button
                  onClick={() => handleReject(res)}
                  className="bg-red-500 text-white px-3 py-1 rounded"
                >
                  Reject
                </button>
              </div>
            )}
          </div>
        );
      })}

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
