import React, { useEffect, useState } from "react";
import { auth, db } from "../firebase/firebase";
import { doc, getDoc } from "firebase/firestore";
import { useNavigate } from "react-router-dom";

function Profile() {
  const [userDetails, setUserDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState(""); // Add error state
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (user) {
        // Fetch user data from Firestore
        const docRef = doc(db, "Users", user.uid);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          setUserDetails(docSnap.data());
          console.log(docSnap.data());
        } else {
          // User not found in Firestore, log them out and show error
          setErrorMessage("User does not exist. Please contact support.");
          await auth.signOut(); // Sign out the user
          setTimeout(() => {
            navigate("/SignIn"); // Redirect to Sign In after showing the message
          }, 2000);
        }
      } else {
        // Redirect to SignIn if no user is logged in
        navigate("/SignIn");
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [navigate]);

  async function handleLogout() {
    try {
      await auth.signOut();
      navigate("/SignIn");
      console.log("User logged out successfully!");
    } catch (error) {
      console.error("Error logging out:", error.message);
    }
  }

  if (loading) {
    return <p className="text-center text-gray-500">Loading...</p>;
  }

  if (errorMessage) {
    return <p className="text-center text-red-500">{errorMessage}</p>; // Display error if user not found
  }

  return (
    <div className="flex flex-col items-center p-24">
      {userDetails ? (
        <>
          <div className="flex justify-center mb-4">
            <img
              src={userDetails.photo || "https://via.placeholder.com/150"}
              width="150"
              height="150"
              className="rounded-full shadow-md"
              alt="User Profile"
            />
          </div>
          <h3 className="text-xl font-bold mb-4">
            Welcome {userDetails.firstName} 🙏🙏
          </h3>
          <div className="bg-white p-6 rounded shadow-md w-full max-w-md">
            <p className="mb-2">
              <strong>Email:</strong> {userDetails.email}
            </p>
            <p className="mb-2">
              <strong>First Name:</strong> {userDetails.firstName}
            </p>
            {userDetails.lastName && (
              <p className="mb-2">
                <strong>Last Name:</strong> {userDetails.lastName}
              </p>
            )}
          </div>
          <button
            onClick={handleLogout}
            className="mt-6 bg-red-500 text-white py-2 px-4 rounded hover:bg-red-600"
          >
            Sign Out
          </button>
        </>
      ) : (
        <p className="text-center text-gray-500">No user details available.</p>
      )}
    </div>
  );
}

export default Profile;
