// src/components/Manuscripts/ManuscriptItem.jsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { doc, updateDoc, getDoc } from "firebase/firestore";
import { db, auth } from "../../firebase/firebase";
import SubmissionHistory from "./SubmissionHistory";
import ReviewerFeedback from "./ReviewerFeedback";
import ManuscriptModal from "./ManuscriptModal";
import { useFileDownloader } from "../../hooks/useFileDownloader";
import { useReviewerAssignment } from "../../hooks/useReviewerAssignment";
import {
  filterAcceptedReviewers,
  filterRejectedReviewers,
} from "../../utils/manuscriptHelpers";
import PeerReviewerDetails from "./PeerReviewerDetails";

import ManuscriptStatusBadge from "../ManuscriptStatusBadge";

const statusToDeadlineField = {
  "Assigning Peer Reviewer": "invitationDeadline",
  "Peer Reviewer Assigned": "reviewDeadline",
  "For Revision (Minor)": "revisionDeadline",
  "For Revision (Major)": "revisionDeadline",
  "Back to Admin": "finalizationDeadline",
};

const ManuscriptItem = ({
  manuscript = {},
  role,
  users = [],
  handleAssign = () => {},
  unassignReviewer = () => {},
  showFullName,
  setShowFullName,
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

  const currentUserId = auth?.currentUser?.uid;

  const normalizeTimestamp = (ts) => {
    if (!ts) return null;
    if (typeof ts.toDate === "function") return ts.toDate();
    if (ts.seconds) return new Date(ts.seconds * 1000);
    if (typeof ts === "string" || ts instanceof Date) return new Date(ts);
    return null;
  };

  const formatDate = (ts) => {
    if (!ts) return "—";
    if (ts.toDate) return ts.toDate().toLocaleString();
    if (ts.seconds) return new Date(ts.seconds * 1000).toLocaleString();
    if (ts instanceof Date) return ts.toLocaleString();
    return ts;
  };

  const formatReviewerName = (reviewer, full) =>
    full
      ? `${reviewer.firstName} ${reviewer.middleName} ${reviewer.lastName}`.trim()
      : `${reviewer.firstName} ${
          reviewer.middleName ? reviewer.middleName.charAt(0) + "." : ""
        } ${reviewer.lastName}`.trim();

  const navigate = useNavigate();
  const hasReviewer = manuscript.assignedReviewers?.length > 0;
  const [showModal, setShowModal] = useState(false);
  const [expandedReviewerIds, setExpandedReviewerIds] = useState({});
  const [expandedSubmissionHistory, setExpandedSubmissionHistory] =
    useState(false);
  const [expandedPeerReviewerDetails, setExpandedPeerReviewerDetails] =
    useState(false);

  const toggleReviewerExpand = (reviewerId) =>
    setExpandedReviewerIds((prev) => ({
      ...prev,
      [reviewerId]: !prev[reviewerId],
    }));

  const hasRejection =
    manuscript.reviewerDecisionMeta &&
    Object.values(manuscript.reviewerDecisionMeta).some(
      (d) => d.decision === "reject"
    );

  const researcherVisibleStatuses = [
    "For Revision (Minor)",
    "For Revision (Major)",
    "For Publication",
    "Rejected",
  ];

  const canSeeManuscript = (() => {
    if (role === "Admin") return true;
    if (!status) return true;
    if (role === "Peer Reviewer") {
      const myDecisionMeta = manuscript.reviewerDecisionMeta?.[currentUserId];
      const myDecision = myDecisionMeta?.decision;
      if (status === "Rejected" || status === "Peer Reviewer Rejected")
        return true;
      if (!myDecision) return true;
      return ["minor", "major", "publication"].includes(myDecision);
    }
    return true;
  })();

  if (!canSeeManuscript) return null;

  const visibleReviewers =
    manuscript.assignedReviewersData?.filter((r) => {
      if (role === "Admin") return true;
      if (role === "Peer Reviewer") {
        const myDecision = manuscript.reviewerDecisionMeta?.[r.id]?.decision;
        return myDecision && myDecision !== "reject";
      }
      return false;
    }) || [];

  const { downloadFileCandidate } = useFileDownloader();
  const { assignReviewer } = useReviewerAssignment();

  const manuscriptTitle =
    title ||
    answeredQuestions?.find((q) =>
      q.question?.toLowerCase().trim().startsWith("manuscript title")
    )?.answer ||
    "Untitled";

  const showAssignButton =
    role === "Admin" &&
    ["Assigning Peer Reviewer", "Peer Reviewer Assigned"].includes(status);

  const handleAssignClick = () => {
    assignReviewer(manuscript.id, manuscript.status, statusToDeadlineField);
  };

  const handleStatusChange = async (manuscriptId, newStatus) => {
    try {
      const msRef = doc(db, "manuscripts", manuscriptId);
      const snapshot = await getDoc(msRef);
      if (!snapshot.exists()) return;

      const ms = snapshot.data();

      const buildReviewerObjects = (ids) =>
        ids.map((id) => {
          const user = users.find((u) => u.id === id);
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

      const updateReviewerStats = async (reviewers, field) => {
        for (const r of reviewers) {
          const reviewerRef = doc(db, "Users", r.id);
          await updateDoc(reviewerRef, { [field]: (r[field] || 0) + 1 });
        }
      };

      let updatedAssignedReviewers = [];
      let updatedAssignedMeta = {};

      if (newStatus === "For Publication") {
        const acceptedReviewerIds = filterAcceptedReviewers(
          ms.reviewerDecisionMeta,
          (ms.assignedReviewers || []).map((id) => ({ id }))
        ).map((r) => r.id);

        updatedAssignedReviewers = buildReviewerObjects(acceptedReviewerIds);

        updatedAssignedMeta = {
          ...ms.assignedReviewersMeta,
          ...Object.fromEntries(
            updatedAssignedReviewers.map((r) => [
              r.id,
              ms.assignedReviewersMeta?.[r.id] || {
                assignedAt: r.assignedAt,
                assignedBy: r.assignedBy,
              },
            ])
          ),
        };

        await updateReviewerStats(
          updatedAssignedReviewers,
          "acceptedManuscripts"
        );
      } else if (newStatus === "Peer Reviewer Rejected") {
        const rejectedReviewerIds = filterRejectedReviewers(
          ms.reviewerDecisionMeta,
          (ms.assignedReviewers || []).map((id) => ({ id }))
        ).map((r) => r.id);

        updatedAssignedReviewers = buildReviewerObjects(rejectedReviewerIds);

        updatedAssignedMeta = Object.fromEntries(
          updatedAssignedReviewers.map((r) => [
            r.id,
            ms.assignedReviewersMeta?.[r.id] || {
              assignedAt: r.assignedAt,
              assignedBy: r.assignedBy,
            },
          ])
        );

        await updateReviewerStats(
          updatedAssignedReviewers,
          "rejectedManuscripts"
        );
      } else if (
        ["For Revision (Minor)", "For Revision (Major)"].includes(newStatus)
      ) {
        const acceptedReviewerIds =
          newStatus === "For Revision (Major)"
            ? filterAcceptedReviewers(
                ms.reviewerDecisionMeta,
                (ms.assignedReviewers || []).map((id) => ({ id }))
              ).map((r) => r.id)
            : [];

        updatedAssignedReviewers = buildReviewerObjects(acceptedReviewerIds);
        updatedAssignedMeta = Object.fromEntries(
          updatedAssignedReviewers.map((r) => [
            r.id,
            ms.assignedReviewersMeta?.[r.id] || {
              assignedAt: r.assignedAt,
              assignedBy: r.assignedBy,
            },
          ])
        );

        const updateData = {
          status: newStatus,
          assignedReviewers: updatedAssignedReviewers.map((r) => r.id),
          assignedReviewersMeta: updatedAssignedMeta,
          originalAssignedReviewers: ms.assignedReviewers || [],
          originalAssignedReviewersMeta: ms.assignedReviewersMeta || {},
          reviewerSubmissions: ms.reviewerSubmissions || [],
          finalDecisionAt: new Date(),
          finalDecisionBy: "Admin",
        };

        await updateDoc(msRef, updateData);
        return;
      }

      await updateDoc(msRef, {
        status: newStatus,
        assignedReviewers: updatedAssignedReviewers.map((r) => r.id),
        assignedReviewersMeta: updatedAssignedMeta,
        originalAssignedReviewers: ms.assignedReviewers || [],
        originalAssignedReviewersMeta: ms.assignedReviewersMeta || {},
        finalDecisionAt: new Date(),
        finalDecisionBy: "Admin",
      });
    } catch (err) {
      console.error("Error updating status:", err);
    }
  };

  return (
    <li className="border rounded-xl shadow-md hover:shadow-xl transition-all bg-gradient-to-br from-white to-gray-50 w-full sm:w-auto p-4">
      {/* Header */}
      <div className="flex justify-between items-center">
        <button onClick={() => setShowModal(true)} className="text-left">
          <p className="font-bold text-lg sm:text-xl break-words hover:text-blue-600">
            {manuscriptTitle}
          </p>
        </button>

        <div className="flex items-center gap-2">
          {hasRejection &&
            (status === "Back to Admin" || status === "Rejected") && (
              <span className="px-3 py-1 rounded-full text-xs sm:text-sm font-semibold shadow-sm bg-red-100 text-red-800">
                Rejected by Peer Reviewer
              </span>
            )}
          <ManuscriptStatusBadge 
            status={status} 
            revisionDeadline={manuscript.revisionDeadline}
            finalizationDeadline={manuscript.finalizationDeadline}
          />

          {manuscript.deadline &&
            !["For Publication", "Rejected", "Peer Reviewer Rejected"].includes(
              status
            ) && (
              <span className="px-3 py-1 rounded-full text-xs sm:text-sm font-semibold shadow-sm bg-pink-100 text-pink-800">
                Deadline: {formatDate(manuscript.deadline)}
              </span>
            )}
        </div>
      </div>

      {/* Author & meta */}
      <div className="mt-2 text-sm sm:text-base text-gray-600 break-words space-y-0.5">
        {role !== "Peer Reviewer" ? (
          <>
            <p>
              By{" "}
              {role === "Admin" ? (
                <span
                  className="font-semibold text-red-800 cursor-pointer hover:text-red-900 active:text-red-950 transition-colors hover:underline"
                  onClick={() =>
                    navigate(
                      `/profile/${manuscript.submitterId || manuscript.id}`
                    )
                  }
                  title="View Profile"
                >
                  {firstName || "Unknown"}{" "}
                  {middleName ? middleName.charAt(0) + "." : ""}{" "}
                  {lastName || ""}
                </span>
              ) : (
                <span className="font-semibold text-gray-800">
                  {firstName || "Unknown"}{" "}
                  {middleName ? middleName.charAt(0) + "." : ""}{" "}
                  {lastName || ""}
                </span>
              )}{" "}
              ({userRole || "N/A"})
            </p>
            {email && <p>Email: {email}</p>}
            {submittedAt && <p>Submitted: {formatDate(submittedAt)}</p>}
            {acceptedAt && <p>Accepted: {formatDate(acceptedAt)}</p>}
          </>
        ) : (
          <>
            {manuscript.assignedReviewersMeta?.[currentUserId] &&
              (() => {
                const meta = manuscript.assignedReviewersMeta[currentUserId];
                const acceptedAt = normalizeTimestamp(meta.acceptedAt);
                const declinedAt = normalizeTimestamp(meta.declinedAt);
                const respondedAt = normalizeTimestamp(meta.respondedAt);
                const assignedAt = normalizeTimestamp(meta.assignedAt);
                const deadline = normalizeTimestamp(meta.deadline);

                return (
                  <>
                    {assignedAt && <p>Invited: {formatDate(assignedAt)}</p>}
                    {acceptedAt && (
                      <p className="text-green-700 font-medium">
                        Accepted: {formatDate(acceptedAt)}
                      </p>
                    )}
                    {declinedAt && (
                      <p className="text-red-700 font-medium">
                        Declined: {formatDate(declinedAt)}
                      </p>
                    )}
                    {respondedAt && !acceptedAt && !declinedAt && (
                      <p>Responded: {formatDate(respondedAt)}</p>
                    )}
                    {deadline &&
                      ![
                        "For Publication",
                        "Rejected",
                        "Peer Reviewer Rejected",
                      ].includes(manuscript.status) && (
                        <p className="text-pink-700 font-medium">
                          Deadline: {formatDate(deadline)}
                        </p>
                      )}
                  </>
                );
              })()}
          </>
        )}
      </div>

      {/* Reviewer Feedback Section */}
      {visibleReviewers.length > 0 && (
        <div className="mt-4">
          <h4 className="font-semibold text-gray-700 mb-2">
            Reviewer Feedback
          </h4>
          <ReviewerFeedback
            manuscript={manuscript}
            users={users}
            visibleReviewers={visibleReviewers}
            role={role}
            showFullName={showFullName}
            setShowFullName={setShowFullName}
            formatReviewerName={formatReviewerName}
            formatDate={formatDate}
            normalizeTimestamp={normalizeTimestamp}
            downloadFileCandidate={downloadFileCandidate}
            unassignReviewer={unassignReviewer}
          />
        </div>
      )}

      {/* Peer Review Details */}
      {(role === "Admin" ||
        (role === "Researcher" && researcherVisibleStatuses.includes(status)) ||
        role === "Peer Reviewer") &&
        [
          "For Publication",
          "For Revision (Minor)",
          "For Revision (Major)",
          "Peer Reviewer Rejected",
          "Rejected",
          "Back to Admin",
        ].includes(status) && (
          <div className="mt-3 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
            <button
              className="mb-3 px-4 py-1 bg-indigo-100 text-indigo-700 rounded font-medium text-sm hover:bg-indigo-200"
              onClick={() => setExpandedPeerReviewerDetails((v) => !v)}
            >
              {expandedPeerReviewerDetails
                ? "Hide Peer Review Details"
                : "Show Peer Review Details"}
            </button>

            {expandedPeerReviewerDetails && (
              <PeerReviewerDetails
                manuscript={manuscript}
                role={role}
                users={users}
                currentUserId={currentUserId}
                expandedReviewerIds={expandedReviewerIds}
                setExpandedReviewerIds={setExpandedReviewerIds}
                downloadFileCandidate={downloadFileCandidate}
                formatDate={formatDate}
              />
            )}
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

        {role === "Researcher" &&
          ["For Revision (Minor)", "For Revision (Major)"].includes(status) && (
            <button
              onClick={() => navigate(`/researcher/resubmit/${id}`)}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium text-sm sm:text-base"
            >
              Resubmit Revised Manuscript
            </button>
          )}

        {showAssignButton && (
          <>
            <button
              onClick={async () => {
                await assignReviewer(
                  id,
                  manuscript.status,
                  statusToDeadlineField
                );
              }}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition font-medium text-sm sm:text-base"
            >
              {hasReviewer ? "Assign More Reviewers" : "Assign Reviewer"}
            </button>

            {hasReviewer && (
              <button
                onClick={() => {
                  if (
                    window.confirm(
                      "Are you sure you want to unassign ALL reviewers from this manuscript?"
                    )
                  ) {
                    unassignReviewer(id);
                  }
                }}
                className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition font-medium text-sm sm:text-base"
              >
                Unassign All Reviewers
              </button>
            )}
          </>
        )}

        {role === "Admin" && status === "Back to Admin" && (
          <div className="flex flex-wrap gap-2 mt-2">
            <button
              onClick={() => handleStatusChange(id, "For Revision (Minor)")}
              className="px-4 py-2 bg-yellow-400 text-black rounded hover:bg-yellow-500"
            >
              For Revision (Minor)
            </button>
            <button
              onClick={() => handleStatusChange(id, "For Revision (Major)")}
              className="px-4 py-2 bg-orange-500 text-white rounded hover:bg-orange-600"
            >
              For Revision (Major)
            </button>
            <button
              onClick={() => handleStatusChange(id, "For Publication")}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
            >
              For Publication
            </button>
            <button
              onClick={() => handleStatusChange(id, "Peer Reviewer Rejected")}
              className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
            >
              Reject Manuscript
            </button>
          </div>
        )}
      </div>

      {/* Submission History */}
      {(role === "Admin" ||
        role === "Researcher" ||
        role === "Peer Reviewer") &&
        manuscript.submissionHistory?.length > 0 && (
          <div className="mt-4 border-t pt-3">
            <button
              className="mb-2 px-4 py-1 bg-blue-100 text-blue-700 rounded font-medium text-sm hover:bg-blue-200"
              onClick={() => setExpandedSubmissionHistory((v) => !v)}
            >
              {expandedSubmissionHistory
                ? `Hide Submission History`
                : `Show Submission History (${manuscript.submissionHistory.length})`}
            </button>

            {expandedSubmissionHistory && (
              <SubmissionHistory
                manuscript={manuscript}
                users={users}
                downloadFileCandidate={downloadFileCandidate}
                role={role} // Pass role to hide latest for Researchers
              />
            )}
          </div>
        )}

      {/* View Response Modal */}
      {showModal && (
       <ManuscriptModal
  manuscript={manuscript}
  onClose={() => setShowModal(false)}
  downloadFileCandidate={downloadFileCandidate}
  formatDate={formatDate}
  manuscriptFileUrls={manuscriptFileUrls} // Add this line
/>
      )}
    </li>
  );
};

export default ManuscriptItem;
