import React, { useState, useEffect } from "react";
import { db } from "../../firebase/firebase";
import {
  collection,
  getDocs,
  doc,
  getDoc,
  updateDoc,
  deleteDoc,
} from "firebase/firestore";
import { useAuth } from "../../authcontext/AuthContext";
import { useNavigate } from "react-router-dom";

function UserManagement() {
  const { currentUser, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [deleteUserId, setDeleteUserId] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [usersPerPage, setUsersPerPage] = useState(5); // State for page size

  useEffect(() => {
    if (authLoading) return;
    if (currentUser) {
      checkAdminStatus(currentUser.uid);
    } else {
      navigate("/signin");
    }
  }, [currentUser, authLoading, navigate]);

  useEffect(() => {
    // Clear the message after 3 seconds
    if (message) {
      const timer = setTimeout(() => {
        setMessage("");
      }, 5000); // 5 seconds
      return () => clearTimeout(timer); // Cleanup on unmount or when message changes
    }
  }, [message]);

  const checkAdminStatus = async (userId) => {
    const userDoc = await getDoc(doc(db, "Users", userId));
    if (userDoc.exists()) {
      const userData = userDoc.data();
      if (userData.role === "admin") {
        setIsAdmin(true);
        fetchUsers();
      } else {
        navigate("/unauthorized");
      }
    } else {
      navigate("/signin");
    }
    setLoading(false);
  };

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
        fetchUsers();
      } catch (error) {
        console.error("Error deleting user:", error);
        setMessage("Failed to delete user.");
      }
      setDeleteUserId(null);
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
        fetchUsers();
        setIsEditing(false);
        setEditingUser(null);
      } catch (error) {
        console.error("Error updating user:", error);
        setMessage("Failed to update user.");
      }
    }
  };

  // Pagination logic
  const indexOfLastUser = currentPage * usersPerPage;
  const indexOfFirstUser = indexOfLastUser - usersPerPage;
  const currentUsers = users.slice(indexOfFirstUser, indexOfLastUser);

  const paginate = (pageNumber) => setCurrentPage(pageNumber);

  const handlePageSizeChange = (event) => {
    setUsersPerPage(Number(event.target.value));
    setCurrentPage(1); // Reset to the first page when the page size is changed
  };

  return (
    <div className="p-8 bg-gray-50 min-h-screen relative">
      <h2 className="text-3xl font-bold text-center mt-20 mb-10 text-gray-800">
        Manage Users
      </h2>

      {/* Message Prompt */}
      {message && (
        <p
          className={`absolute top-40 left-1/2 transform -translate-x-1/2 p-3 w-1/3 text-center ${
            message.includes("successfully")
              ? "bg-green-600 text-white"
              : "bg-red-600 text-white"
          }`}
        >
          {message}
        </p>
      )}

      {loading ? (
        <p className="text-center text-gray-500">Loading users...</p>
      ) : (
        <div className="overflow-x-auto shadow-lg mt-20 rounded-lg">
          <table className="table-auto w-full border-collapse bg-white">
            <thead>
              <tr className="bg-indigo-600 text-white">
                <th className="p-3 font-semibold">Email</th>
                <th className="p-3 font-semibold">First Name</th>
                <th className="p-3 font-semibold">Last Name</th>
                <th className="p-3 font-semibold">Role</th>
                <th className="p-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {currentUsers.map((user) => (
                <tr key={user.id} className="hover:bg-gray-100">
                  <td className="p-3 border-b text-center">{user.email}</td>
                  <td className="p-3 border-b text-center">{user.firstName}</td>
                  <td className="p-3 border-b text-center">{user.lastName}</td>
                  <td className="p-3 border-b text-center">{user.role}</td>
                  <td className="p-3 border-b text-center">
                    <button
                      className="bg-blue-600 text-white px-3 py-1 rounded mr-2 hover:bg-blue-500"
                      onClick={() => handleEdit(user)}
                    >
                      Edit
                    </button>
                    <button
                      className="bg-red-600 text-white px-3 py-1 rounded hover:bg-red-500"
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

      {/* Pagination and Page Size Controls */}
      <div className="flex justify-between mt-4">
        <div className="flex items-center">
          <span className="mr-2">Page Size:</span>
          <select
            value={usersPerPage}
            onChange={handlePageSizeChange}
            className="border p-2 rounded"
          >
            <option value={5}>5</option>
            <option value={10}>10</option>
            <option value={20}>20</option>
          </select>
        </div>
        <div className="flex items-center">
          <button
            onClick={() => paginate(currentPage - 1)}
            disabled={currentPage === 1}
            className="px-4 py-2 bg-blue-600 text-white rounded mr-2 disabled:bg-gray-300"
          >
            Previous
          </button>
          <span className="px-4 py-2">{`Page ${currentPage}`}</span>
          <button
            onClick={() => paginate(currentPage + 1)}
            className="px-4 py-2 bg-blue-600 text-white rounded ml-2"
          >
            Next
          </button>
        </div>
      </div>

      {/* Delete confirmation modal */}
      {deleteUserId && (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-60 flex justify-center items-center">
          <div className="bg-white p-6 rounded shadow-xl text-center">
            <p className="text-lg mb-4">
              Are you sure you want to delete this user?
            </p>
            <button
              className="bg-red-600 text-white px-4 py-2 rounded mr-2 hover:bg-red-500"
              onClick={handleDelete}
            >
              Yes
            </button>
            <button
              className="bg-gray-300 px-4 py-2 rounded hover:bg-gray-400"
              onClick={() => setDeleteUserId(null)}
            >
              No
            </button>
          </div>
        </div>
      )}

      {/* Editing user modal */}
      {isEditing && (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-60 flex justify-center items-center">
          <div className="bg-white p-6 rounded shadow-xl text-center">
            <h3 className="text-lg mb-4">Edit User</h3>
            <input
              type="text"
              className="border p-2 mb-4 w-full"
              placeholder="First Name"
              value={editingUser.firstName}
              onChange={(e) =>
                setEditingUser({ ...editingUser, firstName: e.target.value })
              }
            />
            <input
              type="text"
              className="border p-2 mb-4 w-full"
              placeholder="Last Name"
              value={editingUser.lastName}
              onChange={(e) =>
                setEditingUser({ ...editingUser, lastName: e.target.value })
              }
            />
            <select
              className="border p-2 mb-4 w-full"
              value={editingUser.role}
              onChange={(e) =>
                setEditingUser({ ...editingUser, role: e.target.value })
              }
            >
              <option value="admin">Admin</option>
              <option value="Researcher">Researcher</option>
            </select>
            <button
              className="bg-blue-600 text-white px-4 py-2 rounded mr-2 hover:bg-blue-500"
              onClick={handleUpdateUser}
            >
              Save Changes
            </button>
            <button
              className="bg-gray-300 px-4 py-2 rounded hover:bg-gray-400"
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
