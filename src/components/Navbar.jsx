import React, { useState, useEffect, useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { getAuth } from "firebase/auth";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faUser } from "@fortawesome/free-solid-svg-icons";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase/firebase";
import Notifications from "./Notifications";
import UserLogService from "../utils/userLogService";
import ContactDropdown from "./ContactDropdown";

const Navbar = ({ onLogout }) => {
  const iconRef = useRef(null);
  const profileDropdownRef = useRef(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [user, setUser] = useState(null);
  const [firestorePhoto, setFirestorePhoto] = useState(null); // Firestore profile photo
  const [loading, setLoading] = useState(true);
  const location = useLocation();
  const navigate = useNavigate();

  const auth = getAuth();

  // Check if the user is an Admin
  const checkAdminStatus = async (user) => {
    try {
      const userDoc = await getDoc(doc(db, "Users", user.uid));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        setIsAdmin(userData.role === "Admin");
      } else {
        setIsAdmin(false);
      }
    } catch (error) {
      console.error("Error checking admin status:", error);
      setIsAdmin(false);
    }
  };

  // Fetch Firestore photo as Base64 and cache it
  const fetchFirestorePhoto = async (uid) => {
    const cached = sessionStorage.getItem("firestorePhoto");
    if (cached) {
      setFirestorePhoto(cached);
      return;
    }

    try {
      const userDoc = await getDoc(doc(db, "Users", uid));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        if (userData.photoURL) {
          // Fetch image as blob and convert to Base64
          const response = await fetch(userData.photoURL);
          const blob = await response.blob();
          const reader = new FileReader();
          reader.onloadend = () => {
            const base64data = reader.result;
            setFirestorePhoto(base64data);
            sessionStorage.setItem("firestorePhoto", base64data);
          };
          reader.readAsDataURL(blob);
        }
      }
    } catch (error) {
      console.error("Error fetching Firestore photo:", error);
    }
  };

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (currentUser) => {
      if (currentUser && currentUser.emailVerified) {
        setUser(currentUser);
        checkAdminStatus(currentUser);
        fetchFirestorePhoto(currentUser.uid);
      } else {
        setUser(null);
        setIsAdmin(false);
        setFirestorePhoto(null);
        sessionStorage.removeItem("firestorePhoto");
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    const confirmLogout = window.confirm("Are you sure you want to sign out?");
    if (!confirmLogout) return;

    try {
      // Store user info before logging out
      const userId = user?.uid;
      const userEmail = user?.email;

      if (!userId || !userEmail) {
        throw new Error("User information not available");
      }

      // Sign out first to prevent race conditions
      await onLogout();

      // Log the sign-out action
      await UserLogService.logUserLogout(userId, userEmail);

      navigate("/signin");
    } catch (error) {
      console.error("Error during sign out:", error);

      // Log the failed sign-out attempt
      if (user?.uid) {
        await UserLogService.logSecurityEvent(
          user.uid,
          "logout_failed",
          `Failed to sign out: ${error.message}`,
          "error"
        );

        // Also log the error as a login failure for consistency
        await UserLogService.logLoginFailure(
          user.email || "Unknown",
          `Logout failed: ${error.message}`,
          "system"
        );
      }
    } finally {
      sessionStorage.removeItem("firestorePhoto");
    }
  };

  const toggleDropdown = () => setDropdownOpen((prev) => !prev);
  const toggleMobileMenu = () => setMobileMenuOpen((prev) => !prev);

  const handleIconClick = () => {
    if (iconRef.current) {
      iconRef.current.style.transform = "scale(0.9)";
      iconRef.current.style.transition = "transform 0.2s ease";
      setTimeout(() => {
        iconRef.current.style.transform = "scale(1)";
      }, 200);
    }
  };

  useEffect(() => {
    setDropdownOpen(false);
    setMobileMenuOpen(false);
  }, [location]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        profileDropdownRef.current &&
        !profileDropdownRef.current.contains(event.target)
      ) {
        setDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const isActiveLink = (path) =>
    location.pathname === path ? "text-red-900" : "text-black";

  if (loading) {
    return (
      <nav>
        <p>Loading...</p>
      </nav>
    );
  }

  return (
    <>
      <header className="bg-yellow-400 shadow-md fixed top-0 left-0 w-full z-50">
        <div className="flex items-center px-4 py-1">
          {/* Logo Section */}
          <div className="flex items-center">
            <Link to="/home">
              <img
                src="/pubtrackIcon2.png"
                alt="PubTrack Icon"
                className="h-12 w-12 mr-2"
                onClick={handleIconClick}
              />
            </Link>
          </div>

          {/* Mobile Menu Toggle */}
          <button onClick={toggleMobileMenu} className="md:hidden p-2">
            <span className="block w-6 h-0.5 bg-gray-700 mb-1"></span>
            <span className="block w-6 h-0.5 bg-gray-700 mb-1"></span>
            <span className="block w-6 h-0.5 bg-gray-700"></span>
          </button>

          {/* Mobile Menu Dropdown */}
          {mobileMenuOpen && (
            <nav className="md:hidden bg-yellow-400">
              <div className="flex flex-col text-gray-700 font-semibold">
                <Link
                  to="/journals"
                  className={`px-3 py-2 ${isActiveLink("/journals")}`}
                >
                  Journals
                </Link>
                <Link
                  to="/call-for-papers"
                  className={`px-3 py-2 ${isActiveLink("/call-for-papers")}`}
                >
                  Call for Papers
                </Link>
                <Link
                  to="/pub-ethics"
                  className={`px-3 py-2 ${isActiveLink("/pub-ethics")}`}
                >
                  Publication Ethics
                </Link>
                <Link
                  to="/guidelines"
                  className={`px-3 py-2 ${isActiveLink("/guidelines")}`}
                >
                  Guidelines For Submission
                </Link>
                <Link
                  to="/format-guidelines"
                  className={`px-3 py-2 ${isActiveLink("/format-guidelines")}`}
                >
                  Format Guidelines
                </Link>
              </div>
            </nav>
          )}

          {/* Center Navigation */}
          <nav className="hidden md:flex text-black-700 font-poppins flex-grow items-center">
            <span className="border-l border-black h-4 ml-5" />
            <Link
              to="/journals"
              className={`px-6 ml-3 ${isActiveLink("/journals")}`}
            >
              Journals
            </Link>
            <span className="border-l border-black h-4 mx-2" />
            <Link
              to="/call-for-papers"
              className={`px-6 ${isActiveLink("/call-for-papers")}`}
            >
              Call for Papers
            </Link>
            <span className="border-l border-black h-4 mx-2" />
            <Link
              to="/pub-ethics"
              className={`px-6 ${isActiveLink("/pub-ethics")}`}
            >
              Publication Ethics
            </Link>
            <span className="border-l border-black h-4 mx-2" />
            <Link
              to="/guidelines"
              className={`px-6 ${isActiveLink("/guidelines")}`}
            >
              Guidelines For Submission
            </Link>
            <span className="border-l border-black h-4 mx-2" />
            <Link
              to="/format-guidelines"
              className={`px-6 ${isActiveLink("/format-guidelines")}`}
            >
              Format Guidelines
            </Link>
          </nav>

          {/* Profile / Sign Out */}
          <div className="relative flex items-center ml-auto space-x-4">
            {user && <Notifications user={user} />}
            {user ? (
              <div className="relative" ref={profileDropdownRef}>
                <button
                  onClick={toggleDropdown}
                  className="flex items-center justify-center bg-gray-500 w-12 h-12 rounded-full hover:bg-red-600 transition duration-300 shadow-lg border-2 border-white"
                >
                  {firestorePhoto ? (
                    <img
                      src={firestorePhoto}
                      alt="User profile"
                      className="w-full h-full rounded-full object-cover border-2 border-gray-300 shadow-md"
                    />
                  ) : user.photoURL ? (
                    <img
                      src={user.photoURL}
                      alt="User profile"
                      className="w-full h-full rounded-full object-cover border-2 border-gray-300 shadow-md"
                    />
                  ) : (
                    <div className="w-full h-full rounded-full bg-white flex items-center justify-center">
                      <FontAwesomeIcon
                        icon={faUser}
                        className="text-gray-500 p-3 text-2xl"
                      />
                    </div>
                  )}
                </button>

                {dropdownOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg">
                    <Link
                      to="/profile"
                      className="block px-4 py-2 text-gray-800 rounded-md hover:bg-gray-200 active:bg-gray-300"
                    >
                      Profile
                    </Link>
                    {isAdmin && (
                      <Link
                        to="/user-management"
                        className="block px-4 py-2 text-gray-800 hover:bg-gray-200 active:bg-gray-300"
                      >
                        User Management
                      </Link>
                    )}
                    {isAdmin && (
                      <Link
                        to="/user-log"
                        className="block px-4 py-2 text-gray-800 hover:bg-gray-200 active:bg-gray-300"
                      >
                        User Logs
                      </Link>
                    )}
                    <button
                      onClick={handleLogout}
                      className="block w-full text-left rounded-md px-4 py-2 text-red-500 hover:bg-gray-200 active:bg-gray-300"
                    >
                      Sign Out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <Link
                to="/signin"
                className="bg-red-700 hover:bg-red-800 active:scale-95 active:bg-red-900 text-white py-2 px-4 rounded-sm transition duration-300"
              >
                Sign In
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Contact Us Dropdown */}
      <ContactDropdown />
    </>
  );
};

export default Navbar;
