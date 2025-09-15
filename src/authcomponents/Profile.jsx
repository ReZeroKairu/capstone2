import React, { useState, useEffect, useRef } from "react";
import { db } from "../firebase/firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { useAuth } from "../authcontext/AuthContext";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faUser, faEdit } from "@fortawesome/free-solid-svg-icons";
import { logProfileUpdate } from "../utils/logger"; // updated logger

function Profile() {
  const { currentUser } = useAuth();
  const [profile, setProfile] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");
  const [messageTimeout, setMessageTimeout] = useState(null);
  const [showFullMiddle, setShowFullMiddle] = useState(false);

  const messageRef = useRef(null);
  const firstNameRef = useRef(null);
  const lastNameRef = useRef(null);

  const getInitials = (firstName, middleName, lastName) =>
    (
      (firstName?.[0] || "") +
      (middleName?.[0] || "") +
      (lastName?.[0] || "")
    ).toUpperCase();

  const [originalFirstName, setOriginalFirstName] = useState("");
  const [originalMiddleName, setOriginalMiddleName] = useState("");
  const [originalLastName, setOriginalLastName] = useState("");

  const [peerReviewerInfo, setPeerReviewerInfo] = useState({
    affiliation: "",
    expertise: "",
    interests: "",
  });

  const capitalizeWords = (str) => {
    if (!str) return "";
    return str
      .toLowerCase()
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  const smoothScrollTo = (element, offset = 0, duration = 300) => {
    if (!element) return;
    const start = window.scrollY;
    const target =
      element.getBoundingClientRect().top + window.pageYOffset - offset;
    const change = target - start;
    const startTime = performance.now();
    const easeInOut = (t) =>
      t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    const scroll = (currentTime) => {
      const elapsedTime = currentTime - startTime;
      const progress = Math.min(elapsedTime / duration, 1);
      const easedProgress = easeInOut(progress);
      const scrollAmount = start + change * easedProgress;
      window.scrollTo(0, scrollAmount);
      if (elapsedTime < duration) requestAnimationFrame(scroll);
    };
    requestAnimationFrame(scroll);
  };

  useEffect(() => {
    if (currentUser) fetchProfile(currentUser.uid);
  }, [currentUser]);

  const fetchProfile = async (userId) => {
    try {
      const userDoc = await getDoc(doc(db, "Users", userId));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        setProfile({
          id: userDoc.id,
          ...userData,
          photoURL: currentUser.photoURL,
        });
        setOriginalFirstName(userData.firstName);
        setOriginalMiddleName(userData.middleName || "");
        setOriginalLastName(userData.lastName);
        if (userData.role === "Peer Reviewer") {
          setPeerReviewerInfo({
            affiliation: userData.affiliation || "",
            expertise: userData.expertise || "",
            interests: userData.interests || "",
          });
        }
      } else showMessage("Profile not found.", "error");
    } catch (error) {
      console.error("Error fetching profile:", error);
      showMessage("Failed to fetch profile.", "error");
    }
  };

  useEffect(() => {
    if (isEditing) smoothScrollTo(firstNameRef.current, 300);
  }, [isEditing]);

  const handleEdit = () => {
    setIsEditing(true);
    firstNameRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  const handleUpdateProfile = async () => {
    const normalizedProfile = {
      ...profile,
      firstName: capitalizeWords(profile.firstName),
      middleName: capitalizeWords(profile.middleName || ""),
      lastName: capitalizeWords(profile.lastName),
    };

    const before = {
      firstName: originalFirstName,
      middleName: originalMiddleName,
      lastName: originalLastName,
      ...(profile.role === "Peer Reviewer" ? peerReviewerInfo : {}),
    };
    const after = {
      firstName: normalizedProfile.firstName,
      middleName: normalizedProfile.middleName,
      lastName: normalizedProfile.lastName,
      ...(profile.role === "Peer Reviewer" ? peerReviewerInfo : {}),
    };

    const changedFields = {};
    Object.keys(after).forEach((key) => {
      if (after[key] !== before[key])
        changedFields[key] = { before: before[key], after: after[key] };
    });

    if (Object.keys(changedFields).length === 0) {
      showMessage("No changes to save.", "error");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    try {
      await updateDoc(doc(db, "Users", profile.id), after);

      await logProfileUpdate({
        actingUserId: currentUser.uid,
        before,
        after,
      });

      const updatedUserDoc = await getDoc(doc(db, "Users", profile.id));
      if (updatedUserDoc.exists()) {
        const updatedUserData = updatedUserDoc.data();
        setProfile((prev) => ({
          ...prev,
          ...updatedUserData,
          middleName: updatedUserData.middleName || "",
        }));
        setOriginalFirstName(updatedUserData.firstName);
        setOriginalMiddleName(updatedUserData.middleName || "");
        setOriginalLastName(updatedUserData.lastName);
      }

      showMessage("Profile updated successfully.", "success");
      window.scrollTo({ top: 0, behavior: "smooth" });
      setIsEditing(false);
    } catch (error) {
      console.error("Error updating profile:", error);
      showMessage("Failed to update profile.", "error");
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const showMessage = (text, type) => {
    setMessage(text);
    setMessageType(type);
    if (messageTimeout) clearTimeout(messageTimeout);
    const timeout = setTimeout(() => {
      setMessage("");
      setMessageType("");
    }, 5000);
    setMessageTimeout(timeout);

    if (messageRef.current)
      messageRef.current.scrollIntoView({ behavior: "smooth" });
    else window.scrollTo({ top: 100, behavior: "smooth" });
  };

  const handlePeerReviewerChange = (field, value) => {
    setPeerReviewerInfo({ ...peerReviewerInfo, [field]: value });
  };

  return (
    <div className="flex justify-center items-start min-h-screen pt-28 px-4 pb-10 bg-gray-100">
      <div className="relative bg-red-800 w-full max-w-md rounded-lg shadow-2xl p-6 sm:p-8 pt-16 pb-36">
        <button
          className="absolute top-4 right-4 text-white hover:text-yellow-300 active:text-yellow-500 transition-all z-10"
          onClick={handleEdit}
        >
          <FontAwesomeIcon icon={faEdit} className="text-2xl" />
        </button>

        {message && (
          <div
            ref={messageRef}
            className={`${
              messageType === "success"
                ? "bg-green-500"
                : messageType === "error"
                ? "bg-red-500"
                : "bg-gray-500"
            } text-white border-2 border-white rounded-lg p-2 text-center w-full max-w-xs mx-auto mb-4`}
          >
            {message}
          </div>
        )}
        {!message && <div className="h-8 mb-4"></div>}

        <h2 className="text-3xl font-semibold mb-6 text-center text-white">
          Profile
        </h2>

        {profile ? (
          <div className="space-y-6 pr-2">
            <div className="flex flex-col items-center mb-6">
              {profile.photoURL ? (
                <img
                  src={profile.photoURL}
                  alt="Profile"
                  className="w-32 h-32 rounded-full object-cover shadow-md mb-4"
                />
              ) : (
                <div className="w-32 h-32 rounded-full bg-yellow-400 flex justify-center items-center text-white text-6xl shadow-lg mb-4">
                  {getInitials(
                    profile.firstName,
                    profile.middleName,
                    profile.lastName
                  ) || <FontAwesomeIcon icon={faUser} />}
                </div>
              )}
              <p
                className="text-white text-3xl font-bold text-center mb-1 cursor-pointer"
                onClick={() => setShowFullMiddle(!showFullMiddle)}
              >
                {profile.firstName}{" "}
                {profile.middleName
                  ? showFullMiddle
                    ? profile.middleName
                    : `${profile.middleName.charAt(0)}.`
                  : ""}{" "}
                {profile.lastName}
              </p>
              <p className="text-white text-xl text-center">{profile.role}</p>
            </div>

            <div className="border-b-2 border-white pb-3 mb-6">
              <p className="font-semibold text-white text-sm mb-2">Email:</p>
              <p className="text-white mb-4 text-lg">{currentUser.email}</p>
            </div>

            {/* First Name */}
            <div className="border-b-2 border-white pb-3 mb-6">
              {isEditing ? (
                <label
                  htmlFor="firstName"
                  className="font-semibold text-white text-sm mb-2 flex flex-col"
                >
                  First Name:
                  <input
                    ref={firstNameRef}
                    id="firstName"
                    name="firstName"
                    type="text"
                    value={profile.firstName || ""}
                    onChange={(e) =>
                      setProfile({ ...profile, firstName: e.target.value })
                    }
                    className="w-full p-1 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black shadow-md transition-all ease-in-out duration-300 mt-1"
                  />
                </label>
              ) : (
                <p className="text-white text-lg">
                  {profile.firstName || "No first name"}
                </p>
              )}
            </div>

            {/* Middle Name */}
            <div className="border-b-2 border-white pb-3 mb-6">
              {isEditing ? (
                <label
                  htmlFor="middleName"
                  className="font-semibold text-white text-sm mb-2 flex flex-col"
                >
                  Middle Name:
                  <input
                    id="middleName"
                    name="middleName"
                    type="text"
                    value={profile.middleName || ""}
                    onChange={(e) =>
                      setProfile({ ...profile, middleName: e.target.value })
                    }
                    placeholder="Enter middle name"
                    className="w-full p-1 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black shadow-md transition-all ease-in-out duration-300 mt-1"
                  />
                </label>
              ) : (
                <p className="text-white text-lg">
                  {profile.middleName || "No middle name"}
                </p>
              )}
            </div>

            {/* Last Name */}
            <div className="border-b-2 border-white pb-3 mb-6">
              {isEditing ? (
                <label
                  htmlFor="lastName"
                  className="font-semibold text-white text-sm mb-2 flex flex-col"
                >
                  Last Name:
                  <input
                    ref={lastNameRef}
                    id="lastName"
                    name="lastName"
                    type="text"
                    value={profile.lastName || ""}
                    onChange={(e) =>
                      setProfile({ ...profile, lastName: e.target.value })
                    }
                    className="w-full p-1 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black shadow-md transition-all ease-in-out duration-300 mt-1"
                  />
                </label>
              ) : (
                <p className="text-white text-lg">
                  {profile.lastName || "No last name"}
                </p>
              )}
            </div>

            {/* Peer Reviewer Fields */}
            {profile.role === "Peer Reviewer" && peerReviewerInfo && (
              <div className="border-b-2 border-white pb-3 mb-6 space-y-3">
                {["affiliation", "expertise", "interests"].map((field) => (
                  <div key={field}>
                    {isEditing ? (
                      <label
                        htmlFor={field}
                        className="font-semibold text-white text-sm mb-2 flex flex-col capitalize"
                      >
                        {field}:
                        <input
                          id={field}
                          name={field}
                          type="text"
                          value={peerReviewerInfo[field] || ""}
                          onChange={(e) =>
                            handlePeerReviewerChange(field, e.target.value)
                          }
                          className="w-full p-1 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black shadow-md mt-1"
                        />
                      </label>
                    ) : (
                      <p className="text-white">
                        {peerReviewerInfo[field] || `No ${field}`}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}

            {isEditing ? (
              <div className="flex flex-col sm:flex-row justify-between mt-6 space-y-3 sm:space-y-0 sm:space-x-3">
                <button
                  className="bg-blue-500 hover:bg-blue-600 active:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200 shadow-lg w-full sm:w-auto"
                  onClick={handleUpdateProfile}
                >
                  Save Changes
                </button>
                <button
                  className="bg-gray-300 hover:bg-gray-400 active:bg-gray-500 text-gray-800 font-semibold py-3 px-6 rounded-lg transition-all duration-200 shadow-md w-full sm:w-auto"
                  onClick={() => setIsEditing(false)}
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div className="mt-10 h-10"></div>
            )}
          </div>
        ) : (
          <p className="text-center text-gray-100">Loading profile...</p>
        )}
      </div>
    </div>
  );
}

export default Profile;
