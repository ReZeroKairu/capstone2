import { signInWithEmailAndPassword } from "firebase/auth";
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { auth } from "../firebase/firebase"; // Adjust the path based on your project structure
import SignInwithGoogle from "../pages/SignInWithGoogle"; // Google SignIn component
import bg from "../assets/bg.jpg"; // Your background image
import pubtrackicon2 from "../assets/pubtrackicon2.png";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faLock,
  faEye,
  faEyeSlash,
  faEnvelope,
} from "@fortawesome/free-solid-svg-icons";

function SignIn() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [alert, setAlert] = useState({ message: "", type: "" }); // Alert state
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [showPassword, setShowPassword] = useState(false);

  const togglePasswordVisibility = () => {
    setShowPassword((prev) => !prev);
  };

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await signInWithEmailAndPassword(auth, email, password);
      console.log("User logged in successfully");

      // Show success alert
      setAlert({ message: "User logged in successfully!", type: "success" });

      // Navigate to home page
      navigate("/home"); // Use lowercase 'home' if your route is defined as such

      // Hide the alert after 5 seconds
      setTimeout(() => setAlert({ message: "", type: "" }), 5000);
    } catch (error) {
      console.log(error.message);

      // Handle specific error codes
      let errorMessage = "Failed to sign in. Please check your credentials.";
      if (error.code === "auth/invalid-credential") {
        errorMessage = "Invalid email or password. Please try again.";
      }

      // Show error alert
      setAlert({ message: errorMessage, type: "error" });

      // Hide the alert after 5 seconds
      setTimeout(() => setAlert({ message: "", type: "" }), 5000);
    }
  };

  return (
    <main className="relative h-screen">
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
          onSubmit={handleSubmit}
          className="max-w-md mx-auto px-20 border-2 border-white pt-2 pb-6 bg-yellow-400 shadow-md rounded-lg mt-24 mb-10 relative " // Added top and bottom margin
        >
          <img
            src={pubtrackicon2}
            alt="Logo"
            className="h-20 w-auto mb-6 mx-auto" // Adjust height and margin as needed
          />

          {/* Alert Messages */}
          {alert.message && (
            <div className="mb-4 p-2 rounded text-white text-center mx-auto w-full">
              <div
                className={`bg-${
                  alert.type === "success" ? "green" : "red"
                }-500`}
              >
                {alert.message}
              </div>
            </div>
          )}

          <div className="mb-3">
            <label className="">Email address:</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <FontAwesomeIcon icon={faEnvelope} className="text-red-800" />
              </span>
              <input
                type="email"
                className="form-control w-72 p-2 pl-10 border text-black rounded-lg" // Adjust padding to fit icon
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          <div className="mb-3">
            <label className="block">Password:</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <FontAwesomeIcon
                  icon={faLock}
                  className="text-red-800 rounded-lg"
                />
              </span>
              <input
                type={showPassword ? "text" : "password"}
                className="form-control w-72 p-2 pl-10 border rounded-lg"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                className="absolute inset-y-0 right-0 pr-3 flex items-center"
                onClick={togglePasswordVisibility}
              >
                <FontAwesomeIcon
                  icon={showPassword ? faEyeSlash : faEye}
                  className="text-red-800"
                />
              </button>
            </div>
          </div>

          <div className="flex justify-center">
            <button
              type="submit"
              className="btn btn-primary mt-2 bg-red-700 hover:bg-red-800 active:scale-95 active:bg-red-900 text-white p-2 rounded w-32"
            >
              Sign In
            </button>
          </div>
          <p className="forgot-password text-center mt-4">
            New user?{" "}
            <a
              href="/SignUp"
              className="text-red-700 hover:text-red-800  active:text-red-950 underline"
            >
              Sign Up
            </a>
          </p>
          <SignInwithGoogle />
        </form>
      </div>
    </main>
  );
}

export default SignIn;
