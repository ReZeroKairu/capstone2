import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { getFirestore, doc, getDoc } from "firebase/firestore";
import Navbar from "../components/Navbar";
import {
  FaHome,
  FaBullhorn,
  FaUsers,
  FaTachometerAlt,
  FaFileUpload,
  FaBook,
} from "react-icons/fa";
import { Link } from "react-router-dom";

// Custom always-open sidebar component for homepage only
const HomepageSidebar = ({ role }) => {
  const [activeTab, setActiveTab] = useState("Home");

  // Set active tab
  const handleTabClick = (tab) => {
    setActiveTab(tab);
  };

  return (
    <div
      className="w-64 bg-red-800 text-white fixed inset-y-0 left-0 z-30 mt-16 sm:mt-20"
      style={{
        height: "100vh",
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      <div className="bg-red-800 text-white text-center py-4 px-6 text-xl font-semibold">
        Menu
      </div>

      <div className="relative z-10">
        <ul>
          {/* Tabs common to all roles */}
          <li>
            <Link
              to="/home"
              onClick={() => handleTabClick("Home")}
              className={`flex items-center w-52 ml-8 px-3 py-3 ${
                activeTab === "Home"
                  ? "bg-white text-black font-bold"
                  : "text-white"
              } hover:bg-white hover:text-black hover:font-bold rounded-lg`}
            >
              <FaHome className="mr-3 text-2xl" />
              Home
            </Link>
          </li>
          <li>
            <Link
              to="/announcement"
              onClick={() => handleTabClick("Announcements")}
              className={`flex items-center w-52 ml-8 px-3 py-3 ${
                activeTab === "Announcements"
                  ? "bg-white text-black font-bold"
                  : "text-white"
              } hover:bg-white hover:text-black hover:font-bold rounded-lg`}
            >
              <FaBullhorn className="mr-3 text-xl" />
              Announcements
            </Link>
          </li>
          <li>
            <Link
              to="/dashboard"
              onClick={() => handleTabClick("Dashboard")}
              className={`flex items-center w-52 ml-8 px-3 py-3 ${
                activeTab === "Dashboard"
                  ? "bg-white text-black font-bold"
                  : "text-white"
              } hover:bg-white hover:text-black hover:font-bold rounded-lg`}
            >
              <FaTachometerAlt className="mr-3 text-xl" />
              Dashboard
            </Link>
          </li>

          {/* Role-specific tabs */}
          {role === "Admin" && (
            <>
              <li>
                <Link
                  to="/user-management"
                  onClick={() => handleTabClick("User Management")}
                  className={`flex items-center w-52 ml-8 px-3 py-3 ${
                    activeTab === "User Management"
                      ? "bg-white text-black font-bold"
                      : "text-white"
                  } hover:bg-white hover:text-black hover:font-bold rounded-lg`}
                >
                  <FaUsers className="mr-3 text-xl" />
                  User Management
                </Link>
              </li>
              <li>
                <Link
                  to="/manuscripts"
                  onClick={() => handleTabClick("Manuscripts")}
                  className={`flex items-center w-52 ml-8 px-3 py-3 ${
                    activeTab === "Manuscripts"
                      ? "bg-white text-black font-bold"
                      : "text-white"
                  } hover:bg-white hover:text-black hover:font-bold rounded-lg`}
                >
                  <FaBook className="mr-3 text-xl" />
                  Manuscripts
                </Link>
              </li>
            </>
          )}

          {role === "Researcher" && (
            <>
              <li>
                <Link
                  to="/submit-manuscript"
                  onClick={() => handleTabClick("Submit Manuscript")}
                  className={`flex items-center w-52 ml-8 px-3 py-3 ${
                    activeTab === "Submit Manuscript"
                      ? "bg-white text-black font-bold"
                      : "text-white"
                  } hover:bg-white hover:text-black hover:font-bold rounded-lg`}
                >
                  <FaFileUpload className="mr-3 text-xl" />
                  Submit Manuscript
                </Link>
              </li>
              <li>
                <Link
                  to="/manuscripts"
                  onClick={() => handleTabClick("Manuscripts")}
                  className={`flex items-center w-52 ml-8 px-3 py-3 ${
                    activeTab === "Manuscripts"
                      ? "bg-white text-black font-bold"
                      : "text-white"
                  } hover:bg-white hover:text-black hover:font-bold rounded-lg`}
                >
                  <FaBook className="mr-3 text-xl" />
                  Manuscripts
                </Link>
              </li>
            </>
          )}

          {role === "Peer Reviewer" && (
            <li>
              <Link
                to="/review-manuscript"
                onClick={() => handleTabClick("Review Manuscript")}
                className={`flex items-center w-52 ml-8 px-3 py-3 ${
                  activeTab === "Review Manuscript"
                    ? "bg-white text-black font-bold"
                    : "text-white"
                } hover:bg-white hover:text-black hover:font-bold rounded-lg`}
              >
                <FaFileUpload className="mr-3 text-xl" />
                Review Manuscript
              </Link>
            </li>
          )}
        </ul>
      </div>
    </div>
  );
};

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
        {/* Use custom homepage sidebar (always open, no burger menu) */}
        {user && <HomepageSidebar role={role} />}

        {/* Main Content - adjusted margin for always-open sidebar */}
        <main
          className={`relative flex-1 overflow-hidden ${user ? "ml-64" : ""}`}
        >
          <div
            className="absolute inset-0 bg-cover bg-center bg-fixed"
            style={{
              backgroundImage: "url('/bg.jpg')",
            }}
          ></div>

          <div className="relative flex flex-col items-center justify-center h-full bg-black bg-opacity-5 text-white">
            <img
              src="/pubtracklogo.png"
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
