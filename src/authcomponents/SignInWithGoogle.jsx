import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { auth, db } from "../firebase/firebase";
import { setDoc, doc, getDoc } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import React from "react";

import { UserLogService } from "../utils/userLogService";

function SignInwithGoogle() {
  const navigate = useNavigate();

  async function googleLogin() {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });

    try {
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      if (!user) return;

      const userDocRef = doc(db, "Users", user.uid);
      const userDoc = await getDoc(userDocRef);

      const userId = user.uid;
      let adminId = null;

      if (userDoc.exists()) {
        const userData = userDoc.data();
        if (userData.role === "Admin") {
          adminId = userId;
        }

        // Log successful Google sign-in with email in metadata
        await UserLogService.logUserActivity(
          userId,
          "User Signed In",
          `User signed in via google`,
          {
            loginMethod: "google",
            actionType: "authentication",
            email: user.email, // Ensure email is included in metadata
          },
          user.email // Pass email as separate parameter as well
        );

        // Log admin status separately if needed
        if (adminId) {
          await UserLogService.logSecurityEvent(
            userId,
            "admin_login",
            "Admin user logged in via Google",
            "info"
          );
        }

        console.log(
          adminId
            ? `Admin signed in: User ID: ${userId}, Admin ID: ${adminId}`
            : `User signed in: User ID: ${userId}`
        );

        navigate("/home");
      } else {
        // New user signup
        try {
          await setDoc(userDocRef, {
            uid: userId,
            email: user.email,
            firstName: user.displayName || "",
            lastName: "",
            photo: user.photoURL ?? "https://via.placeholder.com/150",
            role: "Researcher",
          });

          console.log("User document successfully created.");

          // Log new user registration
          await UserLogService.logRegistration(userId, "google");

          // Log successful login for new user
          await UserLogService.logUserLogin(userId, user.email, "google");

          console.log(`New user signed up: User ID: ${userId}`);
        } catch (error) {
          console.error("Error saving document to Firestore:", error);
        }

        navigate("/home");
      }
    } catch (error) {
      console.error("Error logging in with Google:", error.message);

      // Log failed Google sign-in attempt
      const emailFromError = error?.customData?.email || "Unknown";
      await UserLogService.logLoginFailure(
        emailFromError,
        error.message || "Unknown error during Google sign-in",
        "google"
      );

      // Log security event for failed login
      await UserLogService.logSecurityEvent(
        "anonymous",
        "google_login_failed",
        `Failed Google sign-in attempt for ${emailFromError}: ${error.message}`,
        "warning"
      );
    }
  }

  return (
    <div className="flex flex-col items-center">
      <p className="text-black mb-2">or</p>
      <button
        onClick={googleLogin}
        className="flex items-center justify-center gap-2 bg-white px-4 py-2 rounded shadow hover:bg-red-800 active:bg-red-900 transition-all duration-200"
      >
        <img src={`/googlelogo.png`} alt="Google Logo" className="w-6 h-6" />
        <span className="font-semibold">Sign in with Google</span>
      </button>
    </div>
  );
}

export default SignInwithGoogle;
