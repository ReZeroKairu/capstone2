// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth, GoogleAuthProvider } from "firebase/auth"; // Import GoogleAuthProvider
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage"; // Import getStorage

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBdeb3W_0Ung6bFvzjN0KVJaPMYa6Tw_b0",
  authDomain: "pubtrack2.firebaseapp.com",
  projectId: "pubtrack2",
  storageBucket: "pubtrack2.firebasestorage.app",
  messagingSenderId: "1084019185709",
  appId: "1:1084019185709:web:0f257862cba3141eb340a4",
  measurementId: "G-V63NEVL8P8",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
const analytics = getAnalytics(app); // Analytics (optional)
const db = getFirestore(app); // Firestore
const auth = getAuth(app); // Auth
const provider = new GoogleAuthProvider(); // Create a new instance of GoogleAuthProvider
const storage = getStorage(app); // Initialize Firebase Storage

// Export the initialized services
export { app, db, auth, provider, storage }; // db (Firestore) is exported here
