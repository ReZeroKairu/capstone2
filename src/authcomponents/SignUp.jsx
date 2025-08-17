import React, { useEffect, useState, useRef } from "react";
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  signOut,
} from "firebase/auth";
import { auth, db } from "../firebase/firebase";
import { setDoc, doc } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faEye,
  faEyeSlash,
  faUser,
  faEnvelope,
  faLock,
} from "@fortawesome/free-solid-svg-icons";

function SignUp() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");

  // Error states
  const [errorMessage, setErrorMessage] = useState("");
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [confirmPasswordError, setConfirmPasswordError] = useState("");

  const [successMessage, setSuccessMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const navigate = useNavigate();

  const errorRef = useRef(null);

  useEffect(() => {
    if (errorMessage) {
      errorRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [errorMessage]);

  // Redirect if already authenticated
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user && !successMessage) {
        setIsCheckingAuth(false);
        navigate("/home");
      } else {
        setIsCheckingAuth(false);
      }
    });
    return () => unsubscribe();
  }, [navigate, successMessage]);

  const handleSignUp = async (e) => {
    e.preventDefault();

    setErrorMessage("");
    setEmailError("");
    setPasswordError("");
    setConfirmPasswordError("");
    setSuccessMessage("");

    const trimmedFirstName = firstName.trim();
    const trimmedLastName = lastName.trim();
    const trimmedEmail = email.trim();

    if (
      !trimmedFirstName ||
      !trimmedLastName ||
      !trimmedEmail ||
      !password ||
      !confirmPassword
    ) {
      setErrorMessage("Please fill out all fields");
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
      // Create the user
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        trimmedEmail,
        password
      );
      const user = userCredential.user;

      // Log out immediately
      await signOut(auth);

      // Save to Firestore
      await setDoc(doc(db, "Users", user.uid), {
        uid: user.uid,
        firstName: trimmedFirstName,
        lastName: trimmedLastName,
        email: user.email,
        role: "Researcher",
        photo: null,
      });

      // Send verification email
      await sendEmailVerification(user);

      setSuccessMessage(
        "User registered successfully! A verification email has been sent. Please check your inbox and verify your email before signing in."
      );

      setTimeout(() => {
        navigate("/SignIn");
      }, 5000);
    } catch (error) {
      console.error("Error creating user:", error.code, error.message);
      if (error.code === "auth/email-already-in-use") {
        setEmailError("Email already registered.");
      } else {
        setErrorMessage(error.message || "Failed to register user.");
      }
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

          <div className="flex justify-center mt-4">
            <button
              type="submit"
              className="btn btn-primary mt-2 bg-red-700 hover:bg-red-800 active:scale-95 active:bg-red-900 text-white p-2 rounded w-full sm:w-32"
              disabled={loading}
            >
              {loading ? "Signing Up..." : "Sign Up"}
            </button>
          </div>

          <div className="text-center">
            Already have an account?{" "}
            <a
              href="/SignIn"
              className="text-red-700 hover:text-red-800 active:text-red-950 underline"
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
