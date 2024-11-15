import React, { useState, useEffect } from "react";
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

  // Store original values for firstName and lastName for comparison later
  const [originalFirstName, setOriginalFirstName] = useState("");
  const [originalLastName, setOriginalLastName] = useState("");

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

  const handleEdit = () => {
    setIsEditing(true);
  };

  const logUserAction = async (user, action) => {
    const userLogRef = collection(db, "UserLog"); // Reference to UserLog collection
    await addDoc(userLogRef, {
      userId: user.uid, // User ID
      action: action, // The action being performed (e.g., "ProfileUpdate")
      email: user.email, // User email
      timestamp: new Date(), // Timestamp of the action
    });
  };

  const handleUpdateProfile = async () => {
    // Check if there are any changes before updating
    if (
      profile.firstName === originalFirstName &&
      profile.lastName === originalLastName
    ) {
      showMessage("No changes to save.", "error");
      return; // Stop further execution if no changes are made
    }

    try {
      await updateDoc(doc(db, "Users", profile.id), {
        firstName: profile.firstName,
        lastName: profile.lastName,
      });

      // Log the profile update action
      await logUserAction(currentUser, "ProfileUpdate");

      showMessage("Profile updated successfully.", "success");
      setIsEditing(false);
    } catch (error) {
      console.error("Error updating profile:", error);
      showMessage("Failed to update profile.", "error");
    }
  };

  const showMessage = (text, type) => {
    setMessage(text);
    setMessageType(type);

    // Clear any existing timeout
    if (messageTimeout) {
      clearTimeout(messageTimeout);
    }

    // Set a new timeout to clear the message after 3 seconds
    const timeout = setTimeout(() => {
      setMessage("");
      setMessageType("");
    }, 7000);

    setMessageTimeout(timeout);
  };

  return (
    <div className="flex justify-center items-center min-h-screen bg-gray-300">
      <div className="relative bg-red-800 p-8 rounded-lg shadow-lg w-full mt-28 max-w-md pb-14 mb-7">
        {/* Pencil icon in the top-right corner */}
        <button
          className="absolute top-4 right-4 text-white hover:text-yellow-400 transition-all"
          onClick={handleEdit}
        >
          <FontAwesomeIcon icon={faEdit} className="text-2xl" />
        </button>

        <h2 className="text-3xl font-semibold mb-6 text-center text-white">
          Profile
        </h2>
        {/* Message section with a fixed height to prevent profile shifting */}
        {message && (
          <p
            className={`text-center mb-4 ${
              messageType === "success" ? "text-green-600" : "text-red-600"
            }`}
          >
            {message}
          </p>
        )}
        {!message && (
          <div className="h-8 mb-4"></div> // Add an empty div with the same height as the message
        )}

        {profile ? (
          <div className="space-y-6">
            <div className="flex justify-center mb-3">
              {profile.photoURL ? (
                <img
                  src={profile.photoURL}
                  alt="Profile"
                  className="w-32 h-32 rounded-full object-cover mb-6"
                />
              ) : (
                <div className="w-32 h-32 rounded-full bg-white flex justify-center items-center text-yellow-400 text-6xl md:text-6xl">
                  <FontAwesomeIcon icon={faUser} />
                </div>
              )}
            </div>
            <div>
              <p className="text-white text-2xl text-center">{profile.role}</p>
            </div>

            {/* Display email */}
            <div>
              <label className="font-semibold text-white">Email:</label>
              <p className="text-white mb-10">{currentUser.email}</p>
            </div>

            <div>
              <label className="font-semibold text-white">First Name:</label>
              <div
                className={`${
                  isEditing ? "hidden" : "block"
                } text-white h-10 flex items-center`}
              >
                <p>{profile.firstName || "No first name"}</p>{" "}
                {/* Default text if first name is missing */}
              </div>
              <div
                className={`${
                  isEditing ? "block" : "hidden"
                } text-white h-10 flex items-center`}
              >
                <input
                  type="text"
                  value={profile.firstName || ""}
                  onChange={(e) =>
                    setProfile({ ...profile, firstName: e.target.value })
                  }
                  className="w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 h-10 text-black"
                />
              </div>
            </div>

            <div>
              <label className="font-semibold text-white">Last Name:</label>
              <div
                className={`${
                  isEditing ? "hidden" : "block"
                } text-white h-10 flex items-center`}
              >
                <p>{profile.lastName || "No last name"}</p>{" "}
                {/* Default text if last name is missing */}
              </div>
              <div
                className={`${
                  isEditing ? "block" : "hidden"
                } text-white h-10 flex items-center`}
              >
                <input
                  type="text"
                  value={profile.lastName || ""}
                  onChange={(e) =>
                    setProfile({ ...profile, lastName: e.target.value })
                  }
                  className="w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 h-10 text-black"
                />
              </div>
            </div>

            {isEditing ? (
              <div className="flex justify-between mt-10 h-10">
                <button
                  className="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg transition-all"
                  onClick={handleUpdateProfile}
                >
                  Save Changes
                </button>
                <button
                  className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-semibold py-2 px-4 rounded-lg transition-all"
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
