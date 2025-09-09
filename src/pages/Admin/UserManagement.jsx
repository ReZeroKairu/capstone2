import React, { useState, useEffect } from "react";
import { db, app } from "../../firebase/firebase";
import {
  collection,
  getDocs,
  doc,
  getDoc,
  addDoc,
  deleteDoc,
  updateDoc,
  serverTimestamp,
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

  // Utility: generate page numbers with ellipsis
  const getPageNumbers = (current, total) => {
    const delta = 2;
    const range = [];
    const rangeWithDots = [];

    for (let i = 1; i <= total; i++) {
      if (
        i === 1 ||
        i === total ||
        (i >= current - delta && i <= current + delta)
      ) {
        range.push(i);
      }
    }

    let prev = null;
    for (let num of range) {
      if (prev) {
        if (num - prev === 2) {
          rangeWithDots.push(prev + 1);
        } else if (num - prev > 2) {
          rangeWithDots.push("...");
        }
      }
      rangeWithDots.push(num);
      prev = num;
    }

    return rangeWithDots;
  };

  // Check if current user is admin
  const checkAdminStatus = async (userId) => {
    try {
      const userDoc = await getDoc(doc(db, "Users", userId));
      if (userDoc.exists() && userDoc.data().role === "Admin") {
        setIsAdmin(true);
        await fetchUsers();
      } else {
        navigate("/unauthorized");
      }
    } catch (error) {
      console.error("Check admin status error:", error);
      setMessage("Failed to verify admin status.");
    } finally {
      setLoading(false);
    }
  };

  // Fetch all users (or search users)
  const fetchUsers = async () => {
    setLoading(true);
    try {
      const querySnapshot = await getDocs(collection(db, "Users"));
      const usersList = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      // Sort users by firstName ascending automatically
      usersList.sort((a, b) => a.firstName.localeCompare(b.firstName));
      setUsers(usersList);
    } catch (error) {
      console.error("Fetch users error:", error);
      setMessage("Failed to fetch users.");
    } finally {
      setLoading(false);
    }
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
      const notifColRef = collection(
        db,
        "Users",
        deleteUserId,
        "Notifications"
      );
      const notifSnap = await getDocs(notifColRef);
      for (const notif of notifSnap.docs) {
        await deleteDoc(
          doc(db, "Users", deleteUserId, "Notifications", notif.id)
        );
      }
      await deleteDoc(doc(db, "Users", deleteUserId));
      setUsers((prev) => prev.filter((u) => u.id !== deleteUserId));
      setMessage("User deleted successfully.");
      setDeleteUserId(null);
    } catch (error) {
      console.error("Delete user error:", error);
      setMessage("Failed to delete user.");
    }
  };

  const handleUpdateUser = async () => {
    if (!editingUser) return;
    try {
      const userRef = doc(db, "Users", editingUser.id);
      const userSnap = await getDoc(userRef);
      if (!userSnap.exists()) {
        setMessage("User does not exist.");
        return;
      }

      const prevRole = userSnap.data().role;
      await updateDoc(userRef, {
        firstName: editingUser.firstName,
        lastName: editingUser.lastName,
        role: editingUser.role,
      });

      if (prevRole !== editingUser.role) {
        try {
          const notifColRef = collection(
            db,
            "Users",
            editingUser.id,
            "Notifications"
          );
          const newNotif = {
            message: `Your role has been changed from ${prevRole} to ${editingUser.role}`,
            timestamp: serverTimestamp(),
            seen: false,
          };
          await addDoc(notifColRef, newNotif);
        } catch (notifError) {
          console.error("Failed to create notification:", notifError);
          setMessage("User updated but failed to create notification.");
        }
      }

      setUsers((prev) =>
        prev.map((u) =>
          u.id === editingUser.id ? { ...u, ...editingUser } : u
        )
      );
      setMessage("User updated successfully.");
      setIsEditing(false);
      setEditingUser(null);
    } catch (error) {
      console.error("Update user error:", error);
      setMessage("Failed to update user.");
    }
  };

  // Filter users locally (multi-word search on firstName, lastName, email, role)
  const filteredUsers = users.filter((user) => {
    if (!searchQuery) return true;
    const queryWords = searchQuery.toLowerCase().split(" ");
    return queryWords.every((word) =>
      [user.firstName, user.lastName, user.email, user.role].some((field) =>
        field?.toLowerCase().includes(word)
      )
    );
  });

  const indexOfLastUser = currentPage * usersPerPage;
  const indexOfFirstUser = indexOfLastUser - usersPerPage;
  const currentUsers = filteredUsers.slice(indexOfFirstUser, indexOfLastUser);
  const totalPages = Math.ceil(filteredUsers.length / usersPerPage);

  return (
    <div className="p-4 sm:p-8 bg-gray-50 min-h-screen pt-28 md:pt-24 relative mb-11">
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
          placeholder="Search user"
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setCurrentPage(1);
          }}
          className="w-full pl-10 pr-2 py-1 sm:py-2 border-[3px] border-red-900 rounded text-sm sm:text-base focus:outline-none focus:border-red-900 focus:ring-2 focus:ring-red-900"
        />
        <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-yellow-500" />
      </div>

      {loading ? (
        <p className="text-center text-gray-500">Loading users...</p>
      ) : (
        <div className="overflow-x-auto max-h-[400px]">
          <div className="bg-yellow-400 text-red-800 rounded-t-md p-2 sm:p-3 grid grid-cols-5 text-center font-semibold">
            <span>Email</span>
            <span>First</span>
            <span>Last</span>
            <span>Role</span>
            <span>Actions</span>
          </div>

          <div className="border-2 border-red-800 rounded-b-md overflow-hidden mt-0">
            {currentUsers.map((user, idx) => (
              <div
                key={user.id}
                className={`grid grid-cols-5 items-center p-2 sm:p-3 text-center ${
                  idx < currentUsers.length - 1 ? "border-b border-red-800" : ""
                } hover:bg-gray-100`}
              >
                <span className="text-red-800">{user.email}</span>
                <span className="text-red-800">{user.firstName}</span>
                <span className="text-red-800">{user.lastName}</span>
                <span className="text-red-800">{user.role}</span>
                <div className="flex flex-col sm:flex-row justify-center items-center gap-1 sm:gap-2">
                  <button
                    className="bg-blue-500 text-white px-6 py-2 rounded-sm hover:bg-blue-600 text-xs sm:text-sm"
                    onClick={() => handleEdit(user)}
                  >
                    Edit
                  </button>
                  <button
                    className="bg-red-700 text-white px-4 py-2 rounded-sm hover:bg-red-800 text-xs sm:text-sm"
                    onClick={() => handleDeleteConfirmation(user.id)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}

            {currentUsers.length === 0 && (
              <div className="p-4 text-center text-gray-600">
                No users found.
              </div>
            )}
          </div>
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
      <div className="mt-4 p-2 bg-yellow-400 shadow-lg flex flex-col sm:flex-row justify-between items-center gap-2 rounded-sm">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-bold text-red-900">Page Size:</span>
          <select
            value={usersPerPage}
            onChange={(e) => {
              setUsersPerPage(Number(e.target.value));
              setCurrentPage(1);
            }}
            className="border-2 border-red-800 bg-yellow-400 rounded-md text-red-900 font-bold text-sm"
          >
            <option value={5}>5</option>
            <option value={10}>10</option>
            <option value={20}>20</option>
          </select>
        </div>

        <div className="flex items-center flex-wrap gap-1 text-sm">
          <button
            onClick={() => setCurrentPage(1)}
            disabled={currentPage === 1}
            className="px-3 py-1 mr-1 bg-yellow-400 text-red-900 rounded-md border border-red-900 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            First
          </button>
          <button
            onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
            disabled={currentPage === 1}
            className="px-3 py-1 mr-4 bg-yellow-400 text-red-900 rounded-md border border-red-900 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Prev
          </button>

          {getPageNumbers(currentPage, totalPages).map((num, idx) =>
            num === "..." ? (
              <span key={idx} className="px-3 py-1">
                ...
              </span>
            ) : (
              <button
                key={idx}
                onClick={() => setCurrentPage(num)}
                className={`px-3 py-1 mr-1 rounded-lg ${
                  num === currentPage
                    ? "bg-red-900 text-white border border-red-900"
                    : "bg-yellow-400 text-red-900 border border-red-900"
                }`}
              >
                {num}
              </button>
            )
          )}

          <button
            onClick={() =>
              setCurrentPage((prev) => Math.min(prev + 1, totalPages))
            }
            disabled={currentPage === totalPages}
            className="px-3 py-1 ml-3 mr-1 bg-yellow-400 text-red-900 rounded-md border border-red-900 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
          </button>
          <button
            onClick={() => setCurrentPage(totalPages)}
            disabled={currentPage === totalPages}
            className="px-3 py-1 mr-1 bg-yellow-400 text-red-900 rounded-md border border-red-900 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Last
          </button>
        </div>
      </div>
    </div>
  );
}

export default UserManagement;
