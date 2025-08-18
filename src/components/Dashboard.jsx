import React, { useEffect, useState } from "react";
import { getAuth } from "firebase/auth";
import {
  doc,
  getDoc,
  collection,
  query,
  orderBy,
  getDocs,
  onSnapshot,
  Timestamp,
} from "firebase/firestore";
import { db } from "../firebase/firebase";

const STATUS_ORDER = [
  "Pending",
  "Peer Reviewer",
  "Peer Review Complete",
  "Revisions",
  "Accepted",
  "Rejected",
];

const STATUS_COLORS = {
  Pending: "bg-gray-300",
  "Peer Reviewer": "bg-blue-400",
  "Peer Review Complete": "bg-yellow-400",
  Revisions: "bg-orange-400",
  Accepted: "bg-green-500",
  Rejected: "bg-red-500",
};

const Dashboard = () => {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSubmission, setSelectedSubmission] = useState(null);

  useEffect(() => {
    const auth = getAuth();
    let unsubscribeNotif = null;

    const fetchData = async (currentUser) => {
      try {
        // Get user role
        const userRef = doc(db, "Users", currentUser.uid);
        const docSnap = await getDoc(userRef);
        const userRole = docSnap.exists() ? docSnap.data().role : "User";
        setRole(userRole);

        // Fetch submissions
        const submissionsRef = collection(db, "form_responses");
        const snapshot = await getDocs(
          query(submissionsRef, orderBy("submittedAt", "desc"))
        );
        const allSubs = snapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            submittedAt:
              data.submittedAt instanceof Timestamp
                ? data.submittedAt.toDate()
                : new Date(data.submittedAt?.seconds * 1000 || Date.now()),
          };
        });

        setSubmissions(
          userRole === "Admin"
            ? allSubs
            : allSubs.filter((s) => s.userId === currentUser.uid)
        );

        // Real-time notifications
        const notifRef = collection(db, "Notifications");
        unsubscribeNotif = onSnapshot(notifRef, (snapshot) => {
          const notifs = snapshot.docs.map((doc) => {
            const data = doc.data();
            return {
              id: doc.id,
              ...data,
              timestamp:
                data.timestamp instanceof Timestamp
                  ? data.timestamp.toDate()
                  : new Date(data.timestamp?.seconds * 1000 || Date.now()),
            };
          });
          setNotifications(notifs.sort((a, b) => b.timestamp - a.timestamp));
        });
      } catch (err) {
        console.error("Error fetching dashboard data:", err);
      } finally {
        setLoading(false);
      }
    };

    const unsubscribeAuth = auth.onAuthStateChanged((currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        fetchData(currentUser);
      } else {
        setUser(null);
        setRole(null);
        setSubmissions([]);
        setNotifications([]);
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeNotif) unsubscribeNotif();
    };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[80vh] text-gray-700">
        Loading dashboard...
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center h-[80vh] text-red-600 text-center">
        You must be signed in to view the dashboard.
      </div>
    );
  }

  const calculateProgress = (status) => {
    const idx = STATUS_ORDER.indexOf(status);
    return ((idx + 1) / STATUS_ORDER.length) * 100;
  };

  return (
    <div className="flex flex-col min-h-screen pt-28 px-4 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold mb-6">
        Welcome, {user.displayName || "User"}!
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Submissions Panel */}
        <div className="border p-4 rounded shadow-sm bg-gray-50 w-full">
          <h2 className="text-xl font-semibold mb-4">Submissions</h2>
          {submissions.length === 0 ? (
            <p className="text-gray-600">No submissions found.</p>
          ) : (
            submissions.map((sub) => (
              <div
                key={sub.id}
                className="mb-4 border p-3 rounded bg-white shadow-sm cursor-pointer hover:shadow-md transition"
                onClick={() => setSelectedSubmission(sub)}
              >
                <p className="text-sm text-gray-500 mb-2">
                  {sub.firstName} {sub.lastName} ({sub.role}) —{" "}
                  {sub.submittedAt ? sub.submittedAt.toLocaleString() : "-"}
                </p>
                <div className="flex items-center gap-2">
                  {STATUS_ORDER.map((s, idx) => (
                    <div
                      key={s}
                      className="flex-1 h-2 rounded"
                      style={{
                        backgroundColor:
                          STATUS_ORDER.indexOf(sub.status) >= idx
                            ? STATUS_COLORS[s]
                            : "#e5e7eb",
                      }}
                    ></div>
                  ))}
                </div>
                <p className="text-xs text-right mt-1">
                  {calculateProgress(sub.status).toFixed(0)}%
                </p>
              </div>
            ))
          )}
        </div>

        {/* Notifications Panel */}
        <div className="border p-4 rounded shadow-sm bg-gray-50 w-full">
          <h2 className="text-xl font-semibold mb-4">Notifications</h2>
          {notifications.length === 0 ? (
            <p className="text-gray-600">No notifications</p>
          ) : (
            <ul className="space-y-2 max-h-96 overflow-y-auto">
              {notifications.map((notif) => (
                <li
                  key={notif.id}
                  className="bg-white p-3 rounded shadow-sm hover:bg-gray-100 transition"
                >
                  {notif.message}
                  <p className="text-xs text-gray-400">
                    {notif.timestamp ? notif.timestamp.toLocaleString() : ""}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Manuscripts Panel */}
      <div className="border p-4 rounded shadow-sm bg-gray-50 w-full mb-6">
        <h2 className="text-xl font-semibold mb-4">Manuscripts</h2>
        <p className="text-gray-600">
          Access manuscripts from the sidebar menu.
        </p>
      </div>

      {/* Submission Details Modal */}
      {selectedSubmission && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-lg relative">
            <button
              className="absolute top-3 right-3 text-red-600 font-bold text-xl"
              onClick={() => setSelectedSubmission(null)}
            >
              &times;
            </button>
            <h3 className="text-xl font-semibold mb-4">
              {selectedSubmission.firstName} {selectedSubmission.lastName}
            </h3>
            <p>Status: {selectedSubmission.status}</p>
            <p>Email: {selectedSubmission.email}</p>
            <p>
              Submitted at:{" "}
              {selectedSubmission.submittedAt
                ? selectedSubmission.submittedAt.toLocaleString()
                : "-"}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
