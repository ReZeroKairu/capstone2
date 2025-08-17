import React, { useEffect } from "react";
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
import { Link, useLocation } from "react-router-dom";

const Sidebar = ({ role, isOpen, toggleSidebar }) => {
  const location = useLocation();

  // Reset desktop sidebar when switching to mobile
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768 && isOpen) {
        toggleSidebar(false); // close desktop sidebar
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [isOpen, toggleSidebar]);

  const handleLinkClick = () => {
    if (window.innerWidth < 768) return; // mobile links just navigate
  };

  const links = [
    { name: "Home", path: "/home", icon: <FaHome className="text-2xl" /> },
    {
      name: "Announcements",
      path: "/announcement",
      icon: <FaBullhorn className="text-xl" />,
    },
    {
      name: "Dashboard",
      path: "/dashboard",
      icon: <FaTachometerAlt className="text-xl" />,
    },
  ];

  const adminLinks = [
    {
      name: "User Management",
      path: "/user-management",
      icon: <FaUsers className="text-xl" />,
    },
    {
      name: "Manuscripts",
      path: "/manuscripts",
      icon: <FaBook className="text-xl" />,
    },
  ];

  const researcherLinks = [
    {
      name: "Submit Manuscript",
      path: "/submit-manuscript",
      icon: <FaFileUpload className="text-xl" />,
    },
    {
      name: "Manuscripts",
      path: "/manuscripts",
      icon: <FaBook className="text-xl" />,
    },
  ];

  const peerReviewerLinks = [
    {
      name: "Review Manuscript",
      path: "/review-manuscript",
      icon: <FaFileUpload className="text-xl" />,
    },
  ];

  const renderLinks = (linkArray, mobile = false) =>
    linkArray.map((link) => (
      <li key={link.name} className={mobile ? "flex-1 text-center" : ""}>
        <Link
          to={link.path}
          onClick={handleLinkClick}
          className={`flex items-center justify-center md:justify-start px-4 py-3 mb-1 rounded-lg ${
            location.pathname === link.path
              ? "bg-white text-black font-bold"
              : "text-white hover:bg-white hover:text-black hover:font-bold"
          }`}
        >
          {link.icon}
          {!mobile && isOpen && <span className="ml-3">{link.name}</span>}
        </Link>
      </li>
    ));

  return (
    <>
      {/* Desktop Sidebar */}
      <div
        className={`hidden md:block fixed top-0 left-0 h-full bg-red-800 text-white z-30 overflow-y-auto transition-all duration-300 ${
          isOpen ? "w-64" : "w-0"
        }`}
      >
        {isOpen && (
          <div className="py-4 pt-28 pl-24 px-6">
            <span className="text-xl font-semibold">Menu</span>
          </div>
        )}

        {isOpen && (
          <ul className="mt-4">
            {renderLinks(links)}
            {role === "Admin" && renderLinks(adminLinks)}
            {role === "Researcher" && renderLinks(researcherLinks)}
            {role === "Peer Reviewer" && renderLinks(peerReviewerLinks)}
          </ul>
        )}
      </div>

      {/* Floating burger/X button on desktop only */}
      <button
        type="button"
        onClick={() => toggleSidebar(!isOpen)}
        className="hidden md:flex bg-red-700 hover:bg-red-600 active:bg-red-800 text-white w-10 h-10 items-center justify-center rounded z-50 outline-none focus:outline-none"
        style={{
          position: "fixed",
          top: "7rem",
          left: "0.5rem",
        }}
      >
        {isOpen ? <FaTimes /> : <FaBars />}
      </button>

      {/* Mobile Bottom Menu (unchanged) */}
      <div
        className={`md:hidden fixed bottom-0 left-0 w-full bg-red-800 text-white z-30 flex justify-around p-2 ${
          isOpen ? "h-48 flex-col" : "h-16"
        } transition-all duration-300`}
      >
        {renderLinks(links, true)}
        {role === "Admin" && renderLinks(adminLinks, true)}
        {role === "Researcher" && renderLinks(researcherLinks, true)}
        {role === "Peer Reviewer" && renderLinks(peerReviewerLinks, true)}
      </div>
    </>
  );
};

export default Sidebar;
