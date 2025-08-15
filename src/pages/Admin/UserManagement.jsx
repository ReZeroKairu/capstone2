import React, { useState, useEffect } from "react";
import { db, app } from "../../firebase/firebase";
import {
  collection,
  getDocs,
  doc,
  getDoc,
  addDoc,
  serverTimestamp,
  deleteDoc,
  updateDoc,
} from "firebase/firestore";
import { useAuth } from "../../authcontext/AuthContext";
import { useNavigate } from "react-router-dom";
import { FaSearch } from "react-icons/fa";
import { getAuth } from "firebase/auth";

function UserManagement() {
  const { currentUser, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [deleteUserId, setDeleteUserId] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [usersPerPage, setUsersPerPage] = useState(5);
  const [searchQuery, setSearchQuery] = useState("");
  const auth = getAuth(app);

  const checkAdminStatus = async (userId) => {
    const userDoc = await getDoc(doc(db, "Users", userId));
    if (userDoc.exists() && userDoc.data().role === "Admin") {
      setIsAdmin(true);
      fetchUsers();
    } else {
      navigate("/unauthorized");
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
    } catch {
      setMessage("Failed to fetch users.");
    }
    setLoading(false);
  };

  useEffect(() => {
    if (authLoading) return;
    if (currentUser) checkAdminStatus(currentUser.uid);
    else navigate("/signin");
  }, [currentUser, authLoading, navigate]);

  const handleEdit = (user) => {
    setEditingUser(user);
    setIsEditing(true);
  };

  const handleDeleteConfirmation = (userId) => setDeleteUserId(userId);

  const handleDelete = async () => {
    try {
      await deleteDoc(doc(db, "Users", deleteUserId));
      setMessage("User deleted successfully.");
      fetchUsers();
      setDeleteUserId(null);
    } catch {
      setMessage("Failed to delete user.");
    }
  };

  const handleUpdateUser = async () => {
    if (!editingUser) return;
    try {
      const userRef = doc(db, "Users", editingUser.id);
      await updateDoc(userRef, {
        firstName: editingUser.firstName,
        lastName: editingUser.lastName,
        role: editingUser.role,
      });
      setMessage("User updated successfully.");
      fetchUsers();
      setIsEditing(false);
      setEditingUser(null);
    } catch {
      setMessage("Failed to update user.");
    }
  };

  const filteredUsers = users.filter((user) =>
    ["email", "firstName", "lastName", "role"].some((key) =>
      user[key]?.toLowerCase().includes(searchQuery.toLowerCase())
    )
  );

  const indexOfLastUser = currentPage * usersPerPage;
  const indexOfFirstUser = indexOfLastUser - usersPerPage;
  const currentUsers = filteredUsers.slice(indexOfFirstUser, indexOfLastUser);
  const totalPages = Math.ceil(filteredUsers.length / usersPerPage);

  return (
    <div className="p-4 sm:p-8 bg-gray-50 min-h-screen relative mb-11">
      <h2 className="text-2xl sm:text-3xl font-bold text-center mb-6 sm:mb-10 text-gray-800">
        Manage Users
      </h2>

      {/* Message */}
      {message && (
        <div
          className={`p-2 mb-2 rounded-md text-white text-center w-full sm:w-64 mx-auto ${
            message.includes("success")
              ? "bg-green-600"
              : message.includes("Failed")
              ? "bg-red-600"
              : "bg-blue-600"
          }`}
          role="alert"
        >
          {message}
        </div>
      )}

      {/* Search */}
      <div className="relative mb-4 w-full sm:w-72 mx-auto">
        <input
          type="text"
          placeholder="Search users..."
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setCurrentPage(1);
          }}
          className="w-full pl-10 pr-2 py-1 sm:py-2 border border-gray-500 rounded-md text-sm sm:text-base"
        />
        <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500" />
      </div>

      {/* Users table */}
      {loading ? (
        <p className="text-center text-gray-500">Loading users...</p>
      ) : (
        <div className="overflow-x-auto shadow-lg rounded-lg max-h-[400px]">
          <table className="table-auto w-full border-collapse bg-white text-sm sm:text-base">
            <thead>
              <tr className="bg-indigo-600 text-white">
                <th className="p-2 sm:p-3 font-semibold">Email</th>
                <th className="p-2 sm:p-3 font-semibold">First</th>
                <th className="p-2 sm:p-3 font-semibold">Last</th>
                <th className="p-2 sm:p-3 font-semibold">Role</th>
                <th className="p-2 sm:p-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {currentUsers.map((user) => (
                <tr key={user.id} className="hover:bg-gray-100">
                  <td className="p-1 sm:p-3 border-b text-center">
                    {user.email}
                  </td>
                  <td className="p-1 sm:p-3 border-b text-center">
                    {user.firstName}
                  </td>
                  <td className="p-1 sm:p-3 border-b text-center">
                    {user.lastName}
                  </td>
                  <td className="p-1 sm:p-3 border-b text-center">
                    {user.role}
                  </td>
                  <td className="p-1 sm:p-3 border-b text-center flex flex-col sm:flex-row justify-center items-center gap-1 sm:gap-2">
                    <button
                      className="bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-500 text-xs sm:text-sm"
                      onClick={() => handleEdit(user)}
                    >
                      Edit
                    </button>
                    <button
                      className="bg-red-600 text-white px-2 py-1 rounded hover:bg-red-500 text-xs sm:text-sm"
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

      {/* Delete Modal */}
      {deleteUserId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center p-4">
          <div className="bg-white p-4 rounded shadow-lg w-full max-w-sm">
            <p>Are you sure you want to delete this user?</p>
            <div className="flex flex-col sm:flex-row justify-end gap-2 mt-2">
              <button
                className="bg-red-500 text-white p-2 rounded"
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
        </div>
      )}

      {/* Edit Modal */}
      {isEditing && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center p-4">
          <div className="bg-white p-4 rounded shadow-lg w-full max-w-sm">
            <h3 className="text-lg font-bold mb-2">Edit User</h3>
            <input
              type="text"
              placeholder="First Name"
              value={editingUser.firstName}
              onChange={(e) =>
                setEditingUser({ ...editingUser, firstName: e.target.value })
              }
              className="border p-2 w-full mb-2 text-sm"
            />
            <input
              type="text"
              placeholder="Last Name"
              value={editingUser.lastName}
              onChange={(e) =>
                setEditingUser({ ...editingUser, lastName: e.target.value })
              }
              className="border p-2 w-full mb-2 text-sm"
            />
            <select
              value={editingUser.role}
              onChange={(e) =>
                setEditingUser({ ...editingUser, role: e.target.value })
              }
              className="border p-2 w-full mb-2 text-sm"
            >
              <option value="Researcher">Researcher</option>
              <option value="Admin">Admin</option>
              <option value="Peer Reviewer">Peer Reviewer</option>
            </select>
            <div className="flex flex-col sm:flex-row justify-end gap-2 mt-2">
              <button
                className="bg-blue-500 text-white p-2 rounded text-sm"
                onClick={handleUpdateUser}
              >
                Update
              </button>
              <button
                className="bg-gray-300 text-black p-2 rounded text-sm"
                onClick={() => setIsEditing(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pagination */}
      <div className="mt-4 p-2 bg-white shadow-lg flex flex-col sm:flex-row justify-between items-center gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm">Page Size:</span>
          <select
            value={usersPerPage}
            onChange={(e) => {
              setUsersPerPage(Number(e.target.value));
              setCurrentPage(1);
            }}
            className="border rounded text-sm"
          >
            <option value={5}>5</option>
            <option value={10}>10</option>
            <option value={20}>20</option>
          </select>
        </div>
        <div className="flex items-center flex-wrap gap-1 text-sm">
          <button
            onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
            disabled={currentPage === 1}
            className="px-2 py-1 bg-blue-600 text-white rounded disabled:bg-gray-300"
          >
            Prev
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((num) => (
            <button
              key={num}
              onClick={() => setCurrentPage(num)}
              className={`px-2 py-1 rounded ${
                num === currentPage
                  ? "bg-blue-600 text-white"
                  : "bg-gray-200 text-gray-600"
              }`}
            >
              {num}
            </button>
          ))}
          <button
            onClick={() =>
              setCurrentPage((prev) => Math.min(prev + 1, totalPages))
            }
            disabled={currentPage === totalPages}
            className="px-2 py-1 bg-blue-600 text-white rounded disabled:bg-gray-300"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}

export default UserManagement;
