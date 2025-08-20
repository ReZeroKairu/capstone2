// src/pages/SignUp.jsx
import React, { useEffect, useState, useRef } from "react";
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  signOut,
} from "firebase/auth";
import { auth, db } from "../firebase/firebase";
import { setDoc, doc } from "firebase/firestore";
import { useNavigate, useLocation } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faEye,
  faEyeSlash,
  faUser,
  faEnvelope,
  faLock,
} from "@fortawesome/free-solid-svg-icons";

function SignUp() {
  const location = useLocation();
  const navigate = useNavigate();

  const role = location.pathname.includes("peer")
    ? "Peer Reviewer"
    : "Researcher";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");

  const [errorMessage, setErrorMessage] = useState("");
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [confirmPasswordError, setConfirmPasswordError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const errorRef = useRef(null);

  useEffect(() => {
    if (errorMessage) errorRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [errorMessage]);

  const handleSignUp = async (e) => {
    e.preventDefault();

    setErrorMessage("");
    setEmailError("");
    setPasswordError("");
    setConfirmPasswordError("");
    setSuccessMessage("");

    if (!firstName || !lastName || !email || !password || !confirmPassword) {
      setErrorMessage("Please fill out all fields.");
      return;
    }
    if (password.length < 6) {
      setPasswordError("Password must be at least 6 characters long!");
      return;
    }
    if (password !== confirmPassword) {
      setConfirmPasswordError("Passwords do not match!");
      return;
    }

    setLoading(true);

    try {
      // 1️⃣ Create the Auth user
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );
      const user = userCredential.user;

      try {
        // 2️⃣ Create Firestore document
        await setDoc(doc(db, "Users", user.uid), {
          uid: user.uid,
          firstName,
          lastName,
          email: user.email,
          role,
          photo: null,
        });

        // 3️⃣ Send verification email
        await sendEmailVerification(user);

        // 4️⃣ Sign out the user (optional, user must verify email)
        await signOut(auth);

        // 5️⃣ Success message
        setSuccessMessage(
          "User registered successfully! A verification email has been sent. Please check your inbox before signing in."
        );

        setTimeout(() => navigate("/SignIn"), 5000);
      } catch (firestoreError) {
        console.error("Firestore error:", firestoreError);

        // Rollback: delete Auth user if Firestore write fails
        await user.delete();

        setErrorMessage("Failed to create user profile. Please try again.");
      }
    } catch (authError) {
      console.error("Auth error:", authError.code, authError.message);

      if (authError.code === "auth/email-already-in-use")
        setEmailError("Email already registered.");
      else setErrorMessage(authError.message || "Failed to register user.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <div
        className="fixed inset-0 bg-cover bg-center"
        style={{
          backgroundImage: `url('/bg.jpg')`,
          filter: "blur(2px)",
          zIndex: -1,
        }}
      ></div>

      <div className="min-h-screen flex flex-col justify-center items-center">
        <form
          onSubmit={handleSignUp}
          className="max-w-md mx-auto border-2 border-white px-6 sm:px-12 md:px-20 mt-32 mb-20 pt-4 pb-6 bg-yellow-400 rounded-lg space-y-4 w-full"
        >
          <img
            src="/pubtrackIcon2.png"
            alt="Logo"
            className="h-20 w-auto mb-6 mx-auto"
          />
          {/* Display role below logo */}
          <p className="text-center text-black font-semibold text-lg mb-6">
            {role + " Sign Up"}
          </p>

          {errorMessage && (
            <div
              ref={errorRef}
              className="mb-4 p-2 rounded text-white bg-red-500 text-center"
            >
              {errorMessage}
            </div>
          )}
          {successMessage && (
            <div className="mb-4 p-2 rounded text-white bg-green-500 text-center">
              {successMessage}
            </div>
          )}

          {/* First & Last Name */}
          <div className="relative mb-3">
            <label className="block text-sm font-medium text-gray-700">
              First Name:
            </label>
            <input
              type="text"
              className="w-full mt-1 p-2 pl-10 border text-black rounded-lg focus:ring-blue-500 focus:border-blue-500"
              placeholder="First Name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
            />
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 mt-6 text-red-800">
              <FontAwesomeIcon icon={faUser} />
            </span>
          </div>

          <div className="relative mb-3">
            <label className="block text-sm font-medium text-gray-700">
              Last Name:
            </label>
            <input
              type="text"
              className="w-full mt-1 p-2 pl-10 border text-black rounded-lg focus:ring-blue-500 focus:border-blue-500"
              placeholder="Last Name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
            />
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 mt-6 text-red-800">
              <FontAwesomeIcon icon={faUser} />
            </span>
          </div>

          {/* Email */}
          <div className="relative mb-3">
            <label className="block text-sm font-medium text-gray-700">
              Email address
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-red-800">
                <FontAwesomeIcon icon={faEnvelope} />
              </span>
              <input
                type="email"
                className="w-full mt-1 p-2 pl-10 border text-black rounded-lg focus:ring-blue-500 focus:border-blue-500"
                placeholder="Email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setEmailError("");
                }}
                autoComplete="email"
              />
            </div>
            {emailError && (
              <p className="text-red-600 text-sm mt-1">{emailError}</p>
            )}
          </div>

          {/* Password */}
          <div className="relative mb-3">
            <label className="block text-sm font-medium text-black">
              Password
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-red-800">
                <FontAwesomeIcon icon={faLock} />
              </span>
              <input
                type={showPassword ? "text" : "password"}
                className="w-full mt-1 p-2 pl-10 pr-10 border text-black rounded-lg focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setPasswordError("");
                }}
              />
              <span
                className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer"
                onClick={() => setShowPassword(!showPassword)}
              >
                <FontAwesomeIcon
                  icon={showPassword ? faEyeSlash : faEye}
                  className="text-red-900"
                />
              </span>
            </div>
            {passwordError && (
              <p className="text-red-600 text-sm mt-1">{passwordError}</p>
            )}
          </div>

          {/* Confirm Password */}
          <div className="relative mb-3">
            <label className="block text-sm font-medium text-black">
              Confirm Password
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-red-800">
                <FontAwesomeIcon icon={faLock} />
              </span>
              <input
                type={showConfirmPassword ? "text" : "password"}
                className="w-full mt-1 p-2 pl-10 pr-10 border text-black rounded-lg focus:ring-blue-500 focus:border-blue-500"
                placeholder="Confirm password"
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  setConfirmPasswordError("");
                }}
              />
              <span
                className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              >
                <FontAwesomeIcon
                  icon={showConfirmPassword ? faEyeSlash : faEye}
                  className="text-red-900"
                />
              </span>
            </div>
            {confirmPasswordError && (
              <p className="text-red-600 text-sm mt-1">
                {confirmPasswordError}
              </p>
            )}
          </div>

          {/* Sign Up Button */}
          <div className="flex justify-center mt-4">
            <button
              type="submit"
              className="btn btn-primary mt-2 bg-red-700 hover:bg-red-800 active:scale-95 active:bg-red-900 text-white p-2 rounded w-full sm:w-32"
              disabled={loading}
            >
              {loading ? "Signing Up..." : "Sign Up"}
            </button>
          </div>

          {/* Switch Roles */}
          <div className="text-center mt-2">
            {role === "Researcher" ? (
              <a
                href="/SignUp/peer"
                className="text-red-700 hover:text-red-800 underline"
              >
                Sign up as Peer Reviewer
              </a>
            ) : (
              <a
                href="/SignUp"
                className="text-red-700 hover:text-red-800 underline"
              >
                Sign up as Researcher
              </a>
            )}
          </div>

          {/* Sign In link */}
          <div className="text-center mt-2">
            Already have an account?{" "}
            <a
              href="/SignIn"
              className="text-red-700 hover:text-red-800 underline"
            >
              Sign in
            </a>
          </div>
        </form>
      </div>
    </div>
  );
}

export default SignUp;
