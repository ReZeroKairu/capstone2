// src/components/Manuscripts/ManuscriptItem.jsx
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { doc, updateDoc, getDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../firebase/firebase";
import { notificationService } from "../../utils/notificationService";
import { getActiveDeadline as getReviewerDeadline } from "../../utils/deadlineUtils";
import SubmissionHistory from "./SubmissionHistory";
import ReviewerFeedback from "./ReviewerFeedback";
import ManuscriptModal from "./ManuscriptModal";
import { useFileDownloader } from "../../hooks/useFileDownloader";
import { useReviewerAssignment } from "../../hooks/useReviewerAssignment";
import { useManuscriptStatus } from "../../hooks/useManuscriptStatus";
import {
  filterAcceptedReviewers,
  filterRejectedReviewers,
} from "../../utils/manuscriptHelpers";

import ManuscriptStatusBadge from "../ManuscriptStatusBadge";
import DeadlineBadge from "./DeadlineBadge";
import StatusActionButtons from "./StatusActionButtons";
import AdminFeedback from "../feedback/AdminFeedback";
import { httpsCallable } from 'firebase/functions';
import { collection, query, where, getDocs } from 'firebase/firestore';

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
  manuscriptFileUrls = [],
  currentUserId,
  ...props
}) => {
  const { handleStatusChange: handleStatusUpdate } = useManuscriptStatus();
  const navigate = useNavigate();
  const [showModal, setShowModal] = useState(false);
  const [expandedReviewerIds, setExpandedReviewerIds] = useState({});
  const [expandedSubmissionHistory, setExpandedSubmissionHistory] = useState(false);
  const [activeDeadline, setActiveDeadline] = useState(null);
  const { downloadFileCandidate } = useFileDownloader();
  const { assignReviewer } = useReviewerAssignment();
  const getAdminUserIds = async () => {
  try {
    const usersRef = collection(db, 'Users');
    const q = query(usersRef, where('role', '==', 'Admin'));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => doc.id);
  } catch (error) {
    console.error('Error fetching admin user IDs:', error);
    return [];
  }
};
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

  const manuscriptTitle =
    title ||
    answeredQuestions?.find((q) =>
      q.question?.toLowerCase().trim().startsWith("manuscript title")
    )?.answer ||
    "Untitled";

  const hasReviewer = manuscript.assignedReviewers?.length > 0;
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

  // ----------------------------
  // Determine if current user can see the manuscript
  // ----------------------------
  const canSeeManuscript = (() => {
    if (!currentUserId) return false; // wait until auth is ready
    if (role === "Admin") return true;
    if (!status) return true;

    if (role === "Peer Reviewer") {
      // Convert all IDs to strings for consistent comparison
      const myId = String(currentUserId);
      const assignedReviewers = (manuscript.assignedReviewers || []).map(String);
      const previousReviewers = (manuscript.previousReviewers || []).map(String);
      const originalAssignedReviewers = (manuscript.originalAssignedReviewers || []).map(String);
      
      // Check all possible ID formats and locations
      const isAssigned = assignedReviewers.includes(myId) || 
                        (manuscript.assignedReviewers || []).includes(currentUserId);
                          
      const wasAssigned = previousReviewers.includes(myId) || 
                         originalAssignedReviewers.includes(myId) ||
                         (manuscript.previousReviewers || []).includes(currentUserId) ||
                         (manuscript.originalAssignedReviewers || []).includes(currentUserId);
      
      const hasSubmitted = (manuscript.reviewerSubmissions || []).some(s => 
        String(s.reviewerId) === myId || s.reviewerId === currentUserId
      );

      // Show if currently assigned, was previously assigned, or has submitted a review
      if (isAssigned || wasAssigned || hasSubmitted) {
        return true;
      }

      return false;
    }

    if (role === "Researcher") {
      // Researchers can always see their own manuscript
      if (manuscript.submitterId === currentUserId) return true;
      
      // Co-authors can see the manuscript in any status
      const isCoAuthor = manuscript.coAuthorsIds?.includes(currentUserId) || 
                        (manuscript.coAuthors || []).some(coAuthor => coAuthor.userId === currentUserId || coAuthor.id === currentUserId);
      if (isCoAuthor) return true;

      // Otherwise, only see finalized statuses
      const visibleStatuses = [
        "For Revision (Minor)",
        "For Revision (Major)",
        "For Publication",
        "Rejected",
      ];
      return visibleStatuses.includes(status);
    }

    return true;
  })();

  if (!canSeeManuscript) return null;

  // ----------------------------
  // Determine which reviewers are visible to current user
  // ----------------------------
  const currentVersion = manuscript.versionNumber || 1;
  const visibleReviewers = Object.entries(
    manuscript.assignedReviewersMeta || {}
  )
    .filter(([reviewerId, meta]) => {
      if (role === "Admin") return true;

      // For resubmissions, only show reviewers who were assigned to this version
      if (manuscript.status === "Back to Admin" || manuscript.status === "Peer Reviewer Reviewing") {
        const reviewerAssignment = meta.assignedVersions || [];
        const isAssignedToThisVersion = reviewerAssignment.includes(currentVersion);
        if (!isAssignedToThisVersion) return false;
      }

      if (role === "Peer Reviewer") {
        if (reviewerId !== currentUserId) return false;

        const completedReview = manuscript.reviewerSubmissions?.some(
          (r) => r.reviewerId === currentUserId && 
                 r.status === "Completed" &&
                 (r.manuscriptVersionNumber || 1) === currentVersion
        );

        return (
          completedReview ||
          ["pending", "accepted"].includes(meta.invitationStatus) ||
          manuscript.status === "For Publication"
        );
      }

      if (role === "Researcher") {
        // Only show accepted reviewers who have submitted feedback
        const hasSubmitted = manuscript.reviewerSubmissions?.some(
          r => r.reviewerId === reviewerId && 
               r.status === "Completed" &&
               (r.manuscriptVersionNumber || 1) < currentVersion
        );
        return meta.invitationStatus === "accepted" && hasSubmitted;
      }

      return true;
    })
    .map(([reviewerId, meta]) => {
      const user = users.find((u) => u.id === reviewerId) || {};
      return {
        id: reviewerId,
        firstName: user.firstName || "",
        middleName: user.middleName || "",
        lastName: user.lastName || "",
        email: user.email || "",
        invitationStatus: meta.invitationStatus,
        assignedAt: meta.assignedAt,
        acceptedAt: meta.acceptedAt,
        declinedAt: meta.declinedAt,
        respondedAt: meta.respondedAt,
        assignedBy: meta.assignedBy || "—",
      };
    });

  // This is now handled by StatusActionButtons
  const showAssignButton = false;

  const toggleReviewerExpand = (reviewerId) =>
    setExpandedReviewerIds((prev) => ({
      ...prev,
      [reviewerId]: !prev[reviewerId],
    }));

  // Get the most recent deadline from active (not declined) reviewers
  const getLatestReviewerDeadline = (manuscript) => {
    if (!manuscript.assignedReviewersMeta) return null;
    
    let latestDeadline = null;
    let latestInviteTime = 0;
    
    // Find the latest deadline from active reviewers based on when they were invited
    Object.entries(manuscript.assignedReviewersMeta).forEach(([reviewerId, meta]) => {
      // Skip declined or inactive reviewers
      if (meta.invitationStatus === 'declined' || !meta.deadline) {
        return;
      }
      
      const deadline = meta.deadline.toDate 
        ? meta.deadline.toDate() 
        : new Date(meta.deadline);
        
      // Get the invite time to determine the most recent invitation
      const inviteTime = meta.invitedAt?.toDate 
        ? meta.invitedAt.toDate().getTime() 
        : meta.invitedAt?.seconds 
          ? meta.invitedAt.seconds * 1000 
          : 0;
          
      // Only update if this is an active reviewer with a valid deadline
      const isActive = !meta.declinedAt && !meta.invitationStatus?.toLowerCase().includes('declined');
      
      if (isActive && (inviteTime > latestInviteTime || 
          (inviteTime === latestInviteTime && (!latestDeadline || deadline > latestDeadline)))) {
        latestDeadline = deadline;
        latestInviteTime = inviteTime;
      }
    });
    
    return latestDeadline;
  };

  // Get the appropriate deadline based on user role and manuscript status
 const getActiveDeadline = (manuscript, role) => {
  try {
    // For Back to Admin status, always use the finalization deadline for all roles
    if (manuscript.status === 'Back to Admin') {
      if (manuscript.finalizationDeadline) {
        return manuscript.finalizationDeadline.toDate 
          ? manuscript.finalizationDeadline.toDate() 
          : new Date(manuscript.finalizationDeadline);
      }
      return null;
    }

    // For revision statuses, use the manuscript's revisionDeadline for all roles
    if (
      manuscript.status === 'For Revision (Minor)' || 
      manuscript.status === 'For Revision (Major)'
    ) {
      if (manuscript.revisionDeadline) {
        return manuscript.revisionDeadline.toDate 
          ? manuscript.revisionDeadline.toDate() 
          : new Date(manuscript.revisionDeadline);
      }
      return null;
    }
    
    // For Peer Reviewers, show their individual deadline
    if (role === 'Peer Reviewer' && currentUserId) {
      const reviewerMeta = manuscript.assignedReviewersMeta?.[currentUserId];
      if (reviewerMeta?.deadline) {
        return reviewerMeta.deadline.toDate 
          ? reviewerMeta.deadline.toDate() 
          : new Date(reviewerMeta.deadline);
      }
      return null;
    }

    // For Admins, Researchers, and Authors - find the appropriate deadline
    if (['Admin', 'Researcher', 'Author'].includes(role) && manuscript.assignedReviewersMeta) {
      const currentVersion = manuscript.versionNumber || 1;
      let latestDeadline = null;
      let latestDeadlineTime = 0;

      // Process all reviewers
      Object.entries(manuscript.assignedReviewersMeta).forEach(([reviewerId, meta]) => {
        // Skip declined reviewers or those without a deadline
        if (meta.invitationStatus === 'declined' || !meta.deadline) {
          return;
        }

        // Ensure this reviewer is assigned to the current version
        const assignedVersions = meta.assignedVersions || [];
        const versionData = meta.versionData || {};
        const isAssignedToCurrentVersion = 
          assignedVersions.includes(currentVersion) || versionData[currentVersion];

        if (!isAssignedToCurrentVersion) {
          return;
        }

        // Check if reviewer has already submitted for current version
        const hasSubmitted = manuscript.reviewerSubmissions?.some(
          sub => sub.reviewerId === reviewerId && 
                (sub.manuscriptVersionNumber || 1) === currentVersion
        );

        // Skip reviewers who have already submitted
        if (hasSubmitted) {
          return;
        }

        // Get the deadline as a Date object
        const deadline = meta.deadline.toDate 
          ? meta.deadline.toDate() 
          : new Date(meta.deadline);

        // Track the latest deadline
        if (!latestDeadline || deadline.getTime() > latestDeadlineTime) {
          latestDeadline = deadline;
          latestDeadlineTime = deadline.getTime();
        }
      });

      // Return the latest deadline found
      if (latestDeadline) {
        return latestDeadline;
      }
    }

    // Fallback to manuscript-level deadlines
    if (manuscript.invitationDeadline) {
      return manuscript.invitationDeadline.toDate 
        ? manuscript.invitationDeadline.toDate() 
        : new Date(manuscript.invitationDeadline);
    }

    if (manuscript.reviewDeadline) {
      return manuscript.reviewDeadline.toDate 
        ? manuscript.reviewDeadline.toDate() 
        : new Date(manuscript.reviewDeadline);
    }

    return null;
  } catch (error) {
    console.error('Error getting active deadline:', error);
    return null;
  }
};
  // Load the active deadline when the component mounts or when relevant props change
  useEffect(() => {
    const loadDeadline = async () => {
      try {
        const deadline = await getActiveDeadline(manuscript, role);
        setActiveDeadline(deadline);
      } catch (error) {
        console.error('Failed to load deadline:', error);
        setActiveDeadline(null);
      }
    };

    loadDeadline();
  }, [manuscript, role, currentUserId]);
