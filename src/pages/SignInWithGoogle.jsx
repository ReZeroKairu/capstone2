import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { auth, db } from "../firebase/firebase";
import { setDoc, doc } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import googleLogo from "../assets/googlelogo.png"; // Assuming you have a Google logo in your assets
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
        // Store user details in Firestore
        await setDoc(doc(db, "Users", user.uid), {
          email: user.email,
          firstName: user.displayName,
          photo: user.photoURL,
          lastName: "",
        });

        // Redirect to the profile page
        navigate("/Profile");
      }
    } catch (error) {
      console.error("Error logging in with Google:", error.message);
    }
  }

  return (
    <div className="flex flex-col items-center">
      <p className="text-gray-600 mb-4">or</p>

      <button
        onClick={googleLogin}
        className="flex items-center justify-center gap-2 bg-white text-gray-700 border border-gray-300 px-4 py-2 rounded shadow hover:bg-gray-100 transition-all duration-200"
      >
        <img src={googleLogo} alt="Google Logo" className="w-6 h-6" />
        <span className="font-semibold">Sign in with Google</span>
      </button>
    </div>
  );
}

export default SignInwithGoogle;
