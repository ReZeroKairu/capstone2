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
} from "firebase/firestore";
import { useNavigate } from "react-router-dom";

const db = getFirestore();

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

  const markNotificationAsRead = async (notificationId, userId) => {
    console.log("Marking notification as read:", notificationId, userId); // Log user and notification IDs
    try {
      const notificationRef = doc(
        db,
        "Users",
        userId,
        "Notifications",
        notificationId
      );
      // Update the 'seen' field instead of 'isRead'
      await updateDoc(notificationRef, { seen: true });
    } catch (error) {
      console.error("Error marking notification as seen: ", error);
    }
  };

  // Mark notification as seen locally
  const markAsRead = (id) => {
    setNotifications((prev) =>
      prev.map((notification) =>
        notification.id === id
          ? { ...notification, seen: true } // Update 'seen' field locally
          : notification
      )
    );
    markNotificationAsRead(id, user.uid);
  };

  // Mark notification as unread locally and in Firestore
  const markAsUnread = async (id) => {
    setNotifications((prev) =>
      prev.map((notification) =>
        notification.id === id ? { ...notification, seen: false } : notification
      )
    );
    try {
      await updateDoc(doc(db, "Users", user.uid, "Notifications", id), {
        seen: false,
      });
    } catch (error) {
      console.error("Error marking notification as unread: ", error);
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
  const toggleNotificationDropdown = () => {
    setNotificationDropdownOpen((prev) => !prev);
  };

  // Close dropdown if clicked outside
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
          className="text-gray-700 text-2xl hover:text-red-600 active:text-red-900"
        />
        {notifications.length > 0 && (
          <span className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full px-1.5 text-xs">
            {notifications.filter((notif) => !notif.seen).length}
          </span>
        )}
      </button>

      {notificationDropdownOpen && (
        <div
          ref={dropdownRef} // Attach the ref to the dropdown div
          className="absolute right-0 mt-2 max-w-xs w-64 bg-white rounded-md shadow-lg p-4 z-10"
        >
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
                    notification.seen ? "bg-gray-100" : "bg-gray-200"
                  }`}
                  onClick={() => handleNotificationClick(notification)}
                >
                  <p className="text-sm">{notification.message}</p>
                  {!notification.seen && (
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