const handleSendNotifications = async (userIds, type, title, message, metadata = {}) => {
  try {
    await notificationService.createBulkNotifications(
      userIds,
      type,
      title,
      message,
      metadata
    );
    return { success: true };
  } catch (error) {
    console.error('Error sending notifications:', error);
    throw error;
  }
};
  const handleStatusChange = async (manuscriptId, newStatus, note = '') => {
    console.log('handleStatusChange called with:', { 
      manuscriptId, 
      newStatus,
      note,
      currentUserId
    });
    
    if (!manuscriptId || !newStatus) {
      console.error('Missing required parameters for handleStatusChange');
      return { success: false, error: 'Missing required parameters' };
    }
    
    try {
      // First try to use the handleStatusUpdate from useManuscriptStatus
      if (handleStatusUpdate) {
        console.log('Using handleStatusUpdate from useManuscriptStatus');
        const result = await handleStatusUpdate(manuscriptId, newStatus, note || `Status changed to ${newStatus}`);
        if (result && result.success) {
          console.log('Status updated successfully using useManuscriptStatus');
          return { success: true };
        }
        return result || { success: false, error: 'Failed to update status' };
      }
      
      // Fallback to the prop function if available
      if (typeof props.handleStatusChange === 'function') {
        console.log('Using handleStatusChange from props');
        const result = await props.handleStatusChange(manuscriptId, newStatus, note);
        if (result && result.success) {
          console.log('Status updated successfully using prop function');
          return { success: true };
        }
        return result || { success: false, error: 'Failed to update status' };
      }
      
      // Last resort: direct update (without handling deadlines)
      console.warn('Using direct document update as fallback - deadlines may not be set correctly');
      const msRef = doc(db, "manuscripts", manuscriptId);
      console.log('Updating document directly...');
      await updateDoc(msRef, {
        status: newStatus,
        lastUpdated: serverTimestamp()
      });

      let updatedAssignedReviewers = [];
      let updatedAssignedMeta = {};

      // ---------- Handle status-specific reviewer updates ----------
      if (newStatus === "For Publication") {
        const acceptedReviewerIds = filterAcceptedReviewers(
          ms.reviewerDecisionMeta,
          (ms.assignedReviewers || []).map((id) => ({ id }))
        ).map((r) => r.id);

        // Include reviewers who already completed their review
        const completedReviewerIds =
          ms.reviewerSubmissions
            ?.filter((r) => r.status === "Completed")
            .map((r) => r.reviewerId) || [];

        const allVisibleReviewerIds = Array.from(
          new Set([...acceptedReviewerIds, ...completedReviewerIds])
        );

        updatedAssignedReviewers = buildReviewerObjects(allVisibleReviewerIds);

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
        // For new revisions, we need to reset the review data
        const currentReviewers = ms.assignedReviewers || [];

      // In your handleStatusChange function, update the "Back to Admin" section:
if (newStatus === "Back to Admin") {
  try {
    const adminIds = await getAdminUserIds();
    if (adminIds.length > 0) {
      await handleSendNotifications(
        adminIds,
        'status_change',
        'Manuscript Requires Attention',
        `Manuscript "${manuscriptTitle}" has been sent back to admin for review.`,
        {
          manuscriptId,
          status: newStatus,
          actionUrl: `/manuscripts?manuscriptId=${manuscriptId}`
        }
      );
    }
  } catch (error) {
    console.error('Error sending admin notifications:', error);
    // Don't block the status change if notification fails
  }
} else {
  // For major revisions, only keep reviewers who accepted
  const acceptedReviewerIds =
    newStatus === "For Revision (Major)"
      ? filterAcceptedReviewers(
          ms.reviewerDecisionMeta,
          currentReviewers.map((id) => ({ id }))
        ).map((r) => r.id)
      : [];

  updatedAssignedReviewers = buildReviewerObjects(acceptedReviewerIds);
  updatedAssignedMeta = Object.fromEntries(
    updatedAssignedReviewers.map((r) => [
      r.id,
      ms.assignedReviewersMeta?.[r.id] || {
        assignedAt: serverTimestamp(),
        assignedBy: currentUserId || 'system',
      },
    ])
  );
}
      }

      // ---------- Auto-change to "Back to Admin" only when appropriate ----------
      const autoOverrideStatuses = [
        "For Publication",
        "Peer Reviewer Rejected",
        "Rejected",
      ];
      if (!autoOverrideStatuses.includes(newStatus)) {
        const completedReviews =
          ms.reviewerSubmissions?.filter((r) => r.status === "Completed")
            .length || 0;

        const declinedReviews = Object.values(
          ms.assignedReviewersMeta || {}
        ).filter((m) => m.invitationStatus === "declined").length;

        const totalAssigned = ms.assignedReviewers?.length || 0;

        if (completedReviews + declinedReviews === totalAssigned) {
          newStatus = "Back to Admin";
        }
      }

      const updateData = {
        status: newStatus,
        assignedReviewers: updatedAssignedReviewers.map((r) => r.id),
        assignedReviewersMeta: updatedAssignedMeta,
        originalAssignedReviewers: ms.assignedReviewers || [],
        originalAssignedReviewersMeta: ms.assignedReviewersMeta || {},
        reviewerSubmissions: ms.reviewerSubmissions || [],
        finalDecisionAt: new Date(),
        finalDecisionBy: "Admin",
        lastUpdated: new Date().toISOString()
      };

      console.log('Attempting to update document with:', JSON.parse(JSON.stringify(updateData)));
      
      try {
        await updateDoc(msRef, updateData);
        console.log('Document updated successfully');
      } catch (updateError) {
        console.error('Error in updateDoc:', {
          error: updateError,
          errorMessage: updateError.message,
          errorStack: updateError.stack,
          updateData: JSON.parse(JSON.stringify(updateData))
        });
        throw updateError; // Re-throw to be caught by the outer catch
      }
    } catch (err) {
      console.error("Error in handleStatusChange:", {
        error: err,
        errorMessage: err.message,
        errorStack: err.stack,
        manuscriptId,
        newStatus,
        currentUserId
      });
      
      // Show error to user
      alert(`Failed to update status: ${err.message}`);
    }
  };

  return (
    <li className="border rounded-xl shadow-md hover:shadow-xl transition-all bg-gradient-to-br from-white to-gray-50 w-full sm:w-auto p-4">
      {/* Header */}
      <div className="w-full">
        <div className="flex justify-between items-start gap-2">
          <div className="flex-1 min-w-0">
            <p className="font-bold text-lg sm:text-xl break-words text-gray-900">
              {manuscriptTitle}
            </p>
            
            {/* Removed duplicate reviewer information - now shown in the main content area */}
          </div>
          
          {/* Status and rejection badge */}
          <div className="flex flex-col items-end gap-1">
            <ManuscriptStatusBadge
              status={
                // If user is a peer reviewer and is assigned to this manuscript
                role === 'Peer Reviewer' && manuscript.assignedReviewers?.includes(currentUserId)
                  ? manuscript.assignedReviewersMeta?.[currentUserId]?.invitationStatus === 'accepted' 
                    ? status // Show the actual status if reviewer has accepted
                    : manuscript.assignedReviewersMeta?.[currentUserId]?.invitationStatus === 'declined'
                      ? 'Review Declined'
                      : 'Pending Acceptance'
                  : status // For non-reviewers or uninvited reviewers, show the regular status
              }
              className="ml-2"
            />
            
            {hasRejection &&
              (status === "Back to Admin" || status === "Rejected") &&
              role === "Admin" && (
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold shadow-sm bg-red-100 text-red-800">
                  Rejected by Peer Reviewer
                </span>
              )}
            
            {/* Deadline */}
            {(() => {
              // Use the pre-fetched activeDeadline from state
              // Only hide deadline for these specific statuses
              const hideDeadlineForStatuses = [
                "For Publication",
                "Rejected",
                "Peer Reviewer Rejected",
                "non-Acceptance"
                // Note: "For Revision (Minor)" and "For Revision (Major)" are intentionally not included here
                // so their deadlines will be shown
              ];
              
              if (!activeDeadline || hideDeadlineForStatuses.includes(status)) {
                return null;
              }

              // For Admins - show for all manuscripts
              if (role === "Admin") {
                // Use the assigned date or submission date, but ensure it's not in the future
                const startDate = manuscript.assignedAt || manuscript.submittedAt || new Date();
                const now = new Date();
                const effectiveStart = new Date(startDate) > now ? now : new Date(startDate);
                
                return (
                  <DeadlineBadge
                    start={effectiveStart}
                    end={activeDeadline}
                    formatDate={formatDate}
                    className="mt-1"
                  />
                );
              }

              // For Peer Reviewers - show deadline if assigned to this manuscript
              // and either:
              // 1. Review is not completed, or
              // 2. Status is 'Back to Admin' or 'Revision'
              if (role === "Peer Reviewer" && manuscript.assignedReviewers?.includes(currentUserId)) {
                const meta = manuscript.assignedReviewersMeta?.[currentUserId];
                const currentStatus = manuscript.status?.toLowerCase();
                
                // Check if review is completed by either reviewStatus or reviewerSubmissions
                const hasCompletedReview = manuscript.reviewerSubmissions?.some(
                  sub => sub.reviewerId === currentUserId && 
                        ['completed', 'submitted'].includes(sub.status?.toLowerCase())
                );
                
                // Always show deadline if status is 'Back to Admin' or 'For Revision (Minor/Major)'
                // or if review is not completed
                if (!hasCompletedReview || 
                    ['back to admin', 'for revision (minor)', 'for revision (major)'].includes(currentStatus)) {
                  return (
                    <DeadlineBadge
                      start={meta?.assignedAt || manuscript.submittedAt || new Date()}
                      end={activeDeadline}
                      formatDate={formatDate}
                      className="mt-1"
                    />
                  );
                }
                return null;
              }

              // For Researchers - show if they are the submitter or a co-author
              if (role === "Researcher" && 
                  (manuscript.submitterId === currentUserId || 
                   manuscript.coAuthorsIds?.includes(currentUserId))) {
                // Use the assigned date or submission date, but ensure it's not in the future
                const startDate = manuscript.assignedAt || manuscript.submittedAt || new Date();
                const now = new Date();
                const effectiveStart = new Date(startDate) > now ? now : new Date(startDate);
                
                return (
                  <div className="mt-2">
                    <div className="flex items-center text-sm text-gray-600">
                      <DeadlineBadge
                        start={effectiveStart}
                        end={activeDeadline}
                        formatDate={formatDate}
                      />
                    </div>
                  </div>
                );
              }

              return null;
            })()}
          </div>
        </div>
      </div>

      {/* Author & Meta Info */}
      <div className="mt-2 text-sm sm:text-base text-gray-600 break-words space-y-0.5">
        {(role !== "Peer Reviewer" || !currentUserId) ? (
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
            {(manuscript.assignedReviewersMeta?.[currentUserId] || 
              (manuscript.previousReviewers?.includes(currentUserId) && 
               ["For Publication", "Rejected", "Peer Reviewer Rejected"].includes(manuscript.status))) &&
              (() => {
                const isPreviousReviewer = manuscript.previousReviewers?.includes(currentUserId) && 
                                          !manuscript.assignedReviewers?.includes(currentUserId);
                const meta = manuscript.assignedReviewersMeta?.[currentUserId] || 
                           (isPreviousReviewer ? {
                             assignedAt: manuscript.submittedAt,
                             acceptedAt: manuscript.submittedAt
                           } : {});
                
                const assignedAt = normalizeTimestamp(meta.assignedAt);
                const acceptedAt = normalizeTimestamp(meta.acceptedAt);
                const declinedAt = normalizeTimestamp(meta.declinedAt);
                const respondedAt = normalizeTimestamp(meta.respondedAt);
                // Use the pre-fetched activeDeadline from state

                return (
                  <>
                    {assignedAt && <p>Invited: {formatDate(assignedAt)}</p>}
                    {acceptedAt && <p>Accepted: {formatDate(acceptedAt)}</p>}
                    {respondedAt && <p>Responded: {formatDate(respondedAt)}</p>}
                    {declinedAt && <p>Declined: {formatDate(declinedAt)}</p>}
                    
                    {(manuscript.reviewerSubmissions?.some(
                      (r) =>
                        r.reviewerId === currentUserId &&
                        r.status === "Completed"
                    ) ||
                    [
                      "Back to Admin",
                      "For Publication",
                      "Rejected",
                      "Peer Reviewer Rejected",
                    ].includes(manuscript.status)) && (
                      <p className="text-green-700 font-medium">
                        {isPreviousReviewer ? "✅ Previously Reviewed" : "✅ Review Completed"}
                      </p>
                    )}

                    {/* Deadline badge removed from here - now shown in the header */}
                  </>
                );
              })()}
          </>
        )}  
      </div>

      {/* Reviewer Feedback - Hidden for Researchers and Peer Reviewers */}
      {visibleReviewers.length > 0 && role !== "Peer Reviewer" && role !== "Researcher" && (
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

      {/* Admin Feedback Section - Show to Admin, Researcher, and Co-authors, hide from Peer Reviewer */}
      {(role === "Admin" || role === "Researcher" || role === "Co-Author") && (
        <div className="mt-6 space-y-4">
          <AdminFeedback 
            manuscriptId={manuscript.id} 
            userRole={role}
            status={manuscript.status}
            currentVersion={manuscript.versionNumber?.toString() || '1'}
          />
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
         manuscript.submitterId === currentUserId &&
          ["For Revision (Minor)", "For Revision (Major)"].includes(status) && (
            <button
              onClick={() => navigate(`/researcher/resubmit/${id}`)}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium text-sm sm:text-base"
            >
              Resubmit Revised Manuscript
            </button>
          )}
      </div>

      {/* Status Action Buttons - Moved below the card */}
      {role === "Admin" && status !== "Pending" && (
        <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <h3 className="text-lg font-medium text-gray-800 mb-3">Manuscript Status</h3>
          <StatusActionButtons
            id={id}
            status={status}
            assignReviewer={assignReviewer}
            statusToDeadlineField={statusToDeadlineField}
            handleStatusChange={handleStatusChange}
            hasReviewer={hasReviewer}
            unassignReviewer={unassignReviewer}
          />
        </div>
      )}

      {/* Submission History - Show for all manuscripts, but only if user has appropriate role */}
      {manuscript && (
        (role === "Admin" || 
         role === "Researcher" ||
         (role === "Peer Reviewer" && 
          (() => {
            const isAssigned = manuscript.assignedReviewers?.includes(currentUserId);
            const isPreviousReviewer = (manuscript.previousReviewers || []).includes(currentUserId);
            const myDecision = manuscript.reviewerDecisionMeta?.[currentUserId]?.decision;
            const hasDeclined = manuscript.declinedReviewers?.includes(currentUserId);
            const hasReviewedBefore = isPreviousReviewer || (manuscript.reviewerSubmissions || []).some(s => s.reviewerId === currentUserId);
            
            // Only hide if they declined AND never reviewed it before
            if (hasDeclined && !hasReviewedBefore) return false;
            
            // If currently assigned, always show
            if (isAssigned) return true;
            
            // If previously reviewed, check for conflicting decisions
            if (isPreviousReviewer) {
              // Hide if reviewer rejected but manuscript was published
              if (manuscript.status === "For Publication" && myDecision === "reject") {
                return false;
              }
              // Hide if reviewer approved but manuscript was rejected
              if (["Rejected", "Peer Reviewer Rejected"].includes(manuscript.status) && 
                  myDecision && myDecision !== "reject") {
                return false;
              }
              // Otherwise, show the manuscript
              return true;
            }
            
            // For current submissions, check if they have access
            const hasSubmitted = (manuscript.reviewerSubmissions || []).some(s => s.reviewerId === currentUserId);
            if (hasSubmitted) {
              // Apply the same conflict rules for current submissions
              if (manuscript.status === "For Publication") {
                return myDecision && myDecision !== "reject";
              }
              if (["Rejected", "Peer Reviewer Rejected"].includes(manuscript.status)) {
                return myDecision === "reject";
              }
              return true;
            }
            
            return false;
          })()
         )
        ) && (
          <div className="mt-4 border-t pt-3">
            <button
              className="mb-2 px-4 py-1 bg-blue-100 text-blue-700 rounded font-medium text-sm hover:bg-blue-200"
              onClick={() => setExpandedSubmissionHistory((v) => !v)}
            >
              {expandedSubmissionHistory
                ? `Hide Submission History`
                : `Show Submission History (${manuscript.submissionHistory?.length || 0})`}
            </button>

            {expandedSubmissionHistory && (
              <SubmissionHistory
                manuscript={manuscript}
                users={users}
                downloadFileCandidate={downloadFileCandidate}
                role={role}
              />
            )}
          </div>
        )
      )}

      {/* View Response Modal */}
      {showModal && (
        <ManuscriptModal
          manuscript={manuscript}
          onClose={() => setShowModal(false)}
          downloadFileCandidate={downloadFileCandidate}
          formatDate={formatDate}
        />
      )}
    </li>
  );
};

export default ManuscriptItem;
