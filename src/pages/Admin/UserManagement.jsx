import React, { useState, useEffect } from "react";
import { db } from "../../firebase/firebase";
import {
  collection,
  getDocs,
  doc,
  getDoc,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";
import { useAuth } from "../../authcontext/AuthContext";
import { useNavigate } from "react-router-dom";
import { deleteDoc, updateDoc } from "firebase/firestore";
import { FaSearch } from "react-icons/fa"; // Importing the search icon

function UserManagement() {
  const { currentUser, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [isEditing, setIsEditing] = useState(false); // Editing state
  const [editingUser, setEditingUser] = useState(null); // User being edited
  const [deleteUserId, setDeleteUserId] = useState(null); // User ID for deletion confirmation
  const [currentPage, setCurrentPage] = useState(1);
  const [usersPerPage, setUsersPerPage] = useState(5);
  const [searchQuery, setSearchQuery] = useState("");

  const checkAdminStatus = async (userId) => {
    const userDoc = await getDoc(doc(db, "Users", userId));
    if (userDoc.exists() && userDoc.data().role === "admin") {
      setIsAdmin(true);
      fetchUsers();
    } else {
      navigate("/unauthorized");
    }
    setLoading(false);
  };
  const handleEdit = (user) => {
    setEditingUser(user);
    setIsEditing(true); // Open the editing modal
  };

  const handleDeleteConfirmation = (userId) => {
    setDeleteUserId(userId); // Set the user ID for deletion
  };

  const handleDelete = async () => {
    try {
      await deleteDoc(doc(db, "Users", deleteUserId)); // Delete the user document from Firestore
      setMessage("User deleted successfully.");
      fetchUsers(); // Refresh the user list after deletion
      setDeleteUserId(null); // Close the modal
    } catch (error) {
      setMessage("Failed to delete user.");
    }
  };

  useEffect(() => {
    if (authLoading) return;
    if (currentUser) {
      checkAdminStatus(currentUser.uid);
    } else {
      navigate("/signin");
    }
  }, [currentUser, authLoading, navigate]);

  const handleUpdateUser = async () => {
    if (editingUser) {
      try {
        const userDocRef = doc(db, "Users", editingUser.id);
        const userSnapshot = await getDoc(userDocRef);
        const previousRole = userSnapshot.data().role;

        // Check if role has changed
        if (previousRole !== editingUser.role) {
          // Update the user's role
          await updateDoc(userDocRef, {
            firstName: editingUser.firstName,
            lastName: editingUser.lastName,
            role: editingUser.role,
          });

          // Send a notification if the role has changed
          await addDoc(
            collection(db, "Users", editingUser.id, "Notifications"),
            {
              message: `Your role has been changed to ${editingUser.role}`,
              timestamp: serverTimestamp(),
              seen: false, // You can use this to mark if the notification has been read
              status: "new", // Add the status field, for example "new"
            }
          );
        } else {
          // Update user data without notification if role hasn't changed
          await updateDoc(userDocRef, {
            firstName: editingUser.firstName,
            lastName: editingUser.lastName,
            role: editingUser.role,
          });
        }

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
      setMessage("Failed to fetch users.");
    }
    setLoading(false);
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

  const handlePageSizeChange = (event) => {
    setUsersPerPage(Number(event.target.value));
    setCurrentPage(1); // Reset to first page when page size changes
  };

  // Pagination with ellipsis
  const maxVisiblePages = 5;
  const startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
  const endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
  const adjustedStartPage = Math.max(1, endPage - maxVisiblePages + 1);

  useEffect(() => {
    // Timer to hide the message after 5 seconds
    if (message) {
      const timer = setTimeout(() => {
        setMessage(""); // Reset message after 5 seconds
      }, 5000);

      return () => clearTimeout(timer); // Cleanup timer on unmount
    }
  }, [message]);

  return (
    <div className="p-8 bg-gray-50 min-h-screen relative mb-11">
      <h2 className="text-3xl font-bold text-center mt-20 mb-10 text-gray-800">
        Manage Users
      </h2>
      {message && (
        <div
          className={`p-2 mb-2 rounded-md text-white text-center ${
            message.includes("success")
              ? "bg-green-600"
              : message.includes("Failed")
              ? "bg-red-600"
              : "bg-blue-600"
          } w-64 mx-auto`}
          role="alert"
        >
          <div className="flex items-center">
            {/* Conditional icon based on message type */}
            {message.includes("success") && (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="w-6 h-6 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                strokeWidth="2"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M5 13l4 4L19 7"
                />
              </svg>
            )}
            {message.includes("Failed") && (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="w-6 h-6 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                strokeWidth="2"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            )}
            <span>{message}</span>
          </div>
        </div>
      )}
      <div className="flex items-center border border-gray-500 mb-1 w-72">
        {/* Search icon inside input */}
        <FaSearch className="text-gray-500 w-8 ml-1" />
        <input
          type="text"
          placeholder="Search users..."
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setCurrentPage(1); // Reset to the first page when searching
          }}
          className="w-full p-2 " // Add left padding to accommodate the icon
        />
      </div>
      {loading ? (
        <p className="text-center text-gray-500">Loading users...</p>
      ) : (
        <div
          className="overflow-x-auto shadow-lg rounded-lg"
          style={{ maxHeight: "500px" }}
        >
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
                      onClick={() => handleEdit(user)} // Trigger edit
                    >
                      Edit
                    </button>
                    <button
                      className="bg-red-600 text-white px-3 py-1 rounded hover:bg-red-500"
                      onClick={() => handleDeleteConfirmation(user.id)} // Trigger delete confirmation
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}{" "}
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
              <option value="Researcher">Researcher</option>
              <option value="admin">Admin</option>
              <option value="Peer Reviewer">Peer Reviewer</option>
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
      {/* Fixed Pagination */}
      <div className="fixed bottom-0 left-0 w-full p-2 bg-white shadow-lg">
        <div className="flex justify-between items-center">
          <div className="flex items-center">
            <span className="mr-2">Page Size:</span>
            <select
              value={usersPerPage}
              onChange={handlePageSizeChange}
              className="border rounded"
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={20}>20</option>
            </select>
          </div>

          <div className="flex items-center space-x-1">
            <button
              onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="px-3 py-1 bg-blue-600 text-white rounded disabled:bg-gray-300"
            >
              Previous
            </button>

            {startPage > 1 && (
              <>
                <button
                  onClick={() => setCurrentPage(1)}
                  className="px-3 py-1 rounded bg-gray-200 text-gray-600"
                >
                  1
                </button>
                {startPage > 2 && <span>...</span>}
              </>
            )}

            {Array.from(
              { length: endPage - adjustedStartPage + 1 },
              (_, i) => adjustedStartPage + i
            ).map((pageNumber) => (
              <button
                key={pageNumber}
                onClick={() => setCurrentPage(pageNumber)}
                className={`px-3 py-1 rounded ${
                  pageNumber === currentPage
                    ? "bg-blue-600 text-white"
                    : "bg-gray-200 text-gray-600"
                }`}
              >
                {pageNumber}
              </button>
            ))}

            {endPage < totalPages && (
              <>
                {endPage < totalPages - 1 && <span>...</span>}
                <button
                  onClick={() => setCurrentPage(totalPages)}
                  className="px-3 py-1 rounded bg-gray-200 text-gray-600"
                >
                  {totalPages}
                </button>
              </>
            )}

            <button
              onClick={() =>
                setCurrentPage((prev) => Math.min(prev + 1, totalPages))
              }
              disabled={currentPage === totalPages}
              className="px-3 py-1 bg-blue-600 text-white rounded disabled:bg-gray-300"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default UserManagement;
