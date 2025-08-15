import React, { useEffect, useState, useRef, useCallback } from "react";
import { auth, db } from "../firebase/firebase";
import { onAuthStateChanged } from "firebase/auth";
import {
  doc,
  getDoc,
  updateDoc,
  onSnapshot,
  setDoc,
  collection,
} from "firebase/firestore";

function Announcement() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [announcements, setAnnouncements] = useState([
    { title: "", message: "", date: "" },
  ]);
  const [originalAnnouncements, setOriginalAnnouncements] = useState([]);
  const [notification, setNotification] = useState({ message: "", type: "" });
  const [error, setError] = useState("");
  const notificationBarRef = useRef(null);
  const messageRefs = useRef([]);
  const notificationTimeoutRef = useRef(null);

  const autoResize = useCallback((element) => {
    if (element) {
      element.style.height = "auto";
      element.style.height = `${element.scrollHeight}px`;
    }
  }, []);

  const showNotification = useCallback((message, type) => {
    setNotification({ message, type });
    if (notificationTimeoutRef.current)
      clearTimeout(notificationTimeoutRef.current);
    notificationTimeoutRef.current = setTimeout(
      () => setNotification({ message: "", type: "" }),
      4000
    );
  }, []);

  const checkAdminRole = useCallback(async (user) => {
    if (!user) {
      setIsAdmin(false);
      return;
    }
    try {
      const docRef = doc(db, "Users", user.uid);
      const docSnap = await getDoc(docRef);
      setIsAdmin(docSnap.exists() && docSnap.data().role === "Admin");
    } catch (error) {
      console.error("Error checking admin role:", error);
      setError("Failed to verify admin permissions");
      setIsAdmin(false);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setLoading(true);
      await checkAdminRole(user);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [checkAdminRole]);

  useEffect(() => {
    const docRef = doc(db, "Content", "Announcements");
    const unsubscribe = onSnapshot(
      docRef,
      (doc) => {
        const data = doc.exists() ? doc.data() : {};
        const defaultAnnouncements = [
          {
            title: "Welcome!",
            message: "Stay tuned for updates.",
            date: new Date().toLocaleDateString(),
          },
        ];
        const loaded = data.announcements || defaultAnnouncements;
        setAnnouncements(loaded);
        setOriginalAnnouncements(loaded);
        setLoading(false);
      },
      (error) => {
        console.error("Error fetching announcements:", error);
        setError("Failed to load announcements");
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (isEditing)
      announcements.forEach((_, idx) => autoResize(messageRefs.current[idx]));
  }, [announcements, isEditing, autoResize]);

  useEffect(() => {
    if (notification.message && notificationBarRef.current) {
      notificationBarRef.current.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }
  }, [notification.message]);

  useEffect(
    () => () =>
      notificationTimeoutRef.current &&
      clearTimeout(notificationTimeoutRef.current),
    []
  );

  const handleAnnouncementChange = useCallback((index, field, value) => {
    setAnnouncements((prev) =>
      prev.map((a, i) => (i === index ? { ...a, [field]: value } : a))
    );
  }, []);

  const addAnnouncement = useCallback(() => {
    setAnnouncements((prev) => [
      ...prev,
      { title: "", message: "", date: new Date().toISOString().slice(0, 10) },
    ]);
  }, []);

  const removeAnnouncement = useCallback(
    (index) => {
      if (announcements.length > 1)
        setAnnouncements((prev) => prev.filter((_, i) => i !== index));
    },
    [announcements.length]
  );

  const hasChanges = () =>
    JSON.stringify(originalAnnouncements) !== JSON.stringify(announcements);

  const handleSaveChanges = async () => {
    if (!hasChanges()) {
      showNotification("No changes made.", "warning");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const docRef = doc(db, "Content", "Announcements");
      await updateDoc(docRef, {
        announcements: announcements.filter(
          (a) => a.title.trim() && a.message.trim()
        ),
      });
      const logRef = collection(db, "UserLog");
      await setDoc(doc(logRef), {
        action: "Edited Announcements",
        adminId: auth.currentUser?.uid,
        userId: auth.currentUser?.uid,
        email: auth.currentUser?.email,
        timestamp: new Date(),
      });
      setIsEditing(false);
      setOriginalAnnouncements(announcements);
      showNotification("Announcements saved successfully!", "success");
    } catch (error) {
      console.error("Failed to save announcements:", error);
      setError("Failed to save changes. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEdit = useCallback(() => {
    setAnnouncements(originalAnnouncements);
    setIsEditing(false);
    setError("");
  }, [originalAnnouncements]);

  if (loading)
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="absolute inset-0 bg-cover bg-center bg-fixed" />
      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen mt-11 py-6 w-full">
        <div className="rounded-sm p-4 sm:p-6 w-full max-w-2xl mx-auto flex flex-col">
          {notification.message && (
            <div
              ref={notificationBarRef}
              className={`w-full mb-2 py-3 text-center font-semibold rounded-lg text-white transition-all duration-300 ${
                notification.type === "success"
                  ? "bg-green-500"
                  : notification.type === "warning"
                  ? "bg-yellow-500"
                  : "bg-red-500"
              }`}
            >
              {notification.message}
            </div>
          )}
          {error && (
            <div className="bg-red-500 text-white p-3 rounded-lg mb-2 text-center">
              {error}
            </div>
          )}

          {/* Header */}
          <div className="bg-yellow-300 py-2 rounded-t-lg w-full flex items-center justify-center">
            <span className="text-2xl font-bold text-black text-center">
              {isEditing ? "Editing Announcements" : "Announcements"}
            </span>
          </div>

          {/* Announcements container */}
          <div className="bg-red-800 text-white p-4 sm:p-6 rounded-b-lg overflow-y-auto max-h-[calc(100vh-12rem)] flex flex-col">
            {isEditing ? (
              <div className="flex flex-col items-center space-y-4">
                {announcements.map((a, index) => (
                  <div
                    key={index}
                    className="w-full mb-4 bg-red-900 p-3 sm:p-4 rounded flex flex-col"
                  >
                    <input
                      className="block w-full p-2 mb-2 text-black rounded border-2 border-gray-300 focus:border-blue-500 focus:outline-none"
                      placeholder="Announcement Title"
                      value={a.title}
                      onChange={(e) =>
                        handleAnnouncementChange(index, "title", e.target.value)
                      }
                    />
                    <textarea
                      ref={(el) => (messageRefs.current[index] = el)}
                      className="block w-full p-2 mb-2 text-black rounded resize-none border-2 border-gray-300 focus:border-blue-500 focus:outline-none"
                      placeholder="Announcement Message"
                      value={a.message}
                      onChange={(e) => {
                        handleAnnouncementChange(
                          index,
                          "message",
                          e.target.value
                        );
                        autoResize(messageRefs.current[index]);
                      }}
                      style={{ minHeight: "60px", maxHeight: "200px" }}
                    />
                    <input
                      type="date"
                      className="block w-full p-2 mb-2 text-black rounded border-2 border-gray-300 focus:border-blue-500 focus:outline-none"
                      value={a.date}
                      onChange={(e) =>
                        handleAnnouncementChange(index, "date", e.target.value)
                      }
                    />
                    {announcements.length > 1 && (
                      <button
                        className="bg-red-600 hover:bg-red-700 text-white px-2 py-1 rounded text-sm transition-colors"
                        onClick={() => removeAnnouncement(index)}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                ))}
                <button
                  className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm transition-colors"
                  onClick={addAnnouncement}
                >
                  Add Announcement
                </button>
                <div className="flex flex-col sm:flex-row sm:space-x-3 pt-4 space-y-2 sm:space-y-0">
                  <button
                    className={`px-6 py-2 rounded font-semibold transition-colors ${
                      saving || !hasChanges()
                        ? "bg-gray-500 cursor-not-allowed"
                        : "bg-green-600 hover:bg-green-700"
                    } text-white`}
                    onClick={handleSaveChanges}
                    disabled={saving || !hasChanges()}
                  >
                    {saving ? "Saving..." : "Save Changes"}
                  </button>
                  <button
                    className="bg-gray-600 hover:bg-gray-700 text-white px-6 py-2 rounded font-semibold transition-colors"
                    onClick={handleCancelEdit}
                    disabled={saving}
                  >
                    Cancel
                  </button>
                </div>
                {hasChanges() && (
                  <p className="text-yellow-300 text-sm mt-2">
                    You have unsaved changes
                  </p>
                )}
              </div>
            ) : (
              <div className="flex flex-col space-y-4">
                {announcements.length === 0 ? (
                  <p className="text-base sm:text-lg mb-4 leading-relaxed text-center">
                    No announcements yet.
                  </p>
                ) : (
                  <div className="space-y-4">
                    {announcements.map(
                      (a, index) =>
                        a.title.trim() &&
                        a.message.trim() && (
                          <div
                            key={index}
                            className="bg-red-900 rounded p-3 sm:p-4 shadow"
                          >
                            <h3 className="text-lg sm:text-xl font-bold mb-2">
                              {a.title}
                            </h3>
                            <p
                              className="mb-2 text-sm sm:text-base"
                              style={{ whiteSpace: "pre-line" }}
                            >
                              {a.message}
                            </p>
                            <p className="text-xs sm:text-sm text-gray-200 text-right">
                              {a.date}
                            </p>
                          </div>
                        )
                    )}
                  </div>
                )}
                {isAdmin && (
                  <div className="text-center mt-4">
                    <button
                      className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded font-semibold transition-colors"
                      onClick={() => setIsEditing(true)}
                    >
                      Edit Announcements
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Announcement;
