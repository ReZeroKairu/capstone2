import React, { useEffect } from "react";
import { HiTrendingUp } from "react-icons/hi";
import {
  FaHome,
  FaBullhorn,
  FaUsers,
  FaFileUpload,
  FaBook,
  FaBars,
  FaTimes,
  FaWpforms,
  FaInbox,
} from "react-icons/fa";
import { Link, useLocation } from "react-router-dom";

const Sidebar = ({ role, isOpen, toggleSidebar }) => {
  const location = useLocation();

  // Close desktop sidebar when switching to mobile
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768 && isOpen) {
        toggleSidebar(false);
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
      icon: <HiTrendingUp className="text-xl" />,
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
    {
      name: "Form Creation",
      path: "/createform",
      icon: <FaWpforms className="text-xl" />,
    },
    {
      name: "Responses",
      path: "/formresponses",
      icon: <FaInbox className="text-xl" />,
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
          className={`flex items-center justify-center md:justify-start px-4 py-3 mb-2 rounded-lg mx-3 ${
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
          <div className="flex items-center py-4 pt-28 px-4">
            {/* X button */}
            <button
              type="button"
              onClick={() => toggleSidebar(false)}
              className="bg-red-800 border border-white text-white w-10 h-10 flex items-center justify-center rounded hover:bg-red-700"
            >
              <FaTimes />
            </button>
            {/* Menu label */}
            <span className="text-xl font-semibold ml-3">Menu</span>
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

      {/* Desktop burger toggle (only visible when sidebar is closed) */}
      {!isOpen && (
        <button
          type="button"
          onClick={() => toggleSidebar(true)}
          className="hidden md:flex bg-red-800 border border-white text-white w-10 h-10 items-center justify-center rounded hover:bg-red-700 z-30 outline-none focus:outline-none"
          style={{ position: "fixed", top: "5.5rem", left: "0.5rem" }}
        >
          <FaBars />
        </button>
      )}

      {/* Mobile Bottom Menu - always stick to bottom */}
      <div className="md:hidden fixed bottom-0 left-0 w-full bg-red-800 text-white z-30 flex justify-around p-2 h-16">
        {renderLinks(links, true)}
        {role === "Admin" && renderLinks(adminLinks, true)}
        {role === "Researcher" && renderLinks(researcherLinks, true)}
        {role === "Peer Reviewer" && renderLinks(peerReviewerLinks, true)}
      </div>
    </>
  );
};

export default Sidebar;
