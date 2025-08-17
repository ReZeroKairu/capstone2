import React, { useState, useEffect } from "react";
import { getAuth } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase/firebase";

import Notifications from "../components/Notifications";
import Submissions from "../components/Submissions";
import FormResponses from "../formcomponents/FormResponses";
import Manuscripts from "../components/Manuscripts";

const Dashboard = () => {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);

  const auth = getAuth();

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);

        const userRef = doc(db, "Users", currentUser.uid);
        const docSnap = await getDoc(userRef);

        if (docSnap.exists()) {
          setRole(docSnap.data().role);
        } else {
          setRole(null);
        }
      } else {
        setUser(null);
        setRole(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [auth]);

  if (loading) {
    return (
      <div className="p-6 text-center text-lg text-gray-700">
        Loading Dashboard...
      </div>
    );
  }

  if (!user) {
    return (
      <div className="p-6 text-center text-red-600">
        You must be signed in to view the dashboard.
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 md:p-8 lg:p-12 max-w-full sm:max-w-xl md:max-w-3xl lg:max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">{role} Dashboard</h1>
        <Notifications user={user} />
      </div>

      {/* Role-based Panels */}
      {role === "Admin" && (
        <div className="space-y-6">
          <h2 className="text-xl font-semibold">Submissions Overview</h2>
          <Submissions />

          <h2 className="text-xl font-semibold">Form Responses</h2>
          <FormResponses />

          <h2 className="text-xl font-semibold">Manuscripts</h2>
          <Manuscripts />
        </div>
      )}

      {role === "Researcher" && (
        <div className="space-y-6">
          <h2 className="text-xl font-semibold">My Submissions</h2>
          <Submissions />

          <h2 className="text-xl font-semibold">Form Responses</h2>
          <FormResponses />
        </div>
      )}

      {role === "Peer Reviewer" && (
        <div className="space-y-6">
          <h2 className="text-xl font-semibold">Manuscripts to Review</h2>
          <Manuscripts />

          <h2 className="text-xl font-semibold">My Submissions</h2>
          <Submissions />
        </div>
      )}
    </div>
  );
};

export default Dashboard;
