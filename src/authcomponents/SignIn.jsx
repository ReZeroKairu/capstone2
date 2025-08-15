import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../authcontext/AuthContext";
import SignInwithGoogle from "./SignInWithGoogle";

function SignIn() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [alert, setAlert] = useState({ message: "", type: "" });
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { login, currentUser, emailVerified } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setAlert({ message: "", type: "" });
    setLoading(true);

    try {
      const user = await login(email, password);

      if (!user.emailVerified) {
        setAlert({
          message: "Please verify your email before logging in.",
          type: "error",
        });
        return;
      }

      setAlert({ message: "Logged in successfully!", type: "success" });
      navigate("/home");
    } catch (error) {
      console.error(error);
      setAlert({
        message: "Failed to sign in. Check your credentials.",
        type: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  if (currentUser && emailVerified) {
    navigate("/home");
    return null;
  }

  return (
    <div className="min-h-screen flex flex-col justify-center items-center">
      <form
        onSubmit={handleSubmit}
        className="max-w-md w-full p-6 bg-yellow-400 rounded-lg shadow-md"
      >
        <h2 className="text-center text-2xl mb-4 font-bold">Sign In</h2>

        {alert.message && (
          <div
            className={`mb-3 p-2 text-center rounded text-white ${
              alert.type === "success" ? "bg-green-500" : "bg-red-500"
            }`}
          >
            {alert.message}
          </div>
        )}

        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full mb-3 p-2 rounded border"
          required
        />
        <div className="relative">
          <input
            type={showPassword ? "text" : "password"}
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full mb-3 p-2 rounded border"
            required
          />
          <span
            className="absolute right-2 top-2 cursor-pointer"
            onClick={() => setShowPassword(!showPassword)}
          >
            {showPassword ? "🙈" : "👁️"}
          </span>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-red-700 hover:bg-red-800 text-white p-2 rounded"
        >
          {loading ? "Signing In..." : "Sign In"}
        </button>

        <p className="mt-3 text-center">
          New user?{" "}
          <Link to="/SignUp" className="text-red-700 underline">
            Sign Up
          </Link>
        </p>

        <SignInwithGoogle />
        <p className="mt-2 text-center">
          <Link to="/forgot-password" className="text-red-700 underline">
            Forgot Password?
          </Link>
        </p>
      </form>
    </div>
  );
}

export default SignIn;
