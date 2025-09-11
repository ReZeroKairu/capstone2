import React, { useEffect, useState } from "react";
import { getAuth } from "firebase/auth";
import {
  doc,
  getDoc,
  collection,
  onSnapshot,
  query,
  where,
  orderBy,
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
        // fetch role
        const userRef = doc(db, "Users", currentUser.uid);
        const docSnap = await getDoc(userRef);
        const userRole = docSnap.exists() ? docSnap.data().role : "Researcher";
        setRole(userRole);

        const manuscriptsRef = collection(db, "manuscripts");

        // Admin: listen to all manuscripts
        if (userRole === "Admin") {
          const q = query(manuscriptsRef, orderBy("submittedAt", "desc"));
          const unsub = onSnapshot(q, (snapshot) => {
            const all = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
            setManuscripts(all);
          });
          unsubscribes.push(unsub);
          return;
        }

        // Peer Reviewer: only assigned to them
        if (userRole === "Peer Reviewer") {
          const q = query(
            manuscriptsRef,
            where("assignedReviewers", "array-contains", currentUser.uid),
            orderBy("submittedAt", "desc")
          );
          const unsub = onSnapshot(q, (snapshot) => {
            const arr = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
            setManuscripts(arr);
          });
          unsubscribes.push(unsub);
          return;
        }

        // Researcher (and fallback): use two queries (own submissions + co-author) and merge
        // Note: this tries to match common co-author storage patterns:
        // - m.coAuthors array with {id,...}
        // - m.answeredQuestions coauthors text that may include email/name
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

        const localMap = new Map(); // id -> manuscript

        const mergeAndSet = () => {
          const merged = Array.from(localMap.values());
          merged.sort(
            (a, b) =>
              (b.submittedAt?.seconds || 0) - (a.submittedAt?.seconds || 0)
          );
          setManuscripts(merged);
        };

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

        // As a fallback to catch manuscripts where co-authors are saved only in answeredQuestions
        // we also listen to a small recent set and merge client-side (works for small projects)
        const qRecent = query(manuscriptsRef, orderBy("submittedAt", "desc"));
        const unsubRecent = onSnapshot(qRecent, (snap) => {
          const email = currentUser.email || "";
          const name =
            currentUser.displayName ||
            `${currentUser.firstName || ""} ${
              currentUser.lastName || ""
            }`.trim();
          snap.docs.forEach((d) => {
            const data = { id: d.id, ...d.data() };
            const already = localMap.has(d.id);
            if (already) return;
            const isCoAuthor =
              data.coAuthors?.some?.((c) => c.id === currentUser.uid) ||
              data.answeredQuestions?.some(
                (q) =>
                  q.type === "coauthors" &&
                  (Array.isArray(q.answer)
                    ? q.answer.some(
                        (a) =>
                          (email && a.includes(email)) ||
                          (name && a.includes(name))
                      )
                    : typeof q.answer === "string" &&
                      ((email && q.answer.includes(email)) ||
                        (name && q.answer.includes(name))))
              );
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading)
    return <div className="p-28 text-gray-700">Loading dashboard...</div>;
  if (!user)
    return (
      <div className="p-28 text-red-600 text-center">
        You must be signed in to view the dashboard.
      </div>
    );

  const countByCustomStatus = (status) => {
    if (status === "In Progress")
      return manuscripts.filter((m) => IN_PROGRESS_STATUSES.includes(m.status))
        .length;
    if (status === "Rejected")
      return manuscripts.filter((m) => m.status === "Rejected").length;
    if (status === "For Publication")
      return manuscripts.filter((m) => m.status === "For Publication").length;
    return 0;
  };

  const handleStatusClick = (status) => {
    navigate(`/manuscripts?status=${encodeURIComponent(status)}`);
  };

  return (
    <div
      className={`flex flex-col min-h-screen pb-36 pt-24 px-4 sm:px-6 lg:px-24 ${
        sidebarOpen ? "lg:pl-64" : ""
      }`}
    >
      <h1 className="text-3xl font-bold mb-6 text-center sm:text-left">
        Welcome, {user.displayName || "User"}!
      </h1>

      {/* Summary Counts */}
      <div className="grid grid-cols-1 sm:grid-cols-5 gap-4 mb-6">
        {["In Progress", "For Publication", "Rejected"].map((status) => (
          <div
            key={status}
            className="bg-gray-100 p-4 rounded shadow-sm cursor-pointer hover:shadow-md text-center"
            onClick={() => handleStatusClick(status)}
          >
            <p className="text-lg font-semibold">{status}</p>
            <p className="text-2xl font-bold">{countByCustomStatus(status)}</p>
          </div>
        ))}
      </div>

      {/* Manuscript List */}
      {manuscripts.map((m) => {
        const manuscriptTitle =
          m.manuscriptTitle ||
          m.title ||
          m.answeredQuestions?.find((q) =>
            q.question?.toLowerCase().trim().startsWith("manuscript title")
          )?.answer ||
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
              currentStatus={m.status}
              inProgressStatuses={IN_PROGRESS_STATUSES}
              currentStep={stepIndex}
              steps={STATUS_STEPS}
            />
          </div>
        );
      })}
    </div>
  );
};

export default Dashboard;
