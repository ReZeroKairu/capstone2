import React, { useEffect, useState } from "react";
import { getAuth } from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  updateDoc,
  serverTimestamp,
  deleteField,
} from "firebase/firestore";
import { db } from "../firebase/firebase";
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
          // Send notification to the author about the status change
          await handleManuscriptStatusChange(
            manuscriptId, 
            manuscriptTitle, 
            ms.status, // oldStatus
            newStatus, 
            authorId,  // authorId
            userId     // adminId (who made the change)
          );
          
          console.log(`Status change notification sent for manuscript ${manuscriptId} to author ${authorId}` );
          
          // Log the status change for the author
          await UserLogService.logManuscriptStatusChange(
            userId, // Admin who made the change
            manuscriptId, 
            manuscriptTitle, 
            ms.status, 
            newStatus, 
            authorId  // The affected user (author)
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
          const allMss = snapshot.docs
            .map((doc) => {
              const data = doc.data() || {};

              let assignedReviewersData = [];
              
              // Get all reviewers (current + original) for comprehensive data
              const allReviewerIds = [
                ...(data.assignedReviewers || []),
                ...(data.originalAssignedReviewers || [])
              ];
              const uniqueReviewerIds = [...new Set(allReviewerIds)];
              
              if (uniqueReviewerIds.length > 0) {
                assignedReviewersData = uniqueReviewerIds
                  .map((id) => {
                    const u = allUsers.find((user) => user.id === id);
                    // Check both current and original metadata
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
                  })
                  .sort((a, b) => {
                    const aTime = a.assignedAt?.toDate?.()?.getTime?.() || 0;
                    const bTime = b.assignedAt?.toDate?.()?.getTime?.() || 0;
                    return aTime - bTime;
                  });

                if (userRole === "Peer Reviewer") {
                  assignedReviewersData = assignedReviewersData.filter(
                    (r) => r.id === currentUser.uid
                  );
                }
              }

              let filteredData = {
                ...data,
                assignedReviewersData,
              };

              if (userRole === "Peer Reviewer") {
                filteredData.userId = undefined;
                filteredData.firstName = undefined;
                filteredData.middleName = undefined;
                filteredData.lastName = undefined;
                filteredData.email = undefined;
                filteredData.submitter = undefined;
              }

              if (userRole === "Researcher") {
                filteredData.assignedReviewersData = [];
              }

              return { id: doc.id, ...filteredData };
            })
            .filter((m) => {
              if (userRole === "Admin") return true;
              if (userRole === "Peer Reviewer") {
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
              }
              if (userRole === "Researcher") {
                return (
                  m.userId === currentUser.uid ||
                  m.submitterId === currentUser.uid ||
                  (m.coAuthorsIds || []).includes(currentUser.uid) ||
                  (m.assignedReviewers || []).includes(currentUser.uid)
                );
              }
              return (
                m.userId === currentUser.uid ||
                m.submitterId === currentUser.uid ||
                (m.coAuthorsIds || []).includes(currentUser.uid)
              );
            });

          allMss.sort((a, b) => {
            // Priority 1: Sort by completion date (finalDecisionAt) for completed manuscripts
            const aCompletionTime = a.finalDecisionAt?.toDate?.()?.getTime?.() || 
                                   (["For Publication", "For Revision", "Peer Reviewer Rejected"].includes(a.status) ? 
                                    (a.acceptedAt?.toDate?.()?.getTime?.() || a.submittedAt?.toDate?.()?.getTime?.() || 0) : 0);
            const bCompletionTime = b.finalDecisionAt?.toDate?.()?.getTime?.() || 
                                   (["For Publication", "For Revision", "Peer Reviewer Rejected"].includes(b.status) ? 
                                    (b.acceptedAt?.toDate?.()?.getTime?.() || b.submittedAt?.toDate?.()?.getTime?.() || 0) : 0);
            
            // If both have completion times, sort by completion time (newest first)
            if (aCompletionTime && bCompletionTime) {
              return bCompletionTime - aCompletionTime;
            }
            
            // If only one has completion time, completed manuscripts come first
            if (aCompletionTime && !bCompletionTime) return -1;
            if (!aCompletionTime && bCompletionTime) return 1;
            
            // Priority 2: For non-completed manuscripts, sort by submitted/accepted time
            const aTime = a.acceptedAt?.toDate?.()?.getTime?.() || a.submittedAt?.toDate?.()?.getTime?.() || 0;
            const bTime = b.acceptedAt?.toDate?.()?.getTime?.() || b.submittedAt?.toDate?.()?.getTime?.() || 0;
            return bTime - aTime;
          });

          setManuscripts(allMss);
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
  const filteredManuscripts = manuscripts
    .filter((m) => {
      if (filter === "all") return m.status !== "Pending";
      if (filter === "Rejected")
        return m.status === "Rejected" || m.status === "Peer Reviewer Rejected";
      if (filter === "Back to Admin") return m.status === "Back to Admin";
      return m.status === filter;
    })
    .filter((m) => {
      if (!searchQuery) return true;
      const queryWords = searchQuery.toLowerCase().split(" ");
      
      // Get manuscript title from various possible fields
      const manuscriptTitle = m.title || m.manuscriptTitle || m.formTitle || 
                             m.answeredQuestions?.find(q => 
                               q.question?.toLowerCase().includes('title'))?.answer || "Untitled";
      
      // Build searchable fields array
      const fields = [
        manuscriptTitle,
        m.firstName,
        m.middleName, 
        m.lastName,
        m.role,
        m.email,
        m.submitter,
        m.status,
        // Add reviewer names if available
        ...(m.assignedReviewersData?.map(r => `${r.firstName} ${r.lastName}`) || []),
        // Add form responses if available
        ...(m.answeredQuestions?.map(q => q.answer?.toString()) || [])
      ];
      
      return queryWords.every((word) =>
        fields.some((f) => f?.toString().toLowerCase().includes(word))
      );
    });

  const indexOfLast = currentPage * manuscriptsPerPage;
  const indexOfFirst = indexOfLast - manuscriptsPerPage;
  const currentManuscripts = filteredManuscripts.slice(
    indexOfFirst,
    indexOfLast
  );
  const totalPages = Math.ceil(filteredManuscripts.length / manuscriptsPerPage);

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
        {currentManuscripts.filter(Boolean).map((m) => (
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
            handleStatusChange={handleStatusChange} // <-- added for Back to Admin buttons
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
