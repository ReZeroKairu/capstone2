import React, { useEffect, useState } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";
import { AuthProvider } from "./authcontext/AuthContext";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import Home from "./pages/Home";
import Announcement from "./components/Announcement";
import Profile from "./authcomponents/Profile";
import SignUp from "./authcomponents/SignUp";
import SignIn from "./authcomponents/SignIn";
import ForgotPassword from "./authcomponents/ForgotPassword";
import Journals from "./components/Journals";
import CallForPapers from "./components/CallForPapers";
import PubEthics from "./components/PubEthics";
import Guidelines from "./components/Guidelines";
import Unauthorized from "./pages/Unauthorized";
import UserManagement from "./pages/Admin/UserManagement";
import AdminCreation from "./components/AdminCreation";
import ProtectedRoute from "./authcontext/ProtectedRoute";
import AdminRoute from "./authcontext/AdminRoute";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import UserLog from "./pages/Admin/UserLog";
import NotFound from "./pages/NotFound";
import Manuscripts from "./components/Manuscripts";
import SubmitManuscript from "./pages/Researcher/SubmitManuscript";
import DynamicForm from "./formcomponents/DynamicForm";
import CreateForm from "./formcomponents/CreateForm";
import AnswerForm from "./formcomponents/AnswerForm";
import FormResponses from "./formcomponents/FormResponses";
import Submissions from "./components/Submissions";
import { SortableItem } from "./pages/Admin/SortableItem";

function App() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const auth = getAuth();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      auth,
      (currentUser) => {
        setUser(currentUser);
        setLoading(false);
      },
      (error) => {
        console.error("Error checking auth state:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [auth]);

  if (loading) {
    return <p className="text-center">Loading...</p>;
  }

  return (
    <AuthProvider value={{ currentUser: user }}>
      <Router future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
        {/* Top-level flex container */}
        <div className="flex flex-col min-h-screen">
          <Navbar user={user} onLogout={() => auth.signOut()} />

          {/* Main content fills remaining space */}
          <div className="flex-1">
            <div className="App">
              <div className="auth-wrapper">
                <div className="auth-inner">
                  <Routes>
                    <Route path="/" element={<Navigate to="/home" />} />
                    <Route path="/home" element={<Home />} />
                    <Route path="/signup" element={<SignUp />} />
                    <Route path="/signin" element={<SignIn />} />
                    <Route
                      path="/forgot-password"
                      element={<ForgotPassword />}
                    />
                    <Route path="/announcement" element={<Announcement />} />
                    <Route path="/journals" element={<Journals />} />
                    <Route
                      path="/call-for-papers"
                      element={<CallForPapers />}
                    />
                    <Route path="/pub-ethics" element={<PubEthics />} />
                    <Route path="/guidelines" element={<Guidelines />} />
                    <Route path="/unauthorized" element={<Unauthorized />} />
                    <Route path="/manuscripts" element={<Manuscripts />} />
                    <Route path="/dynamicform" element={<DynamicForm />} />
                    <Route path="/createform" element={<CreateForm />} />
                    <Route path="/answerform" element={<AnswerForm />} />
                    <Route path="/formresponses" element={<FormResponses />} />
                    <Route path="/submissions" element={<Submissions />} />
                    <Route path="/sortable-item" element={<SortableItem />} />
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
          </div>

          {/* Footer always at bottom */}
          <ConditionalFooter />
        </div>
      </Router>
    </AuthProvider>
  );
}

// Footer component
const ConditionalFooter = () => {
  const location = useLocation();
  const excludedRoutes = ["/user-management", "/user-log"];
  if (!excludedRoutes.includes(location.pathname)) {
    return <Footer />;
  }
  return null;
};

export default App;
