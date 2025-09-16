import React, { useContext } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { AuthContext } from "../authcontext/AuthContext"; // Adjust path as needed

const AdminRoute = ({ children }) => {
  const { currentUser, role, loading } = useContext(AuthContext);
  const location = useLocation();

  // Show loading while auth context is determining user state
  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <p>Loading...</p>
      </div>
    );
  }

  // Redirect if not logged in or not admin
  if (!currentUser || role !== "Admin") {
    return <Navigate to="/unauthorized" state={{ from: location }} replace />;
  }

  // Render children if user is admin
  return children;
};

export default AdminRoute;
