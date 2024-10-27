import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom"; // useNavigate for navigation
import { getAuth, onAuthStateChanged } from "firebase/auth"; // Import Firebase authentication methods
import pubtracklogo from "../assets/pubtracklogo.png"; // Your logo
import bg from "../assets/bg.jpg"; // Your background image
import Navbar from "../components/Navbar";

function Home() {
  const [user, setUser] = useState(null); // State to hold user information
  const navigate = useNavigate(); // Use useNavigate for navigation
  const auth = getAuth(); // Initialize Firebase auth

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      console.log("User state changed:", user); // Log the user state
      setUser(user); // Update user state
    });

    return () => unsubscribe(); // Cleanup subscription on unmount
  }, [auth]);

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
    <div className="overflow-hidden">
      <Navbar user={user} onLogout={handleLogout} />{" "}
      {/* Pass user and logout function */}
      {/* Main Content Section */}
      <main className="relative h-screen">
        <div
          className="absolute inset-0 bg-cover bg-center bg-fixed"
          style={{
            backgroundImage: `url(${bg})`,
          }}
        ></div>

        {/* Logo and Text Overlay */}
        <div className="relative flex flex-col items-center justify-center h-full bg-black bg-opacity-50 text-white">
          <img src={pubtracklogo} alt="PubTrack Logo" className="h-96 mb-6" />
        </div>
      </main>
    </div>
  );
}

export default Home;
