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
  FaEnvelope,
  FaClock,
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
    { name: "Home", path: "/home", icon: <FaHome className="text-xl" /> },
    {
      name: "Announcements",
      path: "/announcement",
      icon: <FaBullhorn className="text-lg" />,
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
      name: "Submission Form",
      path: "/createform",
      icon: <FaWpforms className="text-xl" />,
    },
    {
      name: "Responses",
      path: "/formresponses",
      icon: <FaInbox className="text-xl" />,
    },
    {
      name: "Deadline Settings",
      path: "/admin/deadline-settings",
      icon: <FaClock className="text-xl" />,
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
      name: "Manuscripts",
      path: "/manuscripts",
      icon: <FaBook className="text-xl" />,
    },
    {
      name: "Review Manuscript",
      path: "/review-manuscript",
      icon: <FaFileUpload className="text-xl" />,
    },
    {
      name: "Review Invitations",
      path: "/reviewer-invitations",
      icon: <FaEnvelope className="text-xl" />,
    }
  ];

  const renderLinks = (linkArray, mobile = false) =>
    linkArray.map((link) => (
      <li key={link.name} className={mobile ? "flex-1 text-center" : ""}>
        <div className={mobile ? "mx-1" : "mx-4"}>
          <Link
            to={link.path}
            onClick={() => {
              handleLinkClick();
              if (!mobile) {
                // Small visual feedback on desktop
                const el = document.activeElement;
                if (el) {
                  el.classList.add("scale-95");
                  setTimeout(() => el.classList.remove("scale-95"), 150);
                }
              }
            }}
            className={`flex items-center rounded justify-start px-4 py-2 mb-1 transition-all duration-150
          ${
            location.pathname === link.path
              ? "bg-white text-black font-bold shadow"
              : "text-white hover:bg-white hover:text-black hover:font-bold"
          } w-auto max-w-[230px] active:scale-95`}
          >
            {link.icon}
            {!mobile && isOpen && <span className="ml-2">{link.name}</span>}
          </Link>
        </div>
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

      {/* Desktop burger/X toggle */}
      <button
        type="button"
        onClick={() => toggleSidebar(!isOpen)}
        className="hidden md:flex bg-red-700 hover:bg-red-600 active:bg-red-500 text-white w-10 h-10 items-center justify-center rounded z-30 outline-none focus:outline-none"
        style={{ position: "fixed", top: "6.8rem", left: "0.5rem" }}
      >
        {isOpen ? <FaTimes /> : <FaBars />}
      </button>

      {/* Mobile Bottom Menu - horizontally scrollable with subtle scrollbar */}
      <div className="md:hidden fixed bottom-0 left-0 w-full bg-red-800 text-white z-30 overflow-x-auto scrollbar-thin scrollbar-thumb-yellow-500 scrollbar-track-red-800">
        <ul className="flex flex-nowrap p-2 gap-2 min-w-max">
          {renderLinks(links, true)}
          {role === "Admin" && renderLinks(adminLinks, true)}
          {role === "Researcher" && renderLinks(researcherLinks, true)}
          {role === "Peer Reviewer" && renderLinks(peerReviewerLinks, true)}
        </ul>
      </div>
    </>
  );
};

export default Sidebar;
