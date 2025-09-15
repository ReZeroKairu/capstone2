import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../firebase/firebase";

const STATUS_COLORS = {
  "Assigning Peer Reviewer": "bg-yellow-100 text-yellow-800",
  "Peer Reviewer Assigned": "bg-blue-100 text-blue-800",
  "Peer Reviewer Reviewing": "bg-indigo-100 text-indigo-800",
  "Back to Admin": "bg-purple-100 text-purple-800",
  "For Revision": "bg-orange-100 text-orange-800",
  "For Publication": "bg-green-100 text-green-800",
  "Peer Reviewer Rejected": "bg-red-100 text-red-800",
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
  } = manuscript;

  const navigate = useNavigate();
  const hasReviewer = manuscript.assignedReviewers?.length > 0;
  const [showModal, setShowModal] = useState(false);
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

  const formatDate = (ts) => {
    if (!ts) return "—";
    if (ts.toDate) return ts.toDate().toLocaleString();
    if (ts.seconds) return new Date(ts.seconds * 1000).toLocaleString();
    if (ts instanceof Date) return ts.toLocaleString();
    return ts;
  };

  // --- New: handle admin status changes ---
  const handleStatusChange = async (manuscriptId, newStatus) => {
    try {
      const msRef = doc(db, "manuscripts", manuscriptId);
      await updateDoc(msRef, { status: newStatus });
    } catch (err) {
      console.error("Error updating status:", err);
    }
  };

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
        {hasReviewer && manuscript.assignedReviewersData?.length > 0 && (
          <div className="mt-2">
            {status === "Peer Reviewer Assigned" && (
              <p className="text-sm font-medium text-gray-700 mb-1">
                Peer Reviewer Assigned:
              </p>
            )}
            <div className="flex flex-col gap-2">
              {manuscript.assignedReviewersData.map((r) => {
                const displayName = showFullName[r.id]
                  ? `${r.firstName} ${r.middleName} ${r.lastName}`.trim()
                  : `${r.firstName} ${
                      r.middleName ? r.middleName.charAt(0) + "." : ""
                    } ${r.lastName}`.trim();

                const assignedByUser = users.find((u) => u.id === r.assignedBy);
                const assignedByName = assignedByUser
                  ? `${assignedByUser.firstName} ${
                      assignedByUser.middleName
                        ? assignedByUser.middleName + " "
                        : ""
                    }${assignedByUser.lastName}`
                  : r.assignedBy || "—";

                const decisionMeta =
                  manuscript.reviewerDecisionMeta?.[r.id] || null;

                return (
                  <div key={r.id} className="bg-blue-50 px-2 py-1 rounded-md">
                    <span
                      className="text-blue-800 text-xs sm:text-sm font-medium cursor-pointer"
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
                    <div className="text-xs text-gray-500">
                      Assigned At: {formatDate(r.assignedAt)}
                      <br />
                      Assigned By: {assignedByName}
                      {decisionMeta && (
                        <>
                          <br />
                          {decisionMeta.decision === "accept"
                            ? "Accepted by reviewer at: "
                            : decisionMeta.decision === "reject"
                            ? "Rejected by reviewer at: "
                            : ""}
                          {formatDate(decisionMeta.decidedAt)}
                        </>
                      )}
                    </div>
                  </div>
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

        {/* --- New: Back to Admin Section --- */}
        {status === "Back to Admin" && (
          <div className="mt-4 border-t pt-3">
            {/* Peer Reviewer Feedback */}
            {manuscript.reviewerSubmissions?.length > 0 && (
              <div className="mb-2">
                <p className="font-medium text-gray-700 mb-1">
                  Peer Reviewer Feedback:
                </p>
                <ul className="space-y-1">
                  {manuscript.reviewerSubmissions.map((r, idx) => {
                    const reviewer = manuscript.assignedReviewersData?.find(
                      (u) => u.id === r.reviewerId
                    );
                    return (
                      <li
                        key={idx}
                        className="bg-gray-50 p-2 rounded border border-gray-200"
                      >
                        <p className="text-sm font-medium">
                          Reviewer:{" "}
                          {reviewer
                            ? `${reviewer.firstName} ${
                                reviewer.middleName
                                  ? reviewer.middleName.charAt(0) + "."
                                  : ""
                              } ${reviewer.lastName}`
                            : r.reviewerId}
                        </p>
                        <p className="text-xs text-gray-600">
                          Rating: {r.rating ?? "—"}
                        </p>
                        <p className="text-xs text-gray-600">
                          Comment: {r.comment || "—"}
                        </p>
                        <p className="text-xs text-gray-400">
                          Completed:{" "}
                          {r.completedAt?.toDate
                            ? r.completedAt.toDate().toLocaleString()
                            : r.completedAt || "—"}
                        </p>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            {/* Status Buttons */}
            <div className="flex flex-wrap gap-2 mt-2">
              {[
                "For Revision",
                "For Publication",
                "Peer Reviewer Rejected",
              ].map((s) => (
                <button
                  key={s}
                  onClick={() => handleStatusChange(id, s)}
                  className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
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
            <div className="text-sm text-gray-600 mb-4">
              <strong>User:</strong> {firstName} {middleName} {lastName} |{" "}
              <strong>Email:</strong> {email} | <strong>Role:</strong>{" "}
              {userRole || "N/A"} | <strong>Submitted at:</strong>{" "}
              {formatDate(submittedAt)}
            </div>

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
