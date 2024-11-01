import {
  GoogleAuthProvider,
  signInWithPopup,
  EmailAuthProvider,
  linkWithCredential,
} from "firebase/auth";
import { auth, db } from "../firebase/firebase";
import { setDoc, doc, getDoc } from "firebase/firestore"; // Import getDoc to check if the user exists
import { useNavigate } from "react-router-dom";
import React from "react";

function SignInwithGoogle() {
  const navigate = useNavigate(); // Using navigate for redirect

  async function googleLogin() {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({
      prompt: "select_account", // Forces the account selection dialog
    });

    try {
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      if (user) {
        // Check if user already exists in Firestore
        const userDoc = await getDoc(doc(db, "Users", user.uid));

        if (userDoc.exists()) {
          // User already exists, navigate to Home
          navigate("/Home");
        } else {
          // New user, store user details in Firestore
          await setDoc(doc(db, "Users", user.uid), {
            uid: user.uid,
            email: user.email,
            firstName: user.displayName,
            photo: user.photoURL,
            lastName: "",
            // Reminder: make this updatable in the update user page
            role: "",
          });

          navigate("/Home");
        }
      }
    } catch (error) {
      console.error("Error logging in with Google:", error.message);
    }
  }

  return (
    <div className="flex flex-col items-center">
      <p className="text-black mb-2">or</p>

      <button
        onClick={googleLogin}
        className="flex items-center justify-center gap-2 bg-white  px-4 py-2 rounded shadow hover:bg-red-800 active:bg-red-900 transition-all duration-200"
      >
        <img src={`/googlelogo.png`} alt="Google Logo" className="w-6 h-6" />
        <span className="font-semibold">Sign in with Google</span>
      </button>
    </div>
  );
}

export default SignInwithGoogle;
