import React, { useState } from "react";
import { Link } from "react-router-dom";
import { getAuth } from "firebase/auth";
import pubtrackicon from "../assets/pubtrackicon.jpg";

const Navbar = ({ user, onLogout }) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [contactDropdownOpen, setContactDropdownOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const auth = getAuth();

  const toggleDropdown = () => setDropdownOpen((prev) => !prev);
  const toggleContactDropdown = () => setContactDropdownOpen((prev) => !prev);
  const toggleMobileMenu = () => setMobileMenuOpen((prev) => !prev);

  return (
    <>
      {/* Fixed Header */}
      <header className="bg-yellow-300 shadow-md fixed w-full z-20">
        <div className="flex items-center px-4 py-1 border-b border-gray-200">
          {/* Left Logo Section */}
          <div className="flex items-center">
            <Link to="/Home">
              <img src={pubtrackicon} alt="Logo" className="h-12 w-12 mr-2" />
            </Link>
          </div>

          {/* Mobile Menu Toggle Button */}
          <button onClick={toggleMobileMenu} className="md:hidden p-2">
            <span className="block w-6 h-0.5 bg-gray-700 mb-1"></span>
            <span className="block w-6 h-0.5 bg-gray-700 mb-1"></span>
            <span className="block w-6 h-0.5 bg-gray-700"></span>
          </button>

          {/* Center Navigation Links */}
          <nav
            className={`hidden md:flex text-black-700 font-poppins flex-grow items-center`}
          >
            <span className="border-l border-gray-500 h-4  ml-5" />
            <Link
              to="/journals"
              className="px-6 ml-3 transition-all duration-300 ease-in-out hover:text-red-700 active:scale-95 active:text-red-900"
            >
              Journals
            </Link>
            <span className="border-l border-gray-500 h-4 mx-2" />
            <Link
              to="/call-for-papers"
              className="px-6 transition-all duration-300 ease-in-out hover:text-red-700 active:scale-95 active:text-red-900"
            >
              Call for Papers
            </Link>
            <span className="border-l border-gray-500 h-4 mx-2" />
            <Link
              to="/publication-ethics"
              className="px-6 transition-all duration-300 ease-in-out hover:text-red-700 active:scale-95 active:text-red-900"
            >
              Publication Ethics
            </Link>
            <span className="border-l border-gray-500 h-4 mx-2" />
            <Link
              to="/guidelines"
              className="px-6 transition-all duration-300 ease-in-out hover:text-red-700 active:scale-95 active:text-red-900"
            >
              Guidelines For Submission
            </Link>
          </nav>

          {/* Right Section with Profile and Sign Out Dropdown */}
          <div className="relative flex items-center ml-auto space-x-4">
            {user ? (
              <div className="relative">
                <button
                  onClick={toggleDropdown}
                  className="flex items-center justify-center bg-gray-500 w-12 h-12 rounded-full hover:bg-red-600 transition duration-300 shadow-lg border-2 border-white"
                >
                  <img
                    src={user.photoURL || "https://via.placeholder.com/150"}
                    className="w-full h-full rounded-full object-cover"
                    alt="User Profile"
                  />
                </button>
                {dropdownOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg">
                    <Link
                      to="/profile"
                      className="block px-4 py-2 text-gray-800 hover:bg-gray-200"
                    >
                      Profile
                    </Link>
                    <button
                      onClick={onLogout}
                      className="block w-full text-left px-4 py-2 text-red-500 hover:bg-gray-200"
                    >
                      Sign Out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <Link
                to="/signin"
                className="bg-red-800 text-white font-semibold py-2 px-4 rounded-sm hover:bg-red-900 transition duration-300"
              >
                SIGN IN
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <nav className="md:hidden bg-yellow-300">
          <div className="flex flex-col text-gray-700 font-semibold">
            <Link to="/home" className="hover:text-blue-600 px-3 py-2">
              Home
            </Link>
            <Link to="/journals" className="hover:text-blue-600 px-3 py-2">
              Journals
            </Link>
            <Link
              to="/call-for-papers"
              className="hover:text-blue-600 px-3 py-2"
            >
              Call for Papers
            </Link>
            <Link
              to="/publication-ethics"
              className="hover:text-blue-600 px-3 py-2"
            >
              Publication Ethics
            </Link>
            <Link to="/guidelines" className="hover:text-blue-600 px-3 py-2">
              Guidelines For Submission
            </Link>
          </div>
        </nav>
      )}

      <div className="bg-red-900 text-white py-1 fixed w-full mt-14 z-10">
        <div className="flex justify-end mr-4">
          <button
            onClick={toggleContactDropdown}
            className="text-white text-sm"
          >
            CONTACT US
          </button>
        </div>
        {/* Contact Dropdown Menu */}
        <div
          className={`overflow-hidden transition-all duration-500 ease-in-out ${
            contactDropdownOpen ? "max-h-40 opacity-100" : "max-h-0 opacity-0"
          }`}
        >
          <div className="w-full bg-red-900 rounded-md shadow-lg">
            <div className="flex flex-col items-center p-4">
              <h2 className="text-lg font-semibold">Get in Touch</h2>
              <p className="text-gray-200">You can reach us through:</p>
              <ul className="list-disc pl-5 text-gray-200">
                <li>Email: support@pubtrack.com</li>
                <li>Phone: +123456789</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Navbar;
