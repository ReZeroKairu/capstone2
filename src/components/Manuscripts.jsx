import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { getAuth } from "firebase/auth";
import {
  collection,
  onSnapshot,
  doc,
  getDoc,
  updateDoc,
  query,
  where,
} from "firebase/firestore";
import { db } from "../firebase/firebase";

const STATUS_ORDER = ["Pending", "Accepted", "Rejected"];

const Manuscripts = () => {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [manuscripts, setManuscripts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [expanded, setExpanded] = useState({}); // Track expanded manuscripts
  const navigate = useNavigate();
  const location = useLocation();

  const params = new URLSearchParams(location.search);
  const initialStatus = params.get("status") || "Pending";
  const [selectedStatus, setSelectedStatus] = useState(initialStatus);

  useEffect(() => {
    const auth = getAuth();
    let unsubscribeManuscripts = null;

    const fetchData = async (currentUser) => {
      try {
        const userRef = doc(db, "Users", currentUser.uid);
        const docSnap = await getDoc(userRef);
        const userRole = docSnap.exists() ? docSnap.data().role : "User";
        setRole(userRole);

        const manuscriptsRef = collection(db, "manuscripts");
        unsubscribeManuscripts = onSnapshot(manuscriptsRef, (snapshot) => {
          const allMss = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }));

          allMss.sort(
            (a, b) =>
              (b.submittedAt?.seconds || 0) - (a.submittedAt?.seconds || 0)
          );

          setManuscripts(
            userRole === "Admin"
              ? allMss
              : allMss.filter((m) => m.userId === currentUser.uid)
          );
        });
      } catch (err) {
        console.error("Error fetching manuscripts:", err);
      } finally {
        setLoading(false);
      }
    };

    const unsubscribeAuth = auth.onAuthStateChanged((currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        fetchData(currentUser);
      } else {
        setUser(null);
        setRole(null);
        setManuscripts([]);
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeManuscripts) unsubscribeManuscripts();
    };
  }, []);

  if (loading)
    return <div className="p-28 text-gray-700">Loading manuscripts...</div>;
  if (!user)
    return (
      <div className="p-28 text-red-600 text-center">
        You must be signed in to view manuscripts.
      </div>
    );

  const filteredManuscripts = manuscripts.filter((m) => {
    const matchesStatus = m.status === selectedStatus;
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      m.title?.toLowerCase().includes(term) ||
      `${m.firstName || ""} ${m.lastName || ""}`.toLowerCase().includes(term);
    return matchesStatus && matchesSearch;
  });

  const handleStatusClick = (status) => {
    setSelectedStatus(status);
    navigate(`/manuscripts?status=${status}`);
  };

  const toggleExpand = (id) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const updateManuscriptStatus = async (responseId, newStatus) => {
    try {
      const manuscriptsRef = collection(db, "manuscripts");
      const q = query(manuscriptsRef, where("responseId", "==", responseId));
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        const docRef = doc(db, "manuscripts", snapshot.docs[0].id);
        await updateDoc(docRef, { status: newStatus });
      }
    } catch (err) {
      console.error("Error updating manuscript status:", err);
    }
  };

  return (
    <div className="pt-24 px-4 sm:px-6 lg:px-24 pb-24">
      <h1 className="text-3xl font-bold mb-6 text-center sm:text-left">
        Manuscripts
      </h1>

      {/* Status Buttons */}
      <div className="flex flex-wrap gap-2 mb-4">
        {STATUS_ORDER.map((status) => {
          const count = manuscripts.filter((m) => m.status === status).length;
          const isSelected = selectedStatus === status;
          return (
            <button
              key={status}
              className={`px-4 py-2 rounded font-semibold flex items-center gap-2 transition-shadow text-sm sm:text-base ${
                isSelected
                  ? "bg-green-500 text-white shadow-md"
                  : "bg-gray-200 text-gray-700 hover:bg-gray-300"
              }`}
              onClick={() => handleStatusClick(status)}
            >
              {status}{" "}
              <span className="bg-white text-gray-700 px-2 rounded-full text-xs sm:text-sm">
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Search Input */}
      <div className="mb-6">
        <input
          type="text"
          placeholder="Search by title or author..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="border p-2 w-full rounded text-sm sm:text-base"
        />
      </div>

      {/* Manuscript List */}
      {filteredManuscripts.length === 0 ? (
        <p className="text-gray-600 text-sm sm:text-base">
          No manuscripts matching your search and status "{selectedStatus}".
        </p>
      ) : (
        <ul className="space-y-4">
          {filteredManuscripts.map((m) => (
            <li
              key={m.id}
              className="border p-4 rounded shadow-sm bg-white hover:shadow-md transition w-full sm:w-auto"
            >
              <p
                className="font-semibold text-lg cursor-pointer break-words"
                onClick={() => toggleExpand(m.id)}
              >
                {m.title || "Untitled"}
              </p>
              <p className="text-sm text-gray-600 break-words">
                By {m.firstName || "Unknown"} {m.lastName || ""} (
                {m.role || "N/A"})
              </p>
              {m.submittedAt && (
                <p className="text-sm text-gray-500">
                  Submitted:{" "}
                  {new Date(m.submittedAt.seconds * 1000).toLocaleString()}
                </p>
              )}
              <p className="text-sm mt-1">
                <strong>Status:</strong>{" "}
                <span
                  className={`font-semibold ${
                    m.status === "Pending"
                      ? "text-yellow-600"
                      : m.status === "Accepted"
                      ? "text-green-600"
                      : "text-red-600"
                  }`}
                >
                  {m.status}
                </span>
              </p>

              {/* Show answers if expanded */}
              {expanded[m.id] && (
                <div className="mt-2 border-t pt-2 max-h-96 overflow-y-auto">
                  {m.answeredQuestions?.map((q, idx) => (
                    <p key={idx} className="text-sm sm:text-base break-words">
                      <strong>{q.question}:</strong> {q.answer}
                    </p>
                  ))}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default Manuscripts;
