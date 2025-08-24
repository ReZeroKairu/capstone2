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

// Design constants - SMALLER SIZES and User Management search bar
const COLORS = {
  yellow: "#F9D563",
  brown: "#7B2E19",
  gray: "#f3f2ee",
  border: "#7B2E19",
  text: "#211B17",
};

const FONT = "Poppins, Arial, sans-serif";
const PAGE_SIZE = 50;

export default function FormResponses() {
  const [responses, setResponses] = useState([]);
  const [forms, setForms] = useState([]);
  const [selectedFormId, setSelectedFormId] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [lastVisible, setLastVisible] = useState(null);
  const [prevStack, setPrevStack] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Modal state for view response
  const [selectedResponse, setSelectedResponse] = useState(null);

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

  useEffect(() => {
    const fetchForms = async () => {
      const snapshot = await getDocs(collection(db, "forms"));
      setForms(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    };
    fetchForms();
  }, []);

  // Basic simulated pagination, adjust logic as needed
  const fetchResponses = async (direction = "next") => {
    if (!selectedFormId || !currentUser) return;
    setLoading(true);

    try {
      let constraints = [
        where("formId", "==", selectedFormId),
        where("status", "==", "Pending"),
      ];

      if (!isAdmin) constraints.push(where("userId", "==", currentUser.uid));

      let q = query(
        collection(db, "form_responses"),
        ...constraints,
        orderBy("submittedAt", "desc"),
        limit(PAGE_SIZE)
      );

      if (direction === "next" && lastVisible) {
        q = query(q, startAfter(lastVisible));
        setPage((p) => p + 1);
      } else if (direction === "prev" && page > 1) {
        setPage((p) => p - 1);
      } else {
        setPage(1);
      }

      const snapshot = await getDocs(q);
      let data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setResponses(data);

      if (snapshot.docs.length > 0) {
        setLastVisible(snapshot.docs[snapshot.docs.length - 1]);
      }
      setTotalPages(Math.max(1, Math.ceil(data.length / PAGE_SIZE)));
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
    // eslint-disable-next-line
  }, [selectedFormId, currentUser, isAdmin]);

  const handleKeyDown = (e) => {
    if (e.key === "Enter") fetchResponses("next");
  };

  const highlightText = (text) => {
    if (!searchTerm) return text;
    const escaped = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const parts = text.split(new RegExp(`(${escaped})`, "gi"));
    return parts.map((part, i) =>
      part.toLowerCase() === searchTerm.toLowerCase() ? (
        <mark key={i} style={{ background: COLORS.yellow, color: COLORS.text, padding: "0 2px", borderRadius: "4px" }}>
          {part}
        </mark>
      ) : (
        <span key={i}>{part}</span>
      )
    );
  };

  // Modal Accept/Reject logic
  const handleAccept = async (res) => {
    try {
      const resRef = doc(db, "form_responses", res.id);
      await updateDoc(resRef, { status: "Assigning Peer Reviewer" });
      await addDoc(collection(db, "form_responses", res.id, "history"), {
        timestamp: serverTimestamp(),
        updatedBy: currentUser.uid,
        status: "Assigning Peer Reviewer",
      });
      setResponses((prev) =>
        prev.map((r) =>
          r.id === res.id ? { ...r, status: "Assigning Peer Reviewer" } : r
        )
      );
      setSelectedResponse((r) =>
        r ? { ...r, status: "Assigning Peer Reviewer" } : r
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
      setResponses((prev) =>
        prev.map((r) => (r.id === res.id ? { ...r, status: "Rejected" } : r))
      );
      setSelectedResponse((r) =>
        r ? { ...r, status: "Rejected" } : r
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
    <div
      style={{
        fontFamily: FONT,
        background: "#fff",
        minHeight: "100vh",
        padding: 0,
      }}
    >
      {/* Add 96px (1 inch) top spacer so header is always visible */}
      <div style={{ height: "96px" }} />
      <div
        style={{
          maxWidth: 900,
          margin: "0 auto",
          padding: "0 0 32px 0",
        }}
      >
        <h1
          style={{
            fontFamily: FONT,
            fontWeight: 600,
            fontSize: "1.55rem", // smaller, matches CreateForm.jsx
            marginBottom: "0.5rem",
            color: COLORS.text,
            letterSpacing: "-.5px",
          }}
        >
          Form Responses
        </h1>
        <div
          style={{
            fontStyle: "italic",
            color: COLORS.text,
            fontSize: ".97rem",
            marginBottom: 8,
            letterSpacing: "-.5px",
          }}
        >
          Form
        </div>

        {/* "Select a form" styled full-width like search bar */}
        <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "16px" }}>
          <div style={{ position: "relative", width: "100%" }}>
            <select
              value={selectedFormId}
              onChange={(e) => setSelectedFormId(e.target.value)}
              style={{
                width: "100%",
                background: COLORS.yellow,
                color: COLORS.text,
                fontWeight: 700,
                fontFamily: FONT,
                fontSize: "1.15rem",
                border: "none",
                borderRadius: "14px",
                padding: "9px 32px 9px 16px",
                appearance: "none",
                cursor: "pointer",
                boxShadow: "none",
                outline: "none",
                letterSpacing: "-.5px",
                transition: "background .2s"
              }}
            >
              <option value="">Select a form</option>
              {forms.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.title}
                </option>
              ))}
            </select>
            {/* Triangle arrow */}
            <span
              style={{
                position: "absolute",
                right: "18px",
                top: "50%",
                transform: "translateY(-50%)",
                fontSize: "1.4rem",
                color: COLORS.brown,
                pointerEvents: "none",
                zIndex: 1,
              }}
            >▼</span>
          </div>

          {/* Search bar full width and styled like User Management */}
          <div
            className="relative w-full flex items-center"
            style={{
              border: `2px solid ${COLORS.brown}`,
              borderRadius: "18px",
              background: "#fff",
              padding: "8px 20px",
            }}
          >
            {/* Yellow magnifying glass */}
            <svg
              width="26"
              height="26"
              viewBox="0 0 24 24"
              fill="none"
              stroke={COLORS.yellow}
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ marginRight: "10px", background: "transparent", flexShrink: 0 }}
            >
              <circle cx="11" cy="11" r="7" />
              <line x1="18" y1="18" x2="15.5" y2="15.5" />
            </svg>
            <input
              type="text"
              placeholder="Search by name or email"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={handleKeyDown}
              style={{
                width: "100%",
                border: "none",
                outline: "none",
                background: "transparent",
                fontFamily: FONT,
                fontSize: "1.16rem",
                fontStyle: "italic",
                fontWeight: 500,
                color: "#9296a1",
                letterSpacing: "-.5px",
              }}
            />
          </div>
        </div>

        {/* Table/List */}
        <div
          style={{
            background: COLORS.gray,
            borderRadius: 9,
            marginTop: 12,
            marginBottom: 0,
            overflow: "hidden",
          }}
        >
          {responses.map((res, idx) => {
            const fullName = `${res.firstName || ""} ${res.lastName || ""}`.trim();
            return (
              <div
                key={res.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  fontFamily: FONT,
                  borderBottom:
                    idx === responses.length - 1
                      ? "none"
                      : `1.3px solid ${COLORS.border}`,
                  padding: "9px 16px",
                  background: COLORS.gray,
                  fontSize: "1.04rem",
                  fontWeight: 500,
                  letterSpacing: "-.5px"
                }}
              >
                <div
                  style={{
                    flex: "1 1 0",
                    color: COLORS.text,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {highlightText(res.email || "")}
                </div>
                <div
                  style={{
                    flex: "1 1 0",
                    color: COLORS.text,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    fontSize: ".98em",
                    marginLeft: "10px",
                  }}
                >
                  {highlightText(fullName)}
                </div>
                <div style={{ flex: "none", marginLeft: "auto" }}>
                  <button
                    type="button"
                    onClick={() => setSelectedResponse(res)}
                    style={{
                      color: COLORS.brown,
                      fontWeight: 500,
                      fontFamily: FONT,
                      textDecoration: "underline",
                      fontSize: "1em",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      letterSpacing: "-.5px"
                    }}
                  >
                    View Response
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        {/* Pagination */}
        <div
          style={{
            background: COLORS.yellow,
            borderRadius: 8,
            padding: "8px 14px",
            marginTop: "14px",
            display: "flex",
            alignItems: "center",
            gap: "14px",
            justifyContent: "space-between",
            fontFamily: FONT,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span
              style={{
                fontWeight: 700,
                color: COLORS.brown,
                fontFamily: FONT,
                fontSize: ".98rem",
                letterSpacing: "-.5px"
              }}
            >
              Page Size:
            </span>
            <input
              type="number"
              min={1}
              max={100}
              value={PAGE_SIZE}
              readOnly
              style={{
                width: "34px",
                fontSize: ".98em",
                border: `1.2px solid ${COLORS.text}`,
                borderRadius: "6px",
                padding: "2px 6px",
                fontWeight: 600,
                fontFamily: FONT,
                textAlign: "center",
                background: "#fff",
                letterSpacing: "-.5px"
              }}
            />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <PageBtn>First</PageBtn>
            <PageBtn>Prev</PageBtn>
            {[1, 2, 3, 5].map((n) => (
              <PageBtn key={n}>{n}</PageBtn>
            ))}
            <span style={{ fontWeight: 700, fontSize: ".98em" }}>...</span>
            <PageBtn>50</PageBtn>
            <PageBtn>Next</PageBtn>
            <PageBtn>Last</PageBtn>
          </div>
        </div>
      </div>

      {/* Modal for single response */}
      {selectedResponse && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 50,
            background: "rgba(0,0,0,0.18)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          onClick={() => setSelectedResponse(null)}
        >
          <div
            style={{
              background: "#fafbfc",
              borderRadius: "8px",
              padding: "19px",
              maxWidth: "420px",
              minWidth: "220px",
              boxShadow: "0 2px 12px #0002",
              border: "1px solid #e0e0e0",
              fontFamily: FONT,
              fontSize: ".97rem",
              letterSpacing: "-.5px"
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                color: "#75777d",
                fontWeight: 500,
                fontSize: "1em",
                marginBottom: 12,
              }}
            >
              User: {selectedResponse.firstName} {selectedResponse.lastName} | Email:{" "}
              {selectedResponse.email} | Role: {selectedResponse.role || "N/A"} | Submitted at:{" "}
              {selectedResponse.submittedAt?.toDate?.()?.toLocaleString() ||
                (selectedResponse.submittedAt?.seconds
                  ? new Date(selectedResponse.submittedAt.seconds * 1000).toLocaleString()
                  : "")}
            </div>
            <div style={{ marginBottom: 12 }}>
              {(selectedResponse.answeredQuestions || []).map((q, idx) => (
                <div key={idx} style={{ fontSize: "1em", marginBottom: 3 }}>
                  <span style={{ fontWeight: "bold" }}>{q.question}:</span> {q.answer}
                </div>
              ))}
            </div>
            <div style={{ fontSize: ".97em", fontWeight: "bold", marginBottom: 4 }}>
              Status:{" "}
              <span style={{ fontWeight: "normal" }}>
                {selectedResponse.status || "Pending"}
              </span>
            </div>
            <div style={{ fontSize: ".97em", fontWeight: "bold", marginBottom: 7 }}>
              History:
            </div>
            <div>
              {(selectedResponse.history || []).length === 0 && (
                <div style={{ marginBottom: 8 }}></div>
              )}
              {(selectedResponse.history || []).map((h, i) => (
                <div key={i} style={{ fontSize: ".97em", color: "#333", marginBottom: 2 }}>
                  [{h.timestamp?.seconds ? new Date(h.timestamp.seconds * 1000).toLocaleString() : ""}]{" "}
                  {h.updatedBy} → {h.status}
                </div>
              ))}
            </div>
            {isAdmin && selectedResponse.status === "Pending" && (
              <div style={{ display: "flex", gap: "12px", marginTop: "12px" }}>
                <button
                  onClick={() => handleAccept(selectedResponse)}
                  style={{
                    background: "#4CC97B",
                    color: "#fff",
                    borderRadius: "6px",
                    fontWeight: 600,
                    border: "none",
                    padding: "7px 18px",
                    fontSize: ".97em",
                    cursor: "pointer",
                    letterSpacing: "-.5px"
                  }}
                >
                  Accept
                </button>
                <button
                  onClick={() => handleReject(selectedResponse)}
                  style={{
                    background: "#DC4C4C",
                    color: "#fff",
                    borderRadius: "6px",
                    fontWeight: 600,
                    border: "none",
                    padding: "7px 18px",
                    fontSize: ".97em",
                    cursor: "pointer",
                    letterSpacing: "-.5px"
                  }}
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

// Pagination button
function PageBtn({ children }) {
  return (
    <button
      style={{
        background: "#fff2c7",
        color: "#7B2E19",
        border: "1px solid #7B2E19",
        borderRadius: "6px",
        fontWeight: 600,
        padding: "2px 8px",
        margin: "0 1.5px",
        cursor: "pointer",
        fontFamily: "Poppins, Arial, sans-serif",
        fontSize: ".98em",
        letterSpacing: "-.5px"
      }}
      type="button"
    >
      {children}
    </button>
  );
}