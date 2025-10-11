import { useState, useEffect, useCallback, useRef } from "react";
import { getAuth } from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  deleteDoc,
  serverTimestamp,
  onSnapshot,
  deleteField  // <-- add this
} from "firebase/firestore";
import { db } from "../firebase/firebase";
import { app } from "../firebase/firebase"; // added to get storageBucket
import {
  computeManuscriptStatus,
  filterAcceptedReviewers,
  filterRejectedReviewers,
  handleManuscriptStatusChange,
  handlePeerReviewerAssignment,
} from "../utils/manuscriptHelpers";
import { UserLogService } from "../utils/userLogService";

import Searchbar from "./Searchbar";
import FilterButtons from "./FilterButtons";
import ManuscriptItem from "./ManuscriptItem";
import PaginationControls from "./PaginationControls";

const Manuscripts = () => {
  const [user, setUser] = useState(null);
  const [userId, setUserId] = useState(null);
  const [role, setRole] = useState(null);
  const [manuscripts, setManuscripts] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [manuscriptsPerPage, setManuscriptsPerPage] = useState(5);
  const [showFullName, setShowFullName] = useState({});

  // Helper for consistent date formatting
  const formatFirestoreDate = (ts) =>
    ts?.toDate?.()
      ? ts.toDate().toLocaleString()
      : ts instanceof Date
      ? ts.toLocaleString()
      : "N/A";

  // Build a safe REST download URL from a storage path
  const buildRestUrlSafe = (rawPath) => {
    if (!rawPath) return null;
    let p = String(rawPath).trim();
    // remove leading slashes, collapse multiple slashes, remove trailing slash
    p = p.replace(/^\/+/, "").replace(/\/{2,}/g, "/").replace(/\/$/, "");
    const bucket = app?.options?.storageBucket || "pubtrack2.appspot.com";
    return `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodeURIComponent(
      p
    )}?alt=media`;
  };

  // --- Assign reviewer ---
  const handleAssign = async (manuscriptId, reviewerId) => {
    try {
      const msRef = doc(db, "manuscripts", manuscriptId);
      const msSnap = await getDoc(msRef);
      if (!msSnap.exists()) return;
  
      const assigned = msSnap.data().assignedReviewers || [];
      const assignedMeta = msSnap.data().assignedReviewersMeta || {};
  
      if (!assigned.includes(reviewerId)) {
        // Add to assigned reviewers with invitation status
        assigned.push(reviewerId);
        assignedMeta[reviewerId] = {
          assignedAt: serverTimestamp(),
          assignedBy: userId,
          invitationStatus: "pending",
          respondedAt: null,
          decision: null
        };
  
        // Only update these specific fields
        await updateDoc(msRef, {
          assignedReviewers: assigned,
          [`assignedReviewersMeta.${reviewerId}`]: assignedMeta[reviewerId]
          // No status update here
        });
  
        // Rest of your notification code...
        const manuscript = msSnap.data();
        const manuscriptTitle = manuscript.manuscriptTitle || manuscript.title || "Untitled Manuscript";
        
        // Send invitation notification
        await addDoc(collection(db, "Users", reviewerId, "Notifications"), {
          type: "reviewer_invitation",
          manuscriptId: manuscriptId,
          manuscriptTitle: manuscriptTitle,
          status: "pending",
          createdAt: serverTimestamp(),
          read: false,
          invitationLink: `/reviewer/invitation/${manuscriptId}`
        });
        
        // Log the reviewer invitation
        await UserLogService.logReviewerInvitation(
          userId, 
          manuscriptId, 
          manuscriptTitle, 
          reviewerId
        );
      }
    } catch (err) {
      console.error("Error assigning reviewer:", err);
    }
  };
  // --- Unassign reviewer ---
  const unassignReviewer = async (manuscriptId, reviewerId = null) => {
    try {
      const msRef = doc(db, "manuscripts", manuscriptId);
      const msSnap = await getDoc(msRef);
      if (!msSnap.exists()) return;

      const data = msSnap.data();
      let assigned = data.assignedReviewers || [];
      let assignedMeta = { ...(data.assignedReviewersMeta || {}) };
      let reviewerDecisionMeta = { ...(data.reviewerDecisionMeta || {}) };

      if (!reviewerId) {
        // Unassign all reviewers
        assigned = [];
        assignedMeta = {};
        reviewerDecisionMeta = {};
        await updateDoc(msRef, {
          assignedReviewers: [],
          assignedReviewersMeta: {},
          reviewerDecisionMeta: deleteField(),
          status: "Assigning Peer Reviewer",
        });
      } else {
        // Remove specific reviewer
        assigned = assigned.filter((id) => id !== reviewerId);
        delete assignedMeta[reviewerId];
        delete reviewerDecisionMeta[reviewerId];

        // Compute final status centrally
        const finalStatus = computeManuscriptStatus(
          reviewerDecisionMeta,
          assigned,
          data.reviewerSubmissions || []
        );

        const updates = {
          assignedReviewers: assigned,
          assignedReviewersMeta: assignedMeta,
          reviewerDecisionMeta:
            Object.keys(reviewerDecisionMeta).length > 0
              ? reviewerDecisionMeta
              : deleteField(),
          status: finalStatus,
        };

        await updateDoc(msRef, updates);
      }

      // Update local state
      setManuscripts((prev) =>
        prev.map((m) =>
          m.id === manuscriptId
            ? {
                ...m,
                assignedReviewers: assigned,
                assignedReviewersMeta: assignedMeta,
                reviewerDecisionMeta:
                  Object.keys(reviewerDecisionMeta).length > 0
                    ? reviewerDecisionMeta
                    : undefined,
                status:
                  !reviewerId && assigned.length === 0
                    ? "Assigning Peer Reviewer"
                    : computeManuscriptStatus(reviewerDecisionMeta, assigned, m.reviewerSubmissions || []),
              }
            : m
        )
      );
    } catch (err) {
      console.error("Error unassigning reviewer:", err);
    }
  };

  // --- Change manuscript status (Back to Admin buttons) ---
  const handleStatusChange = async (manuscriptId, newStatus) => {
    try {
      const msRef = doc(db, "manuscripts", manuscriptId);
      const msSnap = await getDoc(msRef);
      if (!msSnap.exists()) return;
  
      const ms = msSnap.data();
      
      // Prevent status changes if there are pending reviewer invitations
      if (ms.assignedReviewersMeta) {
        const hasPendingInvitations = Object.values(ms.assignedReviewersMeta).some(
          meta => meta.invitationStatus === "pending"
        );
        
        if (hasPendingInvitations) {
          console.log("Cannot change status - there are pending reviewer invitations");
          return; // Exit early if there are pending invitations
        }
      }
  
      let updatedAssignedReviewers = ms.assignedReviewersData || [];
      let updatedAssignedMeta = ms.assignedReviewersMeta || {};
  
      if (newStatus === "For Publication") {
        // Keep only reviewers who accepted
        const reviewerObjects = (ms.assignedReviewers || []).map(id => ({ id }));
        const acceptedReviewerObjects = filterAcceptedReviewers(
          ms.reviewerDecisionMeta,
          reviewerObjects
        );
        
        // Get the accepted reviewer data from assignedReviewersData
        updatedAssignedReviewers = (ms.assignedReviewersData || []).filter(r => 
          acceptedReviewerObjects.some(accepted => accepted.id === r.id)
        );
  
        const newMeta = {};
        updatedAssignedReviewers.forEach((r) => {
          newMeta[r.id] = ms.assignedReviewersMeta?.[r.id] || {
            assignedAt: r.assignedAt,
            assignedBy: r.assignedBy,
          };
        });
        updatedAssignedMeta = newMeta;
  
        // Update accepted reviewer stats
        updatedAssignedReviewers.forEach(async (r) => {
          const reviewerRef = doc(db, "Users", r.id);
          await updateDoc(reviewerRef, {
            acceptedManuscripts: (r.acceptedManuscripts || 0) + 1,
          });
        });
      } else if (newStatus === "Peer Reviewer Rejected") {
        // Keep only reviewers who rejected
        const reviewerObjects = (ms.assignedReviewers || []).map(id => ({ id }));
        const rejectedReviewerObjects = filterRejectedReviewers(
          ms.reviewerDecisionMeta,
          reviewerObjects
        );
        
        // Get the rejected reviewer data from assignedReviewersData
        updatedAssignedReviewers = (ms.assignedReviewersData || []).filter(r => 
          rejectedReviewerObjects.some(rejected => rejected.id === r.id)
        );
  
        const newMeta = {};
        updatedAssignedReviewers.forEach((r) => {
          newMeta[r.id] = ms.assignedReviewersMeta?.[r.id] || {
            assignedAt: r.assignedAt,
            assignedBy: r.assignedBy,
          };
        });
        updatedAssignedMeta = newMeta;
  
        // Update rejected reviewer stats
        updatedAssignedReviewers.forEach(async (r) => {
          const reviewerRef = doc(db, "Users", r.id);
          await updateDoc(reviewerRef, {
            rejectedManuscripts: (r.rejectedManuscripts || 0) + 1,
          });
        });
      } else if (newStatus === "For Revision (Minor)") {
        // Minor Revision: Clear all reviewers, goes back to Admin for reassignment
        await updateDoc(msRef, {
          status: newStatus,
          assignedReviewers: [],
          assignedReviewersMeta: {},
          originalAssignedReviewers: ms.assignedReviewers || [],
          originalAssignedReviewersMeta: ms.assignedReviewersMeta || {},
          reviewerSubmissions: ms.reviewerSubmissions || [],
          finalDecisionAt: new Date(),
          finalDecisionBy: userId,
        });
        
        // Update local state and exit
        setManuscripts((prev) =>
          prev.map((m) =>
            m.id === manuscriptId
              ? {
                  ...m,
                  status: newStatus,
                  assignedReviewers: [],
                  assignedReviewersMeta: {},
                  originalAssignedReviewers: ms.assignedReviewers || [],
                  originalAssignedReviewersMeta: ms.assignedReviewersMeta || {},
                  finalDecisionAt: new Date(),
                  finalDecisionBy: userId,
                }
              : m
          )
        );
        return;
      } else if (newStatus === "For Revision (Major)") {
        // Major Revision: Keep only reviewers who accepted (exclude rejecters)
        const reviewerObjects = (ms.assignedReviewers || []).map(id => ({ id }));
        const acceptedReviewerObjects = filterAcceptedReviewers(
          ms.reviewerDecisionMeta,
          reviewerObjects
        );
        
        updatedAssignedReviewers = (ms.assignedReviewersData || []).filter(r => 
          acceptedReviewerObjects.some(accepted => accepted.id === r.id)
        );
  
        const newMeta = {};
        updatedAssignedReviewers.forEach((r) => {
          newMeta[r.id] = ms.assignedReviewersMeta?.[r.id] || {
            assignedAt: r.assignedAt,
            assignedBy: r.assignedBy,
          };
        });
        updatedAssignedMeta = newMeta;
        
        await updateDoc(msRef, {
          status: newStatus,
          assignedReviewers: updatedAssignedReviewers.map((r) => r.id),
          assignedReviewersMeta: updatedAssignedMeta,
          reviewerSubmissions: ms.reviewerSubmissions || [],
          originalAssignedReviewers: ms.assignedReviewers || [],
          originalAssignedReviewersMeta: ms.assignedReviewersMeta || {},
          finalDecisionAt: new Date(),
          finalDecisionBy: userId,
        });
        
        // Update local state and exit
        setManuscripts((prev) =>
          prev.map((m) =>
            m.id === manuscriptId
              ? {
                  ...m,
                  status: newStatus,
                  assignedReviewers: updatedAssignedReviewers.map((r) => r.id),
                  assignedReviewersMeta: updatedAssignedMeta,
                  originalAssignedReviewers: ms.assignedReviewers || [],
                  originalAssignedReviewersMeta: ms.assignedReviewersMeta || {},
                  finalDecisionAt: new Date(),
                  finalDecisionBy: userId,
                }
              : m
          )
        );
        return;
      }
  
      // Prepare update data
      const updateData = {
        assignedReviewers: updatedAssignedReviewers.map((r) => r.id),
        assignedReviewersMeta: updatedAssignedMeta,
        // Keep original reviewer history for peer reviewer access and admin info
        originalAssignedReviewers: ms.assignedReviewers || [],
        originalAssignedReviewersMeta: ms.assignedReviewersMeta || {},
        // Add decision timestamp
        finalDecisionAt: new Date(),
        finalDecisionBy: userId, // Use the actual admin ID
      };
  
      // Only update status if it's not related to reviewer assignment
      if (!["Reviewer Invited", "Peer Reviewer Assigned"].includes(ms.status)) {
        updateData.status = newStatus;
      }
  
      await updateDoc(msRef, updateData);
  
      // Send notification about status change
      const manuscriptTitle = ms.manuscriptTitle || ms.title || "Untitled Manuscript";
      const authorId = ms.submitterId || ms.userId;
      
      if (authorId) {
        try {
          // Get reviewer IDs if this is a revision notification
          const reviewerIds = [];
          if ((newStatus === "For Revision (Minor)" || newStatus === "For Revision (Major)") && ms.assignedReviewers) {
            // Get all reviewers who have submitted a review
            const reviewsRef = collection(db, "manuscripts", manuscriptId, "reviews");
            const reviewsSnapshot = await getDocs(reviewsRef);
            const submittedReviewerIds = reviewsSnapshot.docs.map(doc => doc.data().reviewerId);
            
            // Only include reviewers who have submitted a review
            reviewerIds.push(...ms.assignedReviewers.filter(id => submittedReviewerIds.includes(id)));
          }
          
          // Send notification to the author about the status change
          await handleManuscriptStatusChange(
            manuscriptId, 
            manuscriptTitle, 
            ms.status, // oldStatus
            newStatus, 
            authorId,  // authorId
            userId,    // adminId (who made the change)
          );
          
          console.log(`Status change logged for author ${authorId}` );
          
          // If the status is being changed by someone other than the author,
          // log it for the admin as well
          if (userId !== authorId) {
            await UserLogService.logManuscriptStatusChange(
              userId, // Admin who made the change
              manuscriptId, 
              manuscriptTitle, 
              ms.status, 
              newStatus, 
              userId  // The admin themselves
            );
            console.log(`Status change logged for admin ${userId}` );
          }
        } catch (error) {
          console.error('Error handling status change notification:', error);
        }
      }
  
      // Update local state
      setManuscripts((prev) =>
        prev.map((m) =>
          m.id === manuscriptId
            ? {
                ...m,
                assignedReviewers: updatedAssignedReviewers.map((r) => r.id),
                assignedReviewersMeta: updatedAssignedMeta,
                status: newStatus,
                originalAssignedReviewers: ms.assignedReviewers || [],
                originalAssignedReviewersMeta: ms.assignedReviewersMeta || {},
                finalDecisionAt: new Date(),
                finalDecisionBy: userId,
              }
            : m
        )
      );
    } catch (err) {
      console.error("Error updating status:", err); 
    }
  };
  // --- Fetch data ---
  useEffect(() => {
    const auth = getAuth();
    let unsubscribeManuscripts = null;

    const fetchData = async (currentUser) => {
      try {
        const usersSnap = await getDocs(collection(db, "Users"));
        const allUsers = usersSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setUsers(allUsers);

        const userRef = doc(db, "Users", currentUser.uid);
        const docSnap = await getDoc(userRef);
        const userRole = docSnap.exists() ? docSnap.data().role : "User";
        setRole(userRole);

        setUser(currentUser);
        setUserId(currentUser.uid);

    const manuscriptsRef = collection(db, "manuscripts");
unsubscribeManuscripts = onSnapshot(manuscriptsRef, (snapshot) => {
  const allMss = snapshot.docs.map((doc) => {
    const data = doc.data() || {};

    // Combine current + original reviewers
    const allReviewerIds = [
      ...(data.assignedReviewers || []),
      ...(data.originalAssignedReviewers || [])
    ];
    const uniqueReviewerIds = [...new Set(allReviewerIds)];

    let assignedReviewersData = uniqueReviewerIds.map((id) => {
      const u = allUsers.find((user) => user.id === id);
      const meta = data.assignedReviewersMeta?.[id] || data.originalAssignedReviewersMeta?.[id] || {};
      const decisionMeta = data.reviewerDecisionMeta?.[id] || {};

      return {
        id,
        firstName: u?.firstName || "",
        middleName: u?.middleName || "",
        lastName: u?.lastName || "",
        assignedAt: meta.assignedAt || null,
        assignedBy: meta.assignedBy || "—",
        decision: decisionMeta.decision || null,
        decidedAt: decisionMeta.decidedAt || null,
      };
    }).sort((a, b) => (a.assignedAt?.toDate?.()?.getTime?.() || 0) - (b.assignedAt?.toDate?.()?.getTime?.() || 0));

    let manuscript = { id: doc.id, ...data, assignedReviewersData };

    // Role-based modifications
    if (userRole === "Peer Reviewer") {
      // Only keep their own reviewer data
      manuscript.assignedReviewersData = assignedReviewersData.filter(r => r.id === currentUser.uid);

      // Hide author info
      manuscript.userId = undefined;
      manuscript.firstName = undefined;
      manuscript.middleName = undefined;
      manuscript.lastName = undefined;
      manuscript.email = undefined;
      manuscript.submitter = undefined;
    }

    if (userRole === "Researcher") {
      manuscript.assignedReviewersData = [];
    }

    return manuscript;
  });

  // No filtering that removes manuscripts — Peer Reviewer keeps all they are assigned to
 let filtered = allMss;

if (userRole === "Peer Reviewer") {
  const myId = currentUser.uid;
  filtered = allMss.filter((m) => {
    const myDecision = m.reviewerDecisionMeta?.[myId]?.decision; // "publication" or "reject"
    const isAssigned = (m.assignedReviewers || []).includes(myId) || 
                      (m.originalAssignedReviewers || []).includes(myId);
    const hasSubmitted = m.reviewerSubmissions?.some(s => s.reviewerId === myId);

    // Only show manuscripts they are involved in
    if (!(isAssigned || hasSubmitted || myDecision)) return false;

    // If there's a final decision, only show if it matches the reviewer's decision
    if (m.status === "For Publication") {
      return myDecision === "publication";
    } else if (m.status === "Rejected" || m.status === "Peer Reviewer Rejected") {
      return myDecision === "reject";
    }
    
    // If no final decision yet, show the manuscript
    return true;
  });
} else if (userRole === "Researcher") {
  filtered = allMss.filter((m) =>
    m.userId === currentUser.uid ||
    m.submitterId === currentUser.uid ||
    (m.coAuthorsIds || []).includes(currentUser.uid) ||
    (m.assignedReviewers || []).includes(currentUser.uid)
  );
}


  // Sort newest first
  filtered.sort((a, b) => {
    const aTime = a.acceptedAt?.toDate?.()?.getTime?.() || a.submittedAt?.toDate?.()?.getTime?.() || 0;
    const bTime = b.acceptedAt?.toDate?.()?.getTime?.() || b.submittedAt?.toDate?.()?.getTime?.() || 0;
    return bTime - aTime;
  });

  setManuscripts(filtered);
});


      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    const unsubscribeAuth = auth.onAuthStateChanged((currentUser) => {
      if (currentUser) fetchData(currentUser);
      else {
        setUser(null);
        setRole(null);
        setUserId(null);
        setManuscripts([]);
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeManuscripts) unsubscribeManuscripts();
    };
  }, [showFullName, role]);

  // --- UI render ---
  if (loading)
    return <div className="p-28 text-gray-700">Loading manuscripts...</div>;
  if (!user)
    return (
      <div className="p-28 text-red-600 text-center">
        You must be signed in to view manuscripts.
      </div>
    );

  // --- Filter manuscripts ---
// Filter manuscripts based on status and search
const filteredManuscripts = manuscripts
  .filter((m) => {
    if (filter === "all") return true;
    if (filter === "Pending") return !m.status || m.status === "Pending";
    if (filter === "Rejected") return m.status === "Rejected" || m.status === "Peer Reviewer Rejected";
    if (filter === "Back to Admin") return m.status === "Back to Admin";
    return m.status === filter;
  })
  .filter((m) => {
    if (!searchQuery) return true;
    const queryWords = searchQuery.toLowerCase().split(" ");
    const manuscriptTitle = m.title || m.manuscriptTitle || m.formTitle ||
      m.answeredQuestions?.find(q => q.question?.toLowerCase().includes('title'))?.answer || "Untitled";

    const fields = [
      manuscriptTitle,
      m.firstName,
      m.middleName,
      m.lastName,
      m.role,
      m.email,
      m.submitter,
      m.status,
      ...(m.assignedReviewersData?.map(r => `${r.firstName} ${r.lastName}`) || []),
      ...(m.answeredQuestions?.map(q => q.answer?.toString()) || [])
    ];

    return queryWords.every(word =>
      fields.some(f => f?.toString().toLowerCase().includes(word))
    );
  });

// Remove any null/undefined items (e.g., filtered out for role)
const visibleManuscripts = filteredManuscripts.filter(Boolean);

// Pagination calculation
const totalPages = Math.ceil(visibleManuscripts.length / manuscriptsPerPage);
const indexOfLast = currentPage * manuscriptsPerPage;
const indexOfFirst = indexOfLast - manuscriptsPerPage;
const currentManuscripts = visibleManuscripts.slice(indexOfFirst, indexOfLast);

  return (
    <div className="pt-24 px-4 sm:px-6 lg:px-24 pb-36">
      <h1 className="text-3xl font-bold mb-6 text-center sm:text-left">
        Manuscripts
      </h1>

      <Searchbar
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        setCurrentPage={setCurrentPage}
      />

      <FilterButtons
        filter={filter}
        setFilter={(val) => {
          setFilter(val);
          setCurrentPage(1);
        }}
        manuscripts={manuscripts}
      />

<ul className="space-y-4">
  {currentManuscripts.map((m) => (
    <ManuscriptItem
      key={m.id}
      manuscript={m}
      role={role}
      users={users}
      handleAssign={handleAssign}
      unassignReviewer={unassignReviewer}
      showFullName={showFullName}
      setShowFullName={setShowFullName}
      formatFirestoreDate={formatFirestoreDate}
      handleStatusChange={handleStatusChange} 
    />
  ))}
</ul>

      <PaginationControls
        currentPage={currentPage}
        totalPages={totalPages}
        setCurrentPage={setCurrentPage}
        manuscriptsPerPage={manuscriptsPerPage}
        setManuscriptsPerPage={setManuscriptsPerPage}
      />
    </div>
  );
};

export default Manuscripts;
