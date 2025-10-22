import { useEffect, useState } from "react";
import { getAuth } from "firebase/auth";
import {
  collection,
  getDocs,
  getDoc,
  doc,
  onSnapshot,
} from "firebase/firestore";
import { db } from "../firebase/firebase";
import { formatFirestoreDate } from "./useFirestoreUtils";

export const useManuscriptsData = () => {
  const [manuscripts, setManuscripts] = useState([]);
  const [users, setUsers] = useState([]);
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [userId, setUserId] = useState(null);
  const [loading, setLoading] = useState(true);

  const auth = getAuth();

  useEffect(() => {
    const fetchData = async (currentUser) => {
      try {
        // Fetch all users
        const usersSnap = await getDocs(collection(db, "Users"));
        const allUsers = usersSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setUsers(allUsers);

        // Fetch current user's role
        const userRef = doc(db, "Users", currentUser.uid);
        const docSnap = await getDoc(userRef);
        const userRole = docSnap.exists() ? docSnap.data().role : "User";
        setRole(userRole);
        setUser(currentUser);
        setUserId(currentUser.uid);

        // Subscribe to manuscripts
        const manuscriptsRef = collection(db, "manuscripts");
        const unsubscribeManuscripts = onSnapshot(
          manuscriptsRef,
          (snapshot) => {
            const allMss = snapshot.docs.map((doc) => {
              const data = doc.data() || {};

              // Combine all reviewer IDs
              const allReviewerIds = [
                ...(data.assignedReviewers || []),
                ...(data.originalAssignedReviewers || []),
              ];
              const uniqueReviewerIds = [...new Set(allReviewerIds)];

              // Build reviewer metadata
              const assignedReviewersData = uniqueReviewerIds
                .map((id) => {
                  const user = allUsers.find((u) => u.id === id);
                  const meta =
                    data.assignedReviewersMeta?.[id] ||
                    data.originalAssignedReviewersMeta?.[id] ||
                    {};
                  const decisionMeta = data.reviewerDecisionMeta?.[id] || {};

                  return {
                    id,
                    firstName: user?.firstName || "",
                    middleName: user?.middleName || "",
                    lastName: user?.lastName || "",
                    assignedAt: meta.assignedAt || null,
                    assignedBy: meta.assignedBy || "—",
                    decision: decisionMeta.decision || null,
                    decidedAt: decisionMeta.decidedAt || null,
                  };
                })
                .sort(
                  (a, b) =>
                    (a.assignedAt?.toDate?.()?.getTime?.() || 0) -
                    (b.assignedAt?.toDate?.()?.getTime?.() || 0)
                );

              let manuscript = { id: doc.id, ...data, assignedReviewersData };

              // Role-based filtering
              if (userRole === "Peer Reviewer") {
                manuscript.assignedReviewersData = assignedReviewersData.filter(
                  (r) => r.id === currentUser.uid
                );
                // Hide author info
                Object.assign(manuscript, {
                  userId: undefined,
                  firstName: undefined,
                  middleName: undefined,
                  lastName: undefined,
                  email: undefined,
                  submitter: undefined,
                });
              }

           if (userRole === "Researcher") {
  // For researchers, include all reviewer data but anonymize it
  manuscript.assignedReviewersData = assignedReviewersData.map((r, idx) => ({
    ...r,
    id: `reviewer-${idx + 1}`, // Anonymize ID
    firstName: 'Reviewer',
    middleName: '',
    lastName: `${idx + 1}`,
    email: '',
    assignedBy: 'System',
    // Preserve the decision status for display
    decision: r.decision,
    decidedAt: r.decidedAt
  }));
}

              return manuscript;
            });

            // Filter manuscripts by user role
            let filtered = allMss;
            const myId = currentUser.uid;

            if (userRole === "Peer Reviewer") {
              filtered = allMss.filter((m) => {
                const myDecision = m.reviewerDecisionMeta?.[myId]?.decision;
                const isAssigned =
                  (m.assignedReviewers || []).includes(myId) ||
                  (m.originalAssignedReviewers || []).includes(myId);
                const hasSubmitted = m.reviewerSubmissions?.some(
                  (s) => s.reviewerId === myId
                );

                if (!(isAssigned || hasSubmitted || myDecision)) return false;

                if (m.status === "For Publication") {
                  return hasSubmitted || myDecision === "publication" || 
                         myDecision === "minor" || 
                         myDecision === "major";
                }
                if (["Rejected", "Peer Reviewer Rejected"].includes(m.status))
                  return myDecision === "reject";

                return true;
              });
            } else if (userRole === "Researcher") {
              filtered = allMss.filter(
                (m) =>
                  m.userId === myId ||
                  m.submitterId === myId ||
                  (m.coAuthorsIds || []).includes(myId) ||
                  (m.assignedReviewers || []).includes(myId)
              );
            }

            // Sort by submission or acceptance date
            filtered.sort((a, b) => {
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

            setManuscripts(filtered);
            setLoading(false);
          }
        );

        return unsubscribeManuscripts;
      } catch (error) {
        console.error("Error fetching manuscripts:", error);
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

    return () => unsubscribeAuth();
  }, [auth]); // ✅ Removed showFullName to prevent redundant fetches

  return {
    manuscripts,
    users,
    user,
    role,
    userId,
    loading,
    formatFirestoreDate,
  };
};
