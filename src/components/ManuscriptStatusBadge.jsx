// src/components/Manuscripts/ManuscriptStatusBadge.jsx
import React from "react";
import { getRemainingTime } from "../utils/deadlineUtils";

const statusColors = {
  Pending: "bg-gray-100 text-gray-800",
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
  revisionDeadline,
  finalizationDeadline,
  className = "",
}) => {
  const getStatusText = () => {
    let deadline = null;

    if (
      status === "For Revision (Minor)" ||
      status === "For Revision (Major)"
    ) {
      deadline = revisionDeadline;
    } else if (status === "In Finalization") {
      deadline = finalizationDeadline;
    }

    if (deadline) {
      const { days, hours, minutes, totalMs } = getRemainingTime(deadline);
      const isOverdue = totalMs <= 0;

      return (
        <>
          <span>{status}</span>
          <span className="ml-2 text-xs font-normal">
            {isOverdue
              ? `Overdue by ${days}d ${hours}h ${minutes}m`
              : `Due in ${days}d ${hours}h ${minutes}m`}
          </span>
        </>
      );
    }

    return status;
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
        statusColors[status] || statusColors.default
      } ${className}`}
    >
      {getStatusText()}
    </span>
  );
};

export default ManuscriptStatusBadge;
