import React, { useEffect, useState } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom"; // Don't forget to import useLocation
import { AuthProvider } from "./authcontext/AuthContext"; // Adjust path as needed
import Navbar from "./components/Navbar"; // Adjust path as needed
import Footer from "./components/Footer"; // Adjust path as needed
import Home from "./pages/Home"; // Adjust path as needed
import Profile from "./authcomponents/Profile"; // Adjust path as needed
import SignUp from "./authcomponents/SignUp"; // Adjust path as needed
import SignIn from "./authcomponents/SignIn"; // Adjust path as needed
import Journals from "./pages/Journals"; // Adjust path as needed
import CallForPapers from "./pages/CallForPapers"; // Adjust path as needed
import PubEthics from "./pages/PubEthics"; // Adjust path as needed
import Guidelines from "./pages/Guidelines"; // Adjust path as needed
import Unauthorized from "./pages/Unauthorized"; // Adjust path as needed
import UserManagement from "./pages/Admin/UserManagement"; // Adjust path as needed
import AdminCreation from "./components/AdminCreation"; // Adjust path as needed
import ProtectedRoute from "./authcontext/ProtectedRoute"; // Import ProtectedRoute
import { getAuth, onAuthStateChanged } from "firebase/auth"; // Import getAuth and onAuthStateChanged from Firebase
import AdminSidebar from "./components/sidebar/AdminSidebar";
import ReviewerSidebar from "./components/sidebar/ReviewerSidebar";
import ResearcherSidebar from "./components/sidebar/ResearcherSidebar";
function App() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const auth = getAuth(); // Get auth instance

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      auth,
      (currentUser) => {
        setUser(currentUser);
        setLoading(false); // Set loading to false once auth state is determined
      },
      (error) => {
        console.error("Error checking auth state:", error);
        setLoading(false); // Set loading to false on error
      }
    );

    return () => unsubscribe();
  }, [auth]);

  if (loading) {
    return <p className="text-center">Loading...</p>; // Optionally add a loading spinner or message
  }

  return (
    <AuthProvider value={{ currentUser: user }}>
      {/* Pass user to AuthProvider */}
      <Router>
        {/* Make sure Navbar is rendered */}
        <Navbar user={user} onLogout={() => auth.signOut()} />{" "}
        {/* Pass the current user to Navbar */}
        <div className="App">
          <div className="auth-wrapper">
            <div className="auth-inner">
              <Routes>
                <Route path="/" element={<Navigate to="/home" />} />
                <Route path="/home" element={<Home />} />
                <Route path="/adminsidebar" element={<AdminSidebar />} />
                <Route
                  path="/researchersidebar"
                  element={<ResearcherSidebar />}
                />
                <Route path="/reviewersidebar" element={<ReviewerSidebar />} />
                <Route path="/signup" element={<SignUp />} />
                <Route path="/signin" element={<SignIn />} />
                <Route path="/journals" element={<Journals />} />
                <Route path="/call-for-papers" element={<CallForPapers />} />
                <Route path="/pub-ethics" element={<PubEthics />} />
                <Route path="/guidelines" element={<Guidelines />} />
                <Route path="/unauthorized" element={<Unauthorized />} />
                <Route
                  path="/profile"
                  element={
                    <ProtectedRoute>
                      <Profile />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/user-management"
                  element={
                    <ProtectedRoute>
                      <UserManagement />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/create-admin"
                  element={
                    <ProtectedRoute>
                      <AdminCreation />
                    </ProtectedRoute>
                  }
                />
              </Routes>
            </div>
          </div>
        </div>
      </Router>
    </AuthProvider>
  );
}

function FooterWrapper() {
  const location = useLocation(); // Get current location (route)
  const shouldRenderFooter = location.pathname !== "/user-management"; // Exclude Footer on /user-management

  return shouldRenderFooter ? <Footer /> : null; // Render Footer if not on /user-management
}

export default App;
