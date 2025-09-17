import React, { useEffect, useState, useMemo } from "react";
import { getAuth } from "firebase/auth";
import {
  doc,
  getDoc,
  collection,
  onSnapshot,
  query,
  where,
  orderBy,
  limit,
} from "firebase/firestore";
import { db } from "../firebase/firebase";
import Progressbar from "./Progressbar.jsx";
import { useNavigate } from "react-router-dom";
import PaginationControls from "./PaginationControls";

const IN_PROGRESS_STATUSES = [
  "Pending",
  "Assigning Peer Reviewer",
  "Peer Reviewer Assigned",
  "Peer Reviewer Reviewing",
  "Back to Admin",
  "For Revision",
];

const STATUS_STEPS = [
  "Pending",
  "Assigning Peer Reviewer",
  "Peer Reviewer Assigned",
  "Peer Reviewer Reviewing",
  "Back to Admin",
  "For Revision",
  "For Publication",
  "Rejected",
];

const Dashboard = ({ sidebarOpen }) => {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [manuscripts, setManuscripts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("All");
  const [currentPage, setCurrentPage] = useState(1);
  const [manuscriptsPerPage, setManuscriptsPerPage] = useState(5);
  const navigate = useNavigate();

  // --- Fetch manuscripts ---
  useEffect(() => {
    const auth = getAuth();
    let unsubscribes = [];

    const unsubscribeAuth = auth.onAuthStateChanged(async (currentUser) => {
      if (!currentUser) {
        setUser(null);
        setRole(null);
        setManuscripts([]);
        setLoading(false);
        return;
      }

      setUser(currentUser);

      try {
        const userRef = doc(db, "Users", currentUser.uid);
        const docSnap = await getDoc(userRef);
        const userRole = docSnap.exists() ? docSnap.data().role : "Researcher";
        setRole(userRole);

        const manuscriptsRef = collection(db, "manuscripts");

        // Admin
        if (userRole === "Admin") {
          const q = query(manuscriptsRef, orderBy("submittedAt", "desc"));
          const unsub = onSnapshot(q, (snapshot) => {
            setManuscripts(
              snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))
            );
          });
          unsubscribes.push(unsub);
          setLoading(false);
          return;
        }

        // Peer Reviewer - need to fetch all manuscripts and filter client-side
        if (userRole === "Peer Reviewer") {
          const q = query(manuscriptsRef, orderBy("submittedAt", "desc"));
          const unsub = onSnapshot(q, (snapshot) => {
            const allManuscripts = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
            
            // Filter manuscripts where peer reviewer is involved
            const filteredManuscripts = allManuscripts.filter((m) => {
              // For final status manuscripts, only show if reviewer is in current assignedReviewers
              // This respects admin's decision about who gets credit
              if (["For Publication", "Peer Reviewer Rejected"].includes(m.status)) {
                return (m.assignedReviewers || []).includes(currentUser.uid);
              }
              
              // For other statuses, show if they are involved in any way
              const currentlyAssigned = (m.assignedReviewers || []).includes(currentUser.uid);
              const originallyAssigned = (m.originalAssignedReviewers || []).includes(currentUser.uid);
              const hasDecision = m.reviewerDecisionMeta && m.reviewerDecisionMeta[currentUser.uid];
              const hasSubmission = m.reviewerSubmissions && m.reviewerSubmissions.some(s => s.reviewerId === currentUser.uid);
              
              return currentlyAssigned || originallyAssigned || hasDecision || hasSubmission;
            });
            
            setManuscripts(filteredManuscripts);
          });
          unsubscribes.push(unsub);
          setLoading(false);
          return;
        }

        // Researcher logic
        const localMap = new Map();
        const mergeAndSet = () => {
          const merged = Array.from(localMap.values());
          merged.sort(
            (a, b) =>
              (b.submittedAt?.seconds || 0) - (a.submittedAt?.seconds || 0)
          );
          setManuscripts(merged);
        };

        const qOwn = query(
          manuscriptsRef,
          where("userId", "==", currentUser.uid),
          orderBy("submittedAt", "desc")
        );
        const qAssigned = query(
          manuscriptsRef,
          where("assignedReviewers", "array-contains", currentUser.uid),
          orderBy("submittedAt", "desc")
        );
        const qRecent = query(
          manuscriptsRef,
          orderBy("submittedAt", "desc"),
          limit(50)
        );

        const unsubOwn = onSnapshot(qOwn, (snap) => {
          snap.docs.forEach((d) =>
            localMap.set(d.id, { id: d.id, ...d.data() })
          );
          mergeAndSet();
        });

        const unsubAssigned = onSnapshot(qAssigned, (snap) => {
          snap.docs.forEach((d) =>
            localMap.set(d.id, { id: d.id, ...d.data() })
          );
          mergeAndSet();
        });

        const unsubRecent = onSnapshot(qRecent, (snap) => {
          const email = currentUser.email || "";
          const name =
            currentUser.displayName ||
            `${currentUser.firstName || ""} ${
              currentUser.lastName || ""
            }`.trim();

          snap.docs.forEach((d) => {
            const data = { id: d.id, ...d.data() };
            if (localMap.has(d.id)) return;

            const isCoAuthor =
              data.coAuthors?.some?.((c) => c.id === currentUser.uid) ||
              data.answeredQuestions?.some((q) => {
                if (q.type !== "coauthors") return false;
                if (Array.isArray(q.answer)) {
                  return q.answer.some(
                    (a) =>
                      typeof a === "string" &&
                      ((email && a.includes(email)) ||
                        (name && a.includes(name)))
                  );
                } else if (typeof q.answer === "string") {
                  return (
                    (email && q.answer.includes(email)) ||
                    (name && q.answer.includes(name))
                  );
                }
                return false;
              });

            if (isCoAuthor) localMap.set(d.id, data);
          });
          mergeAndSet();
        });

        unsubscribes.push(unsubOwn, unsubAssigned, unsubRecent);
      } catch (err) {
        console.error("Error fetching manuscripts:", err);
      } finally {
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      unsubscribes.forEach((u) => u && u());
    };
  }, []);

  // --- Summary Counts ---
  const summaryCounts = useMemo(() => {
    if (!user || !manuscripts) return [];

    const rejectedStatuses = ["Rejected", "Peer Reviewer Rejected"];
    const counts = [];

    // Role-specific total merged into summary
    if (role === "Admin") {
      counts.push({ label: "Total Manuscripts", count: manuscripts.length });
    } else if (role === "Peer Reviewer") {
      // Count manuscripts using same logic as filtering
      const reviewedCount = manuscripts.filter((m) => {
        // For final status manuscripts, only count if reviewer is in current assignedReviewers
        if (["For Publication", "Peer Reviewer Rejected"].includes(m.status)) {
          return (m.assignedReviewers || []).includes(user.uid);
        }
        
        // For other statuses, count if they are involved in any way
        const currentlyAssigned = (m.assignedReviewers || []).includes(user.uid);
        const originallyAssigned = (m.originalAssignedReviewers || []).includes(user.uid);
        const hasDecision = m.reviewerDecisionMeta && m.reviewerDecisionMeta[user.uid];
        const hasSubmission = m.reviewerSubmissions && m.reviewerSubmissions.some(s => s.reviewerId === user.uid);
        
        return currentlyAssigned || originallyAssigned || hasDecision || hasSubmission;
      }).length;
      counts.push({
        label: "Total Manuscripts Reviewed",
        count: reviewedCount,
      });
    } else if (role === "Researcher") {
      const submittedCount = manuscripts.filter(
        (m) =>
          m.userId === user.uid ||
          m.coAuthors?.some((c) => c.id === user.uid) ||
          m.coAuthorsIds?.includes(user.uid)
      ).length;
      counts.push({
        label: "Total Manuscripts Submitted",
        count: submittedCount,
      });
    }

    // Other counts
    counts.push(
      {
        label: "In Progress",
        count: manuscripts.filter((m) =>
          IN_PROGRESS_STATUSES.includes(m.status)
        ).length,
      },
      {
        label: "For Publication",
        count: manuscripts.filter((m) => m.status === "For Publication").length,
      },
      {
        label: "Rejected",
        count: manuscripts.filter((m) => rejectedStatuses.includes(m.status))
          .length,
      }
    );

    return counts;
  }, [manuscripts, user, role]);

  // --- Filtered manuscripts ---
  const displayedManuscripts = useMemo(() => {
    // Role-specific total clicks should show all manuscripts
    const totalLabels = [
      "Total Manuscripts",
      "Total Manuscripts Submitted",
      "Total Manuscripts Reviewed",
    ];

    if (filterStatus === "All" || totalLabels.includes(filterStatus))
      return manuscripts;

    if (filterStatus === "In Progress") {
      return manuscripts.filter((m) => IN_PROGRESS_STATUSES.includes(m.status));
    }

    if (filterStatus === "Rejected") {
      return manuscripts.filter((m) =>
        ["Rejected", "Peer Reviewer Rejected"].includes(m.status)
      );
    }

    if (filterStatus === "For Publication") {
      return manuscripts.filter((m) => m.status === "For Publication");
    }

    // Exact status match
    return manuscripts.filter((m) => m.status === filterStatus);
  }, [manuscripts, filterStatus]);

  // --- Reset page to 1 when filter changes ---
  useEffect(() => {
    setCurrentPage(1);
  }, [filterStatus, manuscriptsPerPage, displayedManuscripts.length]);

  const indexOfLast = currentPage * manuscriptsPerPage;
  const indexOfFirst = indexOfLast - manuscriptsPerPage;
  const currentManuscripts = displayedManuscripts.slice(
    indexOfFirst,
    indexOfLast
  );
  const totalPages =
    Math.ceil(displayedManuscripts.length / manuscriptsPerPage) || 1;

  if (loading)
    return <div className="p-28 text-gray-700">Loading dashboard...</div>;
  if (!user)
    return (
      <div className="p-28 text-red-600 text-center">
        You must be signed in to view the dashboard.
      </div>
    );

  const handleStatusClick = (status) =>
    navigate(`/manuscripts?status=${encodeURIComponent(status)}`);

  return (
    <div
      className={`flex flex-col min-h-screen py-32 px-4 sm:px-6 lg:px-20 ${
        sidebarOpen ? "lg:pl-64" : ""
      }`}
    >
      {/* Welcome Header */}
      <div className="mb-10 flex flex-col sm:flex-row justify-between items-center">
        <h1 className="text-4xl font-bold text-gray-800">
          Hello, {user.displayName || "User"}!
        </h1>
        <span className="text-gray-500 font-medium mt-2 sm:mt-0">
          Role: {role}
        </span>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Sidebar Summary Panel */}
        {role && (
          <div
            className="lg:w-1/4 bg-gradient-to-b from-indigo-50 to-white rounded-2xl p-6 shadow-lg overflow-y-auto"
            style={{ maxHeight: "400px" }}
          >
            <h2 className="text-xl font-semibold mb-4 text-gray-700">
              Dashboard
            </h2>
            <ul className="space-y-4">
              {summaryCounts.map(({ label, count }) => (
                <li
                  key={label}
                  className={`flex justify-between items-center cursor-pointer hover:bg-indigo-100 p-2 rounded-lg transition ${
                    filterStatus === label ? "bg-indigo-100 font-semibold" : ""
                  }`}
                  onClick={() => setFilterStatus(label)}
                >
                  <span className="text-gray-600 font-medium">{label}</span>
                  <span className="text-indigo-600 font-bold text-lg">
                    {count}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Manuscripts Panel */}
        {role && (
          <div className="flex-1 flex flex-col gap-6">
            {currentManuscripts.map((m) => {
              const manuscriptTitle =
                m.manuscriptTitle ||
                m.title ||
                m.answeredQuestions
                  ?.find((q) =>
                    q.question
                      ?.toLowerCase()
                      .trim()
                      .startsWith("manuscript title")
                  )
                  ?.answer?.toString() ||
                m.formTitle ||
                "Untitled";

              const submittedAtText = m.submittedAt?.toDate
                ? m.submittedAt.toDate().toLocaleString()
                : m.submittedAt?.seconds
                ? new Date(m.submittedAt.seconds * 1000).toLocaleString()
                : "";

              const statusForProgress =
                m.status === "Peer Reviewer Rejected" ? "Rejected" : m.status;
              const stepIndex = Math.max(
                0,
                STATUS_STEPS.indexOf(statusForProgress || "Pending")
              );
              const isRejected = [
                "Rejected",
                "Peer Reviewer Rejected",
              ].includes(m.status);
              const isCompleted = m.status === "For Publication";
              const statusColor = isCompleted
                ? "green"
                : isRejected
                ? "red"
                : "yellow";

              return (
                <div
                  key={m.id}
                  onClick={() => navigate("/manuscripts")}
                  className="bg-white rounded-2xl p-5 shadow-md border border-gray-100 hover:shadow-xl transition relative cursor-pointer"
                >
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="font-semibold text-gray-800">
                      {manuscriptTitle}
                    </h3>
                    <span
                      className={`px-3 py-1 rounded-full text-white text-xs font-medium ${
                        statusColor === "green"
                          ? "bg-green-500"
                          : statusColor === "red"
                          ? "bg-red-500"
                          : "bg-yellow-400 text-gray-800"
                      }`}
                    >
                      {statusForProgress}
                    </span>
                  </div>
                  <p className="text-gray-400 text-sm mb-3">
                    Submitted: {submittedAtText}
                  </p>
                  <Progressbar
                    currentStep={stepIndex}
                    steps={STATUS_STEPS}
                    currentStatus={statusForProgress}
                    forceComplete={isCompleted}
                  />
                </div>
              );
            })}

            {/* Pagination Controls */}
            <PaginationControls
              currentPage={currentPage}
              totalPages={totalPages}
              setCurrentPage={setCurrentPage}
              manuscriptsPerPage={manuscriptsPerPage}
              setManuscriptsPerPage={setManuscriptsPerPage}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
