import React, { useEffect, useState } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { AuthProvider } from "./authcontext/AuthContext"; // Adjust path as needed
import Navbar from "./components/Navbar"; // Adjust path as needed
import Footer from "./components/Footer"; // Adjust path as needed
import Home from "./pages/Home"; // Adjust path as needed
import Profile from "./pages/Profile"; // Adjust path as needed
import SignUp from "./pages/SignUp"; // Adjust path as needed
import SignIn from "./pages/SignIn"; // Adjust path as needed
import Journals from "./pages/Journals"; // Adjust path as needed
import CallForPapers from "./pages/CallForPapers"; // Adjust path as needed
import PubEthics from "./pages/PubEthics"; // Adjust path as needed
import Guidelines from "./pages/Guidelines"; // Adjust path as needed
import Unauthorized from "./pages/Unauthorized"; // Adjust path as needed
import UserManagement from "./pages/Admin/UserManagement"; // Adjust path as needed
import { getAuth, onAuthStateChanged } from "firebase/auth"; // Import getAuth and onAuthStateChanged from Firebase
import AdminCreation from "./components/AdminCreation";

function App() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const auth = getAuth(); // Get auth instance

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false); // Set loading to false once auth state is determined
    });

    return () => unsubscribe();
  }, [auth]);

  if (loading) {
    return <p className="text-center">Loading...</p>; // Optionally add a loading spinner or message
  }

  return (
    <AuthProvider>
      <Router>
        <Navbar user={user} onLogout={() => auth.signOut()} />{" "}
        {/* Pass the current user to Navbar */}
        <div className="App">
          <div className="auth-wrapper">
            <div className="auth-inner">
              <Routes>
                {/* Home is accessible to everyone */}
                <Route path="/" element={<Navigate to="/home" />} />
                <Route path="/home" element={<Home />} />
                <Route
                  path="/profile"
                  element={user ? <Profile /> : <Navigate to="/signin" />}
                />
                <Route path="/signup" element={<SignUp />} />
                <Route path="/signin" element={<SignIn />} />
                <Route path="/journals" element={<Journals />} />
                <Route path="/call-for-papers" element={<CallForPapers />} />
                <Route path="/pub-ethics" element={<PubEthics />} />
                <Route path="/guidelines" element={<Guidelines />} />
                <Route path="/unauthorized" element={<Unauthorized />} />
                <Route path="/user-management" element={<UserManagement />} />
                <Route path="/create-admin" element={<AdminCreation />} />
              </Routes>
              <Footer /> {/* Add the Footer here */}
            </div>
          </div>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;
