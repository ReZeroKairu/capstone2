// src/components/Manuscripts/ManuscriptStatusBadge.jsx
import React from "react";

const statusColors = {
  Pending: "bg-gray-100 text-gray-800",
  Accepted: "bg-teal-100 text-teal-800",
  "Assigning Peer Reviewer": "bg-blue-100 text-blue-800",
  "Peer Reviewer Assigned": "bg-indigo-100 text-indigo-800",
  "Peer Reviewer Reviewing": "bg-purple-100 text-purple-800",
  "Back to Admin": "bg-yellow-100 text-yellow-800",
  "For Revision (Minor)": "bg-orange-100 text-orange-800",
  "For Revision (Major)": "bg-orange-200 text-orange-900",
  "In Finalization": "bg-blue-100 text-blue-800",
  "For Publication": "bg-green-100 text-green-800",
  Rejected: "bg-red-100 text-red-800",
  "Revision Overdue": "bg-red-700 text-white",
  Finalized: "bg-green-100 text-green-800",
  default: "bg-gray-100 text-gray-800",
};

const ManuscriptStatusBadge = ({
  status,
  className = "",
}) => {
  return (
    <span
      className={`inline-flex items-center px-3 py-1 rounded-full text-xs sm:text-sm font-medium ${statusColors[status] || statusColors.default} ${className}`}
    >
      {status}
    </span>
  );
};

export default ManuscriptStatusBadge;
