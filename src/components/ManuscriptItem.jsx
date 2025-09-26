import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { doc, updateDoc, getDoc } from "firebase/firestore";
import { db } from "../firebase/firebase";
import {
  computeManuscriptStatus,
  filterAcceptedReviewers,
  filterRejectedReviewers,
} from "../utils/manuscriptHelpers";
import { getDownloadURL, ref } from "firebase/storage";
import { storage } from "../firebase/firebase";

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
const decisionLabels = {
  accept: "Accepted",
  reject: "Rejected",
  backedOut: "Backed Out",
  pending: "Pending",
};

const ManuscriptItem = ({
  manuscript = {},
  role,
  users = [],
  handleAssign = () => {},
  unassignReviewer = () => {},
  showFullName,
  setShowFullName,
  formatFirestoreDate, // Not used but passed from parent
  handleStatusChange: externalHandleStatusChange, // Not used but passed from parent
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

  const hasRejection =
    manuscript.reviewerDecisionMeta &&
    Object.values(manuscript.reviewerDecisionMeta).some(
      (d) => d.decision === "reject"
    );

  const manuscriptTitle =
    title ||
    answeredQuestions?.find((q) =>
      q.question?.toLowerCase().trim().startsWith("manuscript title")
    )?.answer ||
    "Untitled";

  const showAssignButton =
    role === "Admin" &&
    ["Assigning Peer Reviewer", "Peer Reviewer Assigned"].includes(status);

  const formatDate = (ts) => {
    if (!ts) return "—";
    if (ts.toDate) return ts.toDate().toLocaleString();
    if (ts.seconds) return new Date(ts.seconds * 1000).toLocaleString();
    if (ts instanceof Date) return ts.toLocaleString();
    return ts;
  };

  const handleStatusChange = async (manuscriptId, newStatus) => {
    try {
      const msRef = doc(db, "manuscripts", manuscriptId);
      const snapshot = await getDoc(msRef);
      if (!snapshot.exists()) return;

      const ms = snapshot.data();
      let updatedAssignedReviewers = ms.assignedReviewersData || [];
      let updatedAssignedMeta = ms.assignedReviewersMeta || {};

      if (newStatus === "For Publication") {
        // Keep only reviewers who accepted
        // Convert assignedReviewers IDs to the format expected by filter function
        const reviewerObjects = (ms.assignedReviewers || []).map(id => ({ id }));
        const acceptedReviewerObjects = filterAcceptedReviewers(
          ms.reviewerDecisionMeta,
          reviewerObjects
        );
        
        // Build reviewer data from accepted reviewer IDs and users array
        const acceptedReviewerIds = acceptedReviewerObjects.map(r => r.id);
        updatedAssignedReviewers = acceptedReviewerIds.map(id => {
          const user = users.find(u => u.id === id);
          const meta = ms.assignedReviewersMeta?.[id] || {};
          return {
            id,
            firstName: user?.firstName || "",
            middleName: user?.middleName || "",
            lastName: user?.lastName || "",
            email: user?.email || "",
            assignedAt: meta.assignedAt || null,
            assignedBy: meta.assignedBy || "—",
          };
        });

        // Build new assignedReviewersMeta
        const newMeta = {};
        updatedAssignedReviewers.forEach((r) => {
          newMeta[r.id] = ms.assignedReviewersMeta?.[r.id] || {
            assignedAt: r.assignedAt,
            assignedBy: r.assignedBy,
          };
        });
        updatedAssignedMeta = newMeta;

        // Update reviewer stats for accepted reviewers
        updatedAssignedReviewers.forEach(async (r) => {
          const reviewerRef = doc(db, "Users", r.id);
          await updateDoc(reviewerRef, {
            acceptedManuscripts: (r.acceptedManuscripts || 0) + 1,
          });
        });
      } else if (newStatus === "Peer Reviewer Rejected") {
        // Keep only reviewers who rejected
        // Convert assignedReviewers IDs to the format expected by filter function
        const reviewerObjects = (ms.assignedReviewers || []).map(id => ({ id }));
        const rejectedReviewerObjects = filterRejectedReviewers(
          ms.reviewerDecisionMeta,
          reviewerObjects
        );
        
        // Build reviewer data from rejected reviewer IDs and users array
        const rejectedReviewerIds = rejectedReviewerObjects.map(r => r.id);
        updatedAssignedReviewers = rejectedReviewerIds.map(id => {
          const user = users.find(u => u.id === id);
          const meta = ms.assignedReviewersMeta?.[id] || {};
          return {
            id,
            firstName: user?.firstName || "",
            middleName: user?.middleName || "",
            lastName: user?.lastName || "",
            email: user?.email || "",
            assignedAt: meta.assignedAt || null,
            assignedBy: meta.assignedBy || "—",
          };
        });

        // Build new assignedReviewersMeta
        const newMeta = {};
        updatedAssignedReviewers.forEach((r) => {
          newMeta[r.id] = ms.assignedReviewersMeta?.[r.id] || {
            assignedAt: r.assignedAt,
            assignedBy: r.assignedBy,
          };
        });
        updatedAssignedMeta = newMeta;

        // Update reviewer stats for rejected reviewers
        updatedAssignedReviewers.forEach(async (r) => {
          const reviewerRef = doc(db, "Users", r.id);
          await updateDoc(reviewerRef, {
            rejectedManuscripts: (r.rejectedManuscripts || 0) + 1,
          });
        });
      }

      // When admin makes a decision, use that status directly (don't compute)
      await updateDoc(msRef, {
        status: newStatus, // Use the admin's chosen status directly
        assignedReviewers: updatedAssignedReviewers.map((r) => r.id),
        assignedReviewersMeta: updatedAssignedMeta,
        // Keep original reviewer history for peer reviewer access and admin info
        originalAssignedReviewers: ms.assignedReviewers || [],
        originalAssignedReviewersMeta: ms.assignedReviewersMeta || {},
        // Add decision timestamp
        finalDecisionAt: new Date(),
        finalDecisionBy: "Admin", // You might want to pass the actual admin ID
      });
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
          <div className="flex items-center gap-2">
            {hasRejection &&
              (status === "Back to Admin" || status === "Rejected") && (
                <span className="px-3 py-1 rounded-full text-xs sm:text-sm font-semibold shadow-sm bg-red-100 text-red-800">
                  Rejected by Peer Reviewer
                </span>
              )}
            <span
              className={`px-3 py-1 rounded-full text-xs sm:text-sm font-semibold shadow-sm ${
                STATUS_COLORS[status] || "bg-gray-100 text-gray-800"
              }`}
            >
              {status}
            </span>
          </div>
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
            {["Peer Reviewer Assigned", "Peer Reviewer Reviewing"].includes(
              status
            ) && (
              <p className="text-sm font-medium text-gray-700 mb-1">
                Peer Reviewer
                {manuscript.assignedReviewersData.length > 1 ? "s" : ""}{" "}
                Assigned:
              </p>
            )}
            <div className="flex flex-col gap-2">
              {manuscript.assignedReviewersData.map((r) => {
                const key = `${manuscript.id}_${r.id}`;
                const displayName = showFullName[key]
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
                          [key]: !prev[key],
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
                      {decisionMeta?.decision && (
                        <>
                          <br />
                          {decisionMeta.decision === "reject" &&
                          [
                            "Back to Admin",
                            "Rejected",
                            "Peer Reviewer Rejected",
                          ].includes(manuscript.status) ? (
                            <span className="text-red-600">
                              Rejected by reviewer at:{" "}
                              {formatDate(decisionMeta.decidedAt)}
                            </span>
                          ) : decisionMeta.decision === "accept" ? (
                            <span className="text-green-600">
                              Accepted by reviewer at:{" "}
                              {formatDate(decisionMeta.decidedAt)}
                            </span>
                          ) : (
                            <span className="text-gray-600">
                              {decisionLabels[decisionMeta.decision] ||
                                decisionMeta.decision}{" "}
                              at: {formatDate(decisionMeta.decidedAt)}
                            </span>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Detailed Peer Reviewer Info for Final Status Manuscripts */}
        {role === "Admin" && 
         ["For Publication", "For Revision", "Peer Reviewer Rejected"].includes(status) && (
          <div className="mt-3 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
            <h4 className="text-base font-semibold text-gray-800 mb-3 flex items-center">
              <span className="w-2 h-2 bg-blue-500 rounded-full mr-2"></span>
              Peer Review Details
            </h4>
            
            {manuscript.finalDecisionAt && (
              <div className="mb-3 p-2 bg-white rounded border-l-4 border-blue-500">
                <p className="text-sm">
                  <span className="font-medium text-gray-700">Final Admin Decision:</span>{" "}
                  <span className="text-blue-600 font-medium">{status}</span> on{" "}
                  <span className="font-medium">{formatDate(manuscript.finalDecisionAt)}</span>
                </p>
              </div>
            )}

            <div className="space-y-3">
              {(manuscript.originalAssignedReviewers || manuscript.assignedReviewers || []).map((reviewerId) => {
                const reviewerMeta = manuscript.originalAssignedReviewersMeta?.[reviewerId] || 
                                   manuscript.assignedReviewersMeta?.[reviewerId];
                const reviewer = users.find(u => u.id === reviewerId);
                const assignedByUser = users.find(u => u.id === reviewerMeta?.assignedBy);
                const decision = manuscript.reviewerDecisionMeta?.[reviewerId];
                const submission = manuscript.reviewerSubmissions?.find(s => s.reviewerId === reviewerId);
                
                if (!reviewer && !decision && !submission) return null;
                
                return (
                  <div key={reviewerId} className="bg-white p-3 rounded-lg border shadow-sm">
                    {/* Reviewer Header */}
                    <div className="flex items-center justify-between mb-2">
                      <h5 className="font-medium text-gray-800">
                        {reviewer ? `${reviewer.firstName} ${reviewer.middleName ? reviewer.middleName + ' ' : ''}${reviewer.lastName}` : 'Unknown Reviewer'}
                        {reviewer?.role && <span className="text-gray-500 text-sm ml-1">({reviewer.role})</span>}
                      </h5>
                      {decision && (
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          decision.decision === 'accept' 
                            ? 'bg-green-100 text-green-700' 
                            : 'bg-red-100 text-red-700'
                        }`}>
                          {decision.decision === 'accept' ? 'Accepted' : 'Rejected'}
                        </span>
                      )}
                    </div>

                    {/* Reviewer Details */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-gray-600 mb-2">
                      {reviewer?.email && (
                        <p><span className="font-medium">Email:</span> {reviewer.email}</p>
                      )}
                      {reviewerMeta?.assignedAt && (
                        <p><span className="font-medium">Assigned:</span> {formatDate(reviewerMeta.assignedAt)}</p>
                      )}
                      {assignedByUser && (
                        <p><span className="font-medium">Assigned by:</span> {assignedByUser.firstName} {assignedByUser.lastName}</p>
                      )}
                      {decision?.decidedAt && (
                        <p><span className="font-medium">Decision made:</span> {formatDate(decision.decidedAt)}</p>
                      )}
                    </div>

                    {/* Review Submission Details */}
                    {submission && (
                      <div className="mt-2 p-2 bg-gray-50 rounded border-l-4 border-gray-400">
                        <p className="text-sm font-medium text-gray-700 mb-1">Review Submission:</p>
                        <div className="text-sm text-gray-600 space-y-1">
                          <p><span className="font-medium">Rating:</span> {submission.rating || 'Not provided'}/5</p>
                          <p><span className="font-medium">Submitted:</span> {formatDate(submission.completedAt)}</p>
                          {submission.comment && (
                            <div>
                              <p className="font-medium">Comments:</p>
                              <p className="mt-1 p-2 bg-white rounded border text-xs italic">
                                "{submission.comment}"
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="mt-3 flex flex-col sm:flex-row sm:items-center gap-2">
          {role !== "Peer Reviewer" && (
            <button
              onClick={() => setShowModal(true)}
              className="px-4 py-2 bg-yellow-400 text-[#211B17] rounded-lg hover:bg-yellow-500 transition font-medium text-sm sm:text-base"
            >
              View Response
            </button>
          )}

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
        </div>

        {/* --- Back to Admin Section --- */}
        {status === "Back to Admin" && role === "Admin" && (
          <div className="mt-4 border-t pt-3">
            {manuscript.reviewerSubmissions?.length > 0 ? (
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
            ) : manuscript.reviewerDecisionMeta ? (
              <div className="mb-2">
                <p className="font-medium text-gray-700 mb-1">
                  Reviewer Decisions:
                </p>
                <ul className="list-disc ml-4 text-sm text-gray-700">
                  {Object.entries(manuscript.reviewerDecisionMeta).map(
                    ([revId, meta]) => {
                      const reviewer = manuscript.assignedReviewersData?.find(
                        (u) => u.id === revId
                      );
                      return (
                        <li key={revId}>
                          {reviewer
                            ? `${reviewer.firstName} ${
                                reviewer.middleName
                                  ? reviewer.middleName.charAt(0) + "."
                                  : ""
                              } ${reviewer.lastName}`
                            : revId}
                          : {decisionLabels[meta.decision] || meta.decision}{" "}
                          {meta.decidedAt
                            ? `at ${formatDate(meta.decidedAt)}`
                            : ""}
                        </li>
                      );
                    }
                  )}
                </ul>
              </div>
            ) : (
              <p className="text-sm text-gray-500">
                No reviewer feedback or decisions yet.
              </p>
            )}

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
    .map((q, idx) => {
      // Handle file downloads
      if (q.type === "file" && q.answer) {
        const files = Array.isArray(q.answer) ? q.answer : [q.answer];
        return (
          <div
            key={idx}
            className="bg-gray-50 p-3 rounded-md border border-gray-200"
          >
            <div className="font-semibold mb-1">{q.question}</div>
            <div className="space-y-2">
              {files.map((file, fileIdx) => {
                // If it's already a file object with URL
                if (file.url) {
                  return (
                    <a
                      key={fileIdx}
                      href={file.url}
                      download={file.name || `file-${fileIdx + 1}`}
                      className="text-blue-600 hover:text-blue-800 underline flex items-center"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <svg
                        className="w-4 h-4 mr-1"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                        />
                      </svg>
                      {file.name || `File ${fileIdx + 1}`}
                    </a>
                  );
                }
                // If it's a storage path
                else if (file.path || file.storagePath) {
                  const filePath = file.path || file.storagePath;
                  return (
                    <button
                      key={fileIdx}
                      onClick={async () => {
                        try {
                          const url = await getDownloadURL(ref(storage, filePath));
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = file.name || filePath.split('/').pop() || 'download';
                          document.body.appendChild(a);
                          a.click();
                          document.body.removeChild(a);
                        } catch (error) {
                          console.error('Error downloading file:', error);
                          alert('Error downloading file. Please try again.');
                        }
                      }}
                      className="text-blue-600 hover:text-blue-800 underline flex items-center"
                    >
                      <svg
                        className="w-4 h-4 mr-1"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                        />
                      </svg>
                      {file.name || filePath.split('/').pop() || `File ${fileIdx + 1}`}
                    </button>
                  );
                }
                // Fallback for string paths
                else if (typeof file === 'string') {
                  return (
                    <button
                      key={fileIdx}
                      onClick={async () => {
                        try {
                          const url = await getDownloadURL(ref(storage, file));
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = file.split('/').pop() || 'download';
                          document.body.appendChild(a);
                          a.click();
                          document.body.removeChild(a);
                        } catch (error) {
                          console.error('Error downloading file:', error);
                          alert('Error downloading file. Please try again.');
                        }
                      }}
                      className="text-blue-600 hover:text-blue-800 underline flex items-center"
                    >
                      <svg
                        className="w-4 h-4 mr-1"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                        />
                      </svg>
                      {file.split('/').pop() || `File ${fileIdx + 1}`}
                    </button>
                  );
                }
                return null;
              })}
            </div>
          </div>
        );
      }
      
      // Default handling for non-file answers
      return (
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
      );
    })}
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
