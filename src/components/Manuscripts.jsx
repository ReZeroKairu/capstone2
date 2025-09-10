import React, { useEffect, useState } from "react";
import { getAuth } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import {
  collection,
  onSnapshot,
  doc,
  getDoc,
  getDocs,
  updateDoc,
} from "firebase/firestore";
import { db } from "../firebase/firebase";
import { FaSearch } from "react-icons/fa";

const Manuscripts = () => {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [manuscripts, setManuscripts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState({});
  const [users, setUsers] = useState([]);
  const [showAssignList, setShowAssignList] = useState({});
  const navigate = useNavigate();

  // ✅ Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [manuscriptsPerPage, setManuscriptsPerPage] = useState(5);
  const [searchQuery, setSearchQuery] = useState("");

  // ✅ Utility: generates page numbers with ellipsis
  const getPageNumbers = (current, total) => {
    const delta = 2; // how many numbers to show around current
    const range = [];
    const rangeWithDots = [];

    for (let i = 1; i <= total; i++) {
      if (
        i === 1 ||
        i === total ||
        (i >= current - delta && i <= current + delta)
      ) {
        range.push(i);
      }
    }

    let prev = null;
    for (let num of range) {
      if (prev) {
        if (num - prev === 2) {
          rangeWithDots.push(prev + 1);
        } else if (num - prev > 2) {
          rangeWithDots.push("...");
        }
      }
      rangeWithDots.push(num);
      prev = num;
    }

    return rangeWithDots;
  };

  // Filter state and definitions
  const [filter, setFilter] = useState("in-progress");
  const IN_PROGRESS_STATUSES = [
    "Pending",
    "Assigning Peer Reviewer",
    "Peer Reviewer Assigned",
    "Peer Reviewer Reviewing",
    "Back to Admin",
    "For Revision",
  ];

  const toggleExpand = (id) =>
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  const toggleAssignList = (id) =>
    setShowAssignList((prev) => ({ ...prev, [id]: !prev[id] }));

  const unassignReviewer = async (manuscriptId) => {
    try {
      const msRef = doc(db, "manuscripts", manuscriptId);
      await updateDoc(msRef, {
        assignedReviewers: [],
        status: "Assigning Peer Reviewer",
      });
    } catch (err) {
      console.error("Error unassigning reviewer:", err);
    }
  };

  const handleAssign = async (manuscriptId, reviewerId) => {
    try {
      const msRef = doc(db, "manuscripts", manuscriptId);
      const msSnap = await getDoc(msRef);
      if (!msSnap.exists()) return;

      const assigned = msSnap.data().assignedReviewers || [];
      if (!assigned.includes(reviewerId)) {
        await updateDoc(msRef, {
          assignedReviewers: [...assigned, reviewerId],
          status: "Peer Reviewer Assigned",
        });
      }
      setShowAssignList((prev) => ({ ...prev, [manuscriptId]: false }));
    } catch (err) {
      console.error("Error assigning reviewer:", err);
    }
  };

  useEffect(() => {
    const auth = getAuth();
    let unsubscribeManuscripts = null;

    const fetchData = async (currentUser) => {
      try {
        // Fetch users once
        const usersSnap = await getDocs(collection(db, "Users"));
        const allUsers = usersSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setUsers(allUsers);

        const userRef = doc(db, "Users", currentUser.uid);
        const docSnap = await getDoc(userRef);
        const userRole = docSnap.exists() ? docSnap.data().role : "User";
        setRole(userRole);
        setUser(currentUser);

        const manuscriptsRef = collection(db, "manuscripts");
        unsubscribeManuscripts = onSnapshot(manuscriptsRef, (snapshot) => {
          const allMss = snapshot.docs.map((doc) => {
            const data = doc.data();
            const assignedReviewersNames = data.assignedReviewers?.map((id) => {
              const u = allUsers.find((user) => user.id === id);
              return u ? `${u.firstName} ${u.lastName}` : id;
            });
            return { id: doc.id, ...data, assignedReviewersNames };
          });

          const tsToMillis = (ts) =>
            ts?.toDate?.()?.getTime?.() ??
            (ts?.seconds ? ts.seconds * 1000 : 0);

          allMss.sort((a, b) => {
            const aAcc = tsToMillis(a.acceptedAt);
            const bAcc = tsToMillis(b.acceptedAt);
            if (aAcc && !bAcc) return -1;
            if (!aAcc && bAcc) return 1;
            if (aAcc && bAcc) return bAcc - aAcc;
            const aSub = tsToMillis(a.submittedAt);
            const bSub = tsToMillis(b.submittedAt);
            return bSub - aSub;
          });

          const VISIBLE_STATUSES = [
            "Assigning Peer Reviewer",
            "Peer Reviewer Assigned",
            "Peer Reviewer Reviewing",
            "Back to Admin",
            "For Revision",
            "For Publication",
            "Rejected",
          ];

          const isUserCoauthorInAnsweredQuestions = (m, uid, email) => {
            if (!m.answeredQuestions) return false;
            return m.answeredQuestions.some((q) => {
              if (q.type !== "coauthors") return false;
              if (!Array.isArray(q.answer)) return false;
              return q.answer.some((a) => {
                if (!a) return false;
                if (typeof a === "object") {
                  if (a.id && a.id === uid) return true;
                  if (
                    a.email &&
                    email &&
                    a.email.toLowerCase() === email.toLowerCase()
                  )
                    return true;
                  return false;
                }
                if (typeof a === "string" && email) {
                  return a.toLowerCase().includes(email.toLowerCase());
                }
                return false;
              });
            });
          };

          setManuscripts(
            userRole === "Admin"
              ? allMss.filter((m) => VISIBLE_STATUSES.includes(m.status))
              : allMss.filter((m) => {
                  const isOwner = m.userId === currentUser.uid;
                  const hasCoAuthorsIds =
                    Array.isArray(m.coAuthorsIds) &&
                    m.coAuthorsIds.includes(currentUser.uid);
                  const hasCoAuthorsObjects =
                    Array.isArray(m.coAuthors) &&
                    m.coAuthors.some((c) => c?.id === currentUser.uid);
                  const inAnsweredQ = isUserCoauthorInAnsweredQuestions(
                    m,
                    currentUser.uid,
                    currentUser.email || ""
                  );
                  return (
                    (isOwner ||
                      hasCoAuthorsIds ||
                      hasCoAuthorsObjects ||
                      inAnsweredQ) &&
                    VISIBLE_STATUSES.includes(m.status)
                  );
                })
          );
        });
      } catch (err) {
        console.error("Error fetching manuscripts:", err);
      } finally {
        setLoading(false);
      }
    };

    const unsubscribeAuth = auth.onAuthStateChanged((currentUser) => {
      if (currentUser) fetchData(currentUser);
      else {
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

  // ✅ Filtering + Search
  const filteredManuscripts = manuscripts
    .filter((m) => {
      if (filter === "in-progress")
        return IN_PROGRESS_STATUSES.includes(m.status);
      if (filter === "for-publication") return m.status === "For Publication";
      if (filter === "rejected") return m.status === "Rejected";
      return true;
    })
    .filter((m) => {
      if (!searchQuery) return true;

      const queryWords = searchQuery.toLowerCase().split(" ");

      // ✅ Handle manuscript title (direct field or answeredQuestions)
      const manuscriptTitle =
        m.title ||
        m.answeredQuestions?.find((q) =>
          q.question?.toLowerCase().trim().startsWith("manuscript title")
        )?.answer ||
        "Untitled";

      // ✅ All searchable fields
      const fieldsToSearch = [
        manuscriptTitle,
        m.firstName,
        m.lastName,
        m.role,
        m.email, // 👈 now included
        m.submitter, // 👈 keep this too if submitter is separate
      ];

      // ✅ Match all query words across any field
      return queryWords.every((word) =>
        fieldsToSearch.some((field) => field?.toLowerCase().includes(word))
      );
    });

  // ✅ Apply pagination
  const indexOfLast = currentPage * manuscriptsPerPage;
  const indexOfFirst = indexOfLast - manuscriptsPerPage;
  const currentManuscripts = filteredManuscripts.slice(
    indexOfFirst,
    indexOfLast
  );
  const totalPages = Math.ceil(filteredManuscripts.length / manuscriptsPerPage);

  return (
    <div className="pt-24 px-4 sm:px-6 lg:px-24 pb-24">
      <h1 className="text-3xl font-bold mb-6 text-center sm:text-left">
        Manuscripts
      </h1>
      {/* Search */}
      <div className="relative mb-4 w-full max-w-xl mx-auto">
        <input
          type="text"
          placeholder="Search manuscripts"
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setCurrentPage(1);
          }}
          className="w-full pl-10 pr-2 py-2 border-[3px] border-red-900 rounded text-base
               focus:outline-none focus:border-red-900 focus:ring-2 focus:ring-red-900"
        />
        <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-yellow-500" />
      </div>

      {/* Filter controls */}
      <div className="flex gap-2 mb-6 justify-center sm:justify-start">
        <button
          onClick={() => setFilter("in-progress")}
          className={`px-3 py-1 rounded ${
            filter === "in-progress"
              ? "bg-yellow-200 text-[#211B17] border border-[#7B2E19]"
              : "bg-white border border-gray-300"
          }`}
        >
          In-progress (
          {
            manuscripts.filter((m) => IN_PROGRESS_STATUSES.includes(m.status))
              .length
          }
          )
        </button>
        <button
          onClick={() => setFilter("for-publication")}
          className={`px-3 py-1 rounded ${
            filter === "for-publication"
              ? "bg-yellow-200 text-[#211B17] border border-[#7B2E19]"
              : "bg-white border border-gray-300"
          }`}
        >
          For publication (
          {manuscripts.filter((m) => m.status === "For Publication").length})
        </button>
        <button
          onClick={() => setFilter("rejected")}
          className={`px-3 py-1 rounded ${
            filter === "rejected"
              ? "bg-yellow-200 text-[#211B17] border border-[#7B2E19]"
              : "bg-white border border-gray-300"
          }`}
        >
          Rejected ({manuscripts.filter((m) => m.status === "Rejected").length})
        </button>
        <button
          onClick={() => setFilter("all")}
          className={`px-3 py-1 rounded ${
            filter === "all"
              ? "bg-yellow-200 text-[#211B17] border border-[#7B2E19]"
              : "bg-white border border-gray-300"
          }`}
        >
          All ({manuscripts.length})
        </button>
      </div>
      {/* Manuscript List */}
      <ul className="space-y-4">
        {currentManuscripts.map((m) => {
          const showAssignButton =
            role === "Admin" &&
            (m.status === "Assigning Peer Reviewer" ||
              m.status === "Peer Reviewer Assigned");
          const hasReviewer = m.assignedReviewers?.length > 0;
          const manuscriptTitle =
            m.title ||
            m.answeredQuestions?.find((q) =>
              q.question?.toLowerCase().trim().startsWith("manuscript title")
            )?.answer ||
            "Untitled";

          return (
            <li
              key={m.id}
              className="border p-4 rounded shadow-sm bg-white hover:shadow-md transition w-full sm:w-auto"
            >
              <p
                className="font-semibold text-lg cursor-pointer break-words"
                onClick={() => toggleExpand(m.id)}
              >
                {manuscriptTitle}
              </p>
              <p className="text-sm text-gray-600 break-words">
                By {m.firstName || "Unknown"} {m.lastName || ""} (
                {m.role || "N/A"})
              </p>

              {/* 🔹 Show email here */}
              {m.email && (
                <p className="text-sm text-gray-600 break-words">
                  Email: {m.email}
                </p>
              )}

              {m.submittedAt && (
                <p className="text-sm text-gray-500">
                  Submitted:{" "}
                  {m.submittedAt?.toDate?.()?.toLocaleString?.() ||
                    (m.submittedAt?.seconds
                      ? new Date(m.submittedAt.seconds * 1000).toLocaleString()
                      : "")}
                </p>
              )}

              {m.acceptedAt && (
                <p className="text-sm text-gray-500">
                  Accepted:{" "}
                  {m.acceptedAt?.toDate?.()?.toLocaleString?.() ||
                    (m.acceptedAt?.seconds
                      ? new Date(m.acceptedAt.seconds * 1000).toLocaleString()
                      : "")}
                </p>
              )}

              <p className="text-sm mt-1">
                <strong>Status:</strong>{" "}
                <span
                  className={`font-semibold ${
                    m.status === "Peer Reviewer Assigned"
                      ? "text-indigo-600"
                      : "text-gray-500"
                  }`}
                >
                  {m.status}
                </span>
              </p>

              {hasReviewer && m.assignedReviewersNames?.length > 0 && (
                <p className="text-sm text-gray-700 mt-1">
                  <strong>
                    Assigned Reviewer
                    {m.assignedReviewersNames.length > 1 ? "s" : ""}:
                  </strong>{" "}
                  {m.assignedReviewersNames.join(", ")}
                </p>
              )}

              {showAssignButton && (
                <div className="mt-2">
                  {!hasReviewer ? (
                    <button
                      onClick={() =>
                        navigate(`/admin/reviewer-list?manuscriptId=${m.id}`)
                      }
                      className="px-3 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
                    >
                      Assign Peer Reviewer
                    </button>
                  ) : (
                    <button
                      onClick={() => unassignReviewer(m.id)}
                      className="px-3 py-2 bg-red-500 text-white rounded hover:bg-red-600 text-sm"
                    >
                      Unassign Peer Reviewer
                    </button>
                  )}

                  {showAssignList[m.id] && (
                    <ul className="mt-2 border p-2 rounded bg-gray-50">
                      {users
                        .filter((u) => u.role === "Peer Reviewer")
                        .map((r) => (
                          <li
                            key={r.id}
                            className="flex justify-between items-center mb-1"
                          >
                            <span>
                              {r.firstName} {r.lastName}
                            </span>
                            <button
                              onClick={() => handleAssign(m.id, r.id)}
                              className="px-2 py-1 bg-green-500 text-white rounded hover:bg-green-600 text-xs"
                            >
                              Assign
                            </button>
                          </li>
                        ))}
                    </ul>
                  )}
                </div>
              )}

              {expanded[m.id] && (
                <div className="mt-2 border-t pt-2 max-h-96 overflow-y-auto">
                  {m.answeredQuestions
                    ?.filter(
                      (q) =>
                        !q.question
                          ?.toLowerCase()
                          .trim()
                          .startsWith("manuscript title")
                    )
                    .map((q, idx) => {
                      let displayAnswer;
                      if (Array.isArray(q.answer)) {
                        displayAnswer = q.answer
                          .map((a) =>
                            typeof a === "object" && a !== null
                              ? `${a.name} (${a.email})`
                              : a
                          )
                          .join(", ");
                      } else {
                        displayAnswer = q.answer;
                      }
                      return (
                        <p
                          key={idx}
                          className="text-sm sm:text-base break-words"
                        >
                          <strong>{q.question}:</strong> {displayAnswer}
                        </p>
                      );
                    })}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {/* Pagination */}
      <div className="mt-4 p-2 bg-yellow-400 shadow-lg flex flex-col sm:flex-row justify-between items-center gap-2 rounded-sm">
        {/* Page Size Selector */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-bold text-red-900">Page Size:</span>
          <select
            value={manuscriptsPerPage}
            onChange={(e) => {
              setManuscriptsPerPage(Number(e.target.value));
              setCurrentPage(1);
            }}
            className="border-2 border-red-800 bg-yellow-400 rounded-md text-red-900 font-bold text-sm"
          >
            <option value={5}>5</option>
            <option value={10}>10</option>
            <option value={20}>20</option>
          </select>
        </div>

        {/* Page Buttons */}
        <div className="flex items-center flex-wrap gap-1 text-sm">
          <button
            onClick={() => setCurrentPage(1)}
            disabled={currentPage === 1}
            className="px-3 py-1 mr-1 bg-yellow-400 text-red-900 rounded-md border border-red-900 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            First
          </button>
          <button
            onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
            disabled={currentPage === 1}
            className="px-3 py-1 mr-4 bg-yellow-400 text-red-900 rounded-md border border-red-900 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Prev
          </button>

          {getPageNumbers(currentPage, totalPages).map((num, idx) =>
            num === "..." ? (
              <span key={idx} className="px-3 py-1">
                ...
              </span>
            ) : (
              <button
                key={idx}
                onClick={() => setCurrentPage(num)}
                className={`px-3 py-1 mr-1 rounded-lg ${
                  num === currentPage
                    ? "bg-red-900 text-white border border-red-900"
                    : "bg-yellow-400 text-red-900 border border-red-900"
                }`}
              >
                {num}
              </button>
            )
          )}

          <button
            onClick={() =>
              setCurrentPage((prev) => Math.min(prev + 1, totalPages))
            }
            disabled={currentPage === totalPages}
            className="px-3 py-1 ml-3 mr-1 bg-yellow-400 text-red-900 rounded-md border border-red-900 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
          </button>
          <button
            onClick={() => setCurrentPage(totalPages)}
            disabled={currentPage === totalPages}
            className="px-3 py-1 mr-1 bg-yellow-400 text-red-900 rounded-md border border-red-900 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Last
          </button>
        </div>
      </div>
    </div>
  );
};

export default Manuscripts;
