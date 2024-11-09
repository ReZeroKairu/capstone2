import React, { useState, useEffect, useRef } from "react";
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
  deleteDoc,
} from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { db } from "../firebase/firebase"; // Ensure your Firebase config is correct

const Notifications = ({ user }) => {
  const [notifications, setNotifications] = useState([]);
  const [activeTab, setActiveTab] = useState("unread");
  const [notificationDropdownOpen, setNotificationDropdownOpen] =
    useState(false);
  const [loading, setLoading] = useState(true);
  const dropdownRef = useRef(null); // Create a ref for the dropdown
  const navigate = useNavigate();

  // Fetch notifications from Firestore
  const fetchNotifications = async (userId) => {
    setLoading(true);
    try {
      const notificationsRef = collection(db, "Users", userId, "Notifications");
      const q = query(notificationsRef, orderBy("timestamp", "desc"));
      const querySnapshot = await getDocs(q);

      const fetchedNotifications = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      setNotifications(fetchedNotifications);
    } catch (error) {
      console.error("Error fetching Notifications:", error);
    } finally {
      setLoading(false);
    }
  };

  // Mark notification as read (update 'seen' field)
  const markNotificationAsUnread = async (notificationId, userId) => {
    try {
      const notificationRef = doc(
        db,
        "Users",
        userId,
        "Notifications",
        notificationId
      );
      await updateDoc(notificationRef, { seen: false });
    } catch (error) {
      console.error("Error marking notification as Unread: ", error);
    }
  };

  const markNotificationAsRead = async (notificationId, userId) => {
    try {
      const notificationRef = doc(
        db,
        "Users",
        userId,
        "Notifications",
        notificationId
      );
      await updateDoc(notificationRef, { seen: true });
    } catch (error) {
      console.error("Error marking notification as seen: ", error);
    }
  };

  const markAsUnread = (id) => {
    setNotifications((prev) =>
      prev.map((notification) =>
        notification.id === id ? { ...notification, seen: false } : notification
      )
    );
    markNotificationAsUnread(id, user.uid);
  };

  // Mark notification as read locally and in Firestore
  const markAsRead = (id) => {
    setNotifications((prev) =>
      prev.map((notification) =>
        notification.id === id ? { ...notification, seen: true } : notification
      )
    );
    markNotificationAsRead(id, user.uid);
  };

  // Delete notification from Firestore and local state
  const deleteNotification = async (notificationId) => {
    const isConfirmed = window.confirm(
      "Are you sure you want to delete this notification?"
    );
    if (!isConfirmed) {
      return; // If the user cancels, exit the function without deleting
    }

    try {
      const notificationRef = doc(
        db,
        "Users",
        user.uid,
        "Notifications",
        notificationId
      );
      await deleteDoc(notificationRef);
      console.log("Notification deleted");
      setNotifications((prev) =>
        prev.filter((notification) => notification.id !== notificationId)
      );
    } catch (error) {
      console.error("Error deleting notification:", error);
    }
  };

  // Handle notification click (navigate to relevant page)
  const handleNotificationClick = (notification) => {
    markAsRead(notification.id);
    if (notification.message.includes("admin")) {
      navigate("/profile");
    } else if (notification.message.includes("Peer Reviewer")) {
      navigate("/profile");
    } else if (notification.message.includes("Researcher")) {
      navigate("/profile");
    }
  };

  // Fetch notifications when the component mounts (only when user is logged in)
  useEffect(() => {
    if (user) {
      fetchNotifications(user.uid);
    }
  }, [user]);

  // Handle notification dropdown toggle
  const toggleNotificationDropdown = (event) => {
    event.stopPropagation(); // Stop click propagation to prevent the outside listener from closing it
    setNotificationDropdownOpen((prev) => !prev);
  };

  // Close dropdown if clicking outside of it
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setNotificationDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Filter notifications based on active tab (unread, read, or all)
  const filteredNotifications =
    activeTab === "unread"
      ? notifications.filter((notif) => !notif.seen)
      : activeTab === "read"
      ? notifications.filter((notif) => notif.seen)
      : notifications;

  return (
    <div className="relative">
      <button
        onClick={toggleNotificationDropdown}
        className="relative focus:outline-none"
      >
        <FontAwesomeIcon
          icon={faBell}
          className="text-gray-700 text-3xl hover:text-red-600 active:text-red-900"
        />
        {notifications.length > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-600 text-white rounded-full px-1.5 text-xs">
            {notifications.filter((notif) => !notif.seen).length}
          </span>
        )}
      </button>

      {notificationDropdownOpen && (
        <div
          ref={dropdownRef}
          className="absolute right-0 mt-2 w-72 bg-white border border-gray-300 rounded-lg shadow-lg overflow-hidden"
        >
          <div className="p-3 bg-gray-100 flex justify-between items-center">
            <h3 className="text-sm font-semibold text-gray-800">
              Notifications
            </h3>
            <div className="flex space-x-2">
              <button
                onClick={() => setActiveTab("all")}
                className={`text-xs font-medium ${
                  activeTab === "all" ? "text-blue-600" : "text-gray-600"
                }`}
              >
                All
              </button>
              <button
                onClick={() => setActiveTab("unread")}
                className={`text-xs font-medium ${
                  activeTab === "unread" ? "text-blue-600" : "text-gray-600"
                }`}
              >
                Unread
              </button>
              <button
                onClick={() => setActiveTab("read")}
                className={`text-xs font-medium ${
                  activeTab === "read" ? "text-blue-600" : "text-gray-600"
                }`}
              >
                Read
              </button>
            </div>
          </div>

          {loading ? (
            <p className="p-4 text-center text-gray-600">Loading...</p>
          ) : filteredNotifications.length === 0 ? (
            <p className="p-4 text-center text-gray-600">No notifications</p>
          ) : (
            filteredNotifications.map((notification) => (
              <div
                key={notification.id}
                className="flex flex-col items-start p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => handleNotificationClick(notification)}
              >
                <div className="w-full">
                  <p
                    className={`text-sm ${
                      notification.seen ? "text-gray-600" : "font-semibold"
                    }`}
                  >
                    {notification.message}
                  </p>
                </div>
                <div className="flex items-center justify-between mt-2 space-x-2">
                  {!notification.seen && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        markAsRead(notification.id);
                      }}
                      className="text-xs text-blue-600 hover:text-blue-800"
                    >
                      Mark as read
                    </button>
                  )}
                  {notification.seen && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation(); // Prevent the click event from bubbling up
                        markAsUnread(notification.id); // Mark notification as unread
                      }}
                      className="text-xs text-blue-600 hover:text-blue-800"
                    >
                      Mark as unread
                    </button>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteNotification(notification.id);
                    }}
                    className="text-xs text-red-600 hover:text-red-800"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default Notifications;
