import { useEffect, useState, useCallback } from "react";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import {
  collection,
  getDocs,
  getDoc,
  doc,
  onSnapshot,
} from "firebase/firestore";
import { db } from "../firebase/firebase";

const formatFirestoreDate = (date) => {
  if (!date) return "";
  try {
    const d = date.toDate ? date.toDate() : new Date(date);
    return d.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch (e) {
    return "";
  }
};

export const useManuscriptsData = () => {
  const [manuscripts, setManuscripts] = useState([]);
  const [users, setUsers] = useState([]);
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const auth = getAuth();

  const processManuscripts = useCallback((snapshot, currentUser, userRole, allUsers) => {
    if (!snapshot || !snapshot.docs) return [];

    const allMss = snapshot.docs.map((doc) => {
      const data = doc.data() || {};
      const id = doc.id;

      // Process reviewer data
      const allReviewerIds = [
        ...(data.assignedReviewers || []),
        ...(data.originalAssignedReviewers || []),
      ];
      const uniqueReviewerIds = [...new Set(allReviewerIds)];

      const assignedReviewersData = uniqueReviewerIds
        .map((reviewerId) => {
          const reviewer = allUsers.find((u) => u.id === reviewerId);
          const meta =
            data.assignedReviewersMeta?.[reviewerId] ||
            data.originalAssignedReviewersMeta?.[reviewerId] ||
            {};
          const decisionMeta = data.reviewerDecisionMeta?.[reviewerId] || {};

          return {
            id: reviewerId,
            firstName: reviewer?.firstName || "",
            middleName: reviewer?.middleName || "",
            lastName: reviewer?.lastName || "",
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

      let manuscript = { id, ...data, assignedReviewersData };

      // Role-based filtering
      if (userRole === "Peer Reviewer") {
        manuscript.assignedReviewersData = assignedReviewersData.filter(
          (r) => r.id === currentUser?.uid
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
      } else if (userRole === "Researcher") {
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
    const myId = currentUser?.uid;

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

    return filtered;
  }, []);

  useEffect(() => {
    let unsubscribeManuscripts = () => {};
    let isMounted = true;

    const initialize = async () => {
      try {
        // Set up auth state listener
        const authUnsubscribe = onAuthStateChanged(auth, async (currentUser) => {
          if (!currentUser) {
            if (isMounted) {
              setUser(null);
              setRole(null);
              setManuscripts([]);
              setLoading(false);
            }
            return;
          }

          if (isMounted) {
            setUser(currentUser);
            setLoading(true);
          }

          try {
            // Fetch all users
            const usersSnap = await getDocs(collection(db, "Users"));
            const allUsers = usersSnap.docs.map((d) => ({
              id: d.id,
              ...d.data()
            }));

            if (isMounted) {
              setUsers(allUsers);
            }

            // Fetch current user's role
            const userRef = doc(db, "Users", currentUser.uid);
            const docSnap = await getDoc(userRef);
            const userRole = docSnap.exists() ? docSnap.data().role : "User";

            if (isMounted) {
              setRole(userRole);
            }

            // Set up real-time listener for manuscripts
            const manuscriptsRef = collection(db, "manuscripts");
            unsubscribeManuscripts = onSnapshot(
              manuscriptsRef,
              (snapshot) => {
                if (isMounted) {
                  const processed = processManuscripts(
                    snapshot,
                    currentUser,
                    userRole,
                    allUsers
                  );
                  setManuscripts(processed);
                  setLoading(false);
                }
              },
              (error) => {
                console.error("Error fetching manuscripts:", error);
                if (isMounted) {
                  setLoading(false);
                }
              }
            );

            return () => {
              authUnsubscribe();
              unsubscribeManuscripts();
            };
          } catch (error) {
            console.error("Error initializing data:", error);
            if (isMounted) {
              setLoading(false);
            }
          }
        });
      } catch (error) {
        console.error("Error in useManuscriptsData:", error);
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    initialize();

    return () => {
      isMounted = false;
      unsubscribeManuscripts();
    };
  }, [auth, processManuscripts]);

  return {
    manuscripts,
    users,
    user,
    role,
    userId: user?.uid,
    loading,
    formatFirestoreDate,
  };
};
