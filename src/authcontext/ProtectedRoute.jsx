import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../authcontext/AuthContext"; // Adjust the path based on your project structure

const ProtectedRoute = ({ children, requireVerification = true }) => {
  const { currentUser, loading } = useAuth();

  // Show loading state while determining authentication status
  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <p>Loading...</p> {/* Replace with a spinner or loading indicator */}
      </div>
    );
  }

  // Redirect to sign-in if not authenticated
  if (!currentUser) {
    return <Navigate to="/signin" replace />;
  }

  // Check email verification only if required
  if (requireVerification && !currentUser.emailVerified) {
    return <Navigate to="/unauthorized" replace />; // Redirect to unauthorized if email is not verified
  }

  return children; // Render the protected children if authenticated (and email verified if required)
};

export default ProtectedRoute;
