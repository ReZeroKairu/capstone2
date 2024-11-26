import React, { useState, useEffect, useRef } from "react";
import { db } from "../firebase/firebase"; // Adjust path as needed
import { doc, getDoc, updateDoc, addDoc, collection } from "firebase/firestore";
import { useAuth } from "../authcontext/AuthContext"; // Adjust path as needed
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faUser, faEdit } from "@fortawesome/free-solid-svg-icons";

function Profile() {
  const { currentUser } = useAuth();
  const [profile, setProfile] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState(""); // "success" or "error"
  const [messageTimeout, setMessageTimeout] = useState(null); // Store timeout ID
  const messageRef = useRef(null); // Reference for the message element
  const firstNameRef = useRef(null);
  const lastNameRef = useRef(null);

  // Store original values for firstName and lastName for comparison later
  const [originalFirstName, setOriginalFirstName] = useState("");
  const [originalLastName, setOriginalLastName] = useState("");

  // Smooth scroll helper function
  const smoothScrollTo = (element, offset = 0, duration = 300) => {
    if (!element) return; // Ensure the element exists

    const start = window.scrollY;
    const target =
      element.getBoundingClientRect().top + window.pageYOffset - offset;
    const change = target - start;
    const startTime = performance.now();

    const easeInOut = (t) => {
      return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    };

    const scroll = (currentTime) => {
      const elapsedTime = currentTime - startTime;
      const progress = Math.min(elapsedTime / duration, 1);
      const easedProgress = easeInOut(progress);
      const scrollAmount = start + change * easedProgress;

      window.scrollTo(0, scrollAmount);

      if (elapsedTime < duration) {
        requestAnimationFrame(scroll);
      }
    };

    requestAnimationFrame(scroll); // Start the smooth scroll animation
  };

  useEffect(() => {
    if (currentUser) {
      fetchProfile(currentUser.uid);
    }
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
        setOriginalFirstName(userData.firstName); // Set the original first name
        setOriginalLastName(userData.lastName); // Set the original last name
      } else {
        showMessage("Profile not found.", "error");
      }
    } catch (error) {
      console.error("Error fetching profile:", error);
      showMessage("Failed to fetch profile.", "error");
    }
  };

  useEffect(() => {
    if (isEditing) {
      // Scroll to the first input field when editing starts
      smoothScrollTo(firstNameRef.current, 300);
    }
  }, [isEditing]);

  const handleEdit = () => {
    setIsEditing(true);

    firstNameRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  // Log the user action with the current and previous first/last names
  const logUserAction = async (
    user,
    action,
    previousFirstName,
    previousLastName,
    newFirstName,
    newLastName,
    adminId // Include adminId as a parameter
  ) => {
    const userLogRef = collection(db, "UserLog"); // Reference to UserLog collection

    const timestamp = new Date(); // Get current timestamp

    // Add the log entry to the Firestore collection
    await addDoc(userLogRef, {
      userId: user.uid, // User ID
      adminId: adminId || null, // Admin ID (if available)
      action: action, // The action being performed (e.g., "Profile Update")
      email: user.email, // User email
      previousFirstName: previousFirstName, // Previous first name
      previousLastName: previousLastName, // Previous last name
      newFirstName: newFirstName, // Current first name
      newLastName: newLastName, // Current last name
      timestamp: timestamp, // Timestamp of the action
    });

    // Log the action for debugging
    console.log("Action logged:", {
      userId: user.uid,
      adminId,
      action,
      email: user.email,
      previousFirstName,
      previousLastName,
      newFirstName,
      newLastName,
      timestamp,
    });
  };

  const handleUpdateProfile = async () => {
    // Check if there are any changes before updating
    if (
      profile.firstName === originalFirstName &&
      profile.lastName === originalLastName
    ) {
      showMessage("No changes to save.", "error");

      window.scrollTo({
        top: 0,
        behavior: "smooth",
      });

      return; // Stop further execution if no changes are made
    }

    try {
      // Fetch admin ID if required (replace with your admin-fetching logic if necessary)
      const adminId = currentUser.uid; // Assuming the current user is the admin

      // Perform the update to Firestore
      await updateDoc(doc(db, "Users", profile.id), {
        firstName: profile.firstName,
        lastName: profile.lastName,
      });

      // Log the profile update action with the previous and current names
      await logUserAction(
        currentUser,
        "Profile Update",
        originalFirstName, // previous first name
        originalLastName, // previous last name
        profile.firstName, // current first name
        profile.lastName, // current last name
        adminId // Pass admin ID
      );

      // Fetch the updated user data from Firestore
      const updatedUserDoc = await getDoc(doc(db, "Users", profile.id));

      if (updatedUserDoc.exists()) {
        // Update the local state with the latest values
        const updatedUserData = updatedUserDoc.data();
        setProfile((prevProfile) => ({
          ...prevProfile,
          firstName: updatedUserData.firstName,
          lastName: updatedUserData.lastName,
        }));
        setOriginalFirstName(updatedUserData.firstName);
        setOriginalLastName(updatedUserData.lastName);
      }

      showMessage("Profile updated successfully.", "success");

      window.scrollTo({
        top: 0,
        behavior: "smooth",
      });

      setIsEditing(false);
    } catch (error) {
      console.error("Error updating profile:", error);

      // Handle error (similar to how errors are handled in logUserAction)
      showMessage("Failed to update profile.", "error");

      window.scrollTo({
        top: 0,
        behavior: "smooth",
      });
    }
  };
  const showMessage = (text, type) => {
    setMessage(text);
    setMessageType(type);

    // Clear any existing timeout
    if (messageTimeout) {
      clearTimeout(messageTimeout);
    }

    // Set a new timeout to clear the message after 5 seconds
    const timeout = setTimeout(() => {
      setMessage("");
      setMessageType("");
    }, 5000);

    setMessageTimeout(timeout);

    // Scroll to the message
    if (messageRef.current) {
      messageRef.current.scrollIntoView({ behavior: "smooth" });
    } else {
      window.scrollTo({
        top: 100,
        behavior: "smooth", // Smooth scrolling
      });
    }
  };

  return (
    <div className="flex justify-center items-center min-h-screen">
      <div className="relative bg-red-800 p-8 rounded-lg shadow-2xl w-full mt-28 max-w-md pb-5 mb-7">
        {/* Pencil icon in the top-right corner */}
        <button
          className="absolute top-4 right-4 text-white hover:text-yellow-300 active:text-yellow-500 transition-all"
          onClick={handleEdit}
        >
          <FontAwesomeIcon icon={faEdit} className="text-2xl" />
        </button>
        {message && (
          <div
            ref={messageRef}
            className={`${
              messageType === "success"
                ? "bg-green-500 text-white border-2 border-white rounded-lg p-2 text-center w-full max-w-xs mx-auto mb-4"
                : messageType === "error"
                ? "bg-red-500 text-white border-2 border-white rounded-lg p-2 text-center w-full max-w-xs mx-auto mb-4"
                : "bg-gray-500 text-white border-2 border-white rounded-lg p-2 text-center w-full max-w-xs mx-auto mb-4"
            }`}
          >
            {message}
          </div>
        )}
        {!message && <div className="h-8 mb-4"></div>} {/* Placeholder div */}
        <h2 className="text-3xl font-semibold mb-6 text-center text-white">
          Profile
        </h2>
        {profile ? (
          <div className="space-y-6">
            {/* Profile Photo Section */}
            <div className="flex justify-center mb-3">
              {profile.photoURL ? (
                <img
                  src={profile.photoURL}
                  alt="Profile"
                  className="w-32 h-32 rounded-full object-cover mb-6 shadow-md"
                />
              ) : (
                <div className="w-32 h-32 rounded-full bg-white flex justify-center items-center text-yellow-400 text-6xl shadow-lg">
                  <FontAwesomeIcon icon={faUser} />
                </div>
              )}
            </div>

            {/* Full Name Section */}
            <div className="mb-4">
              <p className="text-white text-3xl font-bold text-center -mt-11 mb-2">
                {profile.firstName} {profile.lastName}
              </p>
              <p className="text-white text-2xl -mt-1 text-center">
                {profile.role}
              </p>
            </div>

            {/* Email Section */}
            <div className="border-b-2 border-gray-400 pb-3 mb-6">
              <label className="font-semibold text-white text-sm mb-2">
                Email:
              </label>
              <p className="text-white mb-4 text-lg">{currentUser.email}</p>
            </div>

            {/* First Name Section */}
            <div className="border-b-2 border-gray-400 pb-3 mb-6">
              <label className="font-semibold text-white text-sm mb-2">
                First Name:
              </label>
              <div
                className={`${
                  isEditing ? "hidden" : "block"
                } text-white h-10 flex items-center`}
              >
                <p className="text-lg">
                  {profile.firstName || "No first name"}
                </p>
              </div>
              <div
                className={`${
                  isEditing ? "block" : "hidden"
                } text-white h-10 flex items-center`}
              >
                <input
                  ref={firstNameRef} // Attach ref to input
                  type="text"
                  value={profile.firstName || ""}
                  onChange={(e) =>
                    setProfile({ ...profile, firstName: e.target.value })
                  }
                  className="w-full p-1 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black shadow-md transition-all ease-in-out duration-300"
                />
              </div>
            </div>

            {/* Last Name Section */}
            <div className="border-b-2 border-gray-400 pb-3 mb-6">
              <label className="font-semibold text-white text-sm mb-2">
                Last Name:
              </label>
              <div
                className={`${
                  isEditing ? "hidden" : "block"
                } text-white h-10 flex items-center`}
              >
                <p className="text-lg">{profile.lastName || "No last name"}</p>
              </div>
              <div
                className={`${
                  isEditing ? "block" : "hidden"
                } text-white h-10 flex items-center`}
              >
                <input
                  ref={lastNameRef} // Attach ref to input
                  type="text"
                  value={profile.lastName || ""}
                  onChange={(e) =>
                    setProfile({ ...profile, lastName: e.target.value })
                  }
                  className="w-full p-1 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black shadow-md transition-all ease-in-out duration-300"
                />
              </div>
            </div>

            {/* Edit Buttons Section */}
            {isEditing ? (
              <div className="flex justify-between mt-6 h-14">
                <button
                  className="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 px-6 rounded-lg transition-all shadow-lg"
                  onClick={handleUpdateProfile}
                >
                  Save Changes
                </button>
                <button
                  className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-semibold py-3 px-6 rounded-lg transition-all shadow-md"
                  onClick={() => setIsEditing(false)}
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div className="mt-10 h-10"></div> // Placeholder div to maintain layout consistency
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
