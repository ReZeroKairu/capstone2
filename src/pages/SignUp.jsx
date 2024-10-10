import React, { useState } from "react";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { auth, db } from "../firebase/firebase";
import { setDoc, doc } from "firebase/firestore";

function SignUp() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const handleRegister = async (e) => {
    e.preventDefault();

    // Clear previous messages
    setErrorMessage("");
    setSuccessMessage("");

    // Validate form input
    if (!firstName || !lastName || !email || !password) {
      setErrorMessage("Please fill out all fields");
      return;
    }

    setLoading(true); // Set loading to true when the form is submitted

    try {
      // Create user in Firebase Authentication
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );
      const user = userCredential.user;

      console.log("Firebase Authentication Success:", user.uid);

      // Save user data to Firestore
      try {
        await setDoc(doc(db, "Users", user.uid), {
          uid: user.uid,
          firstName: firstName,
          lastName: lastName,
          email: user.email,
        });
        console.log("User added to Firestore successfully");

        // Success message
        setSuccessMessage("User registered successfully!");
        setTimeout(() => {
          window.location.href = "/Profile"; // Redirect to profile page after a short delay
        }, 1000);
      } catch (error) {
        console.error("Error writing document to Firestore: ", error.message);
        setErrorMessage("Failed to save user data to Firestore.");
      }
    } catch (error) {
      console.error("Error creating user:", error.message);
      setErrorMessage(error.message);
    } finally {
      setLoading(false); // Stop the loading state after operation completes
    }
  };

  return (
    <div className="max-w-md mx-auto p-6 bg-white shadow-md rounded-lg mt-10">
      <h3 className="text-2xl font-semibold mb-6 text-center">Sign Up</h3>

      {/* Display error message */}
      {errorMessage && (
        <div className="mb-4 text-red-600 text-center">{errorMessage}</div>
      )}

      {/* Display success message */}
      {successMessage && (
        <div className="mb-4 text-green-600 text-center">{successMessage}</div>
      )}

      <form onSubmit={handleRegister} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">
            First Name:
          </label>
          <input
            type="text"
            className="w-full mt-1 p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            placeholder="Enter your first name"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Last Name:
          </label>
          <input
            type="text"
            className="w-full mt-1 p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            placeholder="Enter your last name"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">
            Email address
          </label>
          <input
            type="email"
            className="w-full mt-1 p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            placeholder="Enter email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">
            Password
          </label>
          <input
            type="password"
            className="w-full mt-1 p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            placeholder="Enter password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        <div className="p-4">
          <button
            type="submit"
            className={`w-full bg-blue-600 text-white py-2 px-4 rounded-md ${
              loading ? "opacity-70" : ""
            }`}
            disabled={loading}
          >
            {loading ? "Signing Up..." : "Sign Up"}
          </button>

          <div className="mt-6 text-center">
            <p>Already have an account?</p>
            <a href="/SignIn" className="text-blue-500">
              Sign In
            </a>
          </div>
        </div>
      </form>
    </div>
  );
}

export default SignUp;
