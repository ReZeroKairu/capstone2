import React, { useEffect, useState } from "react";
import {
  collection,
  getDocs,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../../firebase/firebase";

const ArchivedUsers = () => {
  const [archivedUsers, setArchivedUsers] = useState([]);
  const [message, setMessage] = useState("");

  // Load archived users
  useEffect(() => {
    const fetchArchivedUsers = async () => {
      try {
        const snapshot = await getDocs(collection(db, "ArchivedUsers"));
        setArchivedUsers(
          snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
        );
      } catch (error) {
        console.error("Error fetching archived users:", error);
      }
    };
    fetchArchivedUsers();
  }, []);

  // Restore user back to Users collection
  const handleRestore = async (userId) => {
    try {
      const archivedRef = doc(db, "ArchivedUsers", userId);
      const archivedSnap = await getDoc(archivedRef);

      if (!archivedSnap.exists()) {
        setMessage("Archived user not found.");
        return;
      }

      const userData = archivedSnap.data();

      // Copy back to Users
      await setDoc(doc(db, "Users", userId), {
        ...userData,
        restoredAt: serverTimestamp(),
      });

      // Copy Notifications subcollection back
      const notifSnap = await getDocs(
        collection(db, "ArchivedUsers", userId, "Notifications")
      );
      for (const notif of notifSnap.docs) {
        await setDoc(
          doc(db, "Users", userId, "Notifications", notif.id),
          notif.data()
        );
      }

      // Delete from archive
      for (const notif of notifSnap.docs) {
        await deleteDoc(
          doc(db, "ArchivedUsers", userId, "Notifications", notif.id)
        );
      }
      await deleteDoc(archivedRef);

      // Update local state
      setArchivedUsers((prev) => prev.filter((u) => u.id !== userId));
      setMessage("User restored successfully.");
    } catch (error) {
      console.error("Restore error:", error);
      setMessage("Failed to restore user.");
    }
  };

  // Permanently delete
  const handlePermanentDelete = async (userId) => {
    try {
      // Delete Notifications
      const notifSnap = await getDocs(
        collection(db, "ArchivedUsers", userId, "Notifications")
      );
      for (const notif of notifSnap.docs) {
        await deleteDoc(
          doc(db, "ArchivedUsers", userId, "Notifications", notif.id)
        );
      }

      // Delete user doc
      await deleteDoc(doc(db, "ArchivedUsers", userId));

      // Update local state
      setArchivedUsers((prev) => prev.filter((u) => u.id !== userId));
      setMessage("User permanently deleted.");
    } catch (error) {
      console.error("Permanent delete error:", error);
      setMessage("Failed to delete user.");
    }
  };

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Archived Users</h1>
      {message && <p className="mb-2 text-sm text-blue-600">{message}</p>}
      {archivedUsers.length === 0 ? (
        <p>No archived users.</p>
      ) : (
        <table className="w-full border border-gray-300">
          <thead>
            <tr className="bg-gray-200">
              <th className="p-2 border">Name</th>
              <th className="p-2 border">Email</th>
              <th className="p-2 border">Role</th>
              <th className="p-2 border">Actions</th>
            </tr>
          </thead>
          <tbody>
            {archivedUsers.map((user) => (
              <tr key={user.id}>
                <td className="p-2 border">
                  {user.firstName} {user.lastName}
                </td>
                <td className="p-2 border">{user.email}</td>
                <td className="p-2 border">{user.role}</td>
                <td className="p-2 border space-x-2">
                  <button
                    className="bg-green-500 text-white px-2 py-1 rounded"
                    onClick={() => handleRestore(user.id)}
                  >
                    Restore
                  </button>
                  <button
                    className="bg-red-500 text-white px-2 py-1 rounded"
                    onClick={() => handlePermanentDelete(user.id)}
                  >
                    Delete Permanently
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default ArchivedUsers;
