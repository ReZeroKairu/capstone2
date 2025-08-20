import { signInWithEmailAndPassword, signInWithPopup } from "firebase/auth";
import React, { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { auth, provider } from "../firebase/firebase";
import { db } from "../firebase/firebase"; // Make sure to import Firestore
import { collection, addDoc, doc, getDoc } from "firebase/firestore"; // Firestore methods
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faLock,
  faEye,
  faEyeSlash,
  faEnvelope,
} from "@fortawesome/free-solid-svg-icons";
import SignInwithGoogle from "./SignInWithGoogle";

function SignIn() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [alert, setAlert] = useState({ message: "", type: "" });
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isAppReady, setIsAppReady] = useState(false); // Track if app is ready to render

  const togglePasswordVisibility = () => {
    setShowPassword((prev) => !prev);
  };

  const checkEmailVerification = async (user) => {
    try {
      await user.reload(); // Reload user to get the latest emailVerified status
      if (!user.emailVerified) {
        setAlert({
          message:
            "Your email is not verified. Please check your inbox or spam folder.",
          type: "error",
        });
        await auth.signOut(); // Sign out user if email not verified
        return false;
      }
      return true;
    } catch (err) {
      console.error("Error checking email verification:", err);
      setAlert({
        message: "Unable to verify email. Please try again later.",
        type: "error",
      });
      return false;
    }
  };

  // Log user action function
  const logUserAction = async (user, action) => {
    const userLogRef = collection(db, "UserLog"); // Reference to UserLog collection
    const userDocRef = doc(db, "Users", user.uid);
    const userDoc = await getDoc(userDocRef);
    let adminId = null;

    if (userDoc.exists()) {
      const userData = userDoc.data();
      if (userData.role === "Admin") {
        adminId = user.uid; // Set adminId to the user's UID if they are an admin
      }
    }
    // Log the user action with the appropriate adminId
    await addDoc(userLogRef, {
      userId: user.uid, // User ID
      adminId: adminId, // Admin ID (null or user ID if admin)
      action: action, // The action being performed (e.g., "SignIn" or "GoogleSignIn")
      email: user.email, // User email
      timestamp: new Date(), // Timestamp of the action
    });
  };

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      setIsAppReady(true);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // While the app is not ready, show nothing or a loading spinner
  if (!isAppReady) {
    return null; // This prevents the SignIn page from showing while the auth state is being checked
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <span>Loading...</span>{" "}
        {/* Replace with a custom loading spinner if desired */}
      </div>
    );
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setAlert({ message: "", type: "" });

    try {
      if (!email || !password) {
        setAlert({
          message: "Please enter both email and password.",
          type: "error",
        });
        setLoading(false);
        return;
      }

      const userCredential = await signInWithEmailAndPassword(
        auth,
        email,
        password
      );
      const user = userCredential.user;

      // ✅ Check email verification first
      const verified = await checkEmailVerification(user);
      if (!verified) {
        setLoading(false);
        return;
      }

      const userDoc = await getDoc(doc(db, "Users", user.uid));
      if (!userDoc.exists()) {
        setAlert({
          message:
            "No user profile found. Please contact admin or sign up again.",
          type: "error",
        });
        await auth.signOut();
        setLoading(false);
        return;
      }

      await logUserAction(user, "Sign In");

      setAlert({ message: "User logged in successfully!", type: "success" });
      navigate("/home"); // ✅ Navigate only after all checks pass
    } catch (error) {
      console.error("Error during sign-in:", error);
      let errorMessage = "Failed to sign in. Please check your credentials.";

      switch (error.code) {
        case "auth/invalid-email":
          errorMessage = "The email address is invalid.";
          break;
        case "auth/user-not-found":
          errorMessage =
            "No account found with this email. Please sign up first.";
          break;
        case "auth/wrong-password":
          errorMessage = "Incorrect password. Please try again.";
          break;
        case "auth/too-many-requests":
          errorMessage = "Too many failed attempts. Please try again later.";
          break;
        case "auth/invalid-credential":
          errorMessage = "Invalid credentials. Please try signing in again.";
          break;
      }

      setAlert({ message: errorMessage, type: "error" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex flex-col min-h-screen relative">
      <div
        className="fixed inset-0 bg-cover bg-center"
        style={{
          backgroundImage: "url('/bg.jpg')",
          filter: "blur(2px)",
          zIndex: -1,
        }}
      ></div>
      <div className="flex-grow flex justify-center items-center">
        <form
          onSubmit={handleSubmit}
          className="max-w-md mx-auto px-6 sm:px-10 md:px-20 border-2 border-white pt-2 pb-6 bg-yellow-400 shadow-md rounded-lg mt-24 mb-10 relative"
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
                className="form-control w-full sm:w-72 p-2 pl-10 border text-black rounded-lg"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email" // Ensure this is set for autofill to work
                name="email" // Set the name attribute as 'email'
                id="email" // Optional: use an explicit id for the email input field
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
                className="form-control w-full sm:w-72 p-2 pl-10 border rounded-lg"
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
              className="btn btn-primary mt-2 bg-red-700 hover:bg-red-800 active:scale-95 active:bg-red-900 text-white p-2 rounded w-full sm:w-32"
              disabled={loading || !email || !password} // Disable if loading OR fields are empty
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
          <div className=" text-center mt-5 ">
            <Link
              to="/forgot-password"
              className="text-red-700 hover:text-red-800  active:text-red-950 underline"
            >
              Forgot Password?
            </Link>
          </div>
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
