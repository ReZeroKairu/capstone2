import React, { useState } from "react";
import { Link } from "react-router-dom"; // use Link for navigation
import { getAuth } from "firebase/auth"; // Import Firebase authentication methods
import pubtrackicon from "../assets/pubtrackicon.jpg"; // Your icon

const Navbar = ({ user, onLogout }) => {
  const [dropdownOpen, setDropdownOpen] = useState(false); // State for account dropdown visibility
  const [contactDropdownOpen, setContactDropdownOpen] = useState(false); // State for contact dropdown visibility
  const auth = getAuth(); // Initialize Firebase auth

  // Function to toggle account dropdown visibility
  const toggleDropdown = () => {
    setDropdownOpen((prev) => !prev);
  };

  // Function to toggle contact dropdown visibility
  const toggleContactDropdown = () => {
    setContactDropdownOpen((prev) => !prev);
  };

  return (
    <>
      {/* Fixed Header */}
      <header className="bg-yellow-300 shadow-md fixed w-full z-20">
        <div className="flex justify-between items-center px-4 py-1 border-b border-gray-200">
          {/* Left Logo Section */}
          <div className="flex items-center">
            <img src={pubtrackicon} alt="Logo" className="h-12 w-12 mr-2" />
          </div>

          {/* Center Navigation Links */}
          <nav className="hidden md:flex text-gray-700 font-semibold">
            <Link to="/journals" className="hover:text-blue-600 px-3">
              Journals
            </Link>
            <Link
              to="/call-for-papers"
              className="hover:text-blue-600 px-3 border-l border-black"
            >
              Call for Papers
            </Link>
            <Link
              to="/publication-ethics"
              className="hover:text-blue-600 px-3 border-l border-black"
            >
              Publication Ethics
            </Link>
            <Link
              to="/guidelines"
              className="hover:text-blue-600 px-3 border-l border-black"
            >
              Guidelines For Submission
            </Link>
          </nav>

          {/* Right Section with Profile and Sign Out Dropdown */}
          <div className="relative flex items-center space-x-4">
            {user ? (
              <>
                {/* Profile Button */}
                <div className="relative">
                  <button
                    onClick={toggleDropdown} // Toggle dropdown on click
                    className="flex items-center justify-center bg-gray-500 w-12 h-12 rounded-full hover:bg-red-600 transition duration-300 shadow-lg border-2 border-white"
                  >
                    <img
                      src={user.photoURL || "https://via.placeholder.com/150"}
                      className="w-full h-full rounded-full object-cover"
                      alt="User Profile"
                    />
                  </button>

                  {/* Account Dropdown Menu */}
                  {dropdownOpen && (
                    <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg">
                      <Link
                        to="/profile"
                        className="block px-4 py-2 text-gray-800 hover:bg-gray-200"
                      >
                        Profile
                      </Link>
                      <button
                        onClick={onLogout} // Call logout function passed as prop
                        className="block w-full text-left px-4 py-2 text-red-500 hover:bg-gray-200"
                      >
                        Sign Out
                      </button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <Link
                to="/signin"
                className="bg-yellow-500 text-white font-semibold py-2 px-4 rounded-md hover:bg-yellow-600 transition duration-300"
              >
                SIGN IN
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Contact Us Dropdown */}
      <div className="bg-red-900 text-white py-1 fixed w-full mt-14 z-10">
        <div className="flex justify-end mr-4">
          <button
            onClick={toggleContactDropdown}
            className="text-white text-sm" // Smaller font size
          >
            CONTACT US
          </button>
        </div>
        {/* Contact Dropdown Menu */}
        {contactDropdownOpen && (
          <div className="w-full bg-red-700 rounded-md shadow-lg">
            <div className="flex flex-col items-center p-4">
              <h2 className="text-lg font-semibold">Get in Touch</h2>
              <p className="text-gray-200">You can reach us through:</p>
              <ul className="list-disc pl-5 text-gray-200">
                <li>Email: support@pubtrack.com</li>
                <li>Phone: +123456789</li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default Navbar;
