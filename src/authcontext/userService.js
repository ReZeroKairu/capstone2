import { doc, setDoc } from "firebase/firestore";
import { db } from "../firebase/firebase";

export const addUserRole = async (uid) => {
  try {
    await setDoc(doc(db, "Users", uid), { role: "user" });
    console.log("User role added successfully");
  } catch (error) {
    console.error("Error adding user role:", error);
  }
};
