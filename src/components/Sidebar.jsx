import React, { useState, useEffect } from "react";
import {
  FaHome,
  FaBullhorn,
  FaUsers,
  FaTachometerAlt,
  FaFileUpload,
  FaBook,
  FaBars,
  FaTimes,
} from "react-icons/fa";
import { Link } from "react-router-dom";

const Sidebar = ({ role }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("Home");
  const [scrollPosition, setScrollPosition] = useState(0);

  // Toggle sidebar visibility
  const toggleSidebar = () => {
    setIsOpen(!isOpen);
  };

  // Update scroll position on scroll
  const handleScroll = () => {
    setScrollPosition(window.scrollY);
  };

  useEffect(() => {
    window.addEventListener("scroll", handleScroll);

    // Clean up the event listener on unmount
    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  // Set active tab
  const handleTabClick = (tab) => {
    setActiveTab(tab);
  };

  return (
    <div className="relative flex mt-20">
      {/* Sidebar */}
      <div
        className={`transition-all duration-300 ease-in-out mt-16 sm:mt-20 ${
          isOpen ? "w-64" : "w-0"
        } bg-red-800 text-white fixed inset-y-0 left-0 z-30 overflow-hidden`}
        style={{
          height: "100vh",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div className="bg-red-800 text-white text-center py-4 px-6 text-xl font-semibold">
          Menu
        </div>

        <div
          className={`relative z-10 ${
            isOpen ? "opacity-100" : "opacity-0"
          } transition-opacity duration-300 delay-150`}
        >
          <ul className={`${isOpen ? "block" : "hidden"}`}>
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
                onClick={() => handleTabClick("Announcement")}
                className={`flex items-center w-52 ml-8 px-3 py-3 ${
                  activeTab === "Announcement"
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

      {/* Toggle Button - moves down with scroll */}
      <div
        className="absolute z-30 cursor-pointer text-white"
        onClick={toggleSidebar}
        style={{
          position: "absolute",
          top: `${scrollPosition + 20}px`, // Moves with scroll
          left: "20px",
        }}
      >
        {isOpen ? (
          <FaTimes className="text-3xl" />
        ) : (
          <FaBars className="text-3xl" />
        )}
      </div>
    </div>
  );
};

export default Sidebar;
