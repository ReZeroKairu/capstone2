import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { auth, db } from "../firebase/firebase";
import { setDoc, doc, getDoc } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import React from "react";

// 🔹 Import centralized logger
import { logUserAction } from "../utils/logger";

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

        // 🔹 Log successful Google sign-in
        await logUserAction({
          actingUserId: adminId || userId,
          actingUserIsAdmin: !!adminId,
          email: user.email,
          action: "Signed in with Google",
        });

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

          // 🔹 Log new user signup
          await logUserAction({
            actingUserId: userId,
            actingUserIsAdmin: false,
            email: user.email,
            action: "Signed up with Google",
          });

          console.log(`New user signed up: User ID: ${userId}`);
        } catch (error) {
          console.error("Error saving document to Firestore:", error);
        }

        navigate("/home");
      }
    } catch (error) {
      console.error("Error logging in with Google:", error.message);

      // 🔹 Optional: log failed Google sign-in attempt
      await logUserAction({
        actingUserId: null,
        email: null,
        action: "Google Sign-In Failed",
        metadata: { errorMessage: error.message },
      });
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
