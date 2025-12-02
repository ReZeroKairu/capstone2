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
import SearchBar from "./Searchbar";

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
  Pending: "Accepted",
  "For Revision (Minor)": "For Revision",
  "For Revision (Major)": "For Revision",
  "Peer Reviewer Rejected": "Rejected",
};

const Dashboard = ({ sidebarOpen }) => {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [role, setRole] = useState(null);
  const [manuscripts, setManuscripts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("All");
  const [currentPage, setCurrentPage] = useState(1);
  const [manuscriptsPerPage, setManuscriptsPerPage] = useState(5);
  const [searchQuery, setSearchQuery] = useState("");
  const navigate = useNavigate();
  const { userId } = useParams();
  const [targetUser, setTargetUser] = useState(null);
  const [activeDeadlines, setActiveDeadlines] = useState({});

  useEffect(() => {
    const auth = getAuth();
    let unsubscribes = [];
    let isAdmin = false;

    const unsubscribeAuth = auth.onAuthStateChanged(async (currentUser) => {
      if (!currentUser) {
        setUser(null);
        setRole(null);
        setManuscripts([]);
        setLoading(false);
        navigate('/signin');
        return;
      }

      // First, get the current user's role to check if they're an admin
      const currentUserRef = doc(db, "Users", currentUser.uid);
      const currentUserSnap = await getDoc(currentUserRef);
      const currentUserRole = currentUserSnap.exists() ? currentUserSnap.data().role : null;
      
      // Check if current user is an admin
      isAdmin = currentUserRole === 'Admin';

      // If trying to access another user's dashboard and not an admin, redirect to unauthorized
      if (userId && userId !== currentUser.uid && !isAdmin) {
        navigate('/unauthorized');
        return;
      }

      setUser(currentUser);

      try {
        const targetUserId = userId || currentUser.uid;
        const userRef = doc(db, "Users", targetUserId);
        const docSnap = await getDoc(userRef);
        
        // Store the user profile data
        if (docSnap.exists()) {
          const userData = docSnap.data();
          setUserProfile(userData);
          
          // If this is the current user (not viewing someone else's dashboard)
          // update the user state with profile data
          if (!userId || userId === currentUser.uid) {
            setUser(prev => ({
              ...prev,
              ...userData,
              uid: currentUser.uid,
              email: currentUser.email,
              emailVerified: currentUser.emailVerified
            }));
          }
        }
        
        if (!docSnap.exists()) {
          navigate('/not-found');
          return;
        }
        
        const userData = docSnap.data();
        const userRole = userData.role || "Researcher";
        setRole(userRole);

        // If viewing another user's dashboard, set them as target user
        if (userId && userId !== currentUser.uid) {
          setTargetUser(userData);
        } else {
          setTargetUser(null);
        }

        const manuscriptsRef = collection(db, "manuscripts");
        // Use the targetUserId that was already declared earlier
        // const targetUserId = userId || currentUser.uid;

        // Check if user is admin from the role state
        const isUserAdmin = userRole === 'Admin';
        console.log('User role:', userRole, 'Is admin:', isUserAdmin);
        
        if (isUserAdmin) {
            // Admin view - fetch all manuscripts but with proper ownership info
          const q = query(manuscriptsRef, orderBy("submittedAt", "desc"));
          const unsub = onSnapshot(q, (snapshot) => {
            const allManuscripts = snapshot.docs.map(d => {
              const data = d.data();
              // Check if the current user is the owner, submitter, or a co-author
              const isOwner = data.userId === currentUser.uid;
              const isSubmitter = data.submitterId === currentUser.uid;
              const isCoAuthor = data.coAuthors?.some(coAuthor => coAuthor.id === currentUser.uid);
              
              // Determine ownership type
              let ownershipType = 'admin';
              if (isOwner) ownershipType = 'owner';
              else if (isSubmitter) ownershipType = 'submitted';
              else if (isCoAuthor) ownershipType = 'coAuthor';
              
              return {
                id: d.id,
                ...data,
                ownershipType: ownershipType
              };
            });
            
            setManuscripts(allManuscripts);
            setLoading(false);
          }, (error) => {
            console.error('Error fetching admin manuscripts:', error);
            setLoading(false);
          });
          
          unsubscribes.push(unsub);
          return;
        }

        if (userRole === "Peer Reviewer") {
          // For peer reviewers, show manuscripts assigned to them with proper filtering
          const q = query(manuscriptsRef, orderBy("submittedAt", "desc"));
          const unsub = onSnapshot(q, (snapshot) => {
            const allManuscripts = snapshot.docs.map((d) => ({
              id: d.id,
              ...d.data(),
            }));
            const filtered = allManuscripts.filter((m) => {
              const myId = targetUserId;
              const myDecision = m.reviewerDecisionMeta?.[myId]?.decision;
              const isAssigned = (m.assignedReviewers || []).includes(myId);
              const isPreviousReviewer = (m.previousReviewers || []).includes(
                myId
              );
              const hasSubmitted = m.reviewerSubmissions?.some(
                (s) => s.reviewerId === myId
              );
              const hasDeclined = m.declinedReviewers?.includes(myId);
              const hasReviewedBefore = isPreviousReviewer || hasSubmitted;

              if (hasDeclined && !hasReviewedBefore) return false;

              if (isAssigned) return true;

              if (isPreviousReviewer) {
                if (m.status === "For Publication" && myDecision === "reject") {
                  return false;
                }
                if (
                  ["Rejected", "Peer Reviewer Rejected"].includes(m.status) &&
                  myDecision &&
                  myDecision !== "reject"
                ) {
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
            (a, b) =>
              (b.submittedAt?.seconds || 0) - (a.submittedAt?.seconds || 0)
          );
          setManuscripts(merged);
        };

        // For regular users, show their own manuscripts, submissions, and co-authored works
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
        
        // Only include these queries if not an admin viewing another user's dashboard
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
        const qRecent = query(
          manuscriptsRef,
          orderBy("submittedAt", "desc"),
          limit(50)
        );
        
        // If admin is viewing another user's dashboard, show all their manuscripts
        if (isAdmin) {
          // Combine all queries to get all manuscripts the target user is associated with
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
          const qCoAuthor = query(
            manuscriptsRef,
            where("coAuthorsIds", "array-contains", targetUserId),
            orderBy("submittedAt", "desc")
          );

          const localMap = new Map();
          const mergeAndSet = () => {
            const merged = Array.from(localMap.values());
            merged.sort(
              (a, b) =>
                (b.submittedAt?.seconds || 0) - (a.submittedAt?.seconds || 0)
            );
            setManuscripts(merged);
            setLoading(false);
          };

          const unsubOwn = onSnapshot(qOwn, (snap) => {
            snap.docs.forEach((d) =>
              localMap.set(d.id, { id: d.id, ...d.data(), ownershipType: 'owner' })
            );
            mergeAndSet();
          });

          const unsubSubmitter = onSnapshot(qSubmitter, (snap) => {
            snap.docs.forEach((d) =>
              localMap.set(d.id, { id: d.id, ...d.data(), ownershipType: 'submitted' })
            );
            mergeAndSet();
          });

          const unsubCoAuthor = onSnapshot(qCoAuthor, (snap) => {
            snap.docs.forEach((d) =>
              localMap.set(d.id, { id: d.id, ...d.data(), ownershipType: 'coAuthor' })
            );
            mergeAndSet();
          });

          unsubscribes.push(unsubOwn, unsubSubmitter, unsubCoAuthor);
          return;
        }

        const unsubOwn = onSnapshot(qOwn, (snap) => {
          snap.docs.forEach((d) =>
            localMap.set(d.id, { id: d.id, ...d.data() })
          );
          mergeAndSet();
        });
        const unsubSubmitter = onSnapshot(qSubmitter, (snap) => {
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
        const unsubCoAuthor = onSnapshot(qCoAuthor, (snap) => {
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

        unsubscribes.push(
          unsubOwn,
          unsubSubmitter,
          unsubAssigned,
          unsubCoAuthor,
          unsubRecent
        );
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

  const currentVersion = manuscript.versionNumber || 1;
  let latestDeadline = null;
  let latestDeadlineTime = 0;

  Object.entries(manuscript.assignedReviewersMeta).forEach(([reviewerId, meta]) => {
      // Skip declined reviewers or entries without deadlines
    if (meta.invitationStatus === 'declined' || !meta.deadline) {
      return;
    }

    // Check if this reviewer has already submitted for the current version
    const hasSubmittedForCurrentVersion = manuscript.reviewerSubmissions?.some(sub => 
      sub.reviewerId === reviewerId && 
      sub.status === 'Completed' &&
      (sub.manuscriptVersionNumber || 1) === currentVersion
    );

    // Skip reviewers who have already submitted for the current version
    if (hasSubmittedForCurrentVersion) {
      return;
    }

    // Get the deadline as a Date object
    const deadline = meta.deadline.toDate 
      ? meta.deadline.toDate() 
      : new Date(meta.deadline);

    // Track the latest deadline among active reviewers
    if (deadline.getTime() > latestDeadlineTime) {
      latestDeadline = deadline;
      latestDeadlineTime = deadline.getTime();
    }
  });

  return latestDeadline;
};

  // Get the appropriate deadline based on user role and manuscript status
 // In Dashboard.jsx, update the getActiveDeadline function
// In Dashboard.jsx, update the getActiveDeadline function
const getActiveDeadline = (manuscript, role, currentUserId) => {
  try {
    // For Back to Admin status, always use the finalization deadline for all roles
    if (manuscript.status === 'Back to Admin') {
      if (manuscript.finalizationDeadline) {
        return manuscript.finalizationDeadline.toDate 
          ? manuscript.finalizationDeadline.toDate() 
          : new Date(manuscript.finalizationDeadline);
      }
      return null;
    }

    // For revision statuses, use the manuscript's revisionDeadline for all roles
    if (
      manuscript.status === 'For Revision (Minor)' || 
      manuscript.status === 'For Revision (Major)'
    ) {
      if (manuscript.revisionDeadline) {
        return manuscript.revisionDeadline.toDate 
          ? manuscript.revisionDeadline.toDate() 
          : new Date(manuscript.revisionDeadline);
      }
      return null;
    }
    
    // For Peer Reviewers, show their individual deadline only if they haven't submitted
    if (role === 'Peer Reviewer' && currentUserId) {
      const reviewerMeta = manuscript.assignedReviewersMeta?.[currentUserId];
      if (reviewerMeta?.deadline) {
        // Check if reviewer has already submitted for current version
        const currentVersion = manuscript.versionNumber || 1;
        const hasSubmitted = manuscript.reviewerSubmissions?.some(
          sub => sub.reviewerId === currentUserId && 
                (sub.manuscriptVersionNumber || 1) === currentVersion
        );
        
        // Only return the deadline if the reviewer hasn't submitted for the current version
        if (!hasSubmitted) {
          const deadline = reviewerMeta.deadline.toDate 
            ? reviewerMeta.deadline.toDate() 
            : new Date(reviewerMeta.deadline);
            
          // Get the assigned date for this reviewer, if available
          const assignedAt = reviewerMeta.assignedAt 
            ? (reviewerMeta.assignedAt.toDate ? reviewerMeta.assignedAt.toDate() : new Date(reviewerMeta.assignedAt))
            : null;
            
          // If we have an assigned date, return both start and end dates
          if (assignedAt) {
            // Ensure the assigned date is not in the future
            const now = new Date();
            const effectiveStart = assignedAt > now ? now : assignedAt;
            
            return {
              start: effectiveStart,
              end: deadline
            };
          }
          
          return deadline;
        }
      }
      return null;
    }

    // For Admins, Researchers, and Authors - find the appropriate deadline
    if (['Admin', 'Researcher', 'Author'].includes(role) && manuscript.assignedReviewersMeta) {
      const currentVersion = manuscript.versionNumber || 1;
      let latestDeadline = null;
      let latestDeadlineTime = 0;
      let latestAssignedAt = null;

      Object.entries(manuscript.assignedReviewersMeta).forEach(([reviewerId, meta]) => {
        // Skip declined reviewers or those without a deadline
        if (meta.invitationStatus === 'declined' || !meta.deadline) {
          return;
        }

        // Ensure reviewer is assigned to the current version
        const assignedVersions = meta.assignedVersions || [];
        const versionData = meta.versionData || {};
        const isAssignedToCurrentVersion =
          assignedVersions.includes(currentVersion) || versionData[currentVersion];

        if (!isAssignedToCurrentVersion) {
          return;
        }

        // Check if reviewer has already submitted for current version
        const hasSubmitted = manuscript.reviewerSubmissions?.some(
          sub => sub.reviewerId === reviewerId && 
                (sub.manuscriptVersionNumber || 1) === currentVersion
        );

        if (hasSubmitted) {
          return;
        }

        const reviewerDeadline = meta.deadline.toDate 
          ? meta.deadline.toDate() 
          : new Date(meta.deadline);
          
        // Get the assigned date for this reviewer, if available
        const assignedAt = meta.assignedAt 
          ? (meta.assignedAt.toDate ? meta.assignedAt.toDate() : new Date(meta.assignedAt))
          : null;

        // If this is the latest deadline, update the assigned date as well
        if (!latestDeadline || reviewerDeadline.getTime() > latestDeadlineTime) {
          latestDeadline = reviewerDeadline;
          latestDeadlineTime = reviewerDeadline.getTime();
          latestAssignedAt = assignedAt;
        }
      });

      if (latestDeadline) {
        // If we have an assigned date, use it to calculate the deadline
        if (latestAssignedAt) {
          // Ensure the assigned date is not in the future
          const now = new Date();
          const effectiveStart = latestAssignedAt > now ? now : latestAssignedAt;
          
          // Return an object with both start and end dates
          return {
            start: effectiveStart,
            end: latestDeadline
          };
        }
        return latestDeadline;
      }
    }

    // Fallback to manuscript-level deadlines
    if (manuscript.invitationDeadline) {
      return manuscript.invitationDeadline.toDate 
        ? manuscript.invitationDeadline.toDate() 
        : new Date(manuscript.invitationDeadline);
    }

    if (manuscript.reviewDeadline) {
      return manuscript.reviewDeadline.toDate 
        ? manuscript.reviewDeadline.toDate() 
        : new Date(manuscript.reviewDeadline);
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
      const currentUserId = user?.uid;

      for (const manuscript of manuscripts) {
        try {
          // Skip loading deadlines for completed or rejected manuscripts
          if (["For Publication", "Rejected", "Peer Reviewer Rejected"].includes(manuscript.status)) {
            continue;
          }

          // For Peer Reviewers, only show their own assigned manuscripts
          if (role === "Peer Reviewer") {
            const isAssigned = manuscript.assignedReviewers?.includes(currentUserId) ||
                             manuscript.assignedReviewersMeta?.[currentUserId]?.invitationStatus === "accepted";
            if (!isAssigned) continue;
          }

          try {
            // Use the same getActiveDeadline function as in ManuscriptItem
            const deadline = await getReviewerDeadline(
              manuscript,
              role,
              currentUserId,
              manuscript.coAuthorsIds?.includes(currentUserId),
              manuscript.submitterId === currentUserId
            );

            if (deadline) {
              // Convert to Date object if it's a Firestore timestamp
              const deadlineDate = deadline.toDate ? deadline.toDate() : new Date(deadline);
              
              // Only show future deadlines or those within the last 7 days
              const oneWeekAgo = new Date();
              oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
              
              if (deadlineDate > oneWeekAgo) {
                // Store the deadline date
                deadlines[manuscript.id] = deadlineDate;
              }
            }
          } catch (error) {
            console.error("Error loading deadline for manuscript:", manuscript.id, error);
          }
        } catch (error) {
          console.error("Error loading deadline for manuscript:", manuscript.id, error);
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
          (m.previousReviewSubmissions || []).some(
            (s) => s.reviewerId === targetUserId
          ) ||
          (m.previousReviews || []).some((r) => r.reviewerId === targetUserId);

        if (!wasEverAssigned) return false;

        // Check if reviewer has any submissions (current or previous versions)
        const hasAnySubmission =
          (m.reviewerSubmissions || []).some(
            (s) => s.reviewerId === targetUserId
          ) ||
          (m.previousReviewSubmissions || []).some(
            (s) => s.reviewerId === targetUserId
          ) ||
          (m.previousReviews || []).some((r) => r.reviewerId === targetUserId);

        // Check if reviewer has made a decision (current or previous versions)
        const hasAnyDecision =
          m.reviewerDecisionMeta?.[targetUserId]?.decision ||
          (m.previousReviewerDecisionMeta &&
            Object.values(m.previousReviewerDecisionMeta).some(
              (meta) => meta[targetUserId]?.decision
            ));

        // Only count as declined if they never submitted or made a decision
        const isDeclinedWithoutParticipation = 
          (m.declinedReviewers?.includes(targetUserId) || 
           m.assignedReviewersMeta?.[targetUserId]?.invitationStatus === "declined") &&
          !hasAnySubmission && 
          !hasAnyDecision;

        return (hasAnySubmission || hasAnyDecision) && !isDeclinedWithoutParticipation;
      }).length;

      counts.push({
        label: "Total Manuscripts Reviewed",
        count: reviewedCount,
      });
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
      {
        label: "Pending",
        count: manuscripts.filter((m) => m.status === "Pending").length,
      },
      {
        label: "In Progress",
        count: manuscripts.filter((m) =>
          IN_PROGRESS_STATUSES.includes(m.status)
        ).length,
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
        count: manuscripts.filter((m) => rejectedStatuses.includes(m.status))
          .length,
      },
    ];

    // Add Non-Acceptance filter only for non-reviewer roles
    if (role !== "Peer Reviewer") {
      commonFilters.splice(-1, 0, {
        label: "Non-Acceptance",
        count: manuscripts.filter((m) => m.status === "Non-Acceptance").length,
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

    let filteredManuscripts = [...manuscripts];

    // Apply status filter
    if (!(filterStatus === "All" || totalLabels.includes(filterStatus))) {
      if (filterStatus === "Pending") {
        filteredManuscripts = filteredManuscripts.filter((m) => m.status === "Pending");
      } else if (filterStatus === "In Progress") {
        filteredManuscripts = filteredManuscripts.filter((m) => IN_PROGRESS_STATUSES.includes(m.status));
      } else if (filterStatus === "Rejected") {
        filteredManuscripts = filteredManuscripts.filter((m) => 
          ["Rejected", "Peer Reviewer Rejected"].includes(m.status)
        );
      } else if (filterStatus === "Non-Acceptance") {
        filteredManuscripts = filteredManuscripts.filter((m) => 
          m.status === "Non-Acceptance"
        );
      } else if (filterStatus === "For Publication") {
        filteredManuscripts = filteredManuscripts.filter((m) => m.status === "For Publication");
      } else if (filterStatus === "For Revision") {
        filteredManuscripts = filteredManuscripts.filter((m) => 
          ["For Revision (Minor)", "For Revision (Major)"].includes(m.status)
        );
      } else {
        filteredManuscripts = filteredManuscripts.filter((m) => m.status === filterStatus);
      }
    }

    // Apply search query filter if it exists
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filteredManuscripts = filteredManuscripts.filter((m) => {
        const title = (m.manuscriptTitle || m.title || m.formTitle || "").toLowerCase();
        const author = [
          m.firstName || '',
          m.middleName || '',
          m.lastName || ''
        ].join(' ').toLowerCase().replace(/\s+/g, ' ').trim();
        const status = (m.status || "").toLowerCase();
        
        return (
          title.includes(query) ||
          author.includes(query) ||
          status.includes(query)
        );
      });
    }

    return filteredManuscripts;
  }, [manuscripts, filterStatus, searchQuery]);

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
    if (status === "For Publication") {
      // Return the index of 'For Publication' in STATUS_STEPS + 1 (1-based index)
      return STATUS_STEPS.indexOf("For Publication") + 1;
    }

    // Get the steps to use based on the current status
    const stepsToUse =
      status === "Pending"
        ? ["Pending"]
        : STATUS_STEPS.filter((step) => step !== "Pending");

    // Normalize status for display (combine minor/major revisions)
    const normalizedStatus = status.includes("For Revision")
      ? "For Revision"
      : status;

    // Get the status to display (using mapping if needed)
    const displayStatus = STATUS_MAPPING[normalizedStatus] || normalizedStatus;

    // Find the index of the current status in the steps
    const stepIndex = stepsToUse.findIndex((step) => step === displayStatus);

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
            ? `Viewing Dashboard of ${
                targetUser
                  ? `${targetUser.firstName || ""} ${
                      targetUser.middleName ? targetUser.middleName.charAt(0) + ". " : ""
                    }${targetUser.lastName || ""}`.trim()
                  : "User"
              }`
            : `Hello, ${userProfile?.firstName || user?.displayName || "User"} ${
                userProfile?.middleName ? userProfile.middleName.charAt(0) + ". " : ""
              }${userProfile?.lastName || ""}`.trim() || "User!"}
        </h1>
        <span className="text-gray-500 font-medium mt-2 sm:mt-0">
          Role: {role}
        </span>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
  {role && (
    <div className="lg:w-1/4">
      <div className="sticky top-32 bg-white border-2 border-red-900 rounded-2xl p-6 shadow-lg">
        <h2 className="text-xl font-semibold mb-4 text-black">
          Dashboard
        </h2>
        <ul className="space-y-4">
          {summaryCounts.map(({ label, count }) => (
            <li
              key={label}
              className={`flex justify-between items-center cursor-pointer hover:bg-gray-100 p-2 rounded-lg transition ${
                filterStatus === label ? "bg-gray-100 font-semibold" : ""
              }`}
              onClick={() => setFilterStatus(label)}
            >
              <span className="text-black font-medium">{label}</span>
              <span className="text-black font-bold text-lg">
                {count}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>

        )}

        <div className="flex-1">
          <div className="mb-6">
            <SearchBar 
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              setCurrentPage={setCurrentPage}
            />
          </div>
          
          {role && (
          <div className="flex flex-col gap-6">
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

              // Determine the status to display based on user role and invitation status
              const displayStatus = 
                // If user is a peer reviewer and is assigned to this manuscript
                role === 'Peer Reviewer' && m.assignedReviewers?.includes(user?.uid)
                  ? m.assignedReviewersMeta?.[user?.uid]?.invitationStatus === 'accepted' 
                    ? m.status // Show the actual status if reviewer has accepted
                    : m.assignedReviewersMeta?.[user?.uid]?.invitationStatus === 'declined'
                      ? 'Review Declined'
                      : 'Pending Acceptance'
                  : m.status; // For non-reviewers or uninvited reviewers, show the regular status

              const statusForProgress = STATUS_MAPPING[displayStatus] || displayStatus;
              const stepIndex = Math.max(
                0,
                STATUS_STEPS.indexOf(statusForProgress || "Pending")
              );
              const isRejected = ["Rejected", "Peer Reviewer Rejected"].includes(displayStatus);
              const isCompleted = displayStatus === "For Publication";
              const isAccepted = displayStatus === "Accepted";

              // Status color mapping to match ManuscriptStatusBadge
              const statusColors = {
                'Pending': 'bg-gray-100 text-gray-800',
                'Accepted': 'bg-teal-100 text-teal-800',
                'Assigning Peer Reviewer': 'bg-blue-100 text-blue-800',
                'Peer Reviewer Assigned': 'bg-indigo-100 text-indigo-800',
                'Peer Reviewer Reviewing': 'bg-purple-100 text-purple-800',
                'Back to Admin': 'bg-yellow-100 text-yellow-800',
                'For Revision (Minor)': 'bg-orange-100 text-orange-800',
                'For Revision (Major)': 'bg-orange-200 text-orange-900',
                'In Finalization': 'bg-blue-100 text-blue-800',
                'For Publication': 'bg-green-100 text-green-800',
                'Rejected': 'bg-red-100 text-red-800',
                'Peer Reviewer Rejected': 'bg-red-100 text-red-800',
                'Review Declined': 'bg-red-100 text-red-800',
                'Revision Overdue': 'bg-red-700 text-white',
                'Finalized': 'bg-green-100 text-green-800',
                'Pending Acceptance': 'bg-yellow-100 text-yellow-800',
                'default': 'bg-gray-100 text-gray-800'
              };
              
              // Get the appropriate status class or use default
              const statusClass = statusColors[displayStatus] || statusColors['default'];

              return (
                <div
                  key={m.id}
                  onClick={() => navigate(`/manuscripts?manuscriptId=${m.id}`)}
                  className="bg-white rounded-2xl p-5 shadow-md border border-gray-100 hover:shadow-xl transition relative cursor-pointer"
                >
                  <div className="flex justify-between items-center mb-2">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-gray-800">
                        {manuscriptTitle}
                      </h3>
                      {m.ownershipType === 'coAuthor' && (
                        <span className="text-xs bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full">
                          Co-Author
                        </span>
                      )}
                      {m.ownershipType === 'submitted' && m.ownershipType !== 'owner' && (
                        <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">
                          Submitted
                        </span>
                      )}
                    </div>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-medium ${statusClass}`}
                    >
                      {displayStatus}
                    </span>
                  </div>
                  <p className="text-gray-400 text-sm mb-1">
                    Submitted: {submittedAtText}
                  </p>
                  {activeDeadlines[m.id] &&
                    ((role === "Peer Reviewer" &&
                      ([
                        "Back to Admin",
                        "For Revision",
                        "For Revision (Minor)",
                        "For Revision (Major)",
                        "Peer Reviewer Assigned",
                        "Peer Reviewer Reviewing"
                      ].includes(m.status) ||
                        !m.reviewerSubmissions?.some(
                          (s) => s.reviewerId === user?.uid
                        ))) ||
                      (role !== "Peer Reviewer" &&
                        ![
                          "For Publication",
                          "Rejected",
                          "Peer Reviewer Rejected",
                        ].includes(m.status))) && (
                      <div className="mt-1">
                        <div className="flex items-center text-sm text-gray-600">
                          <DeadlineBadge
                            start={(() => {
                              // Use the same logic as in ManuscriptItem
                              const startDate = m.assignedAt || m.submittedAt || new Date();
                              const now = new Date();
                              const effectiveStart = new Date(startDate) > now ? now : new Date(startDate);
                              return effectiveStart?.toDate ? effectiveStart.toDate() : new Date(effectiveStart);
                            })()}
                            end={activeDeadlines[m.id]}
                            formatDate={formatDate}
                            className="mt-1"
                          />
                        </div>
                      </div>
                    )}
                  <Progressbar
                    currentStep={getCurrentStep(m.status)}
                    steps={
                      m.status === "Pending"
                        ? ["Pending"]
                        : STATUS_STEPS.filter((step) => step !== "Pending")
                    }
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
    </div>
  );
};

export default Dashboard;
