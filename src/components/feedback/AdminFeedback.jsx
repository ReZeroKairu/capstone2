import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import { useAuth } from "../../authcontext/AuthContext";
import { db, storage } from "../../firebase/firebase";
import SafeHTML from "../common/SafeHTML";

import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  updateDoc,
  doc,
  serverTimestamp,
  orderBy,
  limit,
  getDoc,
  writeBatch,
  onSnapshot,
  deleteDoc,
} from "firebase/firestore";
import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";
import { FeedbackForm } from "./FeedbackForm";
import { FeedbackVersion } from "./FeedbackVersion";
import PropTypes from "prop-types";

const AdminFeedback = ({
  manuscriptId,
  userRole,
  status: propStatus,
  currentVersion = "1",
}) => {
  const [feedback, setFeedback] = useState("");
  const [file, setFile] = useState(null);
  const [filePreview, setFilePreview] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [editingFeedback, setEditingFeedback] = useState(null);
  const [feedbacks, setFeedbacks] = useState([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showFeedbackForm, setShowFeedbackForm] = useState(true);
  const [isFormExpanded, setIsFormExpanded] = useState(true);

  // Use the status from props if available, otherwise fetch it
  const [manuscriptStatus, setManuscriptStatus] = useState(propStatus || "");

  // Statuses where feedback should be hidden from researchers
  const hideFeedbackStatuses = [
    "Back to Admin",
    "Assigning Peer Reviewer",
    "Peer Reviewer Reviewing",
    "Peer Reviewer Assigned",
  ];

  const { currentUser } = useAuth();
  const prevFeedbackGroups = useRef({});

  // Group feedbacks by version and sort by version number
  const feedbackGroups = useMemo(() => {
    const groupFeedbacksByVersion = (feedbacks) => {
      return feedbacks.reduce((groups, item) => {
        // Convert version to string and handle decimal versions (e.g., 1.0.0 -> 1)
        let version = "1";
        if (item.version) {
          // If version is a string with dots, take the first part
          if (typeof item.version === "string" && item.version.includes(".")) {
            version = item.version.split(".")[0];
          } else {
            // Otherwise, convert to string and remove any decimal part
            version = String(item.version).split(".")[0];
          }
        }

        if (!groups[version]) {
          groups[version] = [];
        }
        groups[version].push(item);
        return groups;
      }, {});
    };

    return groupFeedbacksByVersion(feedbacks);
  }, [feedbacks]);

  // Get all versions sorted (newest first)
  const sortedVersions = useMemo(() => {
    return Object.keys(feedbackGroups).sort((a, b) => {
      // Convert to numbers if possible for numeric comparison
      const numA = isNaN(Number(a)) ? 0 : Number(a);
      const numB = isNaN(Number(b)) ? 0 : Number(b);
      return numB - numA;
    });
  }, [feedbackGroups]);

  // Determine the latest version, using currentVersion prop if available
  const latestVersion = useMemo(() => {
    // If currentVersion is provided, use it as the latest version
    if (currentVersion) {
      return String(currentVersion).split(".")[0]; // Use only the major version
    }

    // Fall back to the first version in the sorted list if available
    return sortedVersions[0] || "1";
  }, [sortedVersions, currentVersion]);

  // Track expanded state for each version
  const [expandedFeedback, setExpandedFeedback] = useState({});
  const [fileInputKey, setFileInputKey] = useState(0);

  // If status prop changes, update the state
  useEffect(() => {
    if (propStatus !== undefined) {
      setManuscriptStatus(propStatus);
    }
  }, [propStatus]);

  // Only fetch status if not provided via props
  useEffect(() => {
    if (propStatus !== undefined || !manuscriptId) return;

    const fetchManuscriptStatus = async () => {
      try {
        const docRef = doc(db, "manuscripts", manuscriptId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setManuscriptStatus(docSnap.data().status || "");
        }
      } catch (error) {
        console.error("Error fetching manuscript status:", error);
      }
    };

    fetchManuscriptStatus();
  }, [manuscriptId, propStatus]);

  // Check if user is admin
  useEffect(() => {
    const checkAdminStatus = async () => {
      if (!currentUser) {
        setIsAdmin(false);
        setLoading(false);
        return;
      }

      try {
        const userRef = doc(db, "Users", currentUser.uid);
        const userDoc = await getDoc(userRef);

        if (userDoc.exists() && userDoc.data().role === "Admin") {
          setIsAdmin(true);
        } else {
          setIsAdmin(false);
        }
      } catch (error) {
        console.error("Error checking admin status:", error);
        setIsAdmin(false);
      } finally {
        setLoading(false);
      }
    };

    checkAdminStatus();
  }, [currentUser]);

  // Set up feedback listener
  useEffect(() => {
    let isMounted = true;
    let unsubscribe = null;

    const setupFeedbackListener = async () => {
      if (!manuscriptId) {
        console.error("No manuscriptId provided");
        setLoading(false);
        return null;
      }

      const q = query(
        collection(db, "manuscripts", manuscriptId, "adminFeedback"),
        orderBy("createdAt", "desc")
      );

      return onSnapshot(
        q,
        (querySnapshot) => {
          if (!isMounted) return;

          const feedbackList = [];
          querySnapshot.forEach((doc) => {
            const data = doc.data();
            feedbackList.push({
              id: doc.id,
              ...data,
              // Ensure timestamps are properly handled
              createdAt: data.createdAt?.toDate
                ? data.createdAt.toDate()
                : data.createdAt,
              updatedAt: data.updatedAt?.toDate
                ? data.updatedAt.toDate()
                : data.updatedAt,
            });
          });

          setFeedbacks(feedbackList);
          setLoading(false);
        },
        (error) => {
          console.error("Error in feedback snapshot:", error);
          console.error("Error details:", {
            code: error.code,
            message: error.message,
            stack: error.stack,
          });
          setLoading(false);
        }
      );
    };

    // Initialize the listener
    const unsubscribePromise = setupFeedbackListener();

    // Cleanup function
    return () => {
      isMounted = false;
      if (unsubscribePromise) {
        unsubscribePromise.then((unsubscribe) => {
          if (unsubscribe) unsubscribe();
        });
      }
    };
  }, [manuscriptId]);

  // Memoize the showAllFeedbackStatuses array to prevent unnecessary re-renders
  const showAllFeedbackStatuses = useMemo(
    () => [
      "For Revision (Minor)",
      "For Revision (Major)",
      "Non-Acceptance",
      "For Publication",
      "Rejected",
    ],
    []
  );

  // Initialize expanded state when feedback groups or user role changes
  useEffect(() => {
    if (!latestVersion || !Object.keys(feedbackGroups).length) return;

    // Always update the expanded state based on the current conditions
    const versions = Object.keys(feedbackGroups);

    setExpandedFeedback((prev) => {
      const newExpanded = { ...prev };
      let hasChanges = false;

      versions.forEach((version) => {
        const isLatestVersion = version === latestVersion;
        const shouldBeExpanded =
          isAdmin ||
          showAllFeedbackStatuses.includes(manuscriptStatus) ||
          !isLatestVersion;

        // Only update if the version is new or if the expanded state needs to change
        if (
          newExpanded[version] === undefined ||
          newExpanded[version] !== shouldBeExpanded
        ) {
          newExpanded[version] = shouldBeExpanded;
          hasChanges = true;
        }
      });

      // Only update if there are actual changes to prevent unnecessary re-renders
      return hasChanges ? newExpanded : prev;
    });

    // Update the previous groups and admin status for reference
    prevFeedbackGroups.current = {
      ...feedbackGroups,
      isAdmin: isAdmin,
      manuscriptStatus: manuscriptStatus,
    };
  }, [
    feedbackGroups,
    isAdmin,
    latestVersion,
    manuscriptStatus,
    showAllFeedbackStatuses,
  ]);

  // Upload file to storage
  const uploadFile = async () => {
    if (!file) return null;

    try {
      setUploading(true);
      const storageRef = ref(
        storage,
        `feedback-files/${manuscriptId}/${Date.now()}_${file.name}`
      );
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      return {
        url,
        name: file.name,
        type: file.type,
        size: file.size,
        path: storageRef.fullPath,
      };
    } catch (error) {
      console.error("Error uploading file:", error);
      throw error;
    } finally {
      setUploading(false);
    }
  };

  // Reset the feedback form
  const resetForm = () => {
    // Clear form state
    setFeedback("");
    setFile(null);
    setFilePreview(null);
    setEditingFeedback(null);

    // Clear the file input
    const fileInput = document.getElementById("file-upload");
    if (fileInput) {
      fileInput.value = "";
      // Trigger change event to ensure React state updates
      const event = new Event("change", { bubbles: true });
      fileInput.dispatchEvent(event);
    }

    // Force re-render of the file input by toggling the key
    setFileInputKey((prev) => prev + 1);
  };

  // Handle form submission
  const handleSubmit = async () => {
    if ((!feedback.trim() && !file) || submitting) return;

    setSubmitting(true);
    setError("");

    try {
      // 1. Upload file if exists
      let fileData = null;
      if (file) {
        fileData = await uploadFile();
      } else if (editingFeedback) {
        // Keep existing file data if editing and no new file is uploaded
        fileData = {
          url: editingFeedback.fileUrl,
          name: editingFeedback.fileName,
          type: editingFeedback.fileType,
          size: editingFeedback.fileSize,
          path: editingFeedback.storagePath,
        };
      }

      // 2. Get manuscript data
      const manuscriptRef = doc(db, "manuscripts", manuscriptId);
      const manuscriptDoc = await getDoc(manuscriptRef);

      // 3. Prepare feedback data
      const feedbackData = {
        message: feedback.trim(),
        createdAt: editingFeedback
          ? editingFeedback.createdAt
          : serverTimestamp(),
        createdBy: currentUser.uid,
        createdByName: currentUser.displayName || "Admin",
        // Use the existing version when editing, otherwise use currentVersion
        version: editingFeedback ? editingFeedback.version : currentVersion,
        fileUrl: fileData?.url || null,
        fileName: fileData?.name || null,
        fileType: fileData?.type || null,
        fileSize: fileData?.size || 0,
        storagePath: fileData?.path || null,
        manuscriptStatus: manuscriptDoc.exists()
          ? manuscriptDoc.data().status
          : "Unknown",
        ...(editingFeedback && { updatedAt: serverTimestamp() }), // Only set updatedAt when editing
      };

      if (editingFeedback) {
        // 4. Update existing feedback
        const feedbackRef = doc(
          db,
          "manuscripts",
          manuscriptId,
          "adminFeedback",
          editingFeedback.id
        );
        await updateDoc(feedbackRef, feedbackData);
      } else {
        // 5. Create new feedback
        const feedbackRef = collection(
          db,
          "manuscripts",
          manuscriptId,
          "adminFeedback"
        );
        await addDoc(feedbackRef, feedbackData);
      }

      // 6. Reset form
      resetForm();
    } catch (error) {
      console.error("Error in feedback submission:", error);
      setError(
        "Failed to submit feedback. " + (error.message || "Please try again.")
      );
    } finally {
      setSubmitting(false);
    }
  };

  // Handle editing feedback
  const handleEditFeedback = (feedback) => {
    setEditingFeedback(feedback);
    setFeedback(feedback.message);
    // Don't pre-fill the file input, but show a note that a new file can be uploaded
    // which will replace the existing one
    setFile(null);
    setFilePreview(null);
    document.getElementById("file-upload").value = "";

    // Scroll to the form
    document
      .getElementById("feedback-form")
      ?.scrollIntoView({ behavior: "smooth" });
  };

 // In handleDeleteFeedback function
const handleDeleteFeedback = async (id, storagePath) => {
  if (!currentUser) {
    console.error('No user is signed in');
    alert('You must be signed in to delete feedback');
    return;
  }

  if (!window.confirm("Are you sure you want to delete this feedback? This action cannot be undone.")) {
    return;
  }

  try {
    console.log('Current user UID:', currentUser.uid);
    console.log('Is admin?', isAdmin);
    console.log('Storage path to delete:', storagePath);

    // If there's a file associated with this feedback, delete it from storage
    if (storagePath) {
      try {
        // Decode and clean the path
        const decodedPath = decodeURIComponent(storagePath);
        const cleanPath = decodedPath.startsWith('/') ? decodedPath.substring(1) : decodedPath;
        
        console.log("Cleaned path:", cleanPath);
        
        // Create a reference to the file
        const fileRef = ref(storage, cleanPath);
        console.log("File reference created:", fileRef.fullPath);
        
        // Test if the file exists and is readable
        try {
          const url = await getDownloadURL(fileRef);
          console.log("File exists and is readable. URL:", url);
        } catch (error) {
          console.warn("File access test failed, but will still attempt deletion:", error.message);
        }
        
        // Delete the file
        await deleteObject(fileRef);
        console.log("File deleted successfully from storage");
      } catch (error) {
        console.error("Error deleting file from storage:", {
          code: error.code,
          message: error.message,
          details: error
        });
        // Continue with feedback deletion even if file deletion fails
      }
    }

    // Delete the feedback document
    console.log("Deleting feedback document with ID:", id);
    await deleteDoc(doc(db, "manuscripts", manuscriptId, "adminFeedback", id));
    console.log("Feedback document deleted successfully");

  } catch (error) {
    console.error("Error in handleDeleteFeedback:", {
      code: error.code,
      message: error.message,
      details: error
    });
    
    let errorMessage = "Failed to delete feedback. Please try again.";
    if (error.code === 'storage/unauthorized') {
      errorMessage = "You don't have permission to delete this file. Please make sure you're logged in as an admin.";
    }
    
    alert(errorMessage);
  }
};
  // Toggle feedback expansion - fixed version
  const toggleFeedback = useCallback(
    (version, isLatestVersion) => {
      // Check if this version should be restricted
      const isRestricted =
        isLatestVersion &&
        !isAdmin &&
        !showAllFeedbackStatuses.includes(manuscriptStatus);
      if (isRestricted) {
        return;
      }

      // Use functional update to ensure we have the latest state
      setExpandedFeedback((prev) => {
        // Create a new object to ensure React detects the state change
        const newState = { ...prev };

        // If the version doesn't exist in the state, initialize it as true
        if (newState[version] === undefined) {
          newState[version] = true;
        } else {
          // Toggle the current version
          newState[version] = !newState[version];
        }

        console.log("Toggling version", version, "to", newState[version]);
        return newState;
      });
    },
    [isAdmin, manuscriptStatus, showAllFeedbackStatuses]
  );

  // Expand all feedback versions
  const expandAll = useCallback(() => {
    const newExpanded = {};
    Object.keys(feedbackGroups).forEach((version) => {
      const isLatestVersion = version === latestVersion;
      // Skip the latest version for researchers if not in allowed status
      if (
        !isAdmin &&
        isLatestVersion &&
        !showAllFeedbackStatuses.includes(manuscriptStatus)
      ) {
        return;
      }
      newExpanded[version] = true;
    });
    setExpandedFeedback(newExpanded);
  }, [
    feedbackGroups,
    latestVersion,
    isAdmin,
    manuscriptStatus,
    showAllFeedbackStatuses,
  ]);

  // Collapse all feedback versions
  const collapseAll = useCallback(() => {
    const newExpanded = {};

    // For researchers in restricted status, only collapse non-latest versions
    if (
      !isAdmin &&
      latestVersion &&
      !showAllFeedbackStatuses.includes(manuscriptStatus)
    ) {
      // Keep the latest version expanded if it's the only one visible
      const versions = Object.keys(feedbackGroups);
      if (versions.length > 1) {
        // Collapse all except the latest version
        Object.keys(feedbackGroups).forEach((version) => {
          if (version !== latestVersion) {
            newExpanded[version] = false;
          } else {
            newExpanded[version] = true; // Keep latest expanded
          }
        });
      }
    } else {
      // For admins or when all versions are visible, collapse everything
      Object.keys(feedbackGroups).forEach((version) => {
        newExpanded[version] = false;
      });
    }

    setExpandedFeedback((prev) => ({
      ...prev,
      ...newExpanded,
    }));
  }, [
    feedbackGroups,
    isAdmin,
    latestVersion,
    manuscriptStatus,
    showAllFeedbackStatuses,
  ]);

  // Check if all visible versions are currently expanded
  const allExpanded = useMemo(() => {
    if (!latestVersion) return false;
    const versions = Object.keys(feedbackGroups);

    // Filter out versions that shouldn't be visible to the current user
    const visibleVersions = versions.filter((version) => {
      const isLatestVersion = version === latestVersion;
      // Show version if:
      // 1. User is admin, OR
      // 2. It's not the latest version, OR
      // 3. It's the latest version but in an allowed status
      return (
        isAdmin ||
        !isLatestVersion ||
        showAllFeedbackStatuses.includes(manuscriptStatus)
      );
    });

    return (
      visibleVersions.length > 0 &&
      visibleVersions.every((version) => expandedFeedback[version] === true)
    );
  }, [
    feedbackGroups,
    expandedFeedback,
    latestVersion,
    isAdmin,
    manuscriptStatus,
    showAllFeedbackStatuses,
  ]);

  // Calculate if there are multiple versions
  const hasMultipleVersions = useMemo(() => {
    if (!feedbacks?.length) return false;
    return feedbacks.some((fb) => fb.version && fb.version !== "1");
  }, [feedbacks]);

  if (loading) {
    return <div className="text-center py-4">Loading...</div>;
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      {/* Header with Toggle */}
      <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-800">
            {" "}
            Admin Feedback
          </h2>
          {Object.keys(feedbackGroups).length > 0 &&
            (isAdmin || feedbacks.length > 0) && (
              <button
                type="button"
                onClick={allExpanded ? collapseAll : expandAll}
                className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200"
              >
                <svg
                  className={`w-3.5 h-3.5 mr-1.5 transform transition-transform duration-200 ${
                    allExpanded ? "rotate-180" : ""
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d={allExpanded ? "M5 15l7-7 7 7" : "M19 9l-7 7-7-7"}
                  />
                </svg>
                {allExpanded ? "Collapse All" : "Expand All"}
              </button>
            )}
        </div>
      </div>

      {/* Feedback Form Header with Toggle */}
      {showFeedbackForm && isAdmin && (
        <div className="border-b border-gray-200">
          <button
            onClick={() => setIsFormExpanded(!isFormExpanded)}
            className="w-full px-6 py-4 text-left flex justify-between items-center focus:outline-none hover:bg-gray-50 transition-colors duration-150"
            aria-expanded={isFormExpanded}
          >
            <h3 className="text-base font-medium text-gray-900">
              {editingFeedback ? "Edit Feedback" : "Add New Feedback"}
            </h3>
            <svg
              className={`w-5 h-5 text-gray-500 transform transition-transform duration-200 ${
                isFormExpanded ? "rotate-180" : ""
              }`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>

          {/* Collapsible Form Content */}
          <div
            className={`transition-all duration-200 overflow-hidden ${
              isFormExpanded
                ? "max-h-[1000px] opacity-100"
                : "max-h-0 opacity-0"
            }`}
          >
            <div className="p-6 pt-0" id="feedback-form">
              <FeedbackForm
                feedback={feedback}
                setFeedback={setFeedback}
                file={file}
                setFile={setFile}
                filePreview={filePreview}
                setFilePreview={setFilePreview}
                uploading={uploading}
                submitting={submitting}
                editingFeedback={editingFeedback}
                onSubmit={handleSubmit}
                onCancel={() => {
                  resetForm();
                  setIsFormExpanded(false);
                }}
                fileInputKey={fileInputKey}
              />
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="mx-6 mt-4 p-3 bg-red-50 border-l-4 border-red-400 text-red-700 rounded-r text-sm flex items-center">
          <svg
            className="w-5 h-5 mr-3 flex-shrink-0"
            fill="currentColor"
            viewBox="0 0 20 20"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
              clipRule="evenodd"
            />
          </svg>
          <div>{error}</div>
        </div>
      )}

      <div className="p-6">
        {loading ? (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          </div>
        ) : feedbacks.length > 0 ? (
          <div className="space-y-4">
            {/* Removed duplicate expand/collapse controls */}

            {sortedVersions.map((version) => {
              const versionFeedbacks = feedbackGroups[version] || [];
              const isLatestVersion = version === latestVersion;

              // For researchers, hide the latest version if it's not in an allowed status
              if (
                !isAdmin &&
                isLatestVersion &&
                !showAllFeedbackStatuses.includes(manuscriptStatus)
              ) {
                return null;
              }

              return (
                <div key={version} className="mb-6">
                  <FeedbackVersion
                    version={version}
                    versionFeedbacks={versionFeedbacks}
                    isLatestVersion={isLatestVersion}
                    isAdmin={isAdmin}
                    isExpanded={!!expandedFeedback[version]}
                    onToggle={toggleFeedback}
                    onEditFeedback={handleEditFeedback}
                    onDeleteFeedback={handleDeleteFeedback}
                    userRole={userRole}
                    currentUser={currentUser}
                    manuscriptStatus={manuscriptStatus}
                  />
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-12 px-4">
            <svg
              className="mx-auto h-12 w-12 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1}
                d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
              />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">
              No feedback yet
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              {isAdmin
                ? "No feedback has been added yet."
                : "Check back later for updates on your submission."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

AdminFeedback.propTypes = {
  manuscriptId: PropTypes.string.isRequired,
  userRole: PropTypes.string,
  status: PropTypes.string,
  currentVersion: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
};

export default AdminFeedback;
