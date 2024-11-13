import React, { useContext } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { AuthContext } from "../authcontext/AuthContext"; // Adjust path as needed
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase/firebase"; // Adjust path to your Firebase config file

const AdminRoute = ({ children }) => {
  const { currentUser } = useContext(AuthContext);
  const location = useLocation();
  const [authState, setAuthState] = React.useState({
    isAdmin: null,
    loading: true,
  });

  React.useEffect(() => {
    if (!currentUser) {
      setAuthState({ isAdmin: false, loading: false });
      return;
    }

    const checkAdmin = async () => {
      try {
        const userDoc = await getDoc(doc(db, "Users", currentUser.uid));
        if (userDoc.exists() && userDoc.data().role === "admin") {
          setAuthState({ isAdmin: true, loading: false });
        } else {
          setAuthState({ isAdmin: false, loading: false });
        }
      } catch (error) {
        console.error("Error checking admin role:", error);
        setAuthState({ isAdmin: false, loading: false });
      }
    };

    checkAdmin();
  }, [currentUser]);

  // Show loading message while checking user role
  if (authState.loading) {
    return <p className="text-center">Loading...</p>;
  }

  // If the user is not an admin, redirect to the unauthorized page
  if (!currentUser || !authState.isAdmin) {
    return <Navigate to="/unauthorized" state={{ from: location }} replace />;
  }

  // Render children if the user is an admin
  return children;
};

export default AdminRoute;
