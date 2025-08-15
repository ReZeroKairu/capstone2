import React, { useState } from "react";
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

const Sidebar = ({ role }) => {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();

  const toggleSidebar = () => setIsOpen(!isOpen);

  const handleLinkClick = () => {
    if (window.innerWidth < 768) setIsOpen(false);
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
          {!mobile && <span className="ml-3">{link.name}</span>}
        </Link>
      </li>
    ));

  return (
    <>
      {/* Overlay for mobile */}
      <div
        className={`fixed inset-0 bg-black bg-opacity-50 z-20 transition-opacity duration-300 md:hidden ${
          isOpen ? "opacity-100 visible" : "opacity-0 invisible"
        }`}
        onClick={toggleSidebar}
      ></div>

      {/* Desktop Sidebar */}
      <div className="hidden md:block fixed top-0 left-0 h-full w-64 bg-red-800 text-white z-30 overflow-y-auto">
        <div className="text-center py-4 px-6 text-xl font-semibold sticky top-0">
          Menu
        </div>
        <ul className="mt-4">
          {renderLinks(links)}
          {role === "Admin" && renderLinks(adminLinks)}
          {role === "Researcher" && renderLinks(researcherLinks)}
          {role === "Peer Reviewer" && renderLinks(peerReviewerLinks)}
        </ul>
      </div>

      {/* Mobile bottom nav */}
      <div
        className={`fixed bottom-0 left-0 w-full bg-red-800 text-white z-30 md:hidden flex justify-around p-2 ${
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
