import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../authcontext/AuthContext";

const ProtectedRoute = ({
  children,
  requireVerification = true,
  allowedRoles = [], // Array of allowed roles
}) => {
  const { currentUser, role, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <p>Loading...</p>
      </div>
    );
  }

  if (!currentUser) {
    return <Navigate to="/signin" replace />;
  }

  if (requireVerification && !currentUser.emailVerified) {
    return <Navigate to="/unauthorized" replace />;
  }

  if (allowedRoles.length > 0 && !allowedRoles.includes(role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return children;
};

export default ProtectedRoute;
