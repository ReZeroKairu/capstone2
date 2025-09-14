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

const IN_PROGRESS_STATUSES = [
  "Pending",
  "Assigning Peer Reviewer",
  "Peer Reviewer Assigned",
  "Peer Reviewer Reviewing",
  "Back to Admin",
  "For Revision",
];

const STATUS_STEPS = [
  "Pending",
  "Assigning Peer Reviewer",
  "Peer Reviewer Assigned",
  "Peer Reviewer Reviewing",
  "Back to Admin",
  "For Revision",
  "For Publication",
  "Rejected",
];

const Dashboard = ({ sidebarOpen }) => {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [manuscripts, setManuscripts] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const auth = getAuth();
    let unsubscribes = [];

    const unsubscribeAuth = auth.onAuthStateChanged(async (currentUser) => {
      if (!currentUser) {
        setUser(null);
        setRole(null);
        setManuscripts([]);
        setLoading(false);
        return;
      }

      setUser(currentUser);

      try {
        const userRef = doc(db, "Users", currentUser.uid);
        const docSnap = await getDoc(userRef);
        const userRole = docSnap.exists() ? docSnap.data().role : "Researcher";
        setRole(userRole);

        const manuscriptsRef = collection(db, "manuscripts");

        if (userRole === "Admin") {
          const q = query(manuscriptsRef, orderBy("submittedAt", "desc"));
          const unsub = onSnapshot(q, (snapshot) => {
            setManuscripts(
              snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))
            );
          });
          unsubscribes.push(unsub);
          return;
        }

        if (userRole === "Peer Reviewer") {
          const q = query(
            manuscriptsRef,
            where("assignedReviewers", "array-contains", currentUser.uid),
            orderBy("submittedAt", "desc")
          );
          const unsub = onSnapshot(q, (snapshot) => {
            setManuscripts(
              snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))
            );
          });
          unsubscribes.push(unsub);
          return;
        }

        // ---------- Researcher Logic ----------
        const localMap = new Map();

        const mergeAndSet = () => {
          const merged = Array.from(localMap.values());
          merged.sort(
            (a, b) =>
              (b.submittedAt?.seconds || 0) - (a.submittedAt?.seconds || 0)
          );
          setManuscripts(merged);
        };

        const qOwn = query(
          manuscriptsRef,
          where("userId", "==", currentUser.uid),
          orderBy("submittedAt", "desc")
        );
        const qAssigned = query(
          manuscriptsRef,
          where("assignedReviewers", "array-contains", currentUser.uid),
          orderBy("submittedAt", "desc")
        );
        const qRecent = query(
          manuscriptsRef,
          orderBy("submittedAt", "desc"),
          limit(50)
        );

        const unsubOwn = onSnapshot(qOwn, (snap) => {
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

        const unsubRecent = onSnapshot(qRecent, (snap) => {
          const email = currentUser.email || "";
          const name =
            currentUser.displayName ||
            `${currentUser.firstName || ""} ${
              currentUser.lastName || ""
            }`.trim();

          snap.docs.forEach((d) => {
            const data = { id: d.id, ...d.data() };
            if (localMap.has(d.id)) return; // Already added

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

        unsubscribes.push(unsubOwn, unsubAssigned, unsubRecent);
      } catch (err) {
        console.error("Error fetching manuscripts:", err);
      } finally {
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      unsubscribes.forEach((u) => u && u());
    };
  }, []);

  // Memoized counts for summary cards
  const memoizedCounts = useMemo(
    () => ({
      inProgress: manuscripts.filter((m) =>
        IN_PROGRESS_STATUSES.includes(m.status)
      ).length,
      rejected: manuscripts.filter((m) => m.status === "Rejected").length,
      forPublication: manuscripts.filter((m) => m.status === "For Publication")
        .length,
    }),
    [manuscripts]
  );

  if (loading)
    return <div className="p-28 text-gray-700">Loading dashboard...</div>;
  if (!user)
    return (
      <div className="p-28 text-red-600 text-center">
        You must be signed in to view the dashboard.
      </div>
    );

  const handleStatusClick = (status) => {
    navigate(`/manuscripts?status=${encodeURIComponent(status)}`);
  };

  return (
    <div
      className={`flex flex-col min-h-screen pb-36 pt-40 px-4 sm:px-6 lg:px-24 ${
        sidebarOpen ? "lg:pl-64" : ""
      }`}
    >
      <h1 className="text-3xl font-bold mb-6 text-center sm:text-left">
        Welcome, {user.displayName || "User"}!
      </h1>

      {/* Summary Counts */}
      <div className="grid grid-cols-1 sm:grid-cols-5 gap-4 mb-6">
        {[
          { label: "In Progress", count: memoizedCounts.inProgress },
          { label: "For Publication", count: memoizedCounts.forPublication },
          { label: "Rejected", count: memoizedCounts.rejected },
        ].map(({ label, count }) => (
          <div
            key={label}
            className="bg-gray-100 p-4 rounded shadow-sm cursor-pointer hover:shadow-md text-center"
            onClick={() => handleStatusClick(label)}
          >
            <p className="text-lg font-semibold">{label}</p>
            <p className="text-2xl font-bold">{count}</p>
          </div>
        ))}
      </div>

      {/* Manuscript List */}
      {manuscripts.map((m) => {
        const manuscriptTitle =
          m.manuscriptTitle ||
          m.title ||
          m.answeredQuestions
            ?.find((q) =>
              q.question?.toLowerCase().trim().startsWith("manuscript title")
            )
            ?.answer?.toString() ||
          m.formTitle ||
          "Untitled";

        const submittedAtText = m.submittedAt?.toDate
          ? m.submittedAt.toDate().toLocaleString()
          : m.submittedAt?.seconds
          ? new Date(m.submittedAt.seconds * 1000).toLocaleString()
          : "";

        const stepIndex = Math.max(
          0,
          STATUS_STEPS.indexOf(
            typeof m.status === "string" ? m.status : "Pending"
          )
        );

        return (
          <div
            key={m.id}
            className="mb-4 border p-4 rounded bg-gray-50 shadow-sm"
          >
            <p className="font-semibold">{manuscriptTitle}</p>
            <p className="text-sm text-gray-500 mb-2">
              Submitted on: {submittedAtText}
            </p>

            <Progressbar
              currentStep={stepIndex}
              steps={STATUS_STEPS}
              currentStatus={m.status} // Pass the actual status
            />
          </div>
        );
      })}
    </div>
  );
};

export default Dashboard;
