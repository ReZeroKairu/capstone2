import React, { useEffect, useState } from "react";
import { getAuth } from "firebase/auth";
import { doc, getDoc, collection, onSnapshot } from "firebase/firestore";
import { db } from "../firebase/firebase";
import { useNavigate } from "react-router-dom";

const Dashboard = ({ sidebarOpen }) => {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [manuscripts, setManuscripts] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const auth = getAuth();
    let unsubscribeManuscripts = null;
    let unsubscribeNotif = null;

    const fetchData = async (currentUser) => {
      try {
        // Get user role
        const userRef = doc(db, "Users", currentUser.uid);
        const docSnap = await getDoc(userRef);
        const userRole = docSnap.exists() ? docSnap.data().role : "User";
        setRole(userRole);

        // Real-time manuscripts listener
        const manuscriptsRef = collection(db, "manuscripts");
        unsubscribeManuscripts = onSnapshot(manuscriptsRef, (snapshot) => {
          const allMss = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }));

          // Sort by submission time
          allMss.sort(
            (a, b) =>
              (b.submittedAt?.seconds || 0) - (a.submittedAt?.seconds || 0)
          );

          setManuscripts(
            userRole === "Admin"
              ? allMss
              : allMss.filter((m) => m.userId === currentUser.uid)
          );
        });

        // Real-time notifications listener
        const notifRef = collection(db, "Notifications");
        unsubscribeNotif = onSnapshot(notifRef, (snapshot) => {
          const notifs = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }));
          setNotifications(
            notifs.sort((a, b) => b.timestamp?.seconds - a.timestamp?.seconds)
          );
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
        setManuscripts([]);
        setNotifications([]);
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeManuscripts) unsubscribeManuscripts();
      if (unsubscribeNotif) unsubscribeNotif();
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

  // Count manuscripts by status
  const countByStatus = (status) =>
    manuscripts.filter((m) => m.status === status).length;

  // Navigate to Manuscripts.jsx with status filter
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

      {/* Manuscripts Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {["Pending", "Accepted", "Rejected"].map((status) => (
          <div
            key={status}
            className="bg-white p-4 rounded shadow-sm cursor-pointer hover:shadow-md text-center"
            onClick={() => handleStatusClick(status)}
          >
            <p className="text-lg font-semibold">{status}</p>
            <p className="text-2xl font-bold">{countByStatus(status)}</p>
          </div>
        ))}
      </div>

      {/* Notifications Panel */}
      <div className="border p-4 rounded shadow-sm bg-gray-50 w-full mb-6">
        <h2 className="text-xl font-semibold mb-4">Notifications</h2>
        {notifications.length === 0 ? (
          <p className="text-gray-600">No notifications</p>
        ) : (
          <ul className="space-y-2 max-h-96 overflow-y-auto">
            {notifications.map((notif) => (
              <li
                key={notif.id}
                className="bg-white p-3 rounded shadow-sm hover:bg-gray-100 transition break-words"
              >
                {notif.message}
                {notif.timestamp && (
                  <p className="text-xs text-gray-400">
                    {notif.timestamp instanceof Date
                      ? notif.timestamp.toLocaleString()
                      : new Date(
                          notif.timestamp.seconds * 1000
                        ).toLocaleString()}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
