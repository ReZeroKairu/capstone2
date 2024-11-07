import React, { useState } from "react"; // Ensure useState is imported
import {
  FaHome,
  FaBullhorn,
  FaTachometerAlt,
  FaFileUpload,
  FaBook,
  FaBars,
  FaTimes,
} from "react-icons/fa";
import { Link } from "react-router-dom"; // Import Link from React Router

const ResearcherSidebar = () => {
  const [isOpen, setIsOpen] = useState(false); // Start with sidebar closed
  const [activeTab, setActiveTab] = useState("Home"); // Initialize activeTab

  // Toggle sidebar visibility
  const toggleSidebar = () => {
    setIsOpen(!isOpen);
  };

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
        } bg-red-800 text-white fixed inset-y-0 left-0 z-30 overflow-hidden transform`}
        style={{
          height: "100vh", // Fixed height of 455px
          backgroundImage: "url('/path-to-your-image.jpg')", // Set a background image (optional)
          backgroundSize: "cover", // Ensure the background image covers the sidebar
          backgroundPosition: "center", // Position the background image to center
        }}
      >
        {/* Sidebar Header */}
        <div className="bg-red-800 text-white text-center py-4 px-6 text-xl font-semibold">
          Menu
        </div>

        {/* Sidebar content */}
        <div
          className={`relative z-10 ${
            isOpen ? "opacity-100" : "opacity-0"
          } transition-opacity duration-300 delay-150`}
        >
          <ul className={`${isOpen ? "block" : "hidden"}`}>
            {/* Sidebar Tab Links */}
            <li>
              <Link
                to="/home" // Replace with the actual path
                onClick={() => handleTabClick("Home")}
                className={`flex items-center w-52 ml-8 px-3 py-3 font-bold transition-colors ${
                  activeTab === "Home" ? "bg-white text-black" : "text-white"
                } hover:bg-white hover:text-black rounded-lg`}
              >
                <FaHome className="mr-3 text-2xl" />
                Home
              </Link>
            </li>

            <li>
              <Link
                to="/announcements" // Replace with the actual path
                onClick={() => handleTabClick("Announcements")}
                className={`flex items-center w-52 ml-8 px-3 py-3 font-bold transition-colors ${
                  activeTab === "Announcements"
                    ? "bg-white text-black"
                    : "text-white"
                } hover:bg-white hover:text-black rounded-lg`}
              >
                <FaBullhorn className="mr-3 text-xl" />
                Announcements
              </Link>
            </li>

            <li>
              <Link
                to="/dashboard" // Replace with the actual path
                onClick={() => handleTabClick("Dashboard")}
                className={`flex items-center w-52 ml-8 px-3 py-3 font-bold transition-colors ${
                  activeTab === "Dashboard"
                    ? "bg-white text-black"
                    : "text-white"
                } hover:bg-white hover:text-black rounded-lg`}
              >
                <FaTachometerAlt className="mr-3 text-xl" />
                Dashboard
              </Link>
            </li>

            <li>
              <Link
                to="/submit-manuscript" // Replace with the actual path
                onClick={() => handleTabClick("Submit Manuscript")}
                className={`flex items-center w-52 ml-8 px-3 py-3 font-bold transition-colors ${
                  activeTab === "Submit Manuscript"
                    ? "bg-white text-black"
                    : "text-white"
                } hover:bg-white hover:text-black rounded-lg`}
              >
                <FaFileUpload className="mr-3 text-xl" />
                Submit Manuscript
              </Link>
            </li>

            <li>
              <Link
                to="/manuscripts" // Replace with the actual path
                onClick={() => handleTabClick("Manuscripts")}
                className={`flex items-center w-52 ml-8 px-3 py-3 font-bold transition-colors ${
                  activeTab === "Manuscripts"
                    ? "bg-white text-black"
                    : "text-white"
                } hover:bg-white hover:text-black rounded-lg`}
              >
                <FaBook className="mr-3 text-xl" />
                Manuscripts
              </Link>
            </li>
          </ul>
        </div>
      </div>

      {/* Burger Menu or Close Button */}
      <div
        className="absolute top-4 left-4 z-30 cursor-pointer text-white"
        onClick={toggleSidebar}
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

export default ResearcherSidebar;
