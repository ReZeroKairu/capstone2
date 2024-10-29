import React, { useState, useEffect } from "react";
import {
  doc,
  setDoc,
  getDocs,
  collection,
  query,
  where,
  getDoc,
} from "firebase/firestore";
import { db } from "../firebase/firebase";
import { useNavigate } from "react-router-dom";
import { getAuth, onAuthStateChanged } from "firebase/auth";

function AdminManagement() {
  const [uid, setUid] = useState("");
  const [message, setMessage] = useState("");
  const [currentAdmins, setCurrentAdmins] = useState([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const navigate = useNavigate();
  const auth = getAuth(); // Get the Auth instance

  const fetchCurrentAdmins = async () => {
    try {
      const q = query(collection(db, "Users"), where("role", "==", "admin"));
      const querySnapshot = await getDocs(q);
      const admins = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setCurrentAdmins(admins);
    } catch (error) {
      console.error("Error fetching admins:", error);
    }
  };

  const checkAdminStatus = async (userId) => {
    const userDoc = await getDoc(doc(db, "Users", userId));

    if (userDoc.exists()) {
      const userData = userDoc.data();
      console.log("User data:", userData); // Log user data to see the role
      if (userData.role === "admin") {
        setIsAdmin(true);
        fetchCurrentAdmins(); // Fetch admins if user is admin
      } else {
        console.log("User is not an admin."); // Log if user is not an admin
        navigate("/unauthorized"); // Redirect to Not Authorized page
      }
    } else {
      console.log("User document does not exist."); // Log if document does not exist
      navigate("/signin"); // Redirect to login if no user found
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        console.log("Current user role:", user.uid); // Log the current user's UID
        checkAdminStatus(user.uid); // Check admin status with the user ID
      } else {
        console.log("No user is logged in."); // Log if no user is logged in
        navigate("/signin"); // Redirect to login if no user is logged in
      }
    });

    return () => unsubscribe(); // Cleanup subscription on unmount
  }, [auth, navigate]);

  const makeUserAdmin = async (uid) => {
    try {
      await setDoc(doc(db, "Users", uid), { role: "admin" }, { merge: true });
      setMessage("User has been assigned the admin role.");
      fetchCurrentAdmins(); // Refresh the admin list
    } catch (error) {
      console.error("Error assigning admin role:", error);
      setMessage("Failed to assign admin role.");
    }
  };

  const handleAssignAdmin = (e) => {
    e.preventDefault();
    if (uid) {
      makeUserAdmin(uid);
    } else {
      setMessage("Please enter a valid user UID.");
    }
  };

  return (
    <div className="p-36">
      <h2 className="text-2xl font-bold">Admin Management</h2>
      <form onSubmit={handleAssignAdmin} className="my-4">
        <input
          type="text"
          placeholder="Enter User UID"
          value={uid}
          onChange={(e) => setUid(e.target.value)}
          className="border p-2 mr-2"
        />
        <button type="submit" className="bg-blue-500 text-white p-2 rounded">
          Assign Admin Role
        </button>
      </form>
      {message && <p>{message}</p>}

      {/* Display current admins */}
      <div className="mt-4">
        <h3 className="text-lg font-semibold mb-4">Current Admins:</h3>
        <div className="grid grid-cols-1 gap-4">
          {currentAdmins.length > 0 ? (
            currentAdmins.map((admin) => (
              <div
                key={admin.id}
                className="p-4 bg-white shadow rounded-lg border border-gray-200"
              >
                <h4 className="font-bold text-xl">{admin.email}</h4>
                <div className="mt-2">
                  <p className="mb-2">
                    <span className="font-semibold">First Name:</span>{" "}
                    {admin.firstName}
                  </p>
                  <p className="mb-2">
                    <span className="font-semibold">Last Name:</span>{" "}
                    {admin.lastName}
                  </p>
                  <p>
                    <span className="font-semibold">UID:</span> {admin.id}
                  </p>
                </div>
              </div>
            ))
          ) : (
            <div className="p-4 bg-white shadow rounded-lg border border-gray-200">
              <p className="text-gray-700">No current admins.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default AdminManagement;
