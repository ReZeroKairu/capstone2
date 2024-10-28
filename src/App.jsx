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
import { auth } from "./firebase/firebase";

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
            </Routes>
          </div>
        </div>
      </div>
    </Router>
  );
}

export default App;
