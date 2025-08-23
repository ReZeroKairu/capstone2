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

// Custom colors
const yellow = "#F9D563";
const brown = "#7B2E19";

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
  const [usersPerPage, setUsersPerPage] = useState(8); // Default to 8
  const [searchQuery, setSearchQuery] = useState("");
  const auth = getAuth(app);

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

  // Fetch all users
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
      // Delete subcollections (like Notifications)
      const notifColRef = collection(db, "Users", deleteUserId, "Notifications");
      const notifSnap = await getDocs(notifColRef);
      for (const notif of notifSnap.docs) {
        await deleteDoc(doc(db, "Users", deleteUserId, "Notifications", notif.id));
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
          const notifColRef = collection(db, "Users", editingUser.id, "Notifications");
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
        prev.map((u) => (u.id === editingUser.id ? { ...u, ...editingUser } : u))
      );
      setMessage("User updated successfully.");
      setIsEditing(false);
      setEditingUser(null);
    } catch (error) {
      console.error("Update user error:", error);
      setMessage("Failed to update user.");
    }
  };

  // Improved search for firstName, lastName, email, or role
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

  // For ellipsis pagination
  const getPageNumbers = () => {
    const pages = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push("...");
      let start = Math.max(2, currentPage - 1);
      let end = Math.min(totalPages - 1, currentPage + 1);
      for (let i = start; i <= end; i++) pages.push(i);
      if (currentPage < totalPages - 2) pages.push("...");
      pages.push(totalPages);
    }
    return pages;
  };

  return (
    <div
      className="min-h-screen pt-28 md:pt-24 relative mb-11 flex flex-col"
      style={{ background: "#fff" }}
    >
      <h2 className="text-3xl font-bold text-center mb-7" style={{ color: "#000" }}>
        Manage Users
      </h2>

      {/* Search Bar */}
      <div
        className="relative mb-6 w-full max-w-md mx-auto flex items-center"
        style={{
          border: `2px solid ${brown}`, // thinner border
          borderRadius: "18px",
          background: "#fff",
          padding: "8px 20px",
        }}
      >
        <FaSearch
          className="mr-3"
          size={26}
          style={{ color: yellow, background: "transparent" }}
        />
        <input
          type="text"
          placeholder="Search user"
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setCurrentPage(1);
          }}
          className="w-full border-none outline-none bg-transparent text-lg"
          style={{ color: brown }}
        />
      </div>

      {/* Message */}
      {message && (
        <div
          className="p-2 mb-2 rounded-md text-white text-center w-full max-w-md mx-auto"
          style={{
            background:
              message.includes("success")
                ? "#3CB371"
                : message.includes("Failed")
                ? "#FF5252"
                : "#7B2E19",
          }}
          role="alert"
        >
          {message}
        </div>
      )}

      {/* Users Table */}
      <div
        className="overflow-x-auto mx-auto"
        style={{
          maxWidth: "1100px",
          border: `2px solid ${brown}`, // thinner border
          borderRadius: "20px",
          background: "#fff",
        }}
      >
        <table className="w-full">
          <thead>
            <tr style={{ background: yellow }}>
              <th className="py-3 px-4 text-left font-bold" style={{ color: brown }}>
                Email
              </th>
              <th className="py-3 px-4 text-left font-bold" style={{ color: brown }}>
                First
              </th>
              <th className="py-3 px-4 text-left font-bold" style={{ color: brown }}>
                Last
              </th>
              <th className="py-3 px-4 text-left font-bold" style={{ color: brown }}>
                Role
              </th>
              <th className="py-3 px-4 text-left font-bold" style={{ color: brown }}>
                Action
              </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="py-5 text-center" style={{ color: brown }}>
                  Loading users...
                </td>
              </tr>
            ) : (
              currentUsers.map((user) => (
                <tr key={user.id} style={{ borderBottom: "none" }}>
                  <td className="py-2 px-4 text-left" style={{ color: brown }}>
                    {user.email}
                  </td>
                  <td className="py-2 px-4 text-left" style={{ color: brown }}>
                    {user.firstName}
                  </td>
                  <td className="py-2 px-4 text-left" style={{ color: brown }}>
                    {user.lastName}
                  </td>
                  <td className="py-2 px-4 text-left" style={{ color: brown }}>
                    {user.role}
                  </td>
                  <td className="py-2 px-4 text-left flex gap-2">
                    <button
                      className="font-bold py-2 px-5"
                      style={{
                        background: yellow,
                        color: brown,
                        borderRadius: "12px",
                        boxShadow:
                          isEditing && editingUser?.id === user.id
                            ? "0 0 0 2px #a259f7"
                            : "none",
                        outline: isEditing && editingUser?.id === user.id ? "2px solid #a259f7" : "none",
                        border: "none",
                        transition: "box-shadow 0.2s",
                      }}
                      onClick={() => handleEdit(user)}
                    >
                      Edit
                    </button>
                    <button
                      className="font-bold py-2 px-5"
                      style={{
                        background: yellow,
                        color: brown,
                        borderRadius: "12px",
                        border: "none",
                        transition: "box-shadow 0.2s",
                      }}
                      onClick={() => handleDeleteConfirmation(user.id)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Delete Modal */}
      {deleteUserId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center p-4 z-50">
          <div style={{ background: "#fff", borderRadius: "20px", padding: "32px", boxShadow: "0 4px 24px #0001" }}>
            <p style={{ color: brown, fontWeight: 600 }}>Are you sure you want to delete this user?</p>
            <div className="flex gap-3 mt-5 justify-end">
              <button
                style={{
                  background: yellow,
                  color: brown,
                  borderRadius: "10px",
                  fontWeight: "bold",
                  padding: "10px 28px",
                  border: "none",
                }}
                onClick={handleDelete}
              >
                Yes
              </button>
              <button
                style={{
                  background: "#eee",
                  color: brown,
                  borderRadius: "10px",
                  fontWeight: "bold",
                  padding: "10px 28px",
                  border: "none",
                }}
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center p-4 z-50">
          <div style={{ background: "#fff", borderRadius: "22px", padding: "32px", boxShadow: "0 4px 24px #0001", minWidth: "320px" }}>
            <h3 className="text-lg font-bold mb-4" style={{ color: brown }}>Edit User</h3>
            <input
              type="text"
              placeholder="First Name"
              value={editingUser.firstName}
              onChange={(e) =>
                setEditingUser({ ...editingUser, firstName: e.target.value })
              }
              className="w-full mb-2 px-4 py-2"
              style={{ borderRadius: "10px", border: `2px solid ${yellow}`, color: brown, background: "#fff" }}
            />
            <input
              type="text"
              placeholder="Last Name"
              value={editingUser.lastName}
              onChange={(e) =>
                setEditingUser({ ...editingUser, lastName: e.target.value })
              }
              className="w-full mb-2 px-4 py-2"
              style={{ borderRadius: "10px", border: `2px solid ${yellow}`, color: brown, background: "#fff" }}
            />
            <select
              value={editingUser.role}
              onChange={(e) =>
                setEditingUser({ ...editingUser, role: e.target.value })
              }
              className="w-full mb-2 px-4 py-2"
              style={{ borderRadius: "10px", border: `2px solid ${yellow}`, color: brown, background: "#fff" }}
            >
              <option value="Researcher">Researcher</option>
              <option value="Admin">Admin</option>
              <option value="Peer Reviewer">Peer Reviewer</option>
            </select>
            <div className="flex gap-3 mt-5 justify-end">
              <button
                style={{
                  background: yellow,
                  color: brown,
                  borderRadius: "10px",
                  fontWeight: "bold",
                  padding: "10px 28px",
                  border: "none",
                }}
                onClick={handleUpdateUser}
              >
                Update
              </button>
              <button
                style={{
                  background: "#eee",
                  color: brown,
                  borderRadius: "10px",
                  fontWeight: "bold",
                  padding: "10px 28px",
                  border: "none",
                }}
                onClick={() => setIsEditing(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pagination Bar */}
      <div
        className="mt-6 mx-auto flex flex-col sm:flex-row justify-between items-center gap-5"
        style={{
          background: yellow,
          borderRadius: "16px",
          padding: "18px 24px",
          maxWidth: "1100px",
          marginTop: "2rem",
        }}
      >
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-bold" style={{ color: brown }}>
            Page Size:
          </span>
          <select
            value={usersPerPage}
            onChange={(e) => {
              setUsersPerPage(Number(e.target.value));
              setCurrentPage(1);
            }}
            style={{
              background: yellow,
              color: brown,
              borderRadius: "9px",
              fontWeight: "bold",
              border: `2px solid ${brown}`,
              padding: "2px 8px",
              outline: "none",
              fontSize: "1rem",
            }}
          >
            <option value={8}>8</option>
            <option value={5}>5</option>
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
          </select>
        </div>
        <div className="flex items-center flex-wrap gap-1 text-sm">
          <button
            onClick={() => setCurrentPage(1)}
            disabled={currentPage === 1}
            style={{
              background: yellow,
              color: brown,
              borderRadius: "8px",
              fontWeight: "bold",
              padding: "4px 16px",
              border: `2px solid ${brown}`,
              opacity: currentPage === 1 ? 0.5 : 1,
            }}
          >
            First
          </button>
          <button
            onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
            disabled={currentPage === 1}
            style={{
              background: yellow,
              color: brown,
              borderRadius: "8px",
              fontWeight: "bold",
              padding: "4px 16px",
              border: `2px solid ${brown}`,
              opacity: currentPage === 1 ? 0.5 : 1,
            }}
          >
            Prev
          </button>
          {getPageNumbers().map((num, idx) =>
            num === "..." ? (
              <span key={idx} style={{ color: brown, fontWeight: "bold", padding: "0 8px" }}>...</span>
            ) : (
              <button
                key={num}
                onClick={() => setCurrentPage(num)}
                style={{
                  background: num === currentPage ? brown : yellow,
                  color: num === currentPage ? yellow : brown,
                  borderRadius: "8px",
                  fontWeight: "bold",
                  border: `2px solid ${brown}`,
                  padding: "4px 16px",
                }}
              >
                {num}
              </button>
            )
          )}
          <button
            onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
            disabled={currentPage === totalPages}
            style={{
              background: yellow,
              color: brown,
              borderRadius: "8px",
              fontWeight: "bold",
              padding: "4px 16px",
              border: `2px solid ${brown}`,
              opacity: currentPage === totalPages ? 0.5 : 1,
            }}
          >
            Next
          </button>
          <button
            onClick={() => setCurrentPage(totalPages)}
            disabled={currentPage === totalPages}
            style={{
              background: yellow,
              color: brown,
              borderRadius: "8px",
              fontWeight: "bold",
              padding: "4px 16px",
              border: `2px solid ${brown}`,
              opacity: currentPage === totalPages ? 0.5 : 1,
            }}
          >
            Last
          </button>
        </div>
      </div>
    </div>
  );
}

export default UserManagement;