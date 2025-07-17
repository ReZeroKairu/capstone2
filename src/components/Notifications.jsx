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
import { getAuth } from "firebase/auth";

const Notifications = ({ user }) => {
  const [notifications, setNotifications] = useState([]);
  const [activeTab, setActiveTab] = useState("unread");
  const [notificationDropdownOpen, setNotificationDropdownOpen] =
    useState(false);
  const [loading, setLoading] = useState(true);
  const dropdownRef = useRef(null); // Create a ref for the dropdown
  const navigate = useNavigate();
  const auth = getAuth();
  const buttonRef = useRef(null); // Ref for the button to prevent closing when the button is clicked
  // Fetch notifications from Firestore

  const fetchNotifications = async (userId) => {
    setLoading(true);
    try {
      const notificationsRef = collection(db, "Users", userId, "Notifications");
      const q = query(notificationsRef, orderBy("timestamp", "desc"));
      const querySnapshot = await getDocs(q);

      const fetchedNotifications = querySnapshot.docs.map((doc) => {
        const data = doc.data();
        const timestamp = data.timestamp ? data.timestamp.toDate() : null; // Convert Firestore timestamp to JavaScript Date
        return {
          id: doc.id,
          ...data,
          timestamp: timestamp, // Add timestamp to the notification object
        };
      });

      setNotifications(fetchedNotifications);
    } catch (error) {
      console.error("Error fetching Notifications:", error);
    } finally {
      setLoading(false);
    }
  };

  const markNotificationAsUnread = async (notificationId) => {
    try {
      const userId = auth.currentUser?.uid; // Get the authenticated user's UID
      if (!userId) throw new Error("User is not authenticated.");

      const notificationRef = doc(
        db,
        "Users",
        userId,
        "Notifications",
        notificationId
      );

      await updateDoc(notificationRef, { seen: false });
      console.log("Notification marked as unread");
    } catch (error) {
      console.error("Error marking notification as unread: ", error);
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

      // Access the current authenticated user
      const auth = getAuth();
      const currentUser = auth.currentUser;

      if (currentUser) {
        // Ensure the user is authenticated before updating
        await updateDoc(notificationRef, { seen: true });
        console.log("Notification marked as seen");
      } else {
        console.error("User is not authenticated");
      }
    } catch (error) {
      console.error("Error marking notification as seen: ", error);
    }
  };

  const markAsUnread = (id) => {
    try {
      // Update local state
      setNotifications((prev) =>
        prev.map((notification) =>
          notification.id === id
            ? { ...notification, seen: false }
            : notification
        )
      );

      // Update Firestore
      if (user?.uid) {
        markNotificationAsUnread(id, user.uid);
      } else {
        console.error("User is not authenticated.");
      }
    } catch (error) {
      console.error("Error marking notification as unread:", error);
    }
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
    if (notification.message.includes("Admin")) {
      navigate("/profile");
    } else if (notification.message.includes("Peer Reviewer")) {
      navigate("/profile");
    } else if (notification.message.includes("Researcher")) {
      navigate("/profile");
    }
  };

  // Fetch notifications when the component mounts (only when user is logged in)
  useEffect(() => {
    if (user && user.uid) {
      fetchNotifications(user.uid);
    }
  }, [user]);

  // Toggle dropdown visibility when icon is clicked
  const toggleNotificationDropdown = (event) => {
    event.stopPropagation(); // Prevent outside click handler from closing dropdown
    setNotificationDropdownOpen((prev) => !prev); // Toggle dropdown open/close
  };

  // Close dropdown when clicking outside of it
  useEffect(() => {
    const handleClickOutside = (event) => {
      // Check if the click is outside both the dropdown and the button
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target) && // Click is outside dropdown
        buttonRef.current &&
        !buttonRef.current.contains(event.target) // Click is outside button
      ) {
        setNotificationDropdownOpen(false); // Close dropdown
      }
    };

    // Add event listener to close dropdown on outside click
    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      // Cleanup event listener on component unmount
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
      {/* Notification Icon */}
      <button
        onClick={toggleNotificationDropdown}
        ref={buttonRef} // Attach ref to the button
        className="relative focus:outline-none"
      >
        <FontAwesomeIcon
          icon={faBell}
          className="text-white text-3xl hover:text-red-600 active:text-red-900"
        />

        {notifications.filter((notif) => !notif.seen).length > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-600 text-white rounded-full px-1.5 text-xs">
            {notifications.filter((notif) => !notif.seen).length}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {notificationDropdownOpen && (
        <div
          ref={dropdownRef} // Ref for dropdown to detect outside click
          className="absolute right-0 mt-2 w-72 bg-white border border-gray-300 rounded-lg shadow-lg overflow-hidden"
        >
          {/* Header */}
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

          {/* Notifications Content */}
          <div className="notifications-container">
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
                          e.stopPropagation();
                          markAsUnread(notification.id);
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
                  {/* Timestamp Display */}
                  {notification.timestamp && (
                    <div className="text-xs text-gray-500 mt-1">
                      {new Date(
                        notification.timestamp.toMillis
                          ? notification.timestamp.toMillis()
                          : Date.parse(notification.timestamp)
                      ).toLocaleString()}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Notifications;
