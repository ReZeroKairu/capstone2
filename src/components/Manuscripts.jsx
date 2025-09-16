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

  // --- Helper function for consistent Firestore timestamp display ---
  const formatFirestoreDate = (ts) =>
    ts?.toDate?.()
      ? ts.toDate().toLocaleString()
      : ts instanceof Date
      ? ts.toLocaleString()
      : "N/A";

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

  const unassignReviewer = async (manuscriptId, reviewerId = null) => {
    try {
      const msRef = doc(db, "manuscripts", manuscriptId);
      const msSnap = await getDoc(msRef);
      if (!msSnap.exists()) return;

      const data = msSnap.data();
      let assigned = data.assignedReviewers || [];
      let assignedMeta = { ...(data.assignedReviewersMeta || {}) };
      let reviewerDecisionMeta = { ...(data.reviewerDecisionMeta || {}) };

      let newStatus = data.status;

      if (!reviewerId) {
        // Remove ALL reviewers
        assigned = [];
        assignedMeta = {};
        reviewerDecisionMeta = {};

        newStatus = "Assigning Peer Reviewer";

        // Delete the nested map entirely and set assigned arrays empty
        await updateDoc(msRef, {
          assignedReviewers: [],
          assignedReviewersMeta: {},
          // remove entire reviewerDecisionMeta field (clean)
          reviewerDecisionMeta: deleteField(),
          status: newStatus,
        });

        // update local state
        setManuscripts((prev) =>
          prev.map((m) =>
            m.id === manuscriptId
              ? {
                  ...m,
                  assignedReviewers: [],
                  assignedReviewersMeta: {},
                  reviewerDecisionMeta: undefined,
                  status: newStatus,
                }
              : m
          )
        );
        return;
      }

      // else: remove a single reviewer
      assigned = assigned.filter((id) => id !== reviewerId);
      delete assignedMeta[reviewerId];
      delete reviewerDecisionMeta[reviewerId]; // local object updated

      // Determine new status based on remaining reviewers/decisions
      if (assigned.length === 0) {
        newStatus = "Assigning Peer Reviewer";
      } else {
        // Look at remaining decisions (if any)
        const remainingDecisions = Object.values(reviewerDecisionMeta || {});
        const activeDecisions = remainingDecisions.filter(
          (meta) => meta && meta.decision && meta.decision !== "backedOut"
        );

        if (activeDecisions.length === 0) {
          newStatus = "Assigning Peer Reviewer";
        } else if (activeDecisions.some((d) => d.decision === "reject")) {
          newStatus = "Peer Reviewer Rejected";
        } else if (activeDecisions.some((d) => d.decision === "accept")) {
          newStatus = "Peer Reviewer Reviewing";
        } else {
          newStatus = "Peer Reviewer Assigned";
        }
      }

      // Use deleteField to force Firestore to remove the nested keys for this reviewer
      const updates = {
        assignedReviewers: assigned,
        status: newStatus,
      };
      updates[`assignedReviewersMeta.${reviewerId}`] = deleteField();
      updates[`reviewerDecisionMeta.${reviewerId}`] = deleteField();

      await updateDoc(msRef, updates);

      // update local state
      setManuscripts((prev) =>
        prev.map((m) =>
          m.id === manuscriptId
            ? {
                ...m,
                assignedReviewers: assigned,
                assignedReviewersMeta: assignedMeta,
                // keep reviewerDecisionMeta with deleted key removed locally
                reviewerDecisionMeta:
                  Object.keys(reviewerDecisionMeta).length > 0
                    ? reviewerDecisionMeta
                    : undefined,
                status: newStatus,
              }
            : m
        )
      );
    } catch (err) {
      console.error("Error unassigning reviewer:", err);
    }
  };

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
              if (data.assignedReviewers?.length > 0) {
                assignedReviewersData = data.assignedReviewers
                  .map((id) => {
                    const u = allUsers.find((user) => user.id === id);
                    const meta = data.assignedReviewersMeta?.[id] || {};
                    const assignedByUser = allUsers.find(
                      (user) => user.id === meta.assignedBy
                    );
                    const decisionMeta = data.reviewerDecisionMeta?.[id] || {};

                    return {
                      id,
                      firstName: u?.firstName || "",
                      middleName: u?.middleName || "",
                      lastName: u?.lastName || "",
                      assignedAt: meta.assignedAt || null,
                      assignedBy: assignedByUser
                        ? `${assignedByUser.firstName} ${
                            assignedByUser.middleName
                              ? assignedByUser.middleName + " "
                              : ""
                          }${assignedByUser.lastName}`
                        : "—",
                      decision: decisionMeta.decision || null,
                      decidedAt: decisionMeta.decidedAt || null,
                    };
                  })
                  .sort((a, b) => {
                    const aTime = a.assignedAt?.toDate?.()?.getTime?.() || 0;
                    const bTime = b.assignedAt?.toDate?.()?.getTime?.() || 0;
                    return aTime - bTime;
                  });

                // Peer Reviewer: only see own record
                if (userRole === "Peer Reviewer") {
                  assignedReviewersData = assignedReviewersData.filter(
                    (r) => r.id === currentUser.uid
                  );
                }
              }

              const coAuthorsIds = Array.isArray(data.coAuthorsIds)
                ? data.coAuthorsIds.map((c) =>
                    typeof c === "string" ? c : c.id
                  )
                : [];

              let filteredData = {
                ...data,
                assignedReviewersData,
                coAuthorsIds,
              };

              // --- DOUBLE-BLIND: hide author info for peer reviewers ---
              if (userRole === "Peer Reviewer") {
                filteredData.userId = undefined;
                filteredData.coAuthorsIds = undefined;
                filteredData.firstName = undefined;
                filteredData.middleName = undefined;
                filteredData.lastName = undefined;
                filteredData.email = undefined;
                filteredData.submitter = undefined;
              }

              // Researchers should not see reviewer data
              if (userRole === "Researcher") {
                filteredData.assignedReviewersData = [];
              }

              return { id: doc.id, ...filteredData };
            })
            .filter((m) => {
              if (userRole === "Admin") return true;

              if (userRole === "Peer Reviewer") {
                return (m.assignedReviewers || []).includes(currentUser.uid);
              }

              // Researchers see their own manuscripts or where they are co-authors
              return (
                m.userId === currentUser.uid ||
                (m.coAuthorsIds || []).includes(currentUser.uid)
              );
            });

          allMss.sort((a, b) => {
            const aTime =
              a.acceptedAt?.toDate?.()?.getTime?.() ||
              a.submittedAt?.toDate?.()?.getTime?.() ||
              0;
            const bTime =
              b.acceptedAt?.toDate?.()?.getTime?.() ||
              b.submittedAt?.toDate?.()?.getTime?.() ||
              0;
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

  if (loading)
    return <div className="p-28 text-gray-700">Loading manuscripts...</div>;
  if (!user)
    return (
      <div className="p-28 text-red-600 text-center">
        You must be signed in to view manuscripts.
      </div>
    );

  const filteredManuscripts = manuscripts
    .filter((m) => {
      if (filter === "all") return m.status !== "Pending";
      if (filter === "Rejected")
        return m.status === "Rejected" || m.status === "Peer Reviewer Rejected";
      return m.status === filter;
    })
    .filter((m) => {
      if (!searchQuery) return true;
      const queryWords = searchQuery.toLowerCase().split(" ");
      const manuscriptTitle = m.title || "Untitled";
      const fields = [
        manuscriptTitle,
        m.firstName,
        m.middleName,
        m.lastName,
        m.role,
        m.email,
        m.submitter,
      ];
      return queryWords.every((word) =>
        fields.some((f) => f?.toLowerCase().includes(word))
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
            formatFirestoreDate={formatFirestoreDate} // optional helper prop
            // expanded & showAssignList are now LOCAL state inside ManuscriptItem
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
