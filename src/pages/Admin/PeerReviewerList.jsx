import React, { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { getAuth } from "firebase/auth";
import { db } from "../../firebase/firebase";
import { functions } from "../../firebase/firebase";
import {
  checkProfileComplete,
  getProfileCompletionStatus,
} from "../../components/profile/profileUtils";
import EmailService from "../../utils/emailService";
import {
  collection,
  getDocs,
  doc,
  updateDoc,
  query,
  where,
  getDoc,
  addDoc,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { getFunctions, httpsCallable } from 'firebase/functions';
import { FaSearch } from "react-icons/fa";
import { app } from '../../firebase/firebase';  // Make sure this points to your firebase config

export default function PeerReviewerList() {
  const [reviewers, setReviewers] = useState([]);
   const functions = getFunctions(app, 'asia-east2');
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(5);
  const [manuscriptData, setManuscriptData] = useState(null);
  const [previousReviewers, setPreviousReviewers] = useState([]);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [invitationDeadline, setInvitationDeadline] = useState(7); // Default to 7 days
  const [showAvailableOnly, setShowAvailableOnly] = useState(true); // Filter for available reviewers
  const [expertiseFilter, setExpertiseFilter] = useState(""); // Filter by expertise
  const [invitingReviewerId, setInvitingReviewerId] = useState(null); // Track which reviewer is being invited
  const location = useLocation();
  const navigate = useNavigate();
  const params = new URLSearchParams(location.search);
  const manuscriptId = params.get("manuscriptId");
  const deadlineParam = params.get("deadline"); // from URL if provided
const emailService = React.useMemo(() => new EmailService(functions), []);
  // List of expertise options
  const expertiseOptions = [
    "", // Empty for 'All Expertises'
    "Higher Education",
    "Graduate Studies",
    "Biodiversity",
    "Health",
    "IT",
    "Advancing Pharmacy",
    "Business and Governance",
  ];

  const getPageNumbers = (current, total) => {
    const delta = 2;
    const range = [];
    const rangeWithDots = [];
    for (let i = 1; i <= total; i++) {
      if (
        i === 1 ||
        i === total ||
        (i >= current - delta && i <= current + delta)
      )
        range.push(i);
    }
    let prev = null;
    for (let num of range) {
      if (prev) {
        if (num - prev === 2) rangeWithDots.push(prev + 1);
        else if (num - prev > 2) rangeWithDots.push("...");
      }
      rangeWithDots.push(num);
      prev = num;
    }
    return rangeWithDots;
  };

  // These statuses will be counted towards the reviewer's active workload
  const ACTIVE_STATUSES = [
    "Assigning Peer Reviewer",
    "Peer Reviewer Assigned",
    "Peer Reviewer Reviewing",
    "For Revision (Minor)",
    "For Revision (Major)",
    "Back to Admin",
  ];

  // These statuses indicate a revision is in progress
  const REVISION_STATUSES = ["For Revision (Minor)", "For Revision (Major)"];

  // Reviewer availability is now managed by the reviewers themselves

  const fetchReviewers = async () => {
    setLoading(true);

    try {
      // Get all peer reviewers
      const usersSnap = await getDocs(collection(db, "Users"));
      const allUsers = usersSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

      // Filter for peer reviewers with complete profiles
      const reviewersOnly = allUsers
        .filter((user) => {
          // Only include users with role 'Peer Reviewer' and complete profiles
          if (user.role !== 'Peer Reviewer') return false;
          
          // Check for required profile fields
          const hasRequiredFields = 
            user.firstName && 
            user.lastName && 
            user.email && 
            user.expertise;
            
          return hasRequiredFields;
        })
        .map(reviewer => ({
          ...reviewer,
          // Ensure isAvailableForReview is always a boolean (default to true if not set)
          isAvailableForReview: reviewer.isAvailableForReview !== false,
          // Map other fields as needed
          name: reviewer.name || `${reviewer.firstName} ${reviewer.lastName}`,
          assignedCount: reviewer.assignedCount || 0
        }));

      const reviewersWithCount = await Promise.all(
        reviewersOnly.map(async (r) => {
          try {
            // Get all manuscripts where this reviewer is assigned
            const manuscriptsSnap = await getDocs(
              query(
                collection(db, "manuscripts"),
                where("assignedReviewers", "array-contains", r.id)
              )
            );

            // Log all manuscripts and their statuses for this reviewer with more details

            const statusCounts = {};
            manuscriptsSnap.docs.forEach((doc) => {
              const data = doc.data();
              const status = data.status || "No Status";
              statusCounts[status] = (statusCounts[status] || 0) + 1;
            });

            // Count only manuscripts with the exact statuses we care about
            const activeManuscripts = manuscriptsSnap.docs.filter((doc) => {
              const status = doc.data().status || "";
              return ACTIVE_STATUSES.includes(status);
            });

            // Count only manuscripts that are in revision status
            const revisionManuscripts = manuscriptsSnap.docs.filter((doc) => {
              const status = doc.data().status || "";
              return REVISION_STATUSES.includes(status);
            });

            return { ...r, assignedCount: activeManuscripts.length };
          } catch (error) {
            console.error(`Error processing reviewer ${r.id}:`, error);
            return { ...r, assignedCount: 0 }; // Return 0 if there's an error
          }
        })
      );

      setReviewers(reviewersWithCount);
    } catch (err) {
      console.error("Error fetching reviewers:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const fetchInvitationDeadline = async () => {
      try {
        const settingsRef = doc(db, "deadlineSettings", "deadlines");
        const settingsSnap = await getDoc(settingsRef);
        if (settingsSnap.exists() && settingsSnap.data().invitationDeadline) {
          setInvitationDeadline(settingsSnap.data().invitationDeadline);
        }
      } catch (error) {
        console.error("Error fetching invitation deadline:", error);
      }
    };
    fetchInvitationDeadline();
  }, []);

  useEffect(() => {
    if (manuscriptId) {
      fetchManuscriptData();
    }
    fetchReviewers();
  }, [manuscriptId, refreshTrigger]); // Add refreshTrigger to dependencies

  const fetchManuscriptData = async () => {
    try {
      const msRef = doc(db, "manuscripts", manuscriptId);
      const msSnap = await getDoc(msRef);
      if (msSnap.exists()) {
        const data = msSnap.data();
        setManuscriptData(data);

        // Get previous reviewers from submission history
        if (data.submissionHistory && data.submissionHistory.length > 1) {
          // Get reviewers from the most recent previous version
          const previousVersion =
            data.submissionHistory[data.submissionHistory.length - 2];
          const prevReviewerIds = previousVersion.reviewers || [];

          // Fetch reviewer details
          if (prevReviewerIds.length > 0) {
            const usersSnap = await getDocs(collection(db, "Users"));
            const allUsers = usersSnap.docs.map((d) => ({
              id: d.id,
              ...d.data(),
            }));
            const prevReviewerData = allUsers.filter((u) =>
              prevReviewerIds.includes(u.id)
            );

            // Add their previous decisions
            const reviewersWithDecisions = prevReviewerData.map((reviewer) => ({
              ...reviewer,
              previousDecision:
                previousVersion.reviewerDecisionMeta?.[reviewer.id]?.decision,
              previousComment:
                previousVersion.reviewerDecisionMeta?.[reviewer.id]?.comment,
            }));

            setPreviousReviewers(reviewersWithDecisions);
          }
        }
      }
    } catch (err) {
      console.error("Error fetching manuscript data:", err);
    }
  };

const handleAssign = async (reviewerId) => {
  setInvitingReviewerId(reviewerId); // Set loading state
  if (!manuscriptId) {
    alert("No manuscript selected for invitation.");
    return;
  }

  try {
    const auth = getAuth();
    const currentUser = auth.currentUser;
    if (!currentUser) throw new Error("Not signed in");

    const msRef = doc(db, "manuscripts", manuscriptId);
    const msSnap = await getDoc(msRef);
    
    if (!msSnap.exists()) {
      alert("Manuscript not found.");
      return;
    }

      const msData = msSnap.data();
      const assigned = [...(msData.assignedReviewers || [])];
      const assignedMeta = { ...(msData.assignedReviewersMeta || {}) };

      if (!assigned.includes(reviewerId)) {
        const invitedAt = serverTimestamp();

        // Get the deadline settings
        const settingsRef = doc(db, "deadlineSettings", "deadlines");
        const settingsSnap = await getDoc(settingsRef);

        // Default to 7 days if no settings found
        let daysForDeadline = 7;

        if (settingsSnap.exists()) {
          const settings = settingsSnap.data();

          // Always use invitationDeadline for reviewer assignments, regardless of manuscript status
          daysForDeadline = settings.invitationDeadline || 7;
        }

        // Calculate the deadline - always use current date + invitation deadline days
        const deadlineDate = new Date();
        deadlineDate.setDate(deadlineDate.getDate() + daysForDeadline);

        // Create a Firestore Timestamp for the deadline
        let deadlineForFirestore = Timestamp.fromDate(deadlineDate);

        // Get current version
        const currentVersion = msData.versionNumber || 1;

        // Get existing versions or initialize if doesn't exist
        const existingVersions =
          assignedMeta[reviewerId]?.assignedVersions || [];

        // If this is a new version, ensure we're using the correct deadline from settings
        if (!existingVersions.includes(currentVersion)) {
          // Recalculate the deadline using the same logic as initial invite
          const settingsRef = doc(db, "deadlineSettings", "deadlines");
          const settingsSnap = await getDoc(settingsRef);
          let daysForDeadline = 7; // Default to 7 days if no settings found

          if (settingsSnap.exists()) {
            const settings = settingsSnap.data();
            // Always use invitationDeadline for reviewer assignments, regardless of manuscript status
            daysForDeadline = settings.invitationDeadline || 7;
          }

          // Recalculate the deadline
          const newDeadlineDate = new Date();
          newDeadlineDate.setDate(newDeadlineDate.getDate() + daysForDeadline);
          deadlineForFirestore = Timestamp.fromDate(newDeadlineDate);
        }

        // Build reviewer metadata (admin-side)
        const newMeta = {
          ...(assignedMeta[reviewerId] || {}),
          assignedAt: serverTimestamp(),
          assignedBy: currentUser.displayName || currentUser.email || "Admin",
          assignedById: currentUser.uid,
          invitationStatus: "pending",
          invitedAt,
          respondedAt: null,
          acceptedAt: null, // will be filled when reviewer accepts
          declinedAt: null, // will be filled when reviewer declines
          decision: null,
          deadline: deadlineForFirestore,
          // Track which versions this reviewer is assigned to
          assignedVersions: [...new Set([...existingVersions, currentVersion])],
          // Track individual version data
          versionData: {
            ...(assignedMeta[reviewerId]?.versionData || {}),
            [currentVersion]: {
              invitedAt: serverTimestamp(),
              deadline: deadlineForFirestore,
              status: "pending",
            },
          },
        };

        // Update Firestore
        const updatedAssigned = [...assigned, reviewerId];
        const updatedMeta = { ...assignedMeta, [reviewerId]: newMeta };

        // Determine status: should remain "Assigning Peer Reviewer" until reviewers accept
        // Only change to "Peer Reviewer Assigned" if at least one reviewer has accepted
        const hasAcceptedReviewer = Object.values(updatedMeta).some(
          (meta) => meta.invitationStatus === "accepted"
        );

        const newStatus = hasAcceptedReviewer
          ? "Peer Reviewer Assigned"
          : "Assigning Peer Reviewer";

        // Update Firestore
        const updateData = {
          assignedReviewers: updatedAssigned,
          assignedReviewersMeta: updatedMeta,
          status: newStatus,
        };

        await updateDoc(msRef, updateData);

        // Get reviewer details for email
        const reviewerDoc = await getDoc(doc(db, "Users", reviewerId));
        const reviewerData = reviewerDoc.data();

        // Send invitation email
       // Send invitation email
try {
  const emailData = {
    reviewerEmail: reviewerData.email,
    reviewerName: `${reviewerData.firstName} ${reviewerData.lastName}`,
    manuscriptTitle: msData.title,
    deadlineDate: deadlineDate.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }),
    manuscriptId: manuscriptId,
    adminName: currentUser.displayName || 'Admin'
  };

  // Call the Firebase Function directly
  const sendInvitationEmail = httpsCallable(functions, 'sendReviewerInvitationEmail');
  await sendInvitationEmail(emailData);
} catch (emailError) {
  console.error("Failed to send invitation email:", emailError);
  // Don't fail the entire process if email fails
  // The reviewer is still assigned in Firestore
}

        // Update the local state immediately for better UX
        setReviewers((prevReviewers) =>
          prevReviewers.map((reviewer) =>
            reviewer.id === reviewerId
              ? {
                  ...reviewer,
                  assignedCount: (reviewer.assignedCount || 0) + 1,
                }
              : reviewer
          )
        );

        // Reset loading state
        setInvitingReviewerId(null);

        // Send notification with deadline information
        const notificationRef = collection(
          db,
          "Users",
          reviewerId,
          "Notifications"
        );
        const notificationDeadline = deadlineForFirestore.toDate();
        const formattedDeadline = notificationDeadline.toLocaleDateString(
          "en-US",
          {
            year: "numeric",
            month: "long",
            day: "numeric",
          }
        );

        await addDoc(notificationRef, {
          type: "reviewer_invitation",
          manuscriptId: manuscriptId,
          manuscriptTitle: msData.title || "Untitled Manuscript",
          status: "pending",
          timestamp: serverTimestamp(),
          seen: false,
          title: "Invitation to Review Manuscript",
          message: `You have been invited to review "${
            msData.title || "Untitled Manuscript"
          }" (Deadline: ${formattedDeadline})`,
          actionUrl: `/reviewer-invitations`,
          invitedAt,
          deadline: deadlineForFirestore,
          deadlineFormatted: formattedDeadline,
        });

        // Trigger a complete refresh to ensure data consistency
        setRefreshTrigger((prev) => prev + 1);
        alert("Reviewer successfully invited!");
      }
    } catch (err) {
      console.error("Error assigning reviewer:", err);
      // Reset loading state on error
      setInvitingReviewerId(null);
      // Show error message to user
      setAlert({
        message: `Failed to assign reviewer: ${err.message}`,
        type: "error",
      });
      alert("Failed to invite reviewer.");
    }
  };

  // Memoize the filtered reviewers to prevent unnecessary recalculations
  const filteredReviewers = React.useMemo(() => {
    return reviewers.filter((reviewer) => {
      // Filter by availability if showAvailableOnly is true
      if (showAvailableOnly && reviewer.isAvailableForReview === false) {
        return false;
      }

      // Filter by expertise if selected
      if (expertiseFilter && reviewer.expertise !== expertiseFilter) {
        return false;
      }

      // Filter by search query if provided
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matches =
          (reviewer.name && reviewer.name.toLowerCase().includes(q)) ||
          (reviewer.email && reviewer.email.toLowerCase().includes(q)) ||
          (reviewer.firstName &&
            reviewer.firstName.toLowerCase().includes(q)) ||
          (reviewer.lastName && reviewer.lastName.toLowerCase().includes(q)) ||
          (reviewer.expertise && reviewer.expertise.toLowerCase().includes(q));
        if (!matches) {
          return false;
        }
      }

      return true;
    });
  }, [reviewers, searchQuery, showAvailableOnly, expertiseFilter]);

  const indexOfLast = currentPage * itemsPerPage;
  const indexOfFirst = indexOfLast - itemsPerPage;
  const currentReviewers = filteredReviewers.slice(indexOfFirst, indexOfLast);

  const handleNavigateProfile = (userId) => {
    navigate(`/profile/${userId}`);
  };

  return (
    <div className="p-4 pb-28 sm:p-8 bg-gray-50 min-h-screen pt-28 md:pt-24 relative my-4 mx-11">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 sm:mb-10">
        <h2 className="text-2xl sm:text-3xl font-bold text-center md:text-left mb-4 md:mb-0 text-gray-800">
          Select Peer Reviewer
        </h2>

        <div className="flex flex-col sm:flex-row items-center gap-4">
          <div className="w-full sm:w-auto">
            <label
              htmlFor="expertise-filter"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Filter by Expertise
            </label>
            <select
              id="expertise-filter"
              value={expertiseFilter}
              onChange={(e) => setExpertiseFilter(e.target.value)}
              className="block w-full sm:w-48 px-3 py-2 border border-gray-300 bg-white shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
            >
              <option value="">All Expertises</option>
              {expertiseOptions
                .filter((opt) => opt !== "")
                .map((expertise) => (
                  <option key={expertise} value={expertise}>
                    {expertise}
                  </option>
                ))}
            </select>
          </div>

          <div className="flex items-center mt-2 sm:mt-0">
            <span className="text-sm font-medium text-gray-700 mr-2">
              Available Only
            </span>
            <button
              onClick={() => setShowAvailableOnly(!showAvailableOnly)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${
                showAvailableOnly ? "bg-green-500" : "bg-gray-200"
              }`}
              aria-pressed={showAvailableOnly}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  showAvailableOnly ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Previous Reviewers Section */}
      {previousReviewers.length > 0 && (
        <div className="mb-6 p-4 bg-blue-50 border-2 border-blue-300 rounded-lg">
          <h3 className="text-lg font-semibold text-blue-900 mb-3">
            📋 Previous Reviewers (Version{" "}
            {manuscriptData?.versionNumber - 1 || 1})
          </h3>
          <p className="text-sm text-blue-800 mb-3">
            These reviewers reviewed the previous version of this manuscript.
            Consider re-inviting them for consistency.
          </p>
          <div className="space-y-2">
            {previousReviewers.map((reviewer) => {
              const decisionLabels = {
                minor: "Minor Revision",
                major: "Major Revision",
                publication: "For Publication",
                reject: "Rejected",
              };
              const decisionColors = {
                minor: "bg-yellow-100 text-yellow-800 border-yellow-300",
                major: "bg-orange-100 text-orange-800 border-orange-300",
                publication: "bg-green-100 text-green-800 border-green-300",
                reject: "bg-red-100 text-red-800 border-red-300",
              };

              return (
                <div
                  key={reviewer.id}
                  className="bg-white p-3 rounded border border-blue-200 flex justify-between items-center"
                >
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">
                      {reviewer.firstName} {reviewer.lastName}
                    </p>
                    <p className="text-sm text-gray-600">{reviewer.email}</p>
                    {reviewer.previousDecision && (
                      <span
                        className={`inline-block mt-1 px-2 py-0.5 text-xs font-medium rounded border ${
                          decisionColors[reviewer.previousDecision] ||
                          "bg-gray-100 text-gray-800"
                        }`}
                      >
                        Previous:{" "}
                        {decisionLabels[reviewer.previousDecision] ||
                          reviewer.previousDecision}
                      </span>
                    )}
                  </div>
                  <button
                    className="ml-3 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 text-sm font-medium"
                    onClick={() => handleAssign(reviewer.id)}
                  >
                    Re-Invite
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Manuscript Info */}
      {manuscriptData && (
        <div className="mb-4 p-3 bg-gray-100 border border-gray-300 rounded">
          <p className="text-sm text-gray-700">
            <strong>Manuscript:</strong> {manuscriptData.title || "Untitled"}
            {manuscriptData.versionNumber > 1 && (
              <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-800 text-xs rounded">
                Version {manuscriptData.versionNumber}
              </span>
            )}
          </p>
        </div>
      )}

      {/* Search */}
      <div className="relative mb-4 w-full sm:w-72 mx-auto">
        <input
          type="text"
          placeholder="Search reviewer"
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setCurrentPage(1);
          }}
          className="w-full pl-10 pr-2 py-1 sm:py-2 border-[3px] border-red-900 rounded text-sm sm:text-base focus:outline-none focus:border-red-900 focus:ring-2 focus:ring-red-900"
        />
        <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-yellow-500" />
      </div>

      {loading ? (
        <p className="text-center text-gray-500 text-base">
          Loading reviewers...
        </p>
      ) : (
        <div className="overflow-x-auto">
          <div className="min-w-full">
            <div className="hidden sm:grid grid-cols-12 bg-yellow-400 p-3 font-semibold text-red-800 rounded-t-lg">
              <span className="px-2 text-left col-span-2">Name</span>
              <span className="px-2 text-left col-span-3">Email</span>
              <span className="px-2 text-left col-span-2">Expertise</span>
              <span className="px-2 text-center col-span-1">Assigned</span>
              <span className="px-2 text-center col-span-2">Status</span>
              {manuscriptId && (
                <span className="px-2 text-center col-span-2">Action</span>
              )}
            </div>

            <div className="border-2 border-red-800 rounded-b-md overflow-hidden">
              {currentReviewers.map((r) => (
                <div
                  key={r.id}
                  className="bg-white hover:bg-gray-50 border-b border-gray-200"
                >
                  {/* Mobile View */}
                  <div className="sm:hidden p-4">
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="font-medium">Name:</span>
                        <span className="text-red-800 text-right">
                          <button
                            className="hover:underline"
                            onClick={() => handleNavigateProfile(r.id)}
                          >
                            {r.name || `${r.firstName} ${r.lastName}`}
                          </button>
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-medium">Email:</span>
                        <span className="text-red-800 text-right">
                          <button
                            className="hover:underline"
                            onClick={() => handleNavigateProfile(r.id)}
                          >
                            {r.email}
                          </button>
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-medium">Expertise:</span>
                        <span className="text-right">{r.expertise || "—"}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-medium">Assigned:</span>
                        <span className="text-right">{r.assignedCount}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-medium">Status:</span>
                        <div className="flex items-center space-x-2">
                          <span className="text-sm text-gray-600">
                            {r.assignedCount || 0} assigned
                          </span>
                          <div className="h-1 w-1 rounded-full bg-gray-400"></div>
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            r.isAvailableForReview === false 
                              ? 'bg-red-100 text-red-800' 
                              : 'bg-green-100 text-green-800'
                          }`}>
                            {r.isAvailableForReview === false ? "Unavailable" : "Available"}
                          </span>
                        </div>
                      </div>
                      {manuscriptId && (
                        <div className="pt-2">
                          <button
                            className={`w-full bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 text-sm whitespace-nowrap flex items-center justify-center ${
                              invitingReviewerId === r.id
                                ? 'bg-blue-400 cursor-not-allowed'
                                : 'bg-blue-500 hover:bg-blue-600 text-white'
                            }`}
                            onClick={() => handleAssign(r.id)}
                            disabled={invitingReviewerId === r.id}
                          >
                            {invitingReviewerId === r.id ? (
                              <>
                                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Sending...
                              </>
                            ) : (
                              'Invite'
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Desktop View */}
                  <div className="hidden sm:grid grid-cols-12 items-center p-3">
                    <div className="px-2 text-left col-span-2 truncate">
                      <button
                        className="text-red-800 hover:underline truncate max-w-full inline-block"
                        onClick={() => handleNavigateProfile(r.id)}
                        title={r.name || `${r.firstName} ${r.lastName}`}
                      >
                        {r.name || `${r.firstName} ${r.lastName}`}
                      </button>
                    </div>
                    <div className="px-2 text-left col-span-3 truncate">
                      <button
                        className="text-red-800 hover:underline truncate max-w-full inline-block"
                        onClick={() => handleNavigateProfile(r.id)}
                        title={r.email}
                      >
                        {r.email}
                      </button>
                    </div>
                    <div className="px-2 text-left col-span-2 truncate">
                      <span
                        className="text-gray-800 truncate inline-block max-w-full"
                        title={r.expertise || ""}
                      >
                        {r.expertise || "—"}
                      </span>
                    </div>
                    <div className="px-2 text-center col-span-1">
                      <span className="text-gray-800">{r.assignedCount}</span>
                    </div>
                    <div className="px-2 text-center col-span-2">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${
                          r.isAvailableForReview === false
                            ? "bg-gray-100 text-gray-800"
                            : r.assignedCount > 0
                            ? "bg-yellow-100 text-yellow-800"
                            : "bg-green-100 text-green-800"
                        }`}
                      >
                        {r.isAvailableForReview === false
                          ? "Unavailable"
                          : r.assignedCount > 0
                          ? "Busy"
                          : "Available"}
                      </span>
                    </div>
                    {manuscriptId && (
                      <div className="px-2 text-center col-span-2">
                        <button
                          className={`w-full bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 text-sm whitespace-nowrap flex items-center justify-center ${
                            invitingReviewerId === r.id
                              ? 'bg-blue-400 cursor-not-allowed'
                              : 'bg-blue-500 hover:bg-blue-600 text-white'
                          }`}
                          onClick={() => handleAssign(r.id)}
                          disabled={invitingReviewerId === r.id}
                        >
                          {invitingReviewerId === r.id ? (
                            <>
                              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                              Sending...
                            </>
                          ) : (
                            'Invite'
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {currentReviewers.length === 0 && (
                <div className="p-4 text-center text-gray-600">
                  No reviewers found.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Pagination */}
      <div className="mt-4 p-2 bg-yellow-400 shadow-lg flex flex-col sm:flex-row justify-between items-center gap-2 rounded-sm">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-bold text-red-900">Page Size:</span>
          <select
            value={itemsPerPage}
            onChange={(e) => {
              setItemsPerPage(Number(e.target.value));
              setCurrentPage(1);
            }}
            className="border-2 border-red-800 bg-yellow-400 rounded-md text-red-900 font-bold text-sm"
          >
            <option value={5}>5</option>
            <option value={10}>10</option>
            <option value={20}>20</option>
          </select>
        </div>

        <div className="flex items-center flex-wrap gap-1 text-sm">
          <button
            onClick={() => setCurrentPage(1)}
            disabled={currentPage === 1}
            className="px-3 py-1 mr-1 bg-yellow-400 text-red-900 rounded-md border border-red-900 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            First
          </button>
          <button
            onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
            disabled={currentPage === 1}
            className="px-3 py-1 mr-4 bg-yellow-400 text-red-900 rounded-md border border-red-900 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Prev
          </button>
          {getPageNumbers(
            currentPage,
            Math.ceil(filteredReviewers.length / itemsPerPage)
          ).map((num, idx) =>
            num === "..." ? (
              <span key={idx} className="px-3 py-1">
                ...
              </span>
            ) : (
              <button
                key={idx}
                onClick={() => setCurrentPage(num)}
                className={`px-3 py-1 mr-1 rounded-lg ${
                  num === currentPage
                    ? "bg-red-900 text-white border border-red-900"
                    : "bg-yellow-400 text-red-900 border border-red-900"
                }`}
              >
                {num}
              </button>
            )
          )}
          <button
            onClick={() =>
              setCurrentPage((prev) =>
                Math.min(
                  prev + 1,
                  Math.ceil(filteredReviewers.length / itemsPerPage)
                )
              )
            }
            disabled={
              currentPage === Math.ceil(filteredReviewers.length / itemsPerPage)
            }
            className="px-3 py-1 ml-3 mr-1 bg-yellow-400 text-red-900 rounded-md border border-red-900 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
          </button>
          <button
            onClick={() =>
              setCurrentPage(Math.ceil(filteredReviewers.length / itemsPerPage))
            }
            disabled={
              currentPage === Math.ceil(filteredReviewers.length / itemsPerPage)
            }
            className="px-3 py-1 mr-1 bg-yellow-400
            text-red-900 rounded-md border border-red-900 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Last
          </button>
        </div>
      </div>
    </div>
  );
}
