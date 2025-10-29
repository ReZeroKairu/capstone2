import { useState, useEffect, useRef } from "react";
import { doc, updateDoc, getDoc } from "firebase/firestore";
import { useSearchParams } from "react-router-dom";
import { db } from "../../firebase/firebase";
import { useManuscriptsData } from "../../hooks/useManuscriptsData";
import { useManuscriptStatus } from "../../hooks/useManuscriptStatus";
import { formatFirestoreDate } from "../../hooks/useFirestoreUtils";

import Searchbar from "../Searchbar";
import FilterButtons from "../FilterButtons";
import PaginationControls from "../PaginationControls";
import ManuscriptItem from "./ManuscriptItem";

const Manuscripts = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [manuscriptsPerPage, setManuscriptsPerPage] = useState(10);
  const [showFullName, setShowFullName] = useState(true);
  const [searchParams] = useSearchParams();
  const manuscriptId = searchParams.get('manuscriptId');
  const manuscriptRef = useRef(null);
  
  // Custom hooks (data + actions)
  const { manuscripts, users, user, role, loading } = useManuscriptsData();
  
  // Scroll to specific manuscript if manuscriptId is in URL
  useEffect(() => {
    if (manuscriptId && manuscriptRef.current && manuscripts?.length > 0) {
      // Small timeout to ensure the DOM is fully rendered
      const timer = setTimeout(() => {
        if (manuscriptRef.current) {
          manuscriptRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
          // Highlight the manuscript briefly
          const element = manuscriptRef.current;
          element.classList.add('ring-2', 'ring-blue-500');
          setTimeout(() => {
            if (element) {
              element.classList.remove('ring-2', 'ring-blue-500');
            }
          }, 3000);
        }
      }, 100);
      
      return () => clearTimeout(timer);
    }
  }, [manuscriptId, manuscripts]);
  const { handleStatusChange } = useManuscriptStatus();

  // --- Loading / Access Control ---
  if (loading) {
    return <div className="p-28 text-gray-700">Loading manuscripts...</div>;
  }
  
  if (!user) {
    return (
      <div className="p-28 text-red-600 text-center">
        You must be signed in to view manuscripts. Please refresh the page.
      </div>
    );
  }

  // Handle unassigning a reviewer
  const handleUnassignReviewer = async (manuscriptId, reviewerId = null) => {
    try {
      const msRef = doc(db, "manuscripts", manuscriptId);
      const msDoc = await getDoc(msRef);

      if (!msDoc.exists()) {
        console.error("Manuscript not found");
        return;
      }

      const manuscript = msDoc.data();
      const updatedAssignedReviewers = [
        ...(manuscript.assignedReviewers || []),
      ];
      const updatedAssignedReviewersMeta = {
        ...(manuscript.assignedReviewersMeta || {}),
      };

      if (reviewerId) {
        // Unassign specific reviewer
        const reviewerIndex = updatedAssignedReviewers.indexOf(reviewerId);
        if (reviewerIndex > -1) {
          updatedAssignedReviewers.splice(reviewerIndex, 1);
          delete updatedAssignedReviewersMeta[reviewerId];
        }
      } else {
        // Unassign all reviewers
        updatedAssignedReviewers.length = 0;
        Object.keys(updatedAssignedReviewersMeta).forEach((key) => {
          delete updatedAssignedReviewersMeta[key];
        });
      }

      // Update the manuscript with the new reviewer assignments
      await updateDoc(msRef, {
        assignedReviewers: updatedAssignedReviewers,
        assignedReviewersMeta: updatedAssignedReviewersMeta,
      });

      // Recalculate the manuscript status using handleStatusChange
      if (updatedAssignedReviewers.length > 0) {
        // Check if all remaining reviewers have completed their reviews
        const allReviewersCompleted = updatedAssignedReviewers.every(
          (reviewerId) =>
            manuscript.reviewerSubmissions?.some(
              (submission) =>
                submission.reviewerId === reviewerId &&
                submission.status === "Completed"
            )
        );

        if (allReviewersCompleted) {
          await handleStatusChange(manuscriptId, "Back to Admin", "All reviews completed");
        } else {
          await handleStatusChange(manuscriptId, "Peer Reviewer Reviewing", "Reviewers still working");
        }
      } else {
        // No reviewers left, set to Assigning Peer Reviewer
        await handleStatusChange(manuscriptId, "Assigning Peer Reviewer", "No reviewers assigned");
      }

      console.log(
        reviewerId ? "Reviewer unassigned" : "All reviewers unassigned"
      );
    } catch (error) {
      console.error("Error unassigning reviewer:", error);
      throw error; // Re-throw to handle in the component
    }
  };

  // --- Filter + Search Logic ---
  const filteredManuscripts = manuscripts
    .filter((m) => {
      // For reviewers, show all manuscripts they are assigned to or were previously involved with
      if (role === 'reviewer') {
        const isAssigned = m.assignedReviewers?.includes(user.uid);
        const wasAssigned = (m.previousReviewers || []).includes(user.uid) || 
                          (m.originalAssignedReviewers || []).includes(user.uid);
        const hasSubmittedReview = m.reviewerSubmissions?.some(s => s.reviewerId === user.uid);
        
        console.log('Manuscript in filter:', {
          id: m.id,
          title: m.title || m.manuscriptTitle,
          status: m.status,
          isAssigned,
          wasAssigned,
          hasSubmittedReview,
          assignedReviewers: m.assignedReviewers || [],
          previousReviewers: m.previousReviewers || []
        });

        // Show if:
        // 1. Currently assigned, or
        // 2. Was previously assigned, or
        // 3. Has submitted a review
        const shouldShow = isAssigned || wasAssigned || hasSubmittedReview;
        
        if (!shouldShow) {
          console.log('Hiding manuscript:', m.id, '- No assignment or submission found');
          return false;
        }
        
        console.log('Showing manuscript:', m.id, '-', { isAssigned, wasAssigned, hasSubmittedReview });
        
        // Apply additional filters if selected
        if (filter === "all") return true;
        if (filter === "Pending") return !m.status || m.status === "Pending";
        if (filter === "Rejected") 
          return m.status === "Rejected" || m.status === "Peer Reviewer Rejected";
        if (filter === "Back to Admin") return m.status === "Back to Admin";
        return m.status === filter;
      }
      
      // For other roles (admin, researcher), use the original filtering logic
      if (filter === "all") return true;
      if (filter === "Pending") return !m.status || m.status === "Pending";
      if (filter === "Rejected")
        return m.status === "Rejected" || m.status === "Peer Reviewer Rejected";
      if (filter === "Back to Admin") return m.status === "Back to Admin";
      return m.status === filter;
    })
    .filter((m) => {
      if (!searchQuery) return true;
      const queryWords = searchQuery.toLowerCase().split(" ");
      const manuscriptTitle =
        m.title ||
        m.manuscriptTitle ||
        m.formTitle ||
        m.answeredQuestions?.find((q) =>
          q.question?.toLowerCase().includes("title")
        )?.answer ||
        "Untitled";

      const fields = [
        manuscriptTitle,
        m.firstName,
        m.middleName,
        m.lastName,
        m.role,
        m.email,
        m.submitter,
        m.status,
        ...(m.assignedReviewersData?.map(
          (r) => `${r.firstName} ${r.lastName}`
        ) || []),
        ...(m.answeredQuestions?.map((q) => q.answer?.toString()) || []),
      ];

      return queryWords.every((word) =>
        fields.some((f) => f?.toString().toLowerCase().includes(word))
      );
    });

  const visibleManuscripts = filteredManuscripts.filter(Boolean);

  // --- Pagination ---
  const totalPages = Math.ceil(visibleManuscripts.length / manuscriptsPerPage);
  const indexOfLast = currentPage * manuscriptsPerPage;
  const indexOfFirst = indexOfLast - manuscriptsPerPage;
  const currentManuscripts = visibleManuscripts.slice(
    indexOfFirst,
    indexOfLast
  );
  console.log("Loaded manuscripts:", manuscripts);
  console.log("User:", user);
  console.log("Role:", role);

  // --- UI ---
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
        {currentManuscripts.map((manuscript) => {
          const isTargetManuscript = manuscript.id === manuscriptId;
          return (
            <div 
              key={manuscript.id} 
              ref={isTargetManuscript ? manuscriptRef : null}
              className={isTargetManuscript ? 'transition-all duration-500' : ''}
            >
              <ManuscriptItem
                manuscript={manuscript}
                role={role}
                users={users}
                handleAssign={() => {}}
                unassignReviewer={handleUnassignReviewer}
                showFullName={showFullName}
                setShowFullName={setShowFullName}
                currentUserId={user?.uid}
                formatDate={formatFirestoreDate}
                handleStatusChange={handleStatusChange}
              />
            </div>
          );
        })}
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
