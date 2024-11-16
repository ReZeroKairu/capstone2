import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { getFirestore, doc, getDoc } from "firebase/firestore";
import Sidebar from "../components/Sidebar"; // Import your Sidebar component
import Navbar from "../components/Navbar";

function Home() {
  const [user, setUser] = useState(null); // State to hold user information
  const [role, setRole] = useState(null); // State to hold user role
  const navigate = useNavigate(); // Use useNavigate for navigation
  const auth = getAuth(); // Initialize Firebase auth
  const db = getFirestore(); // Initialize Firestore

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUser(user);
        // Retrieve user role from Firestore
        const userRef = doc(db, "Users", user.uid);
        const docSnap = await getDoc(userRef);
        if (docSnap.exists()) {
          setRole(docSnap.data().role); // Set the role based on Firestore data
        }
      } else {
        setUser(null);
        setRole(null);
      }
    });

    return () => unsubscribe(); // Cleanup subscription on unmount
  }, [auth, db]);

  // Define the handleLogout function
  async function handleLogout() {
    try {
      await auth.signOut();
      navigate("/signin"); // Redirect after signing out
      console.log("User logged out successfully!");
    } catch (error) {
      console.error("Error logging out:", error.message);
    }
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <Navbar user={user} onLogout={handleLogout} />
      <div className="flex flex-1">
        {/* Conditionally render Sidebar only if user is authenticated */}
        {user && <Sidebar role={role} />} {/* Pass role to Sidebar */}
        {/* Main Content */}
        <main className="relative flex-1 overflow-hidden">
          <div
            className="absolute inset-0 bg-cover bg-center bg-fixed"
            style={{
              backgroundImage: "url('/bg.jpg')",
            }}
          ></div>

          <div className="relative flex flex-col items-center justify-center h-full bg-black bg-opacity-5 text-white">
            <img
              src="/pubtracklogo.png" // Directly reference the logo from the public folder
              alt="PubTrack Logo"
              className="h-[450px] mt-20 sm:mr-[-20rem] md:mr-[-10rem] lg:mr-[-35rem]"
            />
          </div>
        </main>
      </div>
    </div>
  );
}

export default Home;
