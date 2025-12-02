import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useMemo,
} from "react";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendEmailVerification,
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../firebase/firebase";

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);

  // Fetch user role from Firestore
  const fetchUserRole = async (uid) => {
    try {
      const userDoc = await getDoc(doc(db, "Users", uid));
      if (userDoc.exists()) {
        return userDoc.data().role || "Researcher";
      }
      return "Researcher"; // Default role if user doesn't exist
    } catch (error) {
      console.error("Error fetching user role:", error);
      return "Researcher"; // Default role if there's an error
    }
  };

  // Handle auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      auth,
      async (user) => {
        setCurrentUser(user);
        
        if (user) {
          const userRole = await fetchUserRole(user.uid);
          setRole(userRole);
        } else {
          setRole(null);
        }
        
        setLoading(false);
      },
      (error) => {
        console.error("Auth state error:", error);
        setRole("Researcher");
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // Login with email and password
  const login = async (email, password) => {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      if (!user.emailVerified) {
        await signOut(auth);
        throw new Error("Please verify your email before signing in.");
      }
      
      const userRole = await fetchUserRole(user.uid);
      setRole(userRole);
      return user;
    } catch (error) {
      console.error("Login error:", error);
      throw error;
    }
  };

  // Register new user
  const register = async (email, password) => {
    const userCredential = await createUserWithEmailAndPassword(
      auth,
      email,
      password
    );
    await sendEmailVerification(userCredential.user);
    await signOut(auth); // Prevent auto-login until email is verified
    return userCredential.user;
  };

  // Logout user
  const logout = async () => {
    await signOut(auth);
    setCurrentUser(null);
    setRole(null);
  };

  // Context value
  const value = useMemo(
    () => ({
      currentUser,
      role,
      loading,
      emailVerified: currentUser?.emailVerified || false,
      login,
      register,
      logout,
    }),
    [currentUser, role, loading]
  );

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <p className="text-xl font-semibold">Loading...</p>
      </div>
    );
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);