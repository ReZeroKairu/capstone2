import React, { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../../authcontext/AuthContext";
import { db } from "../../firebase/firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faEdit, faArrowLeft } from "@fortawesome/free-solid-svg-icons";
import BasicInfoForm from "./BasicInfoForm";
import ResearcherForm from "./ResearcherForm";
import PeerReviewerForm from "./PeerReviewerForm";
import ProfilePhoto from "./ProfilePhoto";
import { UserLogService } from "../../utils/userLogService";
import {
  validateProfile,
  checkProfileComplete,
  fileToBase64,
  capitalizeWords,
  getProfileCompletionStatus,
} from "./profileUtils";

function Profile() {
  const { userId } = useParams();
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");
  const [messageTimeout, setMessageTimeout] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [isProfileComplete, setIsProfileComplete] = useState(false);
  const [originalFirstName, setOriginalFirstName] = useState("");
  const [originalMiddleName, setOriginalMiddleName] = useState("");
  const [originalLastName, setOriginalLastName] = useState("");
  const [peerReviewerInfo, setPeerReviewerInfo] = useState({
    affiliation: "",
    expertise: "",
    educations: [], // Changed from empty string to empty array
  });
  const [researcherInfo, setResearcherInfo] = useState({
    researchInterests: "",
  });
  const messageRef = useRef(null);
  const originalPhotoRef = useRef(null);

  // Show message helper
  const showMessage = useCallback(
    (text, type) => {
      setMessage(text);
      setMessageType(type);
      if (messageTimeout) clearTimeout(messageTimeout);
      const timeout = setTimeout(() => {
        setMessage("");
        setMessageType("");
      }, 5000);
      setMessageTimeout(timeout);

      if (messageRef.current) {
        messageRef.current.scrollIntoView({ behavior: "smooth" });
      } else {
        window.scrollTo({ top: 100, behavior: "smooth" });
      }
    },
    [messageTimeout]
  );

  // Fetch profile data
  const fetchProfile = useCallback(
    async (userId) => {
      try {
        const userDoc = await getDoc(doc(db, "Users", userId));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          const profilePhoto =
            userData.photoURL ||
            userData.externalPhotoURL ||
            userData.photo ||
            null;

          // Initialize weekly updates if not exists
          if (userData.weeklyUpdates) {
            setWeeklyUpdates({
              count: userData.weeklyUpdates.count || 0,
              weekStart: userData.weeklyUpdates.weekStart || getStartOfWeek(),
              lastUpdated: userData.weeklyUpdates.lastUpdated || null,
            });
          } else {
            // Initialize with default values
            setWeeklyUpdates({
              count: 0,
              weekStart: getStartOfWeek(),
              lastUpdated: null,
            });
          }

          const profileData = {
            id: userDoc.id,
            ...userData,
            photoURL: profilePhoto,
          };

          setProfile(profileData);
          originalPhotoRef.current = profilePhoto;
          setOriginalFirstName(userData.firstName || "");
          setOriginalMiddleName(userData.middleName || "");
          setOriginalLastName(userData.lastName || "");

          // Set role-specific info
          if (userData.role === "Peer Reviewer") {
            setPeerReviewerInfo({
              affiliation: userData.affiliation || "",
              expertise: userData.expertise || "",
              educations: userData.educations || "",
            });
          } else if (userData.role === "Researcher") {
            setResearcherInfo({
              educations: userData.educations || "",
              researchInterests: userData.researchInterests || "",
            });
          }

          // Check if profile is complete
          const completionStatus = getProfileCompletionStatus(profileData);
          setIsProfileComplete(completionStatus.complete);

          // Log the completion status for debugging
          if (!completionStatus.complete) {
            console.log("Profile completion status:", {
              complete: completionStatus.complete,
              message: completionStatus.message,
              missingFields: completionStatus.missingFields,
            });
          }
        } else {
          showMessage("Profile not found.", "error");
          setProfile(null);
        }
      } catch (error) {
        console.error("Error fetching profile:", error);
        showMessage("Failed to fetch profile.", "error");
      } finally {
        setLoading(false);
      }
    },
    [showMessage]
  );

  useEffect(() => {
    if (userId) {
      fetchProfile(userId);
    } else if (currentUser) {
      fetchProfile(currentUser.uid);
    } else {
      // No user ID and no current user, redirect to login
      navigate("/login");
    }
  }, [userId, currentUser, fetchProfile, navigate]);
  
 
  const [formData, setFormData] = useState({
    // Basic Info
    firstName: "",
    middleName: "",
    lastName: "",
    birthDate: "",
    email: "",
    phone: "",
  

    // Researcher Info
    educations: "",
    researchInterests: "",

    // Peer Reviewer Info
    affiliation: "",
    expertise: "",
  });
   
const [previousFormData, setPreviousFormData] = useState(null);
  
  // Track weekly updates
  const [weeklyUpdates, setWeeklyUpdates] = useState({
    count: 0,
    weekStart: getStartOfWeek(),
    lastUpdated: null,
  });

  // Helper function to get start of current week (Sunday)
  function getStartOfWeek() {
    const now = new Date();
    const day = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const diff = now.getDate() - day; // Adjust to Sunday
    const sunday = new Date(now.setDate(diff));
    return sunday.toISOString().split("T")[0]; // YYYY-MM-DD format
  }

  // Check if user can update profile (max 5 times per week, except for admins)
  const canUpdateProfile = useCallback(
    (userRole) => {
      // Admins have unlimited updates
      if (userRole === "Admin") {
        return true;
      }

      const today = new Date().toISOString().split("T")[0];

      // If it's a new week, reset the counter
      if (weeklyUpdates.weekStart !== getStartOfWeek()) {
        return true; // Allow update and reset counter
      }

      // Check if user has updates left this week
      return weeklyUpdates.count < 5;
    },
    [weeklyUpdates]
  );

  // Update weekly update count
  const updateWeeklyCount = useCallback(
    async (userId) => {
      const today = new Date().toISOString().split("T")[0];
      const weekStart = getStartOfWeek();

      // If it's a new week, reset the counter
      if (weeklyUpdates.weekStart !== weekStart) {
        setWeeklyUpdates({
          count: 1,
          weekStart,
          lastUpdated: today,
        });
      } else {
        // Increment the counter
        setWeeklyUpdates((prev) => ({
          ...prev,
          count: prev.count + 1,
          lastUpdated: today,
        }));
      }

      // Update in Firestore
      if (userId) {
        const userRef = doc(db, "Users", userId);
        await updateDoc(
          userRef,
          {
            weeklyUpdates: {
              count:
                weeklyUpdates.weekStart === weekStart
                  ? weeklyUpdates.count + 1
                  : 1,
              weekStart: weekStart,
              lastUpdated: today,
            },
          },
          { merge: true }
        );
      }
    },
    [weeklyUpdates]
  );

  // Initialize form data when profile is loaded
  useEffect(() => {
    if (profile) {
      // Create base form data with all possible fields
      // Format birthDate for the date input (YYYY-MM-DD)
      const formatDateForInput = (dateString) => {
        if (!dateString) return '';
        const date = dateString.toDate ? dateString.toDate() : new Date(dateString);
        return date.toISOString().split('T')[0];
      };

      // Base form data with common fields
      const baseFormData = {
        // Basic info
        firstName: profile.firstName || "",
        middleName: profile.middleName || "",
        lastName: profile.lastName || "",
        birthDate: formatDateForInput(profile.birthDate) || "",
        email: profile.email || "",
        phone: profile.phone || "",

        // Common fields
        researchInterests: profile.researchInterests || "",

        // Peer reviewer fields
        affiliation: profile.affiliation || "",
        expertise: profile.expertise || "",

        // Researcher specific fields
        university: profile.university || "",
        universityAddress: profile.universityAddress || "",
        country: profile.country || "",
        continent: profile.continent || "",
        citizenship: profile.citizenship || "",
        residentialAddress: profile.residentialAddress || "",
        zipCode: profile.zipCode || "",
        currentPosition: profile.currentPosition || "",

        // Array fields (initialize with empty arrays if not present)
        educations: Array.isArray(profile.educations) 
          ? profile.educations 
          : profile.educations 
            ? [{ school: profile.educations, degree: "", year: "" }] 
            : [],
        publications: profile.publications || [],
        presentations: profile.presentations || [],
        awards: profile.awards || [],
      };

      // Set the form data
      setFormData(baseFormData);

      // Set role-specific info for local state
      if (profile.role === "Peer Reviewer") {
        setPeerReviewerInfo({
          affiliation: profile.affiliation || "",
          expertise: profile.expertise || "",
          educations: profile.educations || "",
        });
      } else if (profile.role === "Researcher") {
        setResearcherInfo({
          educations: profile.educations || "",
          researchInterests: profile.researchInterests || "",
          university: profile.university || "",
          universityAddress: profile.universityAddress || "",
          country: profile.country || "",
          continent: profile.continent || "",
          citizenship: profile.citizenship || "",
          residentialAddress: profile.residentialAddress || "",
          zipCode: profile.zipCode || "",
          currentPosition: profile.currentPosition || "",
        });
      }
    }
  }, [profile]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSave = async (e) => {
    e?.preventDefault();
    
    // Create a new form data object with all required fields
    const updatedFormData = {
      ...formData,
      // Ensure all required fields have default values
      university: formData.university || '',
      universityAddress: formData.universityAddress || '',
      affiliation: formData.affiliation || '',
      expertise: formData.expertise || [],
      educations: formData.educations || [],
    };

    // Update the form data state
    setFormData(updatedFormData);
    
    // Save current form data in case we need to revert
    setPreviousFormData(updatedFormData);
    
    // Ensure state is updated before proceeding
    await new Promise(resolve => setTimeout(resolve, 0));

    try {
      const userIdToUpdate = userId || currentUser?.uid;
      if (!userIdToUpdate) {
        showMessage("User not authenticated.", "error");
        return;
      }

      // Get user role to check if they're an admin
      const userDoc = await getDoc(doc(db, "Users", userIdToUpdate));
      const userRole = userDoc.data()?.role;
      const userData = userDoc.data() || {};

      // Check if user can update profile (admins bypass the limit)
      if (!canUpdateProfile(userRole)) {
        showMessage(
          "You've reached the weekly limit of 5 profile updates. Please try again next week.",
          "error"
        );
        return;
      }

      // Create the updated fields object with all necessary fields
      const fieldsToUpdate = {
        ...userData, // Include existing user data
        ...updatedFormData, // Use the updated form data
        // Ensure required fields have default values
        university: updatedFormData.university || "",
        universityAddress: updatedFormData.universityAddress || "",
        affiliation: updatedFormData.affiliation || "",
        expertise: Array.isArray(updatedFormData.expertise) ? updatedFormData.expertise : [],
        educations: Array.isArray(updatedFormData.educations) ? updatedFormData.educations : [],
        // Preserve these fields if they exist in the profile
        photoURL: updatedFormData.photoURL || profile.photoURL || "",
        updatedAt: new Date().toISOString(),
      };

      // Handle file upload if a new photo was selected
      if (selectedFile) {
        fieldsToUpdate.photoURL = await fileToBase64(selectedFile);
      }

      // Validate the updated profile
      const validation = validateProfile(fieldsToUpdate);
      console.log("Validation result:", validation);
      console.log("Form data being validated:", fieldsToUpdate);

      if (!validation.valid) {
        const errorMessage = `Please fill in all required fields: ${validation.missingFields.join(
          ", "
        )}`;
        console.log(
          "Validation failed. Missing fields:",
          validation.missingFields
        );
        showMessage(errorMessage, "error");

        if (validation.missingFields.length > 0) {
          const firstMissingField = validation.missingFields[0].toLowerCase();
          const fieldVariations = [
            firstMissingField,
            firstMissingField + "Input",
            firstMissingField + "-input",
            "input-" + firstMissingField,
            firstMissingField.replace(/[A-Z]/g, (m) => "-" + m.toLowerCase()),
          ];

          let fieldElement = null;
          for (const fieldName of fieldVariations) {
            fieldElement = document.getElementById(fieldName);
            if (fieldElement) break;
            fieldElement = document.querySelector(`[name="${fieldName}"]`);
            if (fieldElement) break;
          }

          if (fieldElement) {
            fieldElement.scrollIntoView({
              behavior: "smooth",
              block: "center",
            });
            fieldElement.focus();
            fieldElement.classList.add("ring-2", "ring-red-500");
            setTimeout(() => {
              fieldElement.classList.remove("ring-2", "ring-red-500");
            }, 3000);
          }
        }
        return;
      }

      // Save the current form data before attempting to update
      const formDataBeforeUpdate = { 
        ...formData,
        // Make sure to include all fields that might be in the form
        university: formData.university || "",
        universityAddress: formData.universityAddress || ""
      };
      
      try {
        // Update Firestore
        const userRef = doc(db, "Users", userIdToUpdate);
        await updateDoc(userRef, fieldsToUpdate);
      } catch (error) {
        console.error("Error updating profile:", error);
        // Restore form data if update fails
        setFormData(formDataBeforeUpdate);
        showMessage("Failed to update profile. Please try again.", "error");
        return;
      }

      // Update weekly update count
      await updateWeeklyCount(userIdToUpdate);

      // Log the profile update - only basic information
      try {
        // Define which fields we want to log
        const loggableFields = [
          "firstName",
          "middleName",
          "lastName",
          "email",
          "phone"
       
        ];

        // Get changed fields (only loggable ones)
        const changedFields = [];
        for (const key of loggableFields) {
          if (JSON.stringify(profile[key]) !== JSON.stringify(formData[key])) {
            changedFields.push(key);
          }
        }

        // Only log if there are relevant changes
        if (changedFields.length > 0) {
          await UserLogService.logUserActivity(
            userIdToUpdate,
            "Updated Profile",
            `Updated basic profile information: ${changedFields.join(", ")}`,
            {
              changedFields,
              actionType: "profile_update",
              previousValues: Object.fromEntries(
                changedFields.map((field) => [field, profile[field] || ""])
              ),
              newValues: Object.fromEntries(
                changedFields.map((field) => [field, formData[field] || ""])
              ),
            },
            profile.email
          );
        }
      } catch (logError) {
        console.error("Error logging profile update:", logError);
        // Continue with the profile update even if logging fails
      }

      // Update local state
      setProfile((prev) => ({
        ...prev,
        ...fieldsToUpdate,
      }));

      if (selectedFile) {
        originalPhotoRef.current = fieldsToUpdate.photoURL;
        setSelectedFile(null);
      }

      // Update original name references
      if (fieldsToUpdate.firstName)
        setOriginalFirstName(fieldsToUpdate.firstName);
      if (fieldsToUpdate.middleName !== undefined)
        setOriginalMiddleName(fieldsToUpdate.middleName);
      if (fieldsToUpdate.lastName) setOriginalLastName(fieldsToUpdate.lastName);

      // Create the complete profile object with all fields
      const completeProfile = {
        ...profile,
        ...fieldsToUpdate,
        // Include ALL form data fields, not just role-specific
        firstName: updatedFormData.firstName || profile.firstName || "",
        lastName: updatedFormData.lastName || profile.lastName || "",
        email: updatedFormData.email || profile.email || "",
        phone: updatedFormData.phone || profile.phone || "",
        university: updatedFormData.university || profile.university || "",
        universityAddress: updatedFormData.universityAddress || profile.universityAddress || "",
        researchInterests: updatedFormData.researchInterests || profile.researchInterests || "",
        affiliation: updatedFormData.affiliation || profile.affiliation || "",
        expertise: updatedFormData.expertise || profile.expertise || "",
        educations: Array.isArray(updatedFormData.educations) 
          ? updatedFormData.educations 
          : profile.educations || [],
        // Include all other fields
        role: profile.role,
        cvUrl: updatedFormData.cvUrl || profile.cvUrl || "",
      };

      // Update profile completion status using getProfileCompletionStatus
      const completionStatus = getProfileCompletionStatus(completeProfile);
      console.log("Profile completion status:", completionStatus);

      // Update the profile state
      setProfile(completeProfile);
      setIsProfileComplete(completionStatus.complete);

      // Log the completion status for debugging
      if (!completionStatus.complete) {
        console.log(
          "Profile still incomplete. Missing fields:",
          completionStatus.missingFields
        );
      }

      // Show success message
      showMessage("Profile updated successfully!", "success");

      // Only exit edit mode if the profile is complete
      if (completionStatus.complete) {
        setIsEditing(false);
      } else {
        // Show a message about what's still needed
        showMessage(
          `Please complete: ${completionStatus.missingFields.join(", ")}`,
          "info"
        );
      }
    } catch (error) {
      console.error("Error updating profile:", error);
      showMessage("Failed to update profile. Please try again.", "error");
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setSelectedFile(null);

    // Reset form to original values
    if (profile) {
      setProfile((prev) => ({
        ...prev,
        firstName: originalFirstName,
        middleName: originalMiddleName,
        lastName: originalLastName,
      }));

      if (profile.role === "Peer Reviewer") {
        setPeerReviewerInfo({
          affiliation: profile.affiliation || "",
          expertise: profile.expertise || "",
          educations: profile.educations || "",
        });
      } else if (profile.role === "Researcher") {
        setResearcherInfo({
          educations: profile.educations || "",
          researchInterests: profile.researchInterests || "",
        });
      }
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading profile...</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-center p-6 bg-white rounded-lg shadow-md">
          <h2 className="text-2xl font-bold text-red-600 mb-2">
            Profile Not Found
          </h2>
          <p className="text-gray-600 mb-4">
            The requested profile could not be found.
          </p>
          <button
            onClick={() => navigate("/")}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
          >
            Return Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="container mx-auto px-4 pt-24 pb-8 max-w-4xl relative mt-6 mb-32"
      style={{ zIndex: 1 }}
    >
      {/* Status Message - Fixed Position */}
      {message && (
        <div
          ref={messageRef}
          className={`fixed top-24 right-4 z-50 p-4 rounded-lg shadow-lg transform transition-all duration-300 ${
            messageType === "success"
              ? "bg-green-500 text-white"
              : "bg-red-500 text-white"
          }`}
          style={{
            maxWidth: "400px",
            animation: "slideIn 0.3s ease-out",
          }}
        >
          <div className="flex items-start">
            {messageType === "success" ? (
              <svg
                className="w-6 h-6 mr-2 flex-shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            ) : (
              <svg
                className="w-6 h-6 mr-2 flex-shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            )}
            <div>
              <p className="font-semibold">
                {messageType === "success" ? "Success!" : "Attention Needed"}
              </p>
              <p className="text-sm opacity-90">{message}</p>
            </div>
            <button
              onClick={() => setMessage("")}
              className="ml-4 text-white opacity-70 hover:opacity-100 focus:outline-none"
              aria-label="Close message"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </button>
          </div>
          
          {/* Add global styles for animations */}
          <style>{
            `@keyframes slideIn {
              from { transform: translateX(100%); }
              to { transform: translateX(0); }
            }
            .slide-in {
              animation: slideIn 0.3s ease-out;
            }`
          }</style>
        </div>
      )}

      {/* Profile Header */}
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-800">
          {profile.firstName} {profile.lastName}'s Profile
        </h1>
        <div className="flex space-x-4">
          <button
            onClick={() => {
              // If viewing another user's profile (for any role), go to that user's dashboard
              if (userId && userId !== currentUser?.uid) {
                navigate(`/dashboard/${userId}`);
              } else {
                // Otherwise, go to the current user's dashboard
                navigate("/dashboard");
              }
            }}
            className="flex items-center px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors"
          >
            <FontAwesomeIcon icon={faArrowLeft} className="mr-2" />
            {userId && userId !== currentUser?.uid
              ? "View User Dashboard"
              : "Go to Dashboard"}
          </button>
          {!isEditing && (
            <button
              onClick={() => setIsEditing(true)}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <FontAwesomeIcon icon={faEdit} className="mr-2" />
              Edit Profile
            </button>
          )}
        </div>
      </div>

      {/* Profile Completion Status */}
      {!isProfileComplete && profile && profile.role !== "Admin" && (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg
                className="h-5 w-5 text-yellow-500"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h2a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-yellow-800">
                {profile.role === "Peer Reviewer"
                  ? "Complete Your Peer Reviewer Profile"
                  : "Profile Incomplete"}
              </h3>
              <div className="mt-1 text-sm text-yellow-700">
                {profile.role === "Peer Reviewer" ? (
                  <>
                    <p className="font-medium">
                      To be eligible for manuscript reviews, please ensure you
                      have completed:
                    </p>
                    <ul className="list-disc pl-5 mt-2 space-y-1">
                      {!profile.firstName?.trim() ||
                      !profile.lastName?.trim() ||
                      !profile.phone?.trim() ? (
                        <li className="font-semibold">
                          Your full name and contact information (Required)
                        </li>
                      ) : (
                        <li className="line-through text-gray-500">
                          Your full name and contact information
                        </li>
                      )}
                      {!profile.affiliation?.trim() ? (
                        <li className="font-semibold">
                          Institutional affiliation (Required)
                        </li>
                      ) : (
                        <li className="line-through text-gray-500">
                          Institutional affiliation
                        </li>
                      )}
                      {!profile.expertise?.length ? (
                        <li className="font-semibold">
                          At least one area of expertise (Required)
                        </li>
                      ) : (
                        <li className="line-through text-gray-500">
                          At least one area of expertise
                        </li>
                      )}

                      {!profile.educations?.length ? (
                        <li className="font-semibold">
                          Education details (Required)
                        </li>
                      ) : (
                        <li className="line-through text-gray-500">
                          Education details
                        </li>
                      )}
                      {!profile.cvUrl ? (
                        <li className="font-semibold">
                          CV/Resume upload (Required)
                        </li>
                      ) : (
                        <li className="line-through text-gray-500">
                          CV/Resume uploaded
                        </li>
                      )}
                    </ul>
                  </>
                ) : (
                  <p>
                    Please complete all required fields to finish setting up
                    your profile.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Profile Content */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="p-6">
          {/* Profile Photo */}
          <div className="flex justify-center mb-8">
            <ProfilePhoto
              photoUrl={
                selectedFile
                  ? URL.createObjectURL(selectedFile)
                  : profile.photoURL || ""
              }
              isEditing={isEditing}
              onPhotoChange={(file) => setSelectedFile(file)}
            />
          </div>

          <form id="profile-form" onSubmit={handleSave} className="space-y-8">
            {/* Basic Information */}
            <div className="mb-8">
              <h2 className="text-xl font-semibold text-gray-800 mb-4 pb-2 border-b border-gray-200">
                Basic Information
              </h2>
              <BasicInfoForm
                profile={profile}
                isEditing={isEditing}
                formData={formData}
                onChange={handleChange}
              />
            </div>

            {/* Role-Specific Information */}
            {profile.role === "Researcher" && (
              <div className="mb-8">
                <h2 className="text-xl font-semibold text-gray-800 mb-4 pb-2 border-b border-gray-200">
                  Researcher Information
                </h2>
                <ResearcherForm
                  profile={profile}
                  isEditing={isEditing}
                  formData={formData}
                  onChange={handleChange}
                />
              </div>
            )}

            {profile.role === "Peer Reviewer" && (
              <div className="mb-8">
                <h2 className="text-xl font-semibold text-gray-800 mb-4 pb-2 border-b border-gray-200">
                  Peer Reviewer Information
                </h2>
                <PeerReviewerForm
                  profile={profile}
                  isEditing={isEditing}
                  formData={formData}
                  onChange={handleChange}
                />
              </div>
            )}

            {/* Single Save Button */}
            {isEditing && (
              <div className="flex justify-end space-x-4 pt-6 border-t border-gray-200">
                <button
                  type="button"
                  onClick={handleCancel}
                  className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Save Changes
                </button>
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}

export default Profile;
