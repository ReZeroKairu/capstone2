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
import { useParams } from "react-router-dom";
import { getActiveDeadline as getReviewerDeadline } from "../utils/deadlineUtils";
import DeadlineBadge from "./manuscriptComp/DeadlineBadge";

const IN_PROGRESS_STATUSES = [
  "Pending",
  "Accepted",
  "Assigning Peer Reviewer",
  "Peer Reviewer Assigned",
  "Peer Reviewer Reviewing",
  "Back to Admin",
  "For Revision",
  "For Revision (Minor)",
  "For Revision (Major)",
];

const STATUS_STEPS = [
  "Pending",
  "Accepted",
  "Assigning Peer Reviewer",
  "Peer Reviewer Assigned",
  "Peer Reviewer Reviewing",
  "Back to Admin",
  "For Revision",
  "For Publication",
  "Rejected",
];

const STATUS_MAPPING = {
  "Pending": "Accepted",
  "For Revision (Minor)": "For Revision",
  "For Revision (Major)": "For Revision",
  "Peer Reviewer Rejected": "Rejected",
};

const Dashboard = ({ sidebarOpen }) => {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [manuscripts, setManuscripts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("All");
  const [currentPage, setCurrentPage] = useState(1);
  const [manuscriptsPerPage, setManuscriptsPerPage] = useState(5);
  const navigate = useNavigate();
  const { userId } = useParams(); 
  const [targetUser, setTargetUser] = useState(null);
  const [activeDeadlines, setActiveDeadlines] = useState({});

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
        const targetUserId = userId || currentUser.uid; 
        const userRef = doc(db, "Users", targetUserId);
        const docSnap = await getDoc(userRef);
        const userRole = docSnap.exists() ? docSnap.data().role : "Researcher";
        setRole(userRole);

        if (userId && userId !== currentUser.uid) {
          const targetSnap = await getDoc(doc(db, "Users", userId));
          if (targetSnap.exists()) {
            setTargetUser(targetSnap.data());
          }
        }

        const manuscriptsRef = collection(db, "manuscripts");

        if (userRole === "Admin") {
          const q = query(manuscriptsRef, orderBy("submittedAt", "desc"));
          const unsub = onSnapshot(q, (snapshot) => {
            setManuscripts(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
          });
          unsubscribes.push(unsub);
          setLoading(false);
          return;
        }

        if (userRole === "Peer Reviewer") {
          const q = query(manuscriptsRef, orderBy("submittedAt", "desc"));
          const unsub = onSnapshot(q, (snapshot) => {
            const allManuscripts = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
            const filtered = allManuscripts.filter((m) => {
              const myId = targetUserId;
              const myDecision = m.reviewerDecisionMeta?.[myId]?.decision;
              const isAssigned = (m.assignedReviewers || []).includes(myId);
              const isPreviousReviewer = (m.previousReviewers || []).includes(myId);
              const hasSubmitted = m.reviewerSubmissions?.some((s) => s.reviewerId === myId);
              const hasDeclined = m.declinedReviewers?.includes(myId);
              const hasReviewedBefore = isPreviousReviewer || hasSubmitted;
              
              if (hasDeclined && !hasReviewedBefore) return false;
              
              if (isAssigned) return true;
              
              if (isPreviousReviewer) {
                if (m.status === "For Publication" && myDecision === "reject") {
                  return false;
                }
                if (["Rejected", "Peer Reviewer Rejected"].includes(m.status) && 
                    myDecision && myDecision !== "reject") {
                  return false;
                }
                return true;
              }
              
              if (hasSubmitted) {
                if (m.status === "For Publication") {
                  return myDecision && myDecision !== "reject";
                }
                if (["Rejected", "Peer Reviewer Rejected"].includes(m.status)) {
                  return myDecision === "reject";
                }
                return true;
              }
              
              return false;
            });
            setManuscripts(filtered);
          });
          unsubscribes.push(unsub);
          setLoading(false);
          return;
        }

        const localMap = new Map();
        const mergeAndSet = () => {
          const merged = Array.from(localMap.values());
          merged.sort(
            (a, b) => (b.submittedAt?.seconds || 0) - (a.submittedAt?.seconds || 0)
          );
          setManuscripts(merged);
        };

        const qOwn = query(
          manuscriptsRef,
          where("userId", "==", targetUserId),
          orderBy("submittedAt", "desc")
        );
        const qSubmitter = query(
          manuscriptsRef,
          where("submitterId", "==", targetUserId),
          orderBy("submittedAt", "desc")
        );
        const qAssigned = query(
          manuscriptsRef,
          where("assignedReviewers", "array-contains", targetUserId),
          orderBy("submittedAt", "desc")
        );
        const qCoAuthor = query(
          manuscriptsRef,
          where("coAuthorsIds", "array-contains", targetUserId),
          orderBy("submittedAt", "desc")
        );
        const qRecent = query(manuscriptsRef, orderBy("submittedAt", "desc"), limit(50));

        const unsubOwn = onSnapshot(qOwn, (snap) => {
          snap.docs.forEach((d) => localMap.set(d.id, { id: d.id, ...d.data() }));
          mergeAndSet();
        });
        const unsubSubmitter = onSnapshot(qSubmitter, (snap) => {
          snap.docs.forEach((d) => localMap.set(d.id, { id: d.id, ...d.data() }));
          mergeAndSet();
        });
        const unsubAssigned = onSnapshot(qAssigned, (snap) => {
          snap.docs.forEach((d) => localMap.set(d.id, { id: d.id, ...d.data() }));
          mergeAndSet();
        });
        const unsubCoAuthor = onSnapshot(qCoAuthor, (snap) => {
          snap.docs.forEach((d) => localMap.set(d.id, { id: d.id, ...d.data() }));
          mergeAndSet();
        });
        const unsubRecent = onSnapshot(qRecent, (snap) => {
          const email = currentUser.email || "";
          const name =
            currentUser.displayName ||
            `${currentUser.firstName || ""} ${currentUser.lastName || ""}`.trim();
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
                      ((email && a.includes(email)) || (name && a.includes(name)))
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

        unsubscribes.push(unsubOwn, unsubSubmitter, unsubAssigned, unsubCoAuthor, unsubRecent);
        setLoading(false);
      } catch (err) {
        console.error("Error fetching manuscripts:", err);
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      unsubscribes.forEach((u) => u && u());
    };
  }, [userId]);

  // Get the most recent deadline from active (not declined) reviewers for a manuscript
  const getLatestReviewerDeadline = (manuscript) => {
    if (!manuscript.assignedReviewersMeta) return null;
    
    let latestDeadline = null;
    let latestInviteTime = 0;
    
    // Find the latest deadline from active reviewers based on when they were invited
    Object.entries(manuscript.assignedReviewersMeta).forEach(([reviewerId, meta]) => {
      // Skip declined or inactive reviewers
      if (meta.invitationStatus === 'declined' || !meta.deadline) {
        return;
      }
      
      const deadline = meta.deadline.toDate 
        ? meta.deadline.toDate() 
        : new Date(meta.deadline);
        
      // Get the invite time to determine the most recent invitation
      const inviteTime = meta.invitedAt?.toDate 
        ? meta.invitedAt.toDate().getTime() 
        : meta.invitedAt?.seconds 
          ? meta.invitedAt.seconds * 1000 
          : 0;
          
      // Only update if this is an active reviewer with a valid deadline
      const isActive = !meta.declinedAt && !meta.invitationStatus?.toLowerCase().includes('declined');
      
      if (isActive && (inviteTime > latestInviteTime || 
          (inviteTime === latestInviteTime && (!latestDeadline || deadline > latestDeadline)))) {
        latestDeadline = deadline;
        latestInviteTime = inviteTime;
      }
    });
    
    return latestDeadline;
  };

  // Get the appropriate deadline based on user role and manuscript status
  const getActiveDeadlineForManuscript = async (manuscript, role) => {
    try {
      // For Back to Admin status, always use the finalization deadline
      if (manuscript.status === 'Back to Admin') {
        if (manuscript.finalizationDeadline) {
          return manuscript.finalizationDeadline.toDate 
            ? manuscript.finalizationDeadline.toDate() 
            : new Date(manuscript.finalizationDeadline);
        }
        return null;
      }
      
      // For revision statuses, use the manuscript's revisionDeadline
      if (manuscript.status === 'For Revision (Minor)' || manuscript.status === 'For Revision (Major)') {
        if (manuscript.revisionDeadline) {
          return manuscript.revisionDeadline.toDate 
            ? manuscript.revisionDeadline.toDate() 
            : new Date(manuscript.revisionDeadline);
        }
        return null;
      }
      
      // For Admins and Researchers, show the latest reviewer invitation deadline
      if (role === 'Admin' || role === 'Researcher') {
        const latestDeadline = getLatestReviewerDeadline(manuscript);
        if (latestDeadline) return latestDeadline;
        
        // Fallback to manuscript-level deadline if no reviewer deadline found
        if (manuscript.invitationDeadline) {
          return manuscript.invitationDeadline.toDate 
            ? manuscript.invitationDeadline.toDate() 
            : new Date(manuscript.invitationDeadline);
        }
      }
      
      // For peer reviewers, show their individual deadline
      if (role === 'Peer Reviewer' && user?.uid) {
        const reviewerMeta = manuscript.assignedReviewersMeta?.[user.uid];
        if (reviewerMeta?.deadline) {
          return reviewerMeta.deadline.toDate 
            ? reviewerMeta.deadline.toDate() 
            : new Date(reviewerMeta.deadline);
        }
      }
      
      return null;
    } catch (error) {
      console.error('Error getting active deadline:', error);
      return null;
    }
  };

  // Load active deadlines for all manuscripts
  useEffect(() => {
    const loadDeadlines = async () => {
      const deadlines = {};
      
      for (const manuscript of manuscripts) {
        try {
          // Skip loading deadlines for completed or rejected manuscripts
          if (['For Publication', 'Rejected', 'Peer Reviewer Rejected'].includes(manuscript.status)) {
            continue;
          }
          
          // For Peer Reviewers, only show their own assigned manuscripts
          if (role === 'Peer Reviewer') {
            const isAssigned = manuscript.assignedReviewers?.includes(user?.uid) || 
                             manuscript.assignedReviewersMeta?.[user?.uid]?.invitationStatus === 'accepted';
            
            if (!isAssigned) {
              continue; // Skip manuscripts not assigned to this reviewer
            }
          }
          
          // Get the appropriate deadline based on role and status
          const deadline = await getActiveDeadlineForManuscript(manuscript, role);
          
          // Only set the deadline if it exists and is in the future
          if (deadline) {
            const deadlineDate = deadline instanceof Date ? deadline : 
                               (deadline.toDate ? deadline.toDate() : new Date(deadline));
            
            if (deadlineDate > new Date()) {
              deadlines[manuscript.id] = deadlineDate;
            }
          }
        } catch (error) {
          console.error('Error loading deadline for manuscript:', manuscript.id, error);
        }
      }
      
      setActiveDeadlines(deadlines);
    };

    if (manuscripts.length > 0 && user?.uid) {
      loadDeadlines();
    }
  }, [manuscripts, role, user?.uid]);

  const formatDate = (ts) => {
    if (!ts) return "—";
    if (ts.toDate) return ts.toDate().toLocaleString();
    if (ts.seconds) return new Date(ts.seconds * 1000).toLocaleString();
    if (ts instanceof Date) return ts.toLocaleString();
    return ts;
  };

  const summaryCounts = useMemo(() => {
    if (!user || !manuscripts) return [];

    const targetUserId = userId || user.uid; 
    const rejectedStatuses = ["Rejected", "Peer Reviewer Rejected"];
    const counts = [];

    if (role === "Admin") {
      counts.push({ label: "Total Manuscripts", count: manuscripts.length });
    } else if (role === "Peer Reviewer") {
      const reviewedCount = manuscripts.filter((m) => {
        // Check if reviewer was ever assigned to this manuscript
        const wasEverAssigned = 
          (m.assignedReviewers || []).includes(targetUserId) ||
          (m.originalAssignedReviewers || []).includes(targetUserId) ||
          (m.previousReviewSubmissions || []).some(s => s.reviewerId === targetUserId) ||
          (m.previousReviews || []).some(r => r.reviewerId === targetUserId);
        
        if (!wasEverAssigned) return false;
        
        // Check if reviewer has any submissions (current or previous versions)
        const hasAnySubmission = 
          (m.reviewerSubmissions || []).some(s => s.reviewerId === targetUserId) ||
          (m.previousReviewSubmissions || []).some(s => s.reviewerId === targetUserId) ||
          (m.previousReviews || []).some(r => r.reviewerId === targetUserId);
        
        // Check if reviewer has made a decision (current or previous versions)
        const hasAnyDecision = 
          m.reviewerDecisionMeta?.[targetUserId]?.decision ||
          (m.previousReviewerDecisionMeta && 
           Object.values(m.previousReviewerDecisionMeta).some(meta => 
             meta[targetUserId]?.decision
           ));
        
        // Count if they have any submission or decision, and didn't explicitly decline
        const isDeclined = 
          m.declinedReviewers?.includes(targetUserId) ||
          m.assignedReviewersMeta?.[targetUserId]?.invitationStatus === 'declined';
        
        return (hasAnySubmission || hasAnyDecision) && !isDeclined;
      }).length;

      counts.push({ label: "Total Manuscripts Reviewed", count: reviewedCount });
    } else if (role === "Researcher") {
      const submittedCount = manuscripts.filter((m) => {
        const isOwner = m.userId === targetUserId;
        const isSubmitter = m.submitterId === targetUserId;
        const isCoAuthor =
          m.coAuthors?.some((c) => c.id === targetUserId) ||
          m.coAuthorsIds?.includes(targetUserId);
        return isOwner || isSubmitter || isCoAuthor;
      }).length;

      counts.push({
        label: "Total Manuscripts Submitted",
        count: submittedCount,
      });
    }

    // Add common filters
    const commonFilters = [
      { label: "Pending", count: manuscripts.filter((m) => m.status === "Pending").length },
      {
        label: "In Progress",
        count: manuscripts.filter((m) => IN_PROGRESS_STATUSES.includes(m.status)).length,
      },
      {
        label: "For Revision",
        count: manuscripts.filter((m) =>
          ["For Revision (Minor)", "For Revision (Major)"].includes(m.status)
        ).length,
      },
      {
        label: "For Publication",
        count: manuscripts.filter((m) => m.status === "For Publication").length,
      },
      {
        label: "Rejected",
        count: manuscripts.filter((m) => rejectedStatuses.includes(m.status)).length,
      }
    ];

    // Add non-Acceptance filter only for non-reviewer roles
    if (role !== "Peer Reviewer") {
      commonFilters.splice(-1, 0, {
        label: "non-Acceptance",
        count: manuscripts.filter((m) => m.status === "non-Acceptance").length,
      });
    }
    
    counts.push(...commonFilters);
    
    return counts;
  }, [manuscripts, user, role, userId]);

  const displayedManuscripts = useMemo(() => {
    const totalLabels = [
      "Total Manuscripts",
      "Total Manuscripts Submitted",
      "Total Manuscripts Reviewed",
    ];

    if (filterStatus === "All" || totalLabels.includes(filterStatus))
      return manuscripts;
    if (filterStatus === "Pending")
      return manuscripts.filter((m) => m.status === "Pending");
    if (filterStatus === "In Progress")
      return manuscripts.filter((m) => IN_PROGRESS_STATUSES.includes(m.status));
    if (filterStatus === "Rejected")
      return manuscripts.filter((m) => ["Rejected", "Peer Reviewer Rejected"].includes(m.status));
    if (filterStatus === "non-Acceptance")
      return manuscripts.filter((m) => m.status === "non-Acceptance");
    if (filterStatus === "For Publication")
      return manuscripts.filter((m) => m.status === "For Publication");
    if (filterStatus === "For Revision")
      return manuscripts.filter((m) =>
        ["For Revision (Minor)", "For Revision (Major)"].includes(m.status)
      );
    if (filterStatus === "non-Acceptance")
      return manuscripts.filter((m) => 
        ["Rejected", "Peer Reviewer Rejected", "non-Acceptance"].includes(m.status)
      );
    return manuscripts.filter((m) => m.status === filterStatus);
  }, [manuscripts, filterStatus]);

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
    
  const getCurrentStep = (status) => {
    if (!status) return 0;
    
    // Special case for 'For Publication' - it should be the final step
    if (status === 'For Publication') {
      // Return the index of 'For Publication' in STATUS_STEPS + 1 (1-based index)
      return STATUS_STEPS.indexOf('For Publication') + 1;
    }
    
    // Get the steps to use based on the current status
    const stepsToUse = status === 'Pending' 
      ? ['Pending'] 
      : STATUS_STEPS.filter(step => step !== 'Pending');
      
    // Normalize status for display (combine minor/major revisions)
    const normalizedStatus = status.includes('For Revision') ? 'For Revision' : status;
    
    // Get the status to display (using mapping if needed)
    const displayStatus = STATUS_MAPPING[normalizedStatus] || normalizedStatus;
    
    // Find the index of the current status in the steps
    const stepIndex = stepsToUse.findIndex(step => step === displayStatus);
    
    // Return the 1-based index, or 0 if not found
    return stepIndex === -1 ? 0 : stepIndex + 1;
  };

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
      <div className="mb-10 flex flex-col sm:flex-row justify-between items-center">
        <h1 className="text-4xl font-bold text-gray-800">
          {userId && userId !== user?.uid
            ? `Viewing Dashboard of ${targetUser ? `${targetUser.firstName || ""} ${targetUser.lastName || ""}`.trim() : "User"}`
            : `Hello, ${user?.displayName || user?.firstName || "User"}!`}
        </h1>
        <span className="text-gray-500 font-medium mt-2 sm:mt-0">
          Role: {role}
        </span>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        {role && (
          <div
            className="lg:w-1/4 bg-gradient-to-b from-indigo-50 to-white rounded-2xl p-6 shadow-lg self-start"
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

              // Use the actual status for display
              const displayStatus = m.status;
              const statusForProgress = STATUS_MAPPING[m.status] || m.status;
              const stepIndex = Math.max(
                0,
                STATUS_STEPS.indexOf(statusForProgress || "Pending")
              );
              const isRejected = [
                "Rejected",
                "Peer Reviewer Rejected",
              ].includes(m.status);
              const isCompleted = m.status === "For Publication";
              const isAccepted = m.status === "Accepted";
              
              let statusColor = "yellow";
              if (isCompleted) statusColor = "green";
              if (isRejected) statusColor = "red";
              if (m.status === "For Revision (Minor)") statusColor = "blue";
              if (m.status === "For Revision (Major)") statusColor = "orange";
              if (isAccepted) statusColor = "teal";

              return (
                <div
                  key={m.id}
                  onClick={() => navigate(`/manuscripts?manuscriptId=${m.id}`)}
                  className="bg-white rounded-2xl p-5 shadow-md border border-gray-100 hover:shadow-xl transition relative cursor-pointer"
                >
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="font-semibold text-gray-800">
                      {manuscriptTitle}
                    </h3>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-medium ${
                        statusColor === "green"
                          ? "bg-green-100 text-green-800"
                          : statusColor === "red"
                          ? "bg-red-100 text-red-800"
                          : statusColor === "blue"
                          ? "bg-blue-100 text-blue-800"
                          : statusColor === "orange"
                          ? "bg-orange-100 text-orange-800"
                          : statusColor === "teal"
                          ? "bg-teal-100 text-teal-800"
                          : "bg-yellow-100 text-yellow-800"
                      }`}
                    >
                      {displayStatus}
                    </span>
                  </div>
                  <p className="text-gray-400 text-sm mb-1">
                    Submitted: {submittedAtText}
                  </p>
                  {activeDeadlines[m.id] && (
                    (role === 'Peer Reviewer' && 
                      (['Back to Admin', 'For Revision', 'For Revision (Minor)', 'For Revision (Major)'].includes(m.status) ||
                       !m.reviewerSubmissions?.some(s => s.reviewerId === user?.uid))
                    ) ||
                    (role !== 'Peer Reviewer' && !['For Publication', 'Rejected', 'Peer Reviewer Rejected'].includes(m.status))
                  ) && (
                    <div className="mt-1">
                      <div className="flex items-center text-sm text-gray-600">
                        <DeadlineBadge
                          start={m.submittedAt || new Date()}
                          end={activeDeadlines[m.id]}
                          formatDate={formatDate}
                        />
                      </div>
                    </div>
                  )}
                  <Progressbar
                    currentStep={getCurrentStep(m.status)}
                    steps={m.status === 'Pending' 
                      ? ['Pending'] 
                      : STATUS_STEPS.filter(step => step !== 'Pending')}
                    currentStatus={m.status}
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