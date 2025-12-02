import { signInWithEmailAndPassword } from "firebase/auth";
import React, { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { auth, db } from "../firebase/firebase";
import { doc, getDoc } from "firebase/firestore";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faLock,
  faEye,
  faEyeSlash,
  faEnvelope,
} from "@fortawesome/free-solid-svg-icons";
import SignInwithGoogle from "./SignInWithGoogle";
import { UserLogService } from "../utils/userLogService";
import { logUserAction } from "../utils/logger";

function SignIn() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [alert, setAlert] = useState({ message: "", type: "" });
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isAppReady, setIsAppReady] = useState(false);

  const togglePasswordVisibility = () => setShowPassword((prev) => !prev);

  const checkEmailVerification = async (user) => {
    try {
      await user.reload();
      if (!user.emailVerified) {
        setAlert({
          message:
            "Your email is not verified. Please check your inbox or spam folder.",
          type: "error",
        });
        await auth.signOut();

        // ✅ log failed login attempt
        await logUserAction({
          actingUserId: user.uid,
          email: user.email,
          action: "Sign In Blocked (Unverified Email)",
        });

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

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) navigate("/home", { replace: true });
      else setIsAppReady(true);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [navigate]);

  if (!isAppReady) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <span>Checking authentication...</span>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <span>Loading...</span>
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

        // ✅ log failed login (no profile)
        await logUserAction({
          actingUserId: user.uid,
          email: user.email,
          action: "Sign In Blocked (No Profile)",
        });

        await auth.signOut();
        setLoading(false);
        return;
      }

      // Log successful login with detailed information
      await UserLogService.logUserLogin(user.uid, user.email, "email");

      setAlert({ message: "User logged in successfully!", type: "success" });
      navigate("/home");
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

      // Log failed login attempt
      await UserLogService.logLoginFailure(email, error);
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

          {/* Alerts */}
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

          {/* Email */}
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
                autoComplete="email"
                name="email"
                id="email"
                required
              />
            </div>
          </div>

          {/* Password */}
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

          {/* Submit */}
          <div className="flex justify-center">
            <button
              type="submit"
              className="btn btn-primary mt-2 bg-red-700 hover:bg-red-800 active:scale-95 active:bg-red-900 text-white p-2 rounded w-full sm:w-32"
              disabled={loading || !email || !password}
            >
              {loading ? "Signing In..." : "Sign In"}
            </button>
          </div>

          {/* Links */}
          <p className="forgot-password text-center mt-4">
            New user?{" "}
            <Link
              to="/SignUp"
              className="text-red-700 hover:text-red-800 active:text-red-950 underline"
            >
              Sign Up
            </Link>
          </p>
          <SignInwithGoogle />
          <div className="text-center mt-5">
            <Link
              to="/forgot-password"
              className="text-red-700 hover:text-red-800 active:text-red-950 underline"
            >
              Forgot Password?
            </Link>
          </div>
        </form>

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
