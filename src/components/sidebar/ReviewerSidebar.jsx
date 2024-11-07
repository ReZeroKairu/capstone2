import React, { useState } from "react"; // Ensure useState is imported
import { FaBars, FaTimes } from "react-icons/fa"; // Burger and close icons

const ResearcherSidebar = () => {
  const [isOpen, setIsOpen] = useState(false); // Start with sidebar closed

  // Toggle sidebar visibility
  const toggleSidebar = () => {
    setIsOpen(!isOpen);
  };

  return (
    <div className="relative flex mt-20">
      {/* Sidebar */}
      <div
        className={`transition-all duration-300 ease-in-out mt-16 sm:mt-20 ${
          isOpen ? "w-64" : "w-0"
        } bg-green-800 text-white fixed inset-y-0 left-0 z-30 overflow-hidden transform`}
        style={{
          height: "455px", // Fixed height of 455px
          backgroundImage: "url('/path-to-your-image.jpg')", // Set a background image (optional)
          backgroundSize: "cover", // Ensure the background image covers the sidebar
          backgroundPosition: "center", // Position the background image to center
        }}
      >
        {/* Sidebar Header */}
        <div className="bg-green-900 text-white text-center py-4 px-6 text-xl font-semibold">
          Menu
        </div>

        {/* Sidebar content */}
        <div className="relative z-10">
          {/* Ensure content is above the background */}
          <ul className={`${isOpen ? "block" : "hidden"}`}>
            <li className="border-b border-green-700">
              <a
                href="#"
                className="block px-6 py-4 hover:bg-green-700 transition-colors"
              >
                Review Submissions
              </a>
            </li>
            <li className="border-b border-green-700">
              <a
                href="#"
                className="block px-6 py-4 hover:bg-green-700 transition-colors"
              >
                Feedback & Comments
              </a>
            </li>
            <li className="border-b border-green-700">
              <a
                href="#"
                className="block px-6 py-4 hover:bg-green-700 transition-colors"
              >
                My Profile
              </a>
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
