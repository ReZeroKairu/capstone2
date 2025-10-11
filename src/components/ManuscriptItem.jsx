import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { doc, updateDoc, getDoc } from "firebase/firestore";
import { db } from "../firebase/firebase";
import { auth } from "../firebase/firebase"; // adjust path as needed
import {
  computeManuscriptStatus,
  filterAcceptedReviewers,
  filterRejectedReviewers,
} from "../utils/manuscriptHelpers";
import { getDownloadURL, ref as storageRef } from "firebase/storage";
import { storage } from "../firebase/firebase";

const STATUS_COLORS = {
  Pending: "bg-gray-100 text-gray-800",
  "Assigning Peer Reviewer": "bg-yellow-100 text-yellow-800",
  "Peer Reviewer Assigned": "bg-blue-100 text-blue-800",
  "Peer Reviewer Reviewing": "bg-indigo-100 text-indigo-800",
  "Back to Admin": "bg-purple-100 text-purple-800",
  "For Revision (Minor)": "bg-yellow-100 text-yellow-800",
  "For Revision (Major)": "bg-orange-100 text-orange-800",
  "For Publication": "bg-green-100 text-green-800",
  "Peer Reviewer Rejected": "bg-red-100 text-red-800",
  Rejected: "bg-red-100 text-red-800",
};
const statusToDeadlineField = {
  "Assigning Peer Reviewer": "invitationDeadline",
  "Peer Reviewer Assigned": "reviewDeadline",
  "For Revision (Minor)": "revisionDeadline",
  "For Revision (Major)": "revisionDeadline",
  "Back to Admin": "finalizationDeadline",
};

