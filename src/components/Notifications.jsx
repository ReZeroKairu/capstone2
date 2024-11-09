import React, { useState, useEffect } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBell } from "@fortawesome/free-solid-svg-icons";
import {
  getFirestore,
  collection,
  query,
  orderBy,
  getDocs,
  doc,
  updateDoc,
} from "firebase/firestore";
import { useNavigate } from "react-router-dom"; // For navigation

const db = getFirestore();

const Notifications = ({ user }) => {
  const [notifications, setNotifications] = useState([]);
  const [activeTab, setActiveTab] = useState("unread"); // "unread", "read", or "all"
  const [notificationDropdownOpen, setNotificationDropdownOpen] =
    useState(false);
  const [loading, setLoading] = useState(true); // State to handle loading state
  const navigate = useNavigate();

  // Fetch notifications from Firestore
  const fetchNotifications = async (userId) => {
    setLoading(true); // Set loading to true when fetching
    try {
      const notificationsRef = collection(db, "users", userId, "notifications");
      const q = query(notificationsRef, orderBy("timestamp", "desc"));
      const querySnapshot = await getDocs(q);

      const fetchedNotifications = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      setNotifications(fetchedNotifications);
    } catch (error) {
      console.error("Error fetching notifications: ", error);
    } finally {
      setLoading(false); // Set loading to false after fetching is done
    }
  };

  // Mark notification as read in Firestore
  const markNotificationAsRead = async (notificationId, userId) => {
    try {
      const notificationRef = doc(
        db,
        "users",
        userId,
        "notifications",
        notificationId
      );
      await updateDoc(notificationRef, { isRead: true });
    } catch (error) {
      console.error("Error marking notification as read: ", error);
    }
  };

  // Mark notification as read locally
  const markAsRead = (id) => {
    setNotifications((prev) =>
      prev.map((notification) =>
        notification.id === id
          ? { ...notification, isRead: true }
          : notification
      )
    );
    markNotificationAsRead(id, user.uid);
  };

  // Mark notification as unread locally and in Firestore
  const markAsUnread = (id) => {
    setNotifications((prev) =>
      prev.map((notification) =>
        notification.id === id
          ? { ...notification, isRead: false }
          : notification
      )
    );
    updateDoc(doc(db, "users", user.uid, "notifications", id), {
      isRead: false,
    });
  };

  // Handle notification click (navigate to relevant page)
  const handleNotificationClick = (notification) => {
    markAsRead(notification.id); // Mark as read both locally and in Firestore

    if (notification.message.includes("Admin")) {
      navigate("/admin-dashboard");
    } else if (notification.message.includes("Peer Reviewer")) {
      navigate("/peer-reviewer-page");
    }
  };

  // Fetch notifications when the component mounts (only when user is logged in)
  useEffect(() => {
    if (user) {
      fetchNotifications(user.uid); // Fetch notifications for the logged-in user
    }
  }, [user]);

  // Handle notification dropdown toggle
  const toggleNotificationDropdown = () => {
    setNotificationDropdownOpen((prev) => !prev);
  };

  // Filter notifications based on active tab (unread, read, or all)
  const filteredNotifications =
    activeTab === "unread"
      ? notifications.filter((notif) => !notif.isRead)
      : activeTab === "read"
      ? notifications.filter((notif) => notif.isRead)
      : notifications; // "all" tab shows all notifications

  return (
    <div className="relative">
      <button
        onClick={toggleNotificationDropdown}
        className="relative focus:outline-none"
      >
        <FontAwesomeIcon
          icon={faBell}
          className="text-gray-700 text-2xl hover:text-red-600 active:text-red-900"
        />
        {notifications.length > 0 && (
          <span className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full px-1.5 text-xs">
            {notifications.filter((notif) => !notif.isRead).length}
          </span>
        )}
      </button>

      {notificationDropdownOpen && (
        <div className="absolute right-0 mt-2 max-w-xs w-64 bg-white rounded-md shadow-lg p-4 z-10">
          <div className="mb-2">
            <h3 className="font-semibold text-gray-800">Notifications</h3>
          </div>
          <div className="flex justify-between mb-2">
            <button
              onClick={() => setActiveTab("all")}
              className={`text-sm font-medium ${
                activeTab === "all" ? "text-blue-600" : "text-gray-600"
              }`}
            >
              All
            </button>
            <button
              onClick={() => setActiveTab("unread")}
              className={`text-sm font-medium ${
                activeTab === "unread" ? "text-blue-600" : "text-gray-600"
              }`}
            >
              Unread
            </button>
            <button
              onClick={() => setActiveTab("read")}
              className={`text-sm font-medium ${
                activeTab === "read" ? "text-blue-600" : "text-gray-600"
              }`}
            >
              Read
            </button>
          </div>
          <div>
            {loading ? (
              <p className="text-gray-500 text-sm">Loading notifications...</p>
            ) : filteredNotifications.length > 0 ? (
              filteredNotifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`p-2 rounded-md cursor-pointer ${
                    notification.isRead ? "bg-gray-100" : "bg-gray-200"
                  }`}
                  onClick={() => handleNotificationClick(notification)}
                >
                  <p className="text-sm">{notification.message}</p>
                  {!notification.isRead && (
                    <button
                      onClick={() => markAsUnread(notification.id)}
                      className="text-blue-600 text-xs mt-1"
                    >
                      Mark as Unread
                    </button>
                  )}
                </div>
              ))
            ) : (
              <p className="text-gray-500 text-sm">No notifications</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Notifications;
