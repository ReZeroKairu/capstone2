import React, { useState, useEffect, useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { getAuth } from "firebase/auth";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faUser,
  faChevronUp,
  faChevronDown,
} from "@fortawesome/free-solid-svg-icons";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase/firebase";

const Navbar = ({ onLogout }) => {
  const iconRef = useRef(null);
  const profileDropdownRef = useRef(null);
  const contactDropdownRef = useRef(null);
  const contactButtonRef = useRef(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [contactDropdownOpen, setContactDropdownOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const auth = getAuth();
  const user = auth.currentUser;
  const [isAdmin, setIsAdmin] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const checkAdminStatus = async () => {
    if (user) {
      const userDoc = await getDoc(doc(db, "Users", user.uid));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        setIsAdmin(userData.role === "admin");
      }
    }
  };

  const handleLogout = async () => {
    await onLogout();
    navigate("/signin");
  };

  useEffect(() => {
    checkAdminStatus();
  }, [user]);

  const toggleDropdown = () => setDropdownOpen((prev) => !prev);

  const toggleContactDropdown = (e) => {
    e.stopPropagation();
    setContactDropdownOpen((prev) => !prev);
  };

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
    setContactDropdownOpen(false);
    setDropdownOpen(false);
    setMobileMenuOpen(false);
  }, [location]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        contactDropdownRef.current &&
        !contactDropdownRef.current.contains(event.target) &&
        contactButtonRef.current &&
        !contactButtonRef.current.contains(event.target)
      ) {
        setContactDropdownOpen(false);
      }
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

  const isActiveLink = (path) => {
    return location.pathname === path ? "text-red-900" : "text-black";
  };

  return (
    <>
      {/* Main Navbar Header */}
      <header className="bg-yellow-400 shadow-md fixed w-full z-50">
        <div className="flex items-center px-4 py-1 border-b border-gray-200">
          {/* Logo Section */}
          <div className="flex items-center">
            <Link to="/Home">
              <img
                src="/pubtrackIcon.jpg"
                alt="PubTrack Icon"
                className="h-12 w-12 mr-2"
                onClick={handleIconClick}
              />
            </Link>
          </div>
          {/* Mobile Menu Toggle Button */}
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
                  className={`px-3 py-2 transition-all duration-300 ease-in-out hover:text-red-700 active:scale-95 active:text-red-900 ${isActiveLink(
                    "/journals"
                  )}`}
                >
                  Journals
                </Link>
                <Link
                  to="/call-for-papers"
                  className={`px-3 py-2 transition-all duration-300 ease-in-out hover:text-red-700 active:scale-95 active:text-red-900 ${isActiveLink(
                    "/call-for-papers"
                  )}`}
                >
                  Call for Papers
                </Link>
                <Link
                  to="/pub-ethics"
                  className={`px-3 py-2 transition-all duration-300 ease-in-out hover:text-red-700 active:scale-95 active:text-red-900 ${isActiveLink(
                    "/pub-ethics"
                  )}`}
                >
                  Publication Ethics
                </Link>
                <Link
                  to="/guidelines"
                  className={`px-3 py-2 transition-all duration-300 ease-in-out hover:text-red-700 active:scale-95 active:text-red-900 ${isActiveLink(
                    "/guidelines"
                  )}`}
                >
                  Guidelines For Submission
                </Link>
              </div>
            </nav>
          )}

          {/* Center Navigation */}
          <nav
            className={`hidden md:flex text-black-700 font-poppins flex-grow items-center`}
          >
            <span className="border-l border-black h-4 ml-5" />
            <Link
              to="/journals"
              className={`px-6 ml-3 transition-all duration-300 ease-in-out hover:text-red-700 active:scale-95 active:text-red-900 ${isActiveLink(
                "/journals"
              )}`}
            >
              Journals
            </Link>
            <span className="border-l border-black h-4 mx-2" />
            <Link
              to="/call-for-papers"
              className={`px-6 transition-all duration-300 ease-in-out hover:text-red-700 active:scale-95 active:text-red-900 ${isActiveLink(
                "/call-for-papers"
              )}`}
            >
              Call for Papers
            </Link>
            <span className="border-l border-black h-4 mx-2" />
            <Link
              to="/pub-ethics"
              className={`px-6 transition-all duration-300 ease-in-out hover:text-red-700 active:scale-95 active:text-red-900 ${isActiveLink(
                "/pub-ethics"
              )}`}
            >
              Publication Ethics
            </Link>
            <span className="border-l border-black h-4 mx-2" />
            <Link
              to="/guidelines"
              className={`px-6 transition-all duration-300 ease-in-out hover:text-red-700 active:scale-95 active:text-red-900 ${isActiveLink(
                "/guidelines"
              )}`}
            >
              Guidelines For Submission
            </Link>
          </nav>
          {/* Profile and Sign Out Dropdown */}
          <div className="relative flex items-center ml-auto space-x-4">
            {user ? (
              <div className="relative" ref={profileDropdownRef}>
                <button
                  onClick={toggleDropdown}
                  className="flex items-center justify-center bg-gray-500 w-12 h-12 rounded-full hover:bg-red-600 transition duration-300 shadow-lg border-2 border-white"
                >
                  {user.photoURL ? (
                    <img
                      src={user.photoURL}
                      alt="User profile"
                      className="w-full h-full rounded-full object-cover border-2 border-gray-300 shadow-md"
                    />
                  ) : (
                    <div className="w-full h-full rounded-full bg-white transition-all duration-300 ease-in-out hover:bg-red-700 active:scale-95 active:bg-red-900  flex items-center justify-center">
                      <FontAwesomeIcon
                        icon={faUser}
                        className="text-gray-500 hover:text-white p-3 text-2xl"
                      />
                    </div>
                  )}
                </button>
                {dropdownOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg">
                    <Link
                      to="/profile"
                      className="block px-4 py-2 text-gray-800 rounded-md hover:bg-gray-200"
                    >
                      Profile
                    </Link>
                    {isAdmin && (
                      <Link
                        to="/user-management"
                        className="block px-4 py-2 text-gray-800 hover:bg-gray-200"
                      >
                        User Management
                      </Link>
                    )}
                    <button
                      onClick={handleLogout}
                      className="block w-full text-left rounded-md px-4 py-2 text-red-500 hover:bg-gray-200"
                    >
                      Sign Out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <Link
                to="/signin"
                className="bg-red-700 text-white py-2 px-4 rounded-sm hover:bg-red-800 transition duration-300"
              >
                Sign In
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Contact Us Dropdown Header */}
      <div className="bg-red-800 text-white py-1 fixed w-full mt-14 z-40">
        <div className="flex justify-end mr-4">
          <button
            ref={contactButtonRef}
            onClick={toggleContactDropdown}
            className="text-white text-sm flex items-center"
          >
            Contact Us
            <FontAwesomeIcon
              icon={contactDropdownOpen ? faChevronUp : faChevronDown}
              className="ml-1 transition-transform duration-300"
            />
          </button>
        </div>

        <div
          ref={contactDropdownRef}
          className={`overflow-hidden transition-max-height duration-500 ease-in-out ${
            contactDropdownOpen
              ? "max-h-screen opacity-100"
              : "max-h-0 opacity-0"
          }`}
        >
          <div className="w-full bg-red-800 !shadow-none min-h-full md:h-64">
            <div className="flex flex-col md:flex-row justify-between p-3 h-full">
              {/* Left Side Contact Information */}
              <div className="flex flex-col mb-4 md:mb-0 flex-grow">
                <p className="text-yellow-200 ml-2 md:ml-20 font-bold">
                  Ms. Leilani G. Pimentel
                </p>
                <p className="text-gray-200 ml-2 md:ml-20">
                  Publication Officer
                </p>
                <br />
                <p className="text-yellow-200 ml-2 md:ml-20 mt-3 font-bold">
                  Office of the University Research and Coordination
                </p>
                <p className="text-gray-200 ml-2 md:ml-20 mt-3">
                  Email: ourc@liceo.edu.ph
                </p>
                <p className="text-gray-200 ml-2 md:ml-20 mt-3">
                  Phone: +63 088 880-2047 / +63 08822 722244 local 135
                </p>
                <p className="text-gray-200 ml-2 md:ml-20 mt-3">
                  Fax: +63 088 880-2047
                </p>
              </div>

              {/* Right Side Address */}
              <div className="flex items-start text-gray-200 mb-4 md:mb-0 md:mr-4 flex-grow">
                <p>
                  <span className="text-yellow-200 mr-4 font-bold">
                    Address:
                  </span>
                  <br />
                  Rodolfo Neri Pelaez Boulevard, Kauswagan
                  <br /> Cagayan de Oro, Misamis Oriental, Philippines
                </p>
              </div>

              {/* Logo Section */}
              <div className="flex items-start text-gray-200 flex-grow">
                <img
                  src="/liceo.png" // Adjust the filename if necessary
                  alt="Logo"
                  className="h-24 w-24 md:h-40 md:w-40 mr-10 mt-5"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Navbar;
