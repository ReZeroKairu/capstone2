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
} from "firebase/firestore";
import { db } from "../firebase/firebase";

import Searchbar from "./Searchbar";
import FilterButtons from "./FilterButtons";
import ManuscriptItem from "./ManuscriptItem";
import PaginationControls from "./PaginationControls";

const Manuscripts = () => {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [manuscripts, setManuscripts] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState({});
  const [showAssignList, setShowAssignList] = useState({});
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

  const toggleExpand = (id) =>
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  const toggleAssignList = (id) =>
    setShowAssignList((prev) => ({ ...prev, [id]: !prev[id] }));

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
          assignedAt: serverTimestamp(), // Firestore Timestamp
          assignedBy: user.uid,
        };

        await updateDoc(msRef, {
          assignedReviewers: assigned,
          assignedReviewersMeta: assignedMeta,
          status: "Peer Reviewer Assigned",
        });
      }
      setShowAssignList((prev) => ({ ...prev, [manuscriptId]: false }));
    } catch (err) {
      console.error("Error assigning reviewer:", err);
    }
  };

  const unassignReviewer = async (manuscriptId) => {
    try {
      const msRef = doc(db, "manuscripts", manuscriptId);
      await updateDoc(msRef, {
        assignedReviewers: [],
        assignedReviewersMeta: {},
        status: "Assigning Peer Reviewer",
      });
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

        const manuscriptsRef = collection(db, "manuscripts");
        // --- Only change is inside onSnapshot mapping ---
        // assignedReviewersData is now sorted by assignedAt
        unsubscribeManuscripts = onSnapshot(manuscriptsRef, (snapshot) => {
          const allMss = snapshot.docs
            .map((doc) => {
              const data = doc.data() || {};

              // Map assigned reviewers with metadata and consistent timestamps
              const assignedReviewersData =
                userRole === "Admin"
                  ? (data.assignedReviewers || [])
                      .map((id) => {
                        const u = allUsers.find((user) => user.id === id);
                        const meta = data.assignedReviewersMeta?.[id] || {};
                        const assignedByUser = allUsers.find(
                          (user) => user.id === meta.assignedBy
                        );

                        return {
                          id,
                          firstName: u?.firstName || "",
                          middleName: u?.middleName || "",
                          lastName: u?.lastName || "",
                          assignedAt: meta.assignedAt || null, // Firestore Timestamp
                          assignedBy: assignedByUser
                            ? `${assignedByUser.firstName} ${
                                assignedByUser.middleName
                                  ? assignedByUser.middleName + " "
                                  : ""
                              }${assignedByUser.lastName}`
                            : "—",
                        };
                      })
                      .sort((a, b) => {
                        const aTime =
                          a.assignedAt?.toDate?.()?.getTime?.() || 0;
                        const bTime =
                          b.assignedAt?.toDate?.()?.getTime?.() || 0;
                        return aTime - bTime; // ascending: oldest assigned first
                      })
                  : [];

              const coAuthorsIds = Array.isArray(data.coAuthorsIds)
                ? data.coAuthorsIds.map((c) =>
                    typeof c === "string" ? c : c.id
                  )
                : [];

              return {
                id: doc.id,
                ...data,
                assignedReviewersData,
                coAuthorsIds,
              };
            })
            .filter((m) => {
              if (userRole === "Admin") return true;
              return (
                m.submitterId === currentUser.uid ||
                m.coAuthorsIds.includes(currentUser.uid)
              );
            });

          // Keep global manuscript order unchanged (by submittedAt / acceptedAt)
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
    .filter((m) =>
      filter === "all" ? m.status !== "Pending" : m.status === filter
    )
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
            expanded={expanded[m.id]}
            toggleExpand={() => toggleExpand(m.id)}
            showAssignList={showAssignList[m.id]}
            toggleAssignList={() => toggleAssignList(m.id)}
            handleAssign={handleAssign}
            unassignReviewer={unassignReviewer}
            showFullName={showFullName}
            setShowFullName={setShowFullName}
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
