import React, { useEffect, useState } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";
import { AuthProvider } from "./authcontext/AuthContext"; // Adjust path as needed
import Navbar from "./components/Navbar"; // Adjust path as needed
import Footer from "./components/Footer"; // Adjust path as needed
import Home from "./pages/Home"; // Adjust path as needed
import Announcement from "./components/Announcement"; // Adjust path as needed
import Profile from "./authcomponents/Profile"; // Adjust path as needed
import SignUp from "./authcomponents/SignUp"; // Adjust path as needed
import SignIn from "./authcomponents/SignIn"; // Adjust path as needed
import ForgotPassword from "./authcomponents/ForgotPassword";
import Journals from "./components/Journals"; // Adjust path as needed
import CallForPapers from "./components/CallForPapers"; // Adjust path as needed
import PubEthics from "./components/PubEthics"; // Adjust path as needed
import Guidelines from "./components/Guidelines"; // Adjust path as needed
import Unauthorized from "./pages/Unauthorized"; // Adjust path as needed
import UserManagement from "./pages/Admin/UserManagement"; // Adjust path as needed
import AdminCreation from "./components/AdminCreation"; // Adjust path as needed
import ProtectedRoute from "./authcontext/ProtectedRoute"; // Import ProtectedRoute
import AdminRoute from "./authcontext/AdminRoute"; // Import AdminRoute
import { getAuth, onAuthStateChanged } from "firebase/auth"; // Import getAuth and onAuthStateChanged from Firebase
import UserLog from "./pages/Admin/UserLog";
import NotFound from "./pages/NotFound"; // Adjust path as needed
import Manuscripts from "./components/Manuscripts";
import SubmitManuscript from "./pages/Researcher/SubmitManuscript";
import ManuscriptSubmissionFormBuilder from "./pages/Admin/ManuscriptSubmissionFormBuilder";
import { SortableItem } from "./pages/Admin/SortableItem";
function App() {
  const [loading, setLoading] = useState(true); // To track if auth state is being loaded
  const [user, setUser] = useState(null); // To store authenticated user
  const auth = getAuth(); // Get auth instance

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      auth,
      (currentUser) => {
        setUser(currentUser); // If user is authenticated, set the user
        setLoading(false); // Set loading to false once auth state is determined
      },
      (error) => {
        console.error("Error checking auth state:", error);
        setLoading(false); // Set loading to false on error
      }
    );

    return () => unsubscribe(); // Cleanup the listener on component unmount
  }, [auth]);

  if (loading) {
    return <p className="text-center">Loading...</p>; // Optionally add a loading spinner or message
  }

  const formId = ""; // Make sure formId is available

  return (
    <AuthProvider value={{ currentUser: user }}>
      <Router future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
        <Navbar user={user} onLogout={() => auth.signOut()} />
        <div className="App">
          <div className="auth-wrapper">
            <div className="auth-inner">
              <Routes>
                <Route path="/" element={<Navigate to="/home" />} />
                <Route path="/home" element={<Home />} />
                <Route path="/signup" element={<SignUp />} />
                <Route path="/signin" element={<SignIn />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/announcement" element={<Announcement />} />
                <Route path="/journals" element={<Journals />} />
                <Route path="/call-for-papers" element={<CallForPapers />} />
                <Route path="/pub-ethics" element={<PubEthics />} />
                <Route path="/guidelines" element={<Guidelines />} />
                <Route path="/unauthorized" element={<Unauthorized />} />
                <Route path="/manuscripts" element={<Manuscripts />} />
                <Route path="/sortable-item" element={<SortableItem />} />
                {/* Pass formId to RenderForm */}
                <Route
                  path="/submit-manuscript"
                  element={<SubmitManuscript />}
                />
                <Route path="*" element={<NotFound />} />
                <Route
                  path="/user-log"
                  element={
                    <AdminRoute>
                      <UserLog />
                    </AdminRoute>
                  }
                />
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
                    <AdminRoute>
                      <UserManagement />
                    </AdminRoute>
                  }
                />
                <Route
                  path="/manuscript-submission-form-builder"
                  element={
                    <AdminRoute>
                      <ManuscriptSubmissionFormBuilder />
                    </AdminRoute>
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
        <ConditionalFooter />
      </Router>
    </AuthProvider>
  );
}

// Separate component for conditional rendering of the footer
const ConditionalFooter = () => {
  const location = useLocation(); // Hook to get the current location
  const excludedRoutes = ["/user-management", "/user-log"]; // Routes without footer

  // Render Footer only if the current path is not in excludedRoutes
  if (!excludedRoutes.includes(location.pathname)) {
    return <Footer />;
  }
  return null; // Render nothing for excluded routes
};

export default App;
