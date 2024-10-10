// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBdeb3W_0Ung6bFvzjN0KVJaPMYa6Tw_b0",
  authDomain: "pubtrack2.firebaseapp.com",
  projectId: "pubtrack2",
  storageBucket: "pubtrack2.appspot.com",
  messagingSenderId: "1084019185709",
  appId: "1:1084019185709:web:0f257862cba3141eb340a4",
  measurementId: "G-V63NEVL8P8",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
const analytics = getAnalytics(app); // Analytics (optional)
const db = getFirestore(app); // Firestore
const auth = getAuth(app); // Auth (missing from your original code)

// Export the initialized services
export { app, db, auth };
