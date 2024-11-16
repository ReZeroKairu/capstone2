import React, { useState, useEffect } from "react";
import { db } from "../firebase/firebase"; // Adjust path as needed
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { useAuth } from "../authcontext/AuthContext"; // Adjust path as needed
import { useNavigate } from "react-router-dom";
import { getAuth } from "firebase/auth";

const AdminCreation = () => {
  const { currentUser } = useAuth(); // Get current user from auth context
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const auth = getAuth();

  // Check if the current user is an Admin
  const checkAdminStatus = async () => {
    if (currentUser) {
      const userDoc = await getDoc(doc(db, "Users", currentUser.uid));
      if (!userDoc.exists() || userDoc.data().role !== "Admin") {
        navigate("/unauthorized"); // Redirect if not Admin
      }
    } else {
      navigate("/signin"); // Redirect if no user is logged in
    }
  };

  useEffect(() => {
    checkAdminStatus(); // Check Admin status on component mount
  }, [currentUser, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      // Create user in Firebase Authentication
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );
      const user = userCredential.user;

      // Set user role in Firestore
      await setDoc(doc(db, "Users", user.uid), {
        email: user.email,
        role: "Admin", // Assign Admin role
      });

      setMessage("Admin created successfully!");
      navigate("/user-management"); // Redirect to user management or Admin dashboard
    } catch (error) {
      console.error("Error creating Admin:", error);
      setMessage("Failed to create Admin: " + error.message);
    }
    setLoading(false);
  };

  return (
    <div className="p-8">
      <h2 className="text-2xl font-bold mb-4">Create Admin User</h2>
      {message && <p className="text-red-600">{message}</p>}
      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label htmlFor="email" className="block mb-2">
            Email:
          </label>
          <input
            type="email"
            id="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="border p-2 w-full"
          />
        </div>
        <div className="mb-4">
          <label htmlFor="password" className="block mb-2">
            Password:
          </label>
          <input
            type="password"
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="border p-2 w-full"
          />
        </div>
        <button
          type="submit"
          className="bg-blue-500 text-white p-2 rounded"
          disabled={loading}
        >
          {loading ? "Creating..." : "Create Admin"}
        </button>
      </form>
    </div>
  );
};

export default AdminCreation;
