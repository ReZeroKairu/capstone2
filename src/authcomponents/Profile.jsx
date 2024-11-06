import React, { useState, useEffect } from "react";
import { db } from "../firebase/firebase"; // Adjust path as needed
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { useAuth } from "../authcontext/AuthContext"; // Adjust path as needed

function Profile() {
  const { currentUser } = useAuth();
  const [profile, setProfile] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState(""); // "success" or "error"
  const [messageTimeout, setMessageTimeout] = useState(null); // Store timeout ID

  useEffect(() => {
    if (currentUser) {
      fetchProfile(currentUser.uid);
    }
  }, [currentUser]);

  const fetchProfile = async (userId) => {
    try {
      const userDoc = await getDoc(doc(db, "Users", userId));
      if (userDoc.exists()) {
        setProfile({ id: userDoc.id, ...userDoc.data() });
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

  const handleUpdateProfile = async () => {
    try {
      await updateDoc(doc(db, "Users", profile.id), {
        firstName: profile.firstName,
        lastName: profile.lastName,
      });
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
    <div className="flex justify-center items-center min-h-screen bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-lg w-full mt-28 max-w-md">
        <h2 className="text-3xl font-semibold mb-6 text-center text-gray-800">
          Profile
        </h2>

        {message && (
          <p
            className={`text-center mb-4 ${
              messageType === "success" ? "text-green-600" : "text-red-600"
            }`}
          >
            {message}
          </p>
        )}

        {profile ? (
          <div className="space-y-4">
            <div>
              <label className="font-semibold text-gray-600">Email:</label>
              <p className="text-gray-700">{profile.email}</p>
            </div>

            <div>
              <label className="font-semibold text-gray-600">First Name:</label>
              {isEditing ? (
                <input
                  type="text"
                  value={profile.firstName}
                  onChange={(e) =>
                    setProfile({ ...profile, firstName: e.target.value })
                  }
                  className="w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              ) : (
                <p className="text-gray-700">{profile.firstName}</p>
              )}
            </div>

            <div>
              <label className="font-semibold text-gray-600">Last Name:</label>
              {isEditing ? (
                <input
                  type="text"
                  value={profile.lastName}
                  onChange={(e) =>
                    setProfile({ ...profile, lastName: e.target.value })
                  }
                  className="w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              ) : (
                <p className="text-gray-700">{profile.lastName}</p>
              )}
            </div>

            <div>
              <label className="font-semibold text-gray-600">Role:</label>
              <p className="text-gray-700">{profile.role}</p>
            </div>

            {isEditing ? (
              <div className="flex justify-between mt-4">
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
              <button
                className="w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg transition-all mt-4"
                onClick={handleEdit}
              >
                Edit Profile
              </button>
            )}
          </div>
        ) : (
          <p className="text-center text-gray-600">Loading profile...</p>
        )}
      </div>
    </div>
  );
}

export default Profile;
