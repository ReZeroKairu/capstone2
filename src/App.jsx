import React from "react";
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
import AdminManagement from "./pages/Admin/AdminManagement"; // Adjust path as needed
import UserManagement from "./pages/Admin/UserManagement"; // Adjust path as needed
import { getAuth } from "firebase/auth"; // Import getAuth from Firebase
import AdminCreation from "./components/AdminCreation";

function App() {
  const auth = getAuth(); // Get auth instance

  return (
    <AuthProvider>
      <Router>
        <Navbar user={auth.currentUser} onLogout={() => auth.signOut()} />{" "}
        {/* Pass auth.currentUser to Navbar */}
        <div className="App">
          <div className="auth-wrapper">
            <div className="auth-inner">
              <Routes>
                {/* Home is accessible to everyone */}
                <Route path="/" element={<Navigate to="/home" />} />
                <Route path="/home" element={<Home />} />
                <Route
                  path="/profile"
                  element={
                    auth.currentUser ? <Profile /> : <Navigate to="/signin" />
                  }
                />
                <Route path="/signup" element={<SignUp />} />
                <Route path="/signin" element={<SignIn />} />
                <Route path="/journals" element={<Journals />} />
                <Route path="/call-for-papers" element={<CallForPapers />} />
                <Route path="/pub-ethics" element={<PubEthics />} />
                <Route path="/guidelines" element={<Guidelines />} />
                <Route path="/unauthorized" element={<Unauthorized />} />
                <Route path="/admin-management" element={<AdminManagement />} />
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
