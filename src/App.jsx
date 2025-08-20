import React, { useEffect, useState } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { getFirestore, doc, getDoc } from "firebase/firestore";

import { AuthProvider } from "./authcontext/AuthContext";
import ProtectedRoute from "./authcontext/ProtectedRoute";
import AdminRoute from "./authcontext/AdminRoute";

import Navbar from "./components/Navbar";
import Sidebar from "./components/Sidebar";
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
import UserLog from "./pages/Admin/UserLog";
import NotFound from "./pages/NotFound";
import Manuscripts from "./components/Manuscripts";
import SubmitManuscript from "./pages/Researcher/SubmitManuscript";
import CreateForm from "./formcomponents/CreateForm";

import FormResponses from "./formcomponents/FormResponses";
import Dashboard from "./components/Dashboard";
import Submissions from "./components/Submissions";

function App() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const auth = getAuth();
  const db = getFirestore();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        const userRef = doc(db, "Users", currentUser.uid);
        const docSnap = await getDoc(userRef);
        if (docSnap.exists()) {
          setRole(docSnap.data().role);
        }
      } else {
        setUser(null);
        setRole(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [auth, db]);

  if (loading)
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-blue-600"></div>
      </div>
    );

  return (
    <AuthProvider value={{ user, role }}>
      <Router>
        <div className="flex min-h-screen">
          {/* Sidebar */}
          {user && (
            <Sidebar
              role={role}
              isOpen={sidebarOpen}
              toggleSidebar={() => setSidebarOpen(!sidebarOpen)}
            />
          )}

          {/* Main content */}
          <div
            className={`flex-1 flex flex-col transition-all duration-300 ease-in-out relative ${
              user && sidebarOpen ? "md:ml-64" : ""
            }`}
          >
            {/* Navbar */}
            <Navbar
              user={user}
              onLogout={() => auth.signOut()}
              isSidebarOpen={sidebarOpen}
            />

            {/* Page content */}
            <main className="flex-1 overflow-auto">
              <Routes>
                <Route path="/" element={<Navigate to="/home" />} />
                <Route path="/home" element={<Home />} />
                <Route path="/signup" element={<SignUp />} />
                <Route path="/SignUp/peer" element={<SignUp />} />
                <Route path="/signin" element={<SignIn />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/announcement" element={<Announcement />} />
                <Route path="/journals" element={<Journals />} />
                <Route path="/call-for-papers" element={<CallForPapers />} />
                <Route path="/pub-ethics" element={<PubEthics />} />
                <Route path="/guidelines" element={<Guidelines />} />
                <Route path="/unauthorized" element={<Unauthorized />} />
                <Route path="/manuscripts" element={<Manuscripts />} />
                <Route path="/createform" element={<CreateForm />} />
                <Route path="/formresponses" element={<FormResponses />} />
                <Route path="/submissions" element={<Submissions />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route
                  path="/submit-manuscript"
                  element={<SubmitManuscript />}
                />
                <Route path="*" element={<NotFound />} />

                {/* Protected Routes */}
                <Route
                  path="/profile"
                  element={
                    <ProtectedRoute>
                      <Profile />
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

                {/* Admin Routes */}
                <Route
                  path="/user-log"
                  element={
                    <AdminRoute>
                      <UserLog />
                    </AdminRoute>
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
              </Routes>
            </main>

            <Footer />
          </div>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;
