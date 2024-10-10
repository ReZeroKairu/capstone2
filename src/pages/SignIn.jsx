import { signInWithEmailAndPassword } from "firebase/auth";
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { auth } from "../firebase/firebase";
import SignInwithGoogle from "../pages/SignInWithGoogle";

function SignIn() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [alert, setAlert] = useState({ message: "", type: "" }); // Alert state
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await signInWithEmailAndPassword(auth, email, password);
      console.log("User logged in Successfully");

      // Show success alert
      setAlert({ message: "User logged in successfully!", type: "success" });

      // Navigate to profile page
      navigate("/Profile");

      // Hide the alert after 3 seconds
      setTimeout(() => setAlert({ message: "", type: "" }), 3000);
    } catch (error) {
      console.log(error.message);

      // Show error alert
      setAlert({ message: error.message, type: "error" });

      // Hide the alert after 3 seconds
      setTimeout(() => setAlert({ message: "", type: "" }), 3000);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="max-w-md mx-auto p-6 bg-white shadow-md rounded-lg mt-10">
        <h3 className="text-2xl font-semibold mb-6 text-center">Sign In</h3>

        {/* Alert Messages */}
        {alert.message && (
          <div
            className={`mb-4 p-2 rounded text-white ${
              alert.type === "success" ? "bg-green-500" : "bg-red-500"
            }`}
          >
            {alert.message}
          </div>
        )}

        <div className="mb-3">
          <label className="block mb-2">Email address</label>
          <input
            type="email"
            className="form-control w-full p-2 border border-gray-300 rounded"
            placeholder="Enter email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div className="mb-3">
          <label className="block mb-2">Password</label>
          <input
            type="password"
            className="form-control w-full p-2 border border-gray-300 rounded"
            placeholder="Enter password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        <div className="d-grid">
          <button
            type="submit"
            className="btn btn-primary bg-blue-500 text-white p-2 rounded w-full"
          >
            Submit
          </button>
        </div>
        <p className="forgot-password text-center mt-3 mb-3">
          New user?{" "}
          <a href="/SignUp" className="text-blue-500">
            Sign Up
          </a>
        </p>
        <SignInwithGoogle />
      </div>
    </form>
  );
}

export default SignIn;
