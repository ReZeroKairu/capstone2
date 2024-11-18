import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { auth, db } from "../firebase/firebase";
import {
  setDoc,
  doc,
  getDoc,
  collection,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";
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

      console.log("User photo URL:", user.photoURL); // Log photo URL for debugging

      if (user) {
        // Check if user already exists in Firestore
        const userDocRef = doc(db, "Users", user.uid);
        const userDoc = await getDoc(userDocRef);

        if (userDoc.exists()) {
          // User already exists, navigate to Home
          console.log("User already exists. Logging sign-in event...");
          await addDoc(collection(db, "UserLog"), {
            uid: user.uid,
            email: user.email,
            action: "Signed in with Google",
            timestamp: serverTimestamp(),
          });
          console.log("Log entry added to UserLog collection.");
          navigate("/home");
        } else {
          // New user, store user details in Firestore
          console.log(
            "New user detected. Creating document and logging event..."
          );
          try {
            await setDoc(userDocRef, {
              uid: user.uid,
              email: user.email,
              firstName: user.displayName,
              lastName: "",
              photo: user.photoURL ?? "https://via.placeholder.com/150",
              role: "Researcher",
            });
            console.log("User document successfully created.");

            // Log sign-up event
            await addDoc(collection(db, "UserLog"), {
              uid: user.uid,
              email: user.email,
              action: "Signed up with Google",
              timestamp: serverTimestamp(),
            });
            console.log("Sign-up event logged in UserLog collection.");
          } catch (error) {
            console.error("Error saving document to Firestore:", error);
          }

          navigate("/home");
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
        className="flex items-center justify-center gap-2 bg-white px-4 py-2 rounded shadow hover:bg-red-800 active:bg-red-900 transition-all duration-200"
      >
        <img src={`/googlelogo.png`} alt="Google Logo" className="w-6 h-6" />
        <span className="font-semibold">Sign in with Google</span>
      </button>
    </div>
  );
}

export default SignInwithGoogle;
