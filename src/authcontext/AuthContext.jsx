import React, { createContext, useContext, useEffect, useState } from "react";
import { getAuth, onAuthStateChanged } from "firebase/auth";

// Create AuthContext
export const AuthContext = createContext();

// AuthProvider component
export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const auth = getAuth();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      auth,
      (user) => {
        setCurrentUser(user);
        setLoading(false);
      },
      (error) => {
        console.error("Error checking authentication state:", error); // Handle any errors
        setLoading(false); // Stop loading even if there's an error
      }
    );

    return () => unsubscribe(); // Cleanup subscription on unmount
  }, [auth]);

  // Include email verification status
  const value = {
    currentUser,
    loading,
    emailVerified: currentUser?.emailVerified || false,
  };

  // Render loading indicator if loading, else render children
  return (
    <AuthContext.Provider value={value}>
      {loading ? <div>Loading...</div> : children}
    </AuthContext.Provider>
  );
};

// Custom hook to use AuthContext
export const useAuth = () => {
  return useContext(AuthContext);
};
