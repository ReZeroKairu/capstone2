import React, { useEffect, useState, useRef } from "react";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { auth, db } from "../firebase/firebase";
import { setDoc, doc } from "firebase/firestore";
import bg from "../assets/bg.jpg";
import { useNavigate } from "react-router-dom";
import pubtrackicon2 from "../assets/pubtrackicon2.png";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faEye, faEyeSlash } from "@fortawesome/free-solid-svg-icons";

function SignUp() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const navigate = useNavigate();

  // Create ref for error message
  const errorRef = useRef(null);

  useEffect(() => {
    if (errorMessage) {
      errorRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [errorMessage]);

  const handleRegister = async (e) => {
    e.preventDefault();

    setErrorMessage("");
    setSuccessMessage("");

    if (!firstName || !lastName || !email || !password || !confirmPassword) {
      setErrorMessage("Please fill out all fields");
      return;
    }
    if (password.length < 6) {
      // Check for minimum password length
      setErrorMessage("Password must be at least 6 characters long!");
      return;
    }
    if (password !== confirmPassword) {
      setErrorMessage("Passwords do not match!");
      return;
    }

    setLoading(true);

    try {
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );
      const user = userCredential.user;

      await setDoc(doc(db, "Users", user.uid), {
        uid: user.uid,
        firstName: firstName,
        lastName: lastName,
        email: user.email,
        role: "Researcher",
      });

      setSuccessMessage("User registered successfully!");
      setTimeout(() => {
        navigate("/Home");
      }, 1000);
    } catch (error) {
      // Check for specific error codes
      if (error.code === "auth/email-already-in-use") {
        setErrorMessage("Email already registered.");
      } else {
        setErrorMessage("Failed to register user.");
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
          backgroundImage: `url(${bg})`,
          filter: "blur(2px)",
          zIndex: -1,
        }}
      ></div>
      <div className="min-h-screen flex flex-col justify-center items-center">
        <form
          onSubmit={handleRegister}
          className="max-w-md mx-auto border-2 border-white px-20 mt-32 mb-20 pt-4 pb-6 bg-yellow-400 rounded-lg space-y-4"
        >
          <img src={pubtrackicon2} alt="Logo" className="h-20 w-auto mx-auto" />

          {/* Error Message Section */}
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

          <div className="mb-3">
            <label>First Name:</label>
            <input
              type="text"
              className="w-full mt-1 p-2 border text-black rounded-lg focus:ring-blue-500 focus:border-blue-500"
              placeholder="Enter your first name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Last Name:
            </label>
            <input
              type="text"
              className="w-full mt-1 p-2 border text-black rounded-lg focus:ring-blue-500 focus:border-blue-500"
              placeholder="Enter your last name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Email address
            </label>
            <input
              type="email"
              className="w-full mt-1 p-2 border text-black rounded-lg focus:ring-blue-500 focus:border-blue-500"
              placeholder="Enter email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="relative">
            <label className="block text-sm font-medium text-black">
              Password
            </label>
            <input
              type={showPassword ? "text" : "password"}
              className="w-full mt-1 p-2 border text-black rounded-lg focus:ring-blue-500 focus:border-blue-500"
              placeholder="Enter password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <span
              className="absolute inset-y-0 right-0 pr-3 mt-6 flex items-center cursor-pointer"
              onClick={() => setShowPassword(!showPassword)}
            >
              <FontAwesomeIcon
                icon={showPassword ? faEyeSlash : faEye}
                className="text-red-800"
              />
            </span>
          </div>

          <div className="relative">
            <label className="block text-sm font-medium text-black">
              Confirm Password
            </label>
            <input
              type={showConfirmPassword ? "text" : "password"}
              className="w-full mt-1 p-2 border text-black rounded-lg focus:ring-blue-500 focus:border-blue-500"
              placeholder="Confirm password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
            <span
              className="absolute inset-y-0 right-0 pr-3 mt-6 flex items-center cursor-pointer"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
            >
              <FontAwesomeIcon
                icon={showConfirmPassword ? faEyeSlash : faEye}
                className="text-red-800"
              />
            </span>
          </div>

          <div className="flex justify-center">
            <button
              type="submit"
              className={`w-full mt-2 bg-red-700 hover:bg-red-800 active:scale-95 active:bg-red-900 text-white p-2 rounded-lg ${
                loading ? "opacity-70" : ""
              }`}
              disabled={loading}
            >
              {loading ? "Signing Up..." : "Sign Up"}
            </button>
          </div>

          <div className="mt-6 text-center">
            <p>Already have an account?</p>
            <a
              href="/SignIn"
              className="text-red-700 hover:text-red-800 active:text-red-950 hover:underline"
            >
              Sign In
            </a>
          </div>
        </form>
      </div>
    </div>
  );
}

export default SignUp;
