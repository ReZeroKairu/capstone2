import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

const STATUS_COLORS = {
  "Assigning Peer Reviewer": "bg-yellow-100 text-yellow-800",
  "Peer Reviewer Assigned": "bg-blue-100 text-blue-800",
  "Peer Reviewer Reviewing": "bg-indigo-100 text-indigo-800",
  "Back to Admin": "bg-purple-100 text-purple-800",
  "For Revision": "bg-orange-100 text-orange-800",
  "For Publication": "bg-green-100 text-green-800",
  Rejected: "bg-red-100 text-red-800",
};

const ManuscriptItem = ({
  manuscript = {},
  role,
  showAssignList = false,
  users = [],
  handleAssign = () => {},
  unassignReviewer = () => {},
}) => {
  if (!manuscript || Object.keys(manuscript).length === 0) return null;

  const {
    id,
    title,
    answeredQuestions = [],
    firstName,
    middleName = "",
    lastName,
    role: userRole,
    email,
    submittedAt,
    acceptedAt,
    status,
    assignedReviewersNames = [], // now array of {id, firstName, middleName, lastName}
  } = manuscript;

  const navigate = useNavigate();
  const hasReviewer = manuscript.assignedReviewers?.length > 0;
  const [showModal, setShowModal] = useState(false);

  // local state for toggling full name per reviewer
  const [showFullName, setShowFullName] = useState({});

  const manuscriptTitle =
    title ||
    answeredQuestions?.find((q) =>
      q.question?.toLowerCase().trim().startsWith("manuscript title")
    )?.answer ||
    "Untitled";

  const showAssignButton =
    role === "Admin" &&
    (status === "Assigning Peer Reviewer" ||
      status === "Peer Reviewer Assigned");

  const formatDate = (ts) =>
    ts?.toDate?.()?.toLocaleString?.() ||
    (ts?.seconds ? new Date(ts.seconds * 1000).toLocaleString() : "");

  return (
    <>
      <li className="border rounded-xl shadow-md hover:shadow-xl transition-all bg-gradient-to-br from-white to-gray-50 w-full sm:w-auto p-4">
        {/* Header */}
        <div className="flex justify-between items-center">
          <p className="font-bold text-lg sm:text-xl break-words">
            {manuscriptTitle}
          </p>
          <span
            className={`px-3 py-1 rounded-full text-xs sm:text-sm font-semibold shadow-sm ${
              STATUS_COLORS[status] || "bg-gray-100 text-gray-800"
            }`}
          >
            {status}
          </span>
        </div>

        {/* Author & meta */}
        <div className="mt-2 text-sm sm:text-base text-gray-600 break-words space-y-0.5">
          <p>
            By{" "}
            <span className="font-semibold">
              {firstName || "Unknown"}{" "}
              {middleName ? middleName.charAt(0) + "." : ""} {lastName || ""}
            </span>{" "}
            ({userRole || "N/A"})
          </p>
          {email && <p>Email: {email}</p>}
          {submittedAt && <p>Submitted: {formatDate(submittedAt)}</p>}
          {acceptedAt && <p>Accepted: {formatDate(acceptedAt)}</p>}
        </div>

        {/* Assigned reviewers */}
        {hasReviewer && assignedReviewersNames.length > 0 && (
          <div className="mt-2">
            {status === "Peer Reviewer Assigned" && (
              <p className="text-sm font-medium text-gray-700 mb-1">
                Peer Reviewer Assigned:
              </p>
            )}
            <div className="flex flex-wrap gap-1">
              {assignedReviewersNames.map((r, idx) => {
                const displayName = showFullName[r.id]
                  ? `${r.firstName} ${r.middleName} ${r.lastName}`.trim()
                  : `${r.firstName} ${
                      r.middleName ? r.middleName.charAt(0) + "." : ""
                    } ${r.lastName}`.trim();

                return (
                  <span
                    key={idx}
                    className="bg-blue-100 text-blue-800 text-xs sm:text-sm px-2 py-1 rounded-full font-medium cursor-pointer"
                    onClick={() =>
                      setShowFullName((prev) => ({
                        ...prev,
                        [r.id]: !prev[r.id],
                      }))
                    }
                    title="Click to toggle full name"
                  >
                    {displayName}
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="mt-3 flex flex-col sm:flex-row sm:items-center gap-2">
          <button
            onClick={() => setShowModal(true)}
            className="px-4 py-2 bg-yellow-400 text-[#211B17] rounded-lg hover:bg-yellow-500 transition font-medium text-sm sm:text-base"
          >
            View Response
          </button>

          {showAssignButton &&
            (!hasReviewer ? (
              <button
                onClick={() =>
                  navigate(`/admin/reviewer-list?manuscriptId=${id}`)
                }
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition font-medium text-sm sm:text-base"
              >
                Assign Reviewer
              </button>
            ) : (
              <button
                onClick={() => unassignReviewer(id)}
                className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition font-medium text-sm sm:text-base"
              >
                Unassign Reviewer
              </button>
            ))}

          {showAssignList && (
            <ul className="mt-2 border rounded-lg p-3 bg-gray-50 max-h-60 overflow-y-auto space-y-2 shadow-inner">
              {users
                .filter((u) => u.role === "Peer Reviewer")
                .map((r) => (
                  <li
                    key={r.id}
                    className="flex justify-between items-center px-2 py-1 bg-white rounded hover:bg-gray-100 transition"
                  >
                    <span className="font-medium">
                      {r.firstName}{" "}
                      {r.middleName ? r.middleName.charAt(0) + "." : ""}{" "}
                      {r.lastName}
                    </span>
                    <button
                      onClick={() => handleAssign(id, r.id)}
                      className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600 text-xs sm:text-sm transition"
                    >
                      Assign
                    </button>
                  </li>
                ))}
            </ul>
          )}
        </div>
      </li>

      {/* View Response Modal */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
          onClick={() => setShowModal(false)}
        >
          <div
            className="bg-white rounded-md p-6 max-w-2xl w-full shadow-lg border overflow-y-auto max-h-[80vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* User Info */}
            <div className="text-sm text-gray-600 mb-4">
              <strong>User:</strong> {firstName} {middleName} {lastName} |{" "}
              <strong>Email:</strong> {email} | <strong>Role:</strong>{" "}
              {userRole || "N/A"} | <strong>Submitted at:</strong>{" "}
              {formatDate(submittedAt)}
            </div>

            {/* Answers */}
            <div className="space-y-4 mb-4">
              {answeredQuestions
                .filter(
                  (q) =>
                    !q.question
                      ?.toLowerCase()
                      .trim()
                      .startsWith("manuscript title")
                )
                .map((q, idx) => (
                  <div
                    key={idx}
                    className="bg-gray-50 p-3 rounded-md border border-gray-200"
                  >
                    <div className="font-semibold mb-1">{q.question}</div>
                    <div className="text-gray-800 text-sm">
                      {Array.isArray(q.answer)
                        ? q.answer
                            .map((a) =>
                              a?.name
                                ? `${a.name}${a.email ? ` (${a.email})` : ""}`
                                : a
                            )
                            .join(", ")
                        : q.answer || "—"}
                    </div>
                  </div>
                ))}
            </div>

            {/* Status */}
            <div className="mb-4 text-sm font-semibold">
              Status: <span className="font-normal">{status}</span>
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 bg-gray-300 text-gray-800 rounded-md font-semibold hover:bg-gray-400 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ManuscriptItem;
