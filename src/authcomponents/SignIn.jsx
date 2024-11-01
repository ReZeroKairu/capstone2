import { signInWithEmailAndPassword, signInWithPopup } from "firebase/auth";
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { auth, provider } from "../firebase/firebase"; // Adjust the path based on your project structure
import SignInwithGoogle from "./SignInWithGoogle"; // Google SignIn component
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
  const [alert, setAlert] = useState({ message: "", type: "" });
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const togglePasswordVisibility = () => {
    setShowPassword((prev) => !prev);
  };

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user && user.emailVerified) {
        navigate("/home");
      }
    });
    return () => unsubscribe();
  }, [navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(
        auth,
        email,
        password
      );
      const user = userCredential.user;
      await user.reload();

      if (!user.emailVerified) {
        setAlert({
          message:
            "Please verify your email before logging in. Please check your email.",
          type: "error",
        });
        await auth.signOut();
        return;
      }

      setAlert({ message: "User logged in successfully!", type: "success" });
      navigate("/home");
    } catch (error) {
      console.error(error.message);
      let errorMessage = "Failed to sign in. Please check your credentials.";
      if (error.code === "auth/invalid-email") {
        errorMessage = "The email address is not valid. Please try again.";
      } else if (error.code === "auth/user-not-found") {
        errorMessage = "No user found with this email address.";
      } else if (error.code === "auth/wrong-password") {
        errorMessage = "Invalid email or password. Please try again.";
      }

      setAlert({ message: errorMessage, type: "error" });
      setTimeout(() => setAlert({ message: "", type: "" }), 5000);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      const userCredential = await signInWithPopup(auth, provider);
      const user = userCredential.user;

      // Check if the user already has an email/password account
      const existingUser = await auth.fetchSignInMethodsForEmail(user.email);
      if (existingUser.length && existingUser[0] === "password") {
        // User exists with email/password; need to link accounts
        setAlert({
          message:
            "You already have an account with this email. Please sign in with email and password.",
          type: "error",
        });
        return;
      }

      // Successfully signed in with Google
      if (user.emailVerified) {
        setAlert({ message: "User logged in successfully!", type: "success" });
        navigate("/home");
      } else {
        setAlert({
          message:
            "Please verify your email before logging in. Please check your email.",
          type: "error",
        });
        await auth.signOut();
      }
    } catch (error) {
      console.error("Google Sign-In error:", error.message);
      setAlert({
        message: "Failed to sign in with Google. Please try again.",
        type: "error",
      });
    }
  };

  return (
    <main className="flex flex-col min-h-screen relative">
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: "url('/bg.jpg')" }}
      ></div>
      <div className="flex-grow flex justify-center items-center">
        <form
          onSubmit={handleSubmit}
          className="max-w-md mx-auto px-20 border-2 border-white pt-2 pb-6 bg-yellow-400 shadow-md rounded-lg mt-24 mb-10 relative"
        >
          <img
            src="/pubtrackIcon2.png"
            alt="Logo"
            className="h-20 w-auto mb-6 mx-auto"
          />

          {/* Alert Messages */}
          {alert.message && (
            <div
              className={`mb-4 p-2 rounded text-white text-center mx-auto w-full bg-${
                alert.type === "success"
                  ? "green"
                  : alert.type === "error"
                  ? "red"
                  : "yellow"
              }-500`}
            >
              {alert.message}
            </div>
          )}

          <div className="mb-3">
            <label>Email address:</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <FontAwesomeIcon icon={faEnvelope} className="text-red-800" />
              </span>
              <input
                type="email"
                className="form-control w-72 p-2 pl-10 border text-black rounded-lg"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="mb-3">
            <label>Password:</label>
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
                required
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
              disabled={loading}
            >
              {loading ? "Signing In..." : "Sign In"}
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

        {/* Loading Indicator */}
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50">
            <span className="text-white">Loading...</span>
          </div>
        )}
      </div>
    </main>
  );
}

export default SignIn;
