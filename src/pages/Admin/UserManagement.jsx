import React, { useState, useEffect } from "react";
import { db } from "../../firebase/firebase"; // Adjust path as needed
import {
  collection,
  getDocs,
  doc,
  getDoc,
  updateDoc,
  deleteDoc,
} from "firebase/firestore";
import { useAuth } from "../../authcontext/AuthContext"; // Adjust path as needed
import { useNavigate } from "react-router-dom";

function UserManagement() {
  const { currentUser, loading: authLoading } = useAuth(); // Get current user and loading state from auth context
  const navigate = useNavigate(); // For redirecting users
  const [users, setUsers] = useState([]); // State to store users
  const [loading, setLoading] = useState(true); // Loading state
  const [message, setMessage] = useState(""); // Message state
  const [isEditing, setIsEditing] = useState(false); // Editing state
  const [editingUser, setEditingUser] = useState(null); // User being edited
  const [deleteUserId, setDeleteUserId] = useState(null); // User ID for deletion confirmation
  const [isAdmin, setIsAdmin] = useState(false); // Admin status

  useEffect(() => {
    if (authLoading) return; // Wait until authentication loading is done
    if (currentUser) {
      checkAdminStatus(currentUser.uid); // Check admin status if user is logged in
    } else {
      navigate("/signin"); // Redirect if no user is logged in
    }
  }, [currentUser, authLoading, navigate]);

  const checkAdminStatus = async (userId) => {
    const userDoc = await getDoc(doc(db, "Users", userId));
    if (userDoc.exists()) {
      const userData = userDoc.data();
      if (userData.role === "admin") {
        setIsAdmin(true);
        fetchUsers(); // Fetch users only if admin
      } else {
        navigate("/unauthorized"); // Redirect if not admin
      }
    } else {
      navigate("/signin"); // Redirect to login if user doc doesn't exist
    }
    setLoading(false); // Stop loading after checking admin status
  };

  // Fetch users from Firestore
  const fetchUsers = async () => {
    setLoading(true);
    try {
      const querySnapshot = await getDocs(collection(db, "Users"));
      const usersList = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setUsers(usersList);
    } catch (error) {
      console.error("Error fetching users:", error);
      setMessage("Failed to fetch users.");
    }
    setLoading(false);
  };

  const handleEdit = (user) => {
    setEditingUser(user);
    setIsEditing(true);
  };

  const handleDeleteConfirmation = (userId) => {
    setDeleteUserId(userId);
  };

  const handleDelete = async () => {
    if (deleteUserId) {
      try {
        await deleteDoc(doc(db, "Users", deleteUserId));
        setMessage("User deleted successfully.");
        fetchUsers(); // Refresh the user list
      } catch (error) {
        console.error("Error deleting user:", error);
        setMessage("Failed to delete user.");
      }
      setDeleteUserId(null); // Reset delete confirmation
    }
  };

  const handleUpdateUser = async () => {
    if (editingUser) {
      try {
        await updateDoc(doc(db, "Users", editingUser.id), {
          firstName: editingUser.firstName,
          lastName: editingUser.lastName,
          role: editingUser.role,
        });
        setMessage("User updated successfully.");
        fetchUsers(); // Refresh the user list
        setIsEditing(false);
        setEditingUser(null); // Reset editing state
      } catch (error) {
        console.error("Error updating user:", error);
        setMessage("Failed to update user.");
      }
    }
  };

  return (
    <div className="p-8">
      <h2 className="text-2xl font-bold mb-4">User Management</h2>
      {message && <p className="text-red-600">{message}</p>}
      {loading ? (
        <p>Loading users...</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="table-auto w-full border-collapse border border-gray-300">
            <thead>
              <tr className="bg-gray-200">
                <th className="border border-gray-300 p-2">Email</th>
                <th className="border border-gray-300 p-2">First Name</th>
                <th className="border border-gray-300 p-2">Last Name</th>
                <th className="border border-gray-300 p-2">Role</th>
                <th className="border border-gray-300 p-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td className="border border-gray-300 p-2">{user.email}</td>
                  <td className="border border-gray-300 p-2">
                    {user.firstName}
                  </td>
                  <td className="border border-gray-300 p-2">
                    {user.lastName}
                  </td>
                  <td className="border border-gray-300 p-2">{user.role}</td>
                  <td className="border border-gray-300 p-2">
                    <button
                      className="bg-blue-500 text-white p-1 rounded mr-2"
                      onClick={() => handleEdit(user)}
                    >
                      Edit
                    </button>
                    <button
                      className="bg-red-500 text-white p-1 rounded"
                      onClick={() => handleDeleteConfirmation(user.id)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {/* Modal for Delete Confirmation */}
      {deleteUserId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center">
          <div className="bg-white p-4 rounded shadow-lg">
            <p>Are you sure you want to delete this user?</p>
            <button
              className="bg-red-500 text-white p-2 rounded mr-2"
              onClick={handleDelete}
            >
              Yes
            </button>
            <button
              className="bg-gray-300 text-black p-2 rounded"
              onClick={() => setDeleteUserId(null)}
            >
              No
            </button>
          </div>
        </div>
      )}
      {/* Modal for Editing User */}
      {isEditing && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center">
          <div className="bg-white p-4 rounded shadow-lg">
            <h3 className="text-lg font-bold">Edit User</h3>
            <input
              type="text"
              placeholder="First Name"
              value={editingUser.firstName}
              onChange={(e) =>
                setEditingUser({ ...editingUser, firstName: e.target.value })
              }
              className="border p-2 w-full mb-2"
            />
            <input
              type="text"
              placeholder="Last Name"
              value={editingUser.lastName}
              onChange={(e) =>
                setEditingUser({ ...editingUser, lastName: e.target.value })
              }
              className="border p-2 w-full mb-2"
            />
            <select
              value={editingUser.role}
              onChange={(e) =>
                setEditingUser({ ...editingUser, role: e.target.value })
              }
              className="border p-2 w-full mb-2"
            >
              <option value="user">Researcher</option>
              <option value="admin">Admin</option>
            </select>
            <button
              className="bg-blue-500 text-white p-2 rounded"
              onClick={handleUpdateUser}
            >
              Update User
            </button>
            <button
              className="bg-gray-300 text-black p-2 rounded ml-2"
              onClick={() => setIsEditing(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default UserManagement;
