import React, { useEffect, useState } from "react";
import { getAuth } from "firebase/auth";
import { doc, getDoc, collection, onSnapshot } from "firebase/firestore";
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

const Dashboard = ({ sidebarOpen }) => {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [manuscripts, setManuscripts] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const auth = getAuth();
    let unsubscribeMss = null;

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
        const userRole = docSnap.exists() ? docSnap.data().role : "User";
        setRole(userRole);

        const manuscriptsRef = collection(db, "manuscripts");

        unsubscribeMss = onSnapshot(manuscriptsRef, (snapshot) => {
          const allMss = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }));

          allMss.sort(
            (a, b) =>
              (b.submittedAt?.seconds || 0) - (a.submittedAt?.seconds || 0)
          );

          setManuscripts(
            userRole === "Admin"
              ? allMss
              : allMss.filter(
                  (m) =>
                    m.userId === currentUser.uid ||
                    m.coAuthors?.some((c) => c.id === currentUser.uid) ||
                    m.assignedReviewers?.includes(currentUser.uid)
                )
          );
        });
      } catch (err) {
        console.error("Error fetching manuscripts:", err);
      } finally {
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeMss) unsubscribeMss();
    };
  }, []);

  if (loading)
    return <div className="p-28 text-gray-700">Loading dashboard...</div>;
  if (!user)
    return (
      <div className="p-28 text-red-600 text-center">
        You must be signed in to view the dashboard.
      </div>
    );

  // Count manuscripts by custom status logic
  const countByCustomStatus = (status) => {
    if (status === "In Progress") {
      return manuscripts.filter((m) => IN_PROGRESS_STATUSES.includes(m.status))
        .length;
    }
    if (status === "Rejected") {
      return manuscripts.filter((m) => m.status === "Rejected").length;
    }
    if (status === "For Publication") {
      return manuscripts.filter((m) => m.status === "For Publication").length;
    }
    return 0;
  };

  const handleStatusClick = (status) => {
    navigate(`/manuscripts?status=${status}`);
  };

  return (
    <div
      className={`flex flex-col min-h-screen pt-24 px-4 sm:px-6 lg:px-24 ${
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
      {manuscripts.map((m) => (
        <div
          key={m.id}
          className="mb-4 border p-4 rounded bg-gray-50 shadow-sm"
        >
          <p className="font-semibold">{m.formTitle}</p>
          <p className="text-sm text-gray-500 mb-2">
            Submitted on:{" "}
            {m.submittedAt?.toDate
              ? m.submittedAt.toDate().toLocaleString()
              : new Date(m.submittedAt.seconds * 1000).toLocaleString()}
          </p>
          {/* Pass the custom in-progress logic to ProgressBar */}
          <Progressbar
            currentStatus={m.status}
            inProgressStatuses={IN_PROGRESS_STATUSES}
          />
        </div>
      ))}
    </div>
  );
};

export default Dashboard;
