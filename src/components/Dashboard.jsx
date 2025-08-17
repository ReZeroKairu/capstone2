import React, { useEffect, useState } from "react";
import { getAuth } from "firebase/auth";
import {
  doc,
  getDoc,
  collection,
  query,
  orderBy,
  getDocs,
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

const Dashboard = () => {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = auth.onAuthStateChanged(async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        try {
          const userRef = doc(db, "Users", currentUser.uid);
          const docSnap = await getDoc(userRef);
          setRole(docSnap.exists() ? docSnap.data().role : "User");

          // Fetch submissions
          const submissionsRef = collection(db, "form_responses");
          const q = query(submissionsRef, orderBy("submittedAt", "desc"));
          const snapshot = await getDocs(q);
          const allSubs = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }));
          setSubmissions(
            role === "Admin"
              ? allSubs
              : allSubs.filter((s) => s.userId === currentUser.uid)
          );
        } catch (err) {
          console.error("Error fetching user data:", err);
        }
      } else {
        setUser(null);
        setRole(null);
        setSubmissions([]);
      }
      setLoading(false);
    });

    return () => unsubscribe();
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

  return (
    <div className="flex flex-col items-center p-6 pt-28 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold mb-4">
        Welcome, {user.displayName || "User"}!
      </h1>

      <div className="w-full space-y-6">
        {/* Submissions Panel */}
        <div className="border p-4 rounded shadow-sm bg-gray-50 w-full">
          <h2 className="text-xl font-semibold mb-4">Submissions</h2>
          {submissions.length === 0 ? (
            <p className="text-gray-600">No submissions found.</p>
          ) : (
            submissions.map((sub) => (
              <div
                key={sub.id}
                className="mb-4 border p-3 rounded bg-white shadow-sm flex flex-col gap-2"
              >
                <p className="text-sm text-gray-500">
                  {sub.firstName} {sub.lastName} ({sub.role}) — Submitted at:{" "}
                  {sub.submittedAt?.toDate
                    ? sub.submittedAt.toDate().toLocaleString()
                    : "-"}
                </p>
                <div className="flex flex-wrap items-center gap-1 mb-2">
                  {STATUS_ORDER.map((s, idx) => (
                    <div key={s} className="flex-1 min-w-[40px]">
                      <div
                        className={`h-2 rounded ${
                          STATUS_ORDER.indexOf(sub.status) >= idx
                            ? "bg-green-500"
                            : "bg-gray-300"
                        }`}
                      ></div>
                      <p className="text-xs text-center mt-1">{s}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Notifications Panel */}
        <div className="border p-4 rounded shadow-sm bg-gray-50 w-full">
          <h2 className="text-xl font-semibold mb-4">Notifications</h2>
          <p className="text-gray-600">
            Notifications appear in the navbar icon.
          </p>
        </div>

        {/* Manuscripts Panel */}
        <div className="border p-4 rounded shadow-sm bg-gray-50 w-full">
          <h2 className="text-xl font-semibold mb-4">Manuscripts</h2>
          <p className="text-gray-600">
            Access manuscripts from the sidebar menu.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
