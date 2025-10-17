import { useState } from "react";
import { doc, updateDoc, getDoc } from "firebase/firestore";
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

  // Custom hooks (data + actions)
  const { manuscripts, users, user, role, loading } =
    useManuscriptsData(showFullName);
  const { handleStatusChange } = useManuscriptStatus();

  // --- Loading / Access Control ---
  if (loading)
    return <div className="p-28 text-gray-700">Loading manuscripts...</div>;
  if (!user)
    return (
      <div className="p-28 text-red-600 text-center">
        You must be signed in to view manuscripts.
      </div>
    );

  // In Manuscripts.jsx, add this function
  const handleUnassignReviewer = async (manuscriptId, reviewerId = null) => {
    try {
      const msRef = doc(db, "manuscripts", manuscriptId);
      const msDoc = await getDoc(msRef);

      if (!msDoc.exists()) {
        console.error("Manuscript not found");
        return;
      }

      const manuscript = msDoc.data();
      const updatedAssignedReviewers = [...(manuscript.assignedReviewers || [])];
      const updatedAssignedReviewersMeta = { ...(manuscript.assignedReviewersMeta || {}) };

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

      const updateData = {
        assignedReviewers: updatedAssignedReviewers,
        assignedReviewersMeta: updatedAssignedReviewersMeta,
      };

      // Check if there are still reviewers assigned
      if (updatedAssignedReviewers.length > 0) {
        // Check if all remaining reviewers have completed their reviews
        const allReviewersCompleted = updatedAssignedReviewers.every(reviewerId => 
          manuscript.assignedReviewersMeta?.[reviewerId]?.status === 'completed'
        );

        if (allReviewersCompleted) {
          updateData.status = "Back to Admin";
        }
      } else {
        // No reviewers left, set to Assigning Peer Reviewer
        updateData.status = "Assigning Peer Reviewer";
      }

      await updateDoc(msRef, updateData);

      console.log(reviewerId ? "Reviewer unassigned" : "All reviewers unassigned");
    } catch (error) {
      console.error("Error unassigning reviewer:", error);
      throw error; // Re-throw to handle in the component
    }
  };

  // --- Filter + Search Logic ---
  const filteredManuscripts = manuscripts
    .filter((m) => {
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
        {currentManuscripts.map((m) => (
          <ManuscriptItem
            key={m.id}
            manuscript={m}
            role={role}
            users={users}
            showFullName={showFullName}
            setShowFullName={setShowFullName}
            formatDate={formatFirestoreDate} // Add this line
            handleStatusChange={handleStatusChange}
            // Add these if they're needed
            handleAssign={() => {}} // Add actual implementation
            unassignReviewer={handleUnassignReviewer}
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
