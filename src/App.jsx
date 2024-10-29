import React, { useEffect, useState } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import SignIn from "./pages/SignIn";
import SignUp from "./pages/SignUp";
import Profile from "./pages/Profile";
import Home from "./pages/Home";
import Navbar from "./components/Navbar";
import Journals from "./pages/Journals";
import { auth } from "./firebase/firebase";
import CallForPapers from "./pages/CallForPapers";
import PubEthics from "./pages/PubEthics";
import Guidelines from "./pages/Guidelines";
import AdminManagement from "./pages/AdminManagement";
import Unauthorized from "./pages/Unauthorized";
function App() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((currentUser) => {
      setUser(currentUser);
    });

    // Cleanup the subscription on unmount
    return () => unsubscribe();
  }, []);

  return (
    <Router>
      <Navbar user={user} onLogout={() => auth.signOut()} />{" "}
      {/* Pass user and logout handler to Navbar */}
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
              <Route path="/admin-management" element={<AdminManagement />} />
            </Routes>
          </div>
        </div>
      </div>
    </Router>
  );
}

export default App;
