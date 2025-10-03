import React, { useState, useEffect, useRef } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBell } from "@fortawesome/free-solid-svg-icons";
import { useLocation } from "react-router-dom";

import {
  collection,
  query,
  orderBy,
  limit,
  startAfter,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  getDoc,
} from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { db } from "../firebase/firebase"; // Ensure your Firebase config is correct
import { getAuth } from "firebase/auth";
import { UserLogService } from "../utils/userLogService";
import { onSnapshot } from "firebase/firestore";
import { formatDistanceToNow } from 'date-fns';

const Notifications = ({ user }) => {
  const [notifications, setNotifications] = useState([]);
  const [activeTab, setActiveTab] = useState("unread");
  const [notificationDropdownOpen, setNotificationDropdownOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [unsubscribe, setUnsubscribe] = useState(null);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();
  const auth = getAuth();
  const buttonRef = useRef(null);
   const location = useLocation(); 
  const NOTIFICATIONS_LIMIT = 20; // Limit the number of notifications to fetch initially
  const [lastVisible, setLastVisible] = useState(null);
  const [hasMore, setHasMore] = useState(true);

  // Set up real-time notifications listener with pagination
  useEffect(() => {
    const userId = user?.uid;
    if (!userId) return;

    setLoading(true);
    
    try {
      const notificationsRef = collection(db, "Users", userId, "Notifications");
      let q = query(
        notificationsRef, 
        orderBy("timestamp", "desc"),
        limit(NOTIFICATIONS_LIMIT)
      );
      
      // Set up real-time listener with error handling
      const unsubscribeListener = onSnapshot(
        q, 
        (querySnapshot) => {
          const fetchedNotifications = [];
          querySnapshot.forEach((doc) => {
            const data = doc.data();
            const timestamp = data.timestamp ? data.timestamp.toDate() : null;
            fetchedNotifications.push({
              id: doc.id,
              ...data,
              timestamp,
            });
          });
          
          // Update the last visible document for pagination
          const lastVisibleDoc = querySnapshot.docs[querySnapshot.docs.length - 1];
          setLastVisible(lastVisibleDoc);
          setHasMore(querySnapshot.docs.length >= NOTIFICATIONS_LIMIT);
          
          setNotifications(fetchedNotifications);
          setLoading(false);
        }, 
        (error) => {
          console.error("Error in notifications listener:", error);
          setLoading(false);
        }
      );
      
      // Save the unsubscribe function
      setUnsubscribe(() => unsubscribeListener);
      
      // Cleanup function
      return () => {
        if (unsubscribeListener) {
          unsubscribeListener();
        }
      };
    } catch (error) {
      console.error("Error setting up notifications listener:", error);
      setLoading(false);
    }
  }, [user?.uid]); // Re-run effect when user changes

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

  // Delete all read notifications
  const deleteAllReadNotifications = async () => {
    const readNotifications = notifications.filter((notif) => notif.seen);
    
    if (readNotifications.length === 0) {
      alert("No read notifications to delete.");
      return;
    }

    const isConfirmed = window.confirm(
      `Are you sure you want to delete all ${readNotifications.length} read notifications? This action cannot be undone.`
    );
    
    if (!isConfirmed) {
      return;
    }

    try {
      // Delete all read notifications from Firestore
      const deletePromises = readNotifications.map(async (notification) => {
        const notificationRef = doc(
          db,
          "Users",
          user.uid,
          "Notifications",
          notification.id
        );
        return deleteDoc(notificationRef);
      });

      await Promise.all(deletePromises);
      
      // Update local state to remove deleted notifications
      setNotifications((prev) =>
        prev.filter((notification) => !notification.seen)
      );
      
      console.log(`${readNotifications.length} read notifications deleted`);
    } catch (error) {
      console.error("Error deleting read notifications:", error);
      alert("Failed to delete some notifications. Please try again.");
    }
  };

  // Mark all notifications as read
  const markAllAsRead = async () => {
    const unreadNotifications = notifications.filter((notif) => !notif.seen);
    
    if (unreadNotifications.length === 0) {
      alert("All notifications are already read.");
      return;
    }

    try {
      // Mark all unread notifications as read in Firestore
      const updatePromises = unreadNotifications.map(async (notification) => {
        const notificationRef = doc(
          db,
          "Users",
          user.uid,
          "Notifications",
          notification.id
        );
        return updateDoc(notificationRef, { seen: true });
      });

      await Promise.all(updatePromises);
      
      // Update local state
      setNotifications((prev) =>
        prev.map((notification) => ({ ...notification, seen: true }))
      );
      
      console.log(`${unreadNotifications.length} notifications marked as read`);
    } catch (error) {
      console.error("Error marking notifications as read:", error);
      alert("Failed to mark some notifications as read. Please try again.");
    }
  };

  // Get user role for role-based navigation
  const getUserRole = async () => {
    try {
      const auth = getAuth();
      const currentUser = auth.currentUser;
      if (currentUser) {
        const userDoc = await getDoc(doc(db, "Users", currentUser.uid));
        return userDoc.exists() ? userDoc.data().role : "Researcher";
      }
    } catch (error) {
      console.error("Error fetching user role:", error);
    }
    return "Researcher";
  };

  // Handle notification click (navigate to relevant page)
 const handleNotificationClick = async (notification) => {
  markAsRead(notification.id);

  // If notification has an actionUrl property, navigate directly
  if (notification.actionUrl) {
    navigate(notification.actionUrl);
    return;
  }

  // Get current user role for role-based navigation
  const userRole = await getUserRole();


    // Navigate based on notification type and metadata
    const actionUrl = notification.metadata?.actionUrl;
    if (actionUrl) {
      navigate(actionUrl);
      return;
    }

    // Enhanced role-based navigation logic
    switch (notification.type) {
      case "manuscript_status":
        // Authors go to manuscripts to see their submissions
        if (userRole === "Researcher") {
          navigate("/manuscripts");
        } else if (userRole === "Admin") {
          navigate("/manuscripts");
        } else {
          navigate("/dashboard");
        }
        break;

      case "manuscript_final":
        // Final decisions - admins go to manuscripts, others to dashboard
        if (userRole === "Admin") {
          navigate("/manuscripts");
        } else {
          navigate("/dashboard");
        }
        break;

case "new_submission":
  if (userRole === "Admin") {
    if (location.pathname !== "/formresponses") {
      navigate("/formresponses");
    }
    // Dispatch refresh event
    window.dispatchEvent(new Event("refreshFormResponses"));
  } else {
    navigate("/dashboard");
  }
  break;


    case "reviewer_assignment":
  // Navigate to actionUrl if it exists, otherwise fallback
  if (notification.metadata?.actionUrl) {
    navigate(notification.metadata.actionUrl);
  } else if (userRole === "Peer Reviewer") {
    navigate("/reviewer-invitations"); // <- new target
  } else {
    navigate("/dashboard");
  }
  break;


      case "reviewer_decision":
      case "review_completed":
        // Reviewer actions - admins go to manuscripts to see updates
        if (userRole === "Admin") {
          navigate("/manuscripts");
        } else if (userRole === "Peer Reviewer") {
          navigate("/review-manuscript");
        } else {
          navigate("/dashboard");
        }
        break;

      case "deadline_reminder":
        // Deadline reminders based on role
        if (userRole === "Admin") {
          navigate("/admin/deadlines");
        } else if (userRole === "Peer Reviewer") {
          navigate("/review-manuscript");
        } else {
          navigate("/manuscripts");
        }
        break;

      case "user_management":
        // User management notifications
        if (userRole === "Admin") {
          navigate("/user-management");
        } else {
          navigate("/profile");
        }
        break;

      case "peer_reviewer_list":
        // Peer reviewer related notifications
        if (userRole === "Admin") {
          navigate("/peer-reviewers");
        } else {
          navigate("/profile");
        }
        break;

      default:
        // Default fallback based on role
        if (userRole === "Admin") {
          navigate("/dashboard");
        } else if (userRole === "Peer Reviewer") {
          navigate("/review-manuscript");
        } else {
          navigate("/manuscripts");
        }
    }
  };

  // Get notification icon based on type
  const getNotificationIcon = (type) => {
    switch (type) {
      case "manuscript_status":
        return "📄";
      case "manuscript_final":
        return "✅";
      case "new_submission":
        return "📝";
      case "reviewer_assignment":
        return "👥";
      case "reviewer_decision":
        return "⚖️";
      case "review_completed":
        return "✔️";
      case "deadline_reminder":
        return "⏰";
      default:
        return "🔔";
    }
  };

  // Get notification color based on type
  const getNotificationColor = (type) => {
    switch (type) {
      case "manuscript_status":
        return "text-blue-600";
      case "manuscript_final":
        return "text-green-600";
      case "new_submission":
        return "text-purple-600";
      case "reviewer_assignment":
        return "text-orange-600";
      case "reviewer_decision":
        return "text-indigo-600";
      case "review_completed":
        return "text-green-600";
      case "deadline_reminder":
        return "text-red-600";
      default:
        return "text-gray-600";
    }
  };

  // Load more notifications for pagination
  const loadMoreNotifications = async () => {
    if (!hasMore || loading) return;
    
    setLoading(true);
    try {
      const userId = user?.uid;
      if (!userId) return;

      const notificationsRef = collection(db, "Users", userId, "Notifications");
      let q = query(
        notificationsRef,
        orderBy("timestamp", "desc"),
        startAfter(lastVisible),
        limit(NOTIFICATIONS_LIMIT)
      );

      const querySnapshot = await getDocs(q);
      const newNotifications = [];
      
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        const timestamp = data.timestamp?.toDate() || null;
        newNotifications.push({
          id: doc.id,
          ...data,
          timestamp,
        });
      });

      setNotifications(prev => [...prev, ...newNotifications]);
      setLastVisible(querySnapshot.docs[querySnapshot.docs.length - 1]);
      setHasMore(querySnapshot.docs.length >= NOTIFICATIONS_LIMIT);
    } catch (error) {
      console.error("Error loading more notifications:", error);
    } finally {
      setLoading(false);
    }
  };

   useEffect(() => {
  const userId = user?.uid;
  if (!userId) return;

  setLoading(true);
  
  try {
    const notificationsRef = collection(db, "Users", userId, "Notifications");
    let q = query(
      notificationsRef, 
      orderBy("timestamp", "desc"),
      limit(NOTIFICATIONS_LIMIT)
    );
    
    const unsubscribeListener = onSnapshot(
      q, 
      (querySnapshot) => {
        const fetchedNotifications = [];
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          const timestamp = data.timestamp ? data.timestamp.toDate() : null;
          fetchedNotifications.push({
            id: doc.id,
            ...data,
            timestamp,
          });
        });
        const lastVisibleDoc = querySnapshot.docs[querySnapshot.docs.length - 1];
        setLastVisible(lastVisibleDoc);
        setHasMore(querySnapshot.docs.length >= NOTIFICATIONS_LIMIT);
        setNotifications(fetchedNotifications);
        setLoading(false);
      }, 
      (error) => {
        console.error("Error in notifications listener:", error);
        setLoading(false);
      }
    );
    
    // Cleanup: unsubscribe when component unmounts or user changes
    return () => unsubscribeListener();

  } catch (error) {
    console.error("Error setting up notifications listener:", error);
    setLoading(false);
  }
}, [user?.uid]);

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
          <div className="p-3 bg-gray-100">
            <div className="flex justify-between items-center mb-2">
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
            
            {/* Action Buttons */}
            <div className="flex justify-between items-center">
              {/* Mark All as Read Button */}
              {notifications.filter((notif) => !notif.seen).length > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-2 py-1 rounded transition-colors"
                  title={`Mark ${notifications.filter((notif) => !notif.seen).length} notifications as read`}
                >
                  ✓ Mark All Read ({notifications.filter((notif) => !notif.seen).length})
                </button>
              )}
              
              {/* Delete All Read Button */}
              {notifications.filter((notif) => notif.seen).length > 0 && (
                <button
                  onClick={deleteAllReadNotifications}
                  className="text-xs text-red-600 hover:text-red-800 hover:bg-red-50 px-2 py-1 rounded transition-colors"
                  title={`Delete ${notifications.filter((notif) => notif.seen).length} read notifications`}
                >
                  🗑️ Clear Read ({notifications.filter((notif) => notif.seen).length})
                </button>
              )}
            </div>
          </div>

          {/* Notifications Content */}
          <div className="max-h-96 overflow-y-auto">
            {loading && notifications.length === 0 ? (
              <div className="p-4 text-center text-gray-500">Loading notifications...</div>
            ) : filteredNotifications.length === 0 ? (
              <div className="p-4 text-center text-gray-500">
                No {activeTab} notifications
              </div>
            ) : (
              <div>
                <ul className="divide-y divide-gray-200">
                {filteredNotifications.map((notification) => (
                  <li
                    key={notification.id}
                    className={`p-3 hover:bg-gray-50 cursor-pointer ${
                      !notification.seen ? "bg-blue-50" : ""
                    }`}
                    onClick={() => handleNotificationClick(notification)}
                  >
                    <div className="flex items-start">
                      <div className="flex-shrink-0 pt-0.5">
                        <span className={`text-lg ${getNotificationColor(notification.type)}`}>
                          {getNotificationIcon(notification.type)}
                        </span>
                      </div>
                      <div className="ml-3 flex-1">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium text-gray-900">
                            {notification.title}
                          </p>
                          <div className="flex space-x-2">
                            <span className="text-xs text-gray-500">
                              {notification.timestamp
                                ? formatDistanceToNow(notification.timestamp, {
                                    addSuffix: true,
                                  })
                                : ""}
                            </span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                notification.seen
                                  ? markAsUnread(notification.id)
                                  : markAsRead(notification.id, user.uid);
                              }}
                              className="text-xs text-blue-600 hover:text-blue-800"
                            >
                              {notification.seen ? "Mark as unread" : "Mark as read"}
                            </button>
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
                        <p className="mt-1 text-sm text-gray-600">
                          {notification.message}
                        </p>
                      </div>
                    </div>
                  </li>
                ))}
                </ul>

                {/* Load More Button */}
                {hasMore && (
                  <div className="p-3 text-center border-t border-gray-200">
                    <button
                      onClick={loadMoreNotifications}
                      disabled={loading}
                      className="text-sm text-blue-600 hover:text-blue-800 disabled:opacity-50 px-4 py-2 bg-gray-50 hover:bg-gray-100 rounded-md w-full transition-colors"
                    >
                      {loading ? 'Loading...' : 'Load More Notifications'}
                    </button>
                  </div>
                )}
              </div>
          )}
        </div>
      </div>
    )}
  </div>
  );
};

export default Notifications;
