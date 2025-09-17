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
} from "../utils/manuscriptHelpers";

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
        assigned.push(reviewerId);
        assignedMeta[reviewerId] = {
          assignedAt: serverTimestamp(),
          assignedBy: userId,
        };

        await updateDoc(msRef, {
          assignedReviewers: assigned,
          [`assignedReviewersMeta.${reviewerId}`]: assignedMeta[reviewerId],
          status: "Peer Reviewer Assigned",
        });
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

      let updatedAssignedReviewers = ms.assignedReviewersData || [];
      let updatedAssignedMeta = ms.assignedReviewersMeta || {};

      if (newStatus === "For Publication") {
        // Keep only reviewers who accepted
        // Convert assignedReviewers IDs to the format expected by filter function
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
        // Convert assignedReviewers IDs to the format expected by filter function
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

      // When admin makes a decision, use that status directly (don't compute)
      await updateDoc(msRef, {
        status: newStatus, // Use the admin's chosen status directly
        assignedReviewers: updatedAssignedReviewers.map((r) => r.id),
        assignedReviewersMeta: updatedAssignedMeta,
        // Keep original reviewer history for peer reviewer access and admin info
        originalAssignedReviewers: ms.assignedReviewers || [],
        originalAssignedReviewersMeta: ms.assignedReviewersMeta || {},
        // Add decision timestamp
        finalDecisionAt: new Date(),
        finalDecisionBy: userId, // Use the actual admin ID
      });

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

  // --- Pagination helpers ---
  const getPageNumbers = (current, total) => {
    const delta = 2;
    const range = [];
    const rangeWithDots = [];
    for (let i = 1; i <= total; i++) {
      if (
        i === 1 ||
        i === total ||
        (i >= current - delta && i <= current + delta)
      )
        range.push(i);
    }
    let prev = null;
    for (let num of range) {
      if (prev) {
        if (num - prev === 2) rangeWithDots.push(prev + 1);
        else if (num - prev > 2) rangeWithDots.push("...");
      }
      rangeWithDots.push(num);
      prev = num;
    }
    return rangeWithDots;
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
              return (
                m.userId === currentUser.uid ||
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
        value={searchQuery}
        onChange={(val) => {
          setSearchQuery(val);
          setCurrentPage(1);
        }}
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
        getPageNumbers={getPageNumbers}
      />
    </div>
  );
};

export default Manuscripts;