const decisionLabels = {
  minor: "Accepted with Minor Revision",
  major: "Accepted with Major Revision",
  publication: "For Publication",
  reject: "Rejected Manuscript",
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

  const currentUserId = auth.currentUser.uid; // or wherever you store the user ID
  const myDecisionMeta = manuscript.reviewerDecisionMeta?.[currentUserId];
  const myDecision = myDecisionMeta?.decision;
  const finalDecision = manuscript.finalDecision;

  const researcherVisibleStatuses = [
    "For Revision (Minor)",
    "For Revision (Major)",
    "For Publication",
    "Rejected",
  ];
  const formatReviewerName = (reviewer, full) =>
    full
      ? `${reviewer.firstName} ${reviewer.middleName} ${reviewer.lastName}`.trim()
      : `${reviewer.firstName} ${
          reviewer.middleName ? reviewer.middleName.charAt(0) + "." : ""
        } ${reviewer.lastName}`.trim();

  // Determine if current user can see this manuscript
  const canSeeManuscript = (() => {
    if (role === "Admin") return true; // Admin sees everything

    // Manuscripts with no status are always visible
    if (!status) return true;

    if (role === "Peer Reviewer") {
      const myDecisionMeta = manuscript.reviewerDecisionMeta?.[currentUserId];
      const myDecision = myDecisionMeta?.decision;

      // Always show rejected manuscripts
      if (status === "Rejected" || status === "Peer Reviewer Rejected")
        return true;

      // Show if the reviewer hasn't submitted yet (pending)
      if (!myDecision) return true;

      // Otherwise, show if they accepted or gave revisions
      return ["minor", "major", "publication"].includes(myDecision);
    }

    return true; // default for other roles
  })();

  if (!canSeeManuscript) return null;

  const normalizeTimestamp = (ts) => {
    if (!ts) return null;
    if (typeof ts.toDate === "function") return ts.toDate();
    if (ts.seconds) return new Date(ts.seconds * 1000);
    if (typeof ts === "string" || ts instanceof Date) return new Date(ts);
    return null;
  };

  const navigate = useNavigate();
  const hasReviewer = manuscript.assignedReviewers?.length > 0;
  const [showModal, setShowModal] = useState(false);
  const [expandedReviewerIds, setExpandedReviewerIds] = useState({});
  const toggleReviewerExpand = reviewerId => setExpandedReviewerIds(prev => ({ ...prev, [reviewerId]: !prev[reviewerId] }));
  const [expandedSubmissionHistory, setExpandedSubmissionHistory] = useState(false);
  const [expandedPeerReviewDetails, setExpandedPeerReviewDetails] = useState(false);

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

      // Helper: build reviewer objects with user info
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

      // Only update counts for reviewers who actually contributed
      const updateReviewerStats = async (reviewers, field) => {
        for (const r of reviewers) {
          const reviewerRef = doc(db, "Users", r.id);
          await updateDoc(reviewerRef, {
            [field]: (r[field] || 0) + 1,
          });
        }
      };

      let updatedAssignedReviewers = [];
      let updatedAssignedMeta = {};

      if (newStatus === "For Publication") {
        // Keep only accepted reviewers
        const acceptedReviewerIds = filterAcceptedReviewers(
          ms.reviewerDecisionMeta,
          (ms.assignedReviewers || []).map((id) => ({ id }))
        ).map((r) => r.id);

        updatedAssignedReviewers = buildReviewerObjects(acceptedReviewerIds);

        // Merge meta, preserving previous decisions
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

        // ✅ Increment counts only for accepted reviewers
        await updateReviewerStats(
          updatedAssignedReviewers,
          "acceptedManuscripts"
        );
      } else if (newStatus === "Peer Reviewer Rejected") {
        // Keep only rejected reviewers
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

        // ✅ Increment counts only for rejected reviewers
        await updateReviewerStats(
          updatedAssignedReviewers,
          "rejectedManuscripts"
        );
      } else if (newStatus === "For Revision (Minor)") {
        // Minor Revision: Clear all reviewers, goes back to Admin for reassignment
        await updateDoc(msRef, {
          status: newStatus,
          assignedReviewers: [],
          assignedReviewersMeta: {},
          originalAssignedReviewers: ms.assignedReviewers || [],
          originalAssignedReviewersMeta: ms.assignedReviewersMeta || {},
          reviewerSubmissions: ms.reviewerSubmissions || [],
          finalDecisionAt: new Date(),
          finalDecisionBy: "Admin",
        });
        return;
      } else if (newStatus === "For Revision (Major)") {
        // Major Revision: Keep only reviewers who accepted (exclude rejecters)
        const acceptedReviewerIds = filterAcceptedReviewers(
          ms.reviewerDecisionMeta,
          (ms.assignedReviewers || []).map((id) => ({ id }))
        ).map((r) => r.id);

        updatedAssignedReviewers = buildReviewerObjects(acceptedReviewerIds);

        // Preserve existing assignedReviewersMeta for accepted reviewers
        updatedAssignedMeta = Object.fromEntries(
          updatedAssignedReviewers.map((r) => [
            r.id,
            ms.assignedReviewersMeta?.[r.id] || {
              assignedAt: r.assignedAt,
              assignedBy: r.assignedBy,
            },
          ])
        );

        // Preserve reviewer submissions
        const updatedReviewerSubmissions = ms.reviewerSubmissions || [];

        // Update doc
        await updateDoc(msRef, {
          status: newStatus,
          assignedReviewers: updatedAssignedReviewers.map((r) => r.id),
          assignedReviewersMeta: updatedAssignedMeta,
          reviewerSubmissions: updatedReviewerSubmissions,
          originalAssignedReviewers: ms.assignedReviewers || [],
          originalAssignedReviewersMeta: ms.assignedReviewersMeta || {},
          finalDecisionAt: new Date(),
          finalDecisionBy: "Admin",
        });

        // Exit the function to avoid double updating below
        return;
      }

      // Update manuscript document
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

  // Before the return statement
  const visibleReviewers =
    manuscript.assignedReviewersData?.filter((r) => {
      if (role !== "Peer Reviewer") return true;
      const myDecision = manuscript.reviewerDecisionMeta?.[r.id]?.decision;
      return myDecision && myDecision !== "reject";
    }) || [];

  // Helper to download a file candidate (either an http(s) URL or a storage path)
  const downloadFileCandidate = async (candidate, suggestedName) => {
    if (!candidate) return;

    try {
      let url;

      // Determine actual URL
      if (typeof candidate === "string" && /^https?:\/\//.test(candidate)) {
        url = candidate;
      } else if (typeof candidate === "object" && candidate.url) {
        url = candidate.url;
      } else {
        const path =
          typeof candidate === "string"
            ? candidate
            : candidate.path || candidate.storagePath || candidate.filePath;
        if (!path) return;

        // Always get a fresh download URL from Firebase
        url = await getDownloadURL(storageRef(storage, path));
      }

      // Directly open URL in a new tab if it’s a full URL
      if (/^https?:\/\//.test(url)) {
        const tempLink = document.createElement("a");
        tempLink.href = url;
        tempLink.download = suggestedName || url.split("/").pop();
        tempLink.target = "_blank";
        document.body.appendChild(tempLink);
        tempLink.click();
        document.body.removeChild(tempLink);
        return;
      }

      // Otherwise fetch blob
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch file");
      const blob = await res.blob();

      // Always create a new blob URL
      const blobUrl = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = suggestedName || "download";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      // Revoke after 1s to ensure download triggered
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
    } catch (err) {
      console.error("Download failed:", err);
      alert("Unable to download file. Please try again.");
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

            {/* Status badge */}
            <span
              className={`px-3 py-1 rounded-full text-xs sm:text-sm font-semibold shadow-sm ${
                STATUS_COLORS[status] || "bg-gray-100 text-gray-800"
              }`}
            >
              {status}
            </span>

            {/* Deadline badge */}
            {manuscript.deadline &&
              !["For Publication", "Rejected", "Peer Reviewer Rejected"].includes(manuscript.status) && (
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
              {/* For Peer Reviewers, only show their assignment time */}
              {manuscript.assignedReviewersMeta?.[currentUserId] && (() => {
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
                    {deadline && !["For Publication", "Rejected", "Peer Reviewer Rejected"].includes(manuscript.status) && (
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

        {/* Assigned reviewers */}
        {/* Assigned Reviewers with Invitation Status */}
        {hasReviewer &&
          manuscript.assignedReviewersData?.length > 0 &&
          (role !== "Peer Reviewer" ||
            // Peer Reviewer sees only if their decision matches final decision
            manuscript.assignedReviewersData.some((r) => {
              if (!manuscript.reviewerDecisionMeta) return false;
              const myDecision =
                manuscript.reviewerDecisionMeta[r.id]?.decision;
              return myDecision && myDecision !== "reject";
            })) && (
            <div className="mt-2">
              {visibleReviewers.map((reviewer) => {
                const invitationStatus =
                  manuscript.assignedReviewersMeta?.[reviewer.id]
                    ?.invitationStatus;
                const decision =
                  manuscript.assignedReviewersMeta?.[reviewer.id]?.decision;
                const decisionMeta =
                  manuscript.reviewerDecisionMeta?.[reviewer.id] || null;

                const submissionKey = `submission_${manuscript.id}_${reviewer.id}`;

                const displayName = formatReviewerName(
                  reviewer,
                  showFullName[submissionKey]
                );

                const assignedByUser = users.find(
                  (u) => u.id === reviewer.assignedBy
                );
                const assignedByName = assignedByUser
                  ? `${assignedByUser.firstName} ${
                      assignedByUser.middleName
                        ? assignedByUser.middleName + " "
                        : ""
                    }${assignedByUser.lastName}`
                  : reviewer.assignedBy || "—";

                return (
                  <div key={reviewer.id} className="bg-blue-50 p-2 rounded-md">
                    <div className="flex justify-between items-start">
                      <div>
                        <span
                          className="text-blue-800 text-sm font-medium cursor-pointer"
                          onClick={() => {
                            const assignedKey = `assigned_${manuscript.id}_${reviewer.id}`;
                            setShowFullName((prev) => ({
                              ...prev,
                              [assignedKey]: !prev[assignedKey],
                            }));
                          }}
                          title="Click to toggle full name"
                        >
                          {formatReviewerName(
                            reviewer,
                            showFullName[
                              `assigned_${manuscript.id}_${reviewer.id}`
                            ]
                          )}
                        </span>

                        <div className="text-xs text-gray-500 mt-1">
                          Assigned: {formatDate(reviewer.assignedAt)} by{" "}
                          {assignedByName}
                          {(() => {
                            const meta =
                              manuscript.assignedReviewersMeta?.[reviewer.id];
                            if (!meta) return null;
                            const acceptedAt = normalizeTimestamp(
                              meta.acceptedAt
                            );
                            const declinedAt = normalizeTimestamp(
                              meta.declinedAt
                            );
                            const deadline = normalizeTimestamp(meta.deadline);

                            return (
                              <>
                                {acceptedAt && (
                                  <div className="text-green-700 font-medium">
                                    Accepted: {formatDate(acceptedAt)}
                                  </div>
                                )}
                                {declinedAt && (
                                  <div className="text-red-700 font-medium">
                                    Declined: {formatDate(declinedAt)}
                                  </div>
                                )}
                                {deadline && !["For Publication", "Rejected", "Peer Reviewer Rejected"].includes(manuscript.status) && (
                                  <div className="text-pink-700 font-medium">
                                    Deadline: {formatDate(deadline)}
                                  </div>
                                )}
                              </>
                            );
                          })()}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span
                          className={`text-xs px-2 py-1 rounded ${
                            !invitationStatus || invitationStatus === "pending"
                              ? "bg-yellow-100 text-yellow-800"
                              : invitationStatus === "accepted"
                              ? "bg-green-100 text-green-800"
                              : "bg-red-100 text-red-800"
                          }`}
                        >
                          {!invitationStatus || invitationStatus === "pending"
                            ? "Invitation Pending"
                            : invitationStatus === "accepted"
                            ? "Accepted"
                            : "Declined"}
                        </span>
                        
                        {/* Unassign button for each reviewer (Admin only) */}
                        {role === "Admin" && (
                          <button
                            onClick={() => unassignReviewer(id, reviewer.id)}
                            className="text-xs px-2 py-1 bg-red-500 text-white rounded hover:bg-red-600 transition"
                            title="Unassign this reviewer"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    </div>

                    {decisionMeta?.decision && (
                      <div className="mt-2 pt-2 border-t border-blue-100 text-xs">
                        <span
                          className={`px-2 py-1 rounded-full font-medium ${
                            decisionMeta.decision === "minor"
                              ? "bg-yellow-100 text-yellow-700"
                              : decisionMeta.decision === "major"
                              ? "bg-orange-100 text-orange-700"
                              : decisionMeta.decision === "publication"
                              ? "bg-green-100 text-green-700"
                              : decisionMeta.decision === "reject"
                              ? "bg-red-100 text-red-700"
                              : "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {decisionLabels[decisionMeta.decision] ||
                            decisionMeta.decision}
                        </span>{" "}
                        {decisionMeta.decidedAt &&
                          `at ${formatDate(decisionMeta.decidedAt)}`}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

        {/* --- Peer Review Details --- */}
        {(role === "Admin" ||
          (role === "Researcher" &&
            researcherVisibleStatuses.includes(status)) ||
          role === "Peer Reviewer") &&
          [
            "For Publication",
            "For Revision (Minor)",
            "For Revision (Major)",
            "Peer Reviewer Rejected",
            "Rejected",
          ].includes(status) && (
            <div className="mt-3 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
              <button
                className="mb-3 px-4 py-1 bg-indigo-100 text-indigo-700 rounded font-medium text-sm hover:bg-indigo-200"
                onClick={() => setExpandedPeerReviewDetails(v => !v)}
              >
                {expandedPeerReviewDetails ? `Hide Peer Review Details` : `Show Peer Review Details`}
              </button>
              {expandedPeerReviewDetails && (
                <>
                  <h4 className="text-base font-semibold text-gray-800 mb-3 flex items-center">
                    <span className="w-2 h-2 bg-blue-500 rounded-full mr-2"></span>
                    {role === "Admin"
                      ? "Peer Review Details"
                      : role === "Researcher"
                      ? "Review Details"
                      : "My Review Details"}
                  </h4>

                  {/* Final decision summary for Admins only */}
                  {role === "Admin" && manuscript.finalDecisionAt && (
                    <div className="mb-3 p-2 bg-white rounded border-l-4 border-blue-500">
                      <p className="text-sm">
                        <span className="font-medium text-gray-700">
                          Final Admin Decision:
                        </span>{" "}
                        <span className="text-blue-600 font-medium">{status}</span>{" "}
                        on{" "}
                        <span className="font-medium">
                          {formatDate(manuscript.finalDecisionAt)}
                        </span>
                      </p>
                    </div>
                  )}

                  {/* Reviewer submissions / Review Details */}
                  <div className="space-y-3">
                    {(role === "Admin"
                      ? [
                          ...new Set([
                            ...(manuscript.originalAssignedReviewers || []),
                            ...(manuscript.assignedReviewers || []),
                          ]),
                        ]
                      : role === "Peer Reviewer"
                      ? [currentUserId]
                      : role === "Researcher"
                      ? manuscript.reviewerSubmissions?.map((s) => s.reviewerId) ||
                        []
                      : []
                    ).map((reviewerId) => {
                      const reviewer = users.find((u) => u.id === reviewerId);
                      const reviewerSubmissions = (manuscript.reviewerSubmissions || [])
                        .filter((s) => s.reviewerId === reviewerId)
                        .sort((a, b) => {
                          const aTime = a.completedAt?.toDate ? a.completedAt.toDate().getTime() : new Date(a.completedAt).getTime();
                          const bTime = b.completedAt?.toDate ? b.completedAt.toDate().getTime() : new Date(b.completedAt).getTime();
                          return aTime - bTime;
                        });
                      if (!reviewerSubmissions.length) return null;
                      const isExpanded = !!expandedReviewerIds[reviewerId];
                      const lastSubmission = reviewerSubmissions[reviewerSubmissions.length-1];
                      return (
                        <div key={reviewerId} className="bg-white p-3 rounded-lg border shadow-sm">
                          <div className="flex items-center justify-between mb-1">
                            <div>
                              <span className="font-medium text-gray-800">
                                {reviewer ? `${reviewer.firstName} ${reviewer.middleName ? reviewer.middleName + " " : ""}${reviewer.lastName}` : reviewerId}
                              </span>
                              {lastSubmission && lastSubmission.completedAt && (
                                <span className="ml-2 text-xs text-gray-500">Last: {formatDate(lastSubmission.completedAt)}</span>
                              )}
                            </div>
                            <button onClick={() => toggleReviewerExpand(reviewerId)} className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200">
                              {isExpanded ? "Hide Details" : `Show Versions (${reviewerSubmissions.length})`}
                            </button>
                          </div>
                          {isExpanded && (
                            <div className="pt-2">
                              {reviewerSubmissions.map((submission, idx) => (
                                <div key={idx} className="border-t pt-2 mt-2 first:mt-0 first:pt-0 first:border-0">
                                  <div className="flex justify-between items-center">
                                    <span className="text-xs font-semibold text-gray-800">
                                      Version {idx + 1}{idx === reviewerSubmissions.length - 1 ? " (Latest)" : ""}
                                      {submission.manuscriptVersionNumber && (
                                        <span className="ml-2 text-indigo-700 font-normal">For Manuscript Version {submission.manuscriptVersionNumber}</span>
                                      )}
                                    </span>
                                    <span className="text-xs text-gray-500">{formatDate(submission.completedAt)}</span>
                                  </div>
                                  {submission.comment && (
                                    <div className="mb-2">
                                      <p className="text-xs text-gray-700 italic mt-1">"{submission.comment}"</p>
                                    </div>
                                  )}
                                  {(submission.reviewFileUrl || submission.reviewFile || submission.reviewFilePath) && (
                                    <p className="mt-1">
                                      <button
                                        onClick={() => downloadFileCandidate(
                                          submission.reviewFileUrl || submission.reviewFile || submission.reviewFilePath,
                                          submission.fileName || submission.name
                                        )}
                                        className="text-blue-600 underline text-xs"
                                      >
                                        Download Review File
                                      </button>
                                    </p>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </>
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

          {/* Resubmit button for Researchers on revision statuses */}
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
                  try {
                    // 🔹 Fetch default deadline days from Firestore
                    const settingsRef = doc(
                      db,
                      "deadlineSettings",
                      "deadlines"
                    );
                    const settingsSnap = await getDoc(settingsRef);

                    let defaultDays = 30; // fallback
                    if (settingsSnap.exists()) {
                      const settings = settingsSnap.data();
                      const field = statusToDeadlineField[manuscript.status];
                      if (field && settings[field]) {
                        defaultDays = settings[field];
                      }
                    }

                    // 🔹 Compute deadline
                    const today = new Date();
                    const deadlineDate = new Date(today);
                    deadlineDate.setDate(today.getDate() + defaultDays);

                    // 🔹 Just navigate to reviewer list with computed deadline
                    navigate(
                      `/admin/reviewer-list?manuscriptId=${id}&deadline=${encodeURIComponent(
                        deadlineDate.toISOString()
                      )}`
                    );
                  } catch (error) {
                    console.error("Failed to load default deadline:", error);
                    alert(
                      "Could not load default deadline. Please check settings."
                    );
                  }
                }}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition font-medium text-sm sm:text-base"
              >
                {hasReviewer ? "Assign More Reviewers" : "Assign Reviewer"}
              </button>
              
              {hasReviewer && (
                <button
                  onClick={() => {
                    if (window.confirm("Are you sure you want to unassign ALL reviewers from this manuscript?")) {
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
        </div>

        {/* --- Submission History Section --- */}
        {(role === "Admin" || role === "Researcher") && manuscript.submissionHistory && manuscript.submissionHistory.length > 0 && (
          <div className="mt-4 border-t pt-3">
            <button
              className="mb-2 px-4 py-1 bg-blue-100 text-blue-700 rounded font-medium text-sm hover:bg-blue-200"
              onClick={() => setExpandedSubmissionHistory(v => !v)}
            >
              {expandedSubmissionHistory ? `Hide Submission History` : `Show Submission History (${manuscript.submissionHistory.length})`}
            </button>
            {expandedSubmissionHistory && (
              <div className="space-y-3 mb-4">
                {manuscript.submissionHistory.map((submission, idx) => {
                  // Get reviewer details for this version
                  const versionReviewers = submission.reviewers || [];
                  const reviewerData = versionReviewers.map(rId => 
                    users.find(u => u.id === rId)
                  ).filter(Boolean);
                  
                  return (
                    <div key={idx} className="bg-gray-50 p-3 rounded border border-gray-200">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-800">
                            Version {submission.versionNumber || idx + 1}
                            {idx === manuscript.submissionHistory.length - 1 && (
                              <span className="ml-2 px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded">Current</span>
                            )}
                          </p>
                          <p className="text-xs text-gray-600">{submission.fileName || "Manuscript file"}</p>
                          <p className="text-xs text-gray-500">
                            Submitted: {submission.submittedAt?.toDate ? submission.submittedAt.toDate().toLocaleString() : new Date(submission.submittedAt).toLocaleString()}
                          </p>
                          {submission.revisionNotes && submission.revisionNotes !== "Initial submission" && (
                            <p className="text-xs text-gray-600 italic mt-1">"{submission.revisionNotes}"</p>
                          )}
                          
                          {/* Show reviewers for this version */}
                          {reviewerData.length > 0 && (
                            <div className="mt-2 pt-2 border-t border-gray-300">
                              <p className="text-xs font-medium text-gray-700 mb-1">Reviewers ({reviewerData.length}):</p>
                              <div className="flex flex-wrap gap-1">
                                {reviewerData.map((reviewer, rIdx) => {
                                  const reviewerDecision = submission.reviewerDecisionMeta?.[reviewer.id];
                                  const reviewerSubmission = submission.reviewerSubmissions?.find(rs => rs.reviewerId === reviewer.id);
                                  
                                  return (
                                    <div key={rIdx} className="text-xs bg-blue-50 px-2 py-1 rounded border border-blue-200">
                                      <span className="font-medium">
                                        {reviewer.firstName} {reviewer.lastName}
                                      </span>
                                      {reviewerDecision?.decision && (
                                        <span className={`ml-1 px-1 rounded text-xs ${
                                          reviewerDecision.decision === "publication" ? "bg-green-200 text-green-800" :
                                          reviewerDecision.decision === "minor" ? "bg-yellow-200 text-yellow-800" :
                                          reviewerDecision.decision === "major" ? "bg-orange-200 text-orange-800" :
                                          "bg-red-200 text-red-800"
                                        }`}>
                                          {reviewerDecision.decision === "publication" ? "✓ Publish" :
                                           reviewerDecision.decision === "minor" ? "Minor Rev" :
                                           reviewerDecision.decision === "major" ? "Major Rev" :
                                           "✗ Reject"}
                                        </span>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                        {submission.fileUrl && (
                          <button
                            onClick={() => downloadFileCandidate(submission.fileUrl, submission.fileName)}
                            className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 ml-3"
                          >
                            Download
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

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
                          Comment: {r.comment || "—"}
                        </p>
                        <p className="text-xs text-gray-400">
                          Completed:{" "}
                          {r.completedAt?.toDate
                            ? r.completedAt.toDate().toLocaleString()
                            : r.completedAt || "—"}
                        </p>
                        {/* reviewer file (if present) */}
                        {(r.reviewFileUrl ||
                          r.reviewFile ||
                          r.reviewFilePath) && (
                          <p className="mt-1">
                            <button
                              onClick={() =>
                                downloadFileCandidate(
                                  r.reviewFileUrl ||
                                    r.reviewFile ||
                                    r.reviewFilePath,
                                  r.fileName || r.name
                                )
                              }
                              className="text-blue-600 underline text-sm"
                            >
                              Download Review File
                            </button>
                          </p>
                        )}
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
                  {manuscript.reviewerDecisionMeta &&
                    Object.entries(manuscript.reviewerDecisionMeta).map(
                      ([revId, decisionMeta]) => {
                        const reviewer = manuscript.assignedReviewersData?.find(
                          (u) => u.id === revId
                        );
                        if (!decisionMeta?.decision) return null;

                        return (
                          <li key={revId} className="mb-1">
                            <span
                              className={`px-2 py-1 rounded-full text-xs font-medium ${
                                decisionMeta.decision === "minor"
                                  ? "bg-yellow-100 text-yellow-700"
                                  : decisionMeta.decision === "major"
                                  ? "bg-orange-100 text-orange-700"
                                  : decisionMeta.decision === "publication"
                                  ? "bg-green-100 text-green-700"
                                  : decisionMeta.decision === "reject"
                                  ? "bg-red-100 text-red-700"
                                  : "bg-gray-100 text-gray-600"
                              }`}
                            >
                              {decisionLabels[decisionMeta.decision] ||
                                decisionMeta.decision}
                            </span>{" "}
                            by{" "}
                            {reviewer
                              ? `${reviewer.firstName} ${reviewer.lastName}`
                              : revId}
                            {decisionMeta.decidedAt &&
                              ` at ${formatDate(decisionMeta.decidedAt)}`}
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
                "For Revision (Minor)",
                "For Revision (Major)",
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
                  if (q.type === "file" && q.answer) {
                    const files = Array.isArray(q.answer)
                      ? q.answer
                      : [q.answer];
                    return (
                      <div
                        key={idx}
                        className="bg-gray-50 p-3 rounded-md border border-gray-200"
                      >
                        <div className="font-semibold mb-1">{q.question}</div>
                        <div className="space-y-2">
                          {files.map((file, fileIdx) => {
                            const fileName =
                              typeof file === "string"
                                ? file.split("/").pop() // get name from path
                                : file.name ||
                                  file.fileName ||
                                  `File-${fileIdx + 1}`;

                            return (
                              <button
                                key={fileIdx}
                                onClick={() =>
                                  downloadFileCandidate(file, fileName)
                                }
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
                                {fileName}
                              </button>
                            );
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
