import React, { useEffect, useState } from "react";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { auth, db } from "../firebase/firebase";
import { setDoc, doc } from "firebase/firestore";
import bg from "../assets/bg.jpg"; // Background image
import { useNavigate } from "react-router-dom";
import pubtrackicon2 from "../assets/pubtrackicon2.png";
function SignUp() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        // Redirect to home or another page if user is logged in
        navigate("/home"); // Change this to your desired route
      } else {
        setLoading(false); // User not logged in
      }
    });
    return () => unsubscribe(); // Cleanup on unmount
  }, [navigate]);

  if (loading) {
    return <div>Loading...</div>; // Optionally show a loading spinner
  }
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
      // Step 1: Create user in Firebase Authentication
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );
      const user = userCredential.user;

      console.log("Firebase Authentication Success:", user.uid);

      // Step 2: Save user data to Firestore with role
      await setDoc(doc(db, "Users", user.uid), {
        uid: user.uid,
        firstName: firstName,
        lastName: lastName,
        email: user.email,
        role: "user", // Default role
      });
      console.log("User added to Firestore successfully");

      // Success message
      setSuccessMessage("User registered successfully!");
      setTimeout(() => {
        window.location.href = "/Home"; // Redirect to home page after a short delay
      }, 1000);
    } catch (error) {
      console.error("Error during sign up:", error.message);
      setErrorMessage("Failed to register user.");
    } finally {
      setLoading(false); // Stop the loading state after operation completes
    }
  };

  return (
    <div className="min-h-screen flex flex-col ">
      <div
        className="fixed inset-0 bg-cover bg-center"
        style={{
          backgroundImage: `url(${bg})`,
          filter: "blur(2px)",
          zIndex: -1, // Ensures the background stays behind other content
        }}
      ></div>
      <div className="min-h-screen flex flex-col justify-center items-center">
        <form
          onSubmit={handleRegister}
          className="max-w-md mx-auto border-2 border-white px-20 mt-32 mb-20 pt-4 pb-6 bg-yellow-400 rounded-lg space-y-4"
        >
          <img
            src={pubtrackicon2}
            alt="Logo"
            className="h-20 w-auto mx-auto" // Adjust height and margin as needed
          />
          {/* Display error message */}
          {errorMessage && (
            <div className="mb-4 text-red-600 text-center">{errorMessage}</div>
          )}

          {/* Display success message */}
          {successMessage && (
            <div className="mb-4 text-green-600 text-center">
              {successMessage}
            </div>
          )}
          <div className="mb-3">
            <label className="">First Name:</label>
            <input
              type="text"
              className="w-full mt-1 p-2 border text-black rounded-lg focus:ring-blue-500 focus:border-blue-500"
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
              className="w-full mt-1 p-2 border text-black rounded-lg focus:ring-blue-500 focus:border-blue-500"
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
              className="w-full mt-1 p-2 border text-black rounded-lg focus:ring-blue-500 focus:border-blue-500"
              placeholder="Enter email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-black">
              Password
            </label>
            <input
              type="password"
              className="w-full mt-1 p-2 border text-black rounded-lg focus:ring-blue-500 focus:border-blue-500"
              placeholder="Enter password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <div className="flex justify-center">
            <button
              type="submit"
              className={`w-full mt-2 bg-red-700 hover:bg-red-800 active:scale-95 active:bg-red-900 text-white p-2 rounded-lg ${
                loading ? "opacity-70" : ""
              }`}
              disabled={loading}
            >
              {loading ? "Signing Up..." : "Sign Up"}
            </button>
          </div>

          <div className="mt-6 text-center">
            <p>Already have an account?</p>
            <a
              href="/SignIn"
              className="text-red-700 hover:text-red-800  active:text-red-950 hover:underline"
            >
              Sign In
            </a>
          </div>
        </form>
      </div>
    </div>
  );
}

export default SignUp;
