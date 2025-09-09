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
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";
import { quillModules, quillFormats } from "../utils/quillConfig";
import DOMPurify from "dompurify";

export default function Announcement() {
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
  const quillRefs = useRef([]); // wrapper refs for ReactQuill
  const notificationTimeoutRef = useRef(null);

  const autoResize = useCallback(() => {
    announcements.forEach((_, idx) => {
      const wrapper = quillRefs.current[idx];
      if (wrapper) {
        const editor = wrapper.querySelector(".ql-editor");
        if (editor) {
          editor.style.height = "auto";
          editor.style.height = `${editor.scrollHeight}px`;
        }
      }
    });
  }, [announcements]);

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
      (docSnap) => {
        const data = docSnap.exists() ? docSnap.data() : {};
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
    if (isEditing) autoResize();
  }, [announcements, isEditing, autoResize]);

  useEffect(() => {
    if (notification.message && notificationBarRef.current) {
      notificationBarRef.current.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }
  }, [notification.message]);

  useEffect(() => {
    return () => {
      if (notificationTimeoutRef.current)
        clearTimeout(notificationTimeoutRef.current);
    };
  }, []);

  const handleAnnouncementMessageChange = (idx, value) => {
    setAnnouncements((prev) =>
      prev.map((a, i) => (i === idx ? { ...a, message: value } : a))
    );
  };

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

  // --- New function: remove a single image from announcement ---
  const removeSingleImage = (announcementIdx, imgIdx) => {
    setAnnouncements((prev) =>
      prev.map((a, i) => {
        if (i !== announcementIdx) return a;
        // Parse the message as DOM
        const parser = new DOMParser();
        const doc = parser.parseFromString(a.message, "text/html");
        const images = doc.querySelectorAll("img");
        if (images[imgIdx]) images[imgIdx].remove();
        return { ...a, message: doc.body.innerHTML };
      })
    );
    showNotification("Image removed from announcement.", "success");
  };

  const handleSaveChanges = async () => {
    if (!hasChanges()) {
      showNotification("No changes made.", "warning");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const docRef = doc(db, "Content", "Announcements");

      // Save all announcements as-is (images + text preserved)
      const cleaned = announcements.filter(
        (a) => a.title.trim() && a.message.trim()
      );

      await updateDoc(docRef, { announcements: cleaned });

      const logRef = collection(db, "UserLog");
      await setDoc(doc(logRef), {
        action: "Edited Announcements",
        adminId: auth.currentUser?.uid,
        userId: auth.currentUser?.uid,
        email: auth.currentUser?.email,
        timestamp: new Date(),
      });

      setIsEditing(false);
      setOriginalAnnouncements(cleaned);
      setAnnouncements(cleaned);
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
        <div className="text-black text-xl">Loading...</div>
      </div>
    );

  return (
    <div className="relative flex flex-col items-center mt-10 p-6 pt-28 pb-40 sm:p-16 sm:pt-28 sm:pb-16">
      <div className="relative w-full max-w-3xl bg-white border border-gray-300 rounded-lg shadow p-6 pt-11">
        <div className="absolute -top-5 left-1/2 transform -translate-x-1/2 bg-red-800 text-white px-6 py-2 rounded-lg font-bold text-lg">
          {isEditing ? "Editing Announcements" : "Announcements"}
        </div>

        {notification.message && (
          <div
            ref={notificationBarRef}
            className={`w-full mb-4 py-3 text-center font-semibold rounded text-white ${
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
          <div className="bg-red-500 text-white p-3 rounded mb-4 text-center">
            {error}
          </div>
        )}

        <div className="max-h-[60vh] overflow-y-auto">
          {isEditing ? (
            <div className="flex flex-col space-y-4">
              {announcements.map((a, idx) => {
                // Parse images in message
                const parser = new DOMParser();
                const doc = parser.parseFromString(a.message, "text/html");
                const images = Array.from(doc.querySelectorAll("img"));
                return (
                  <div key={idx} className="mb-4">
                    <input
                      type="text"
                      value={a.title}
                      onChange={(e) =>
                        setAnnouncements((prev) =>
                          prev.map((it, i) =>
                            i === idx ? { ...it, title: e.target.value } : it
                          )
                        )
                      }
                      className="w-full p-2 border rounded mb-2"
                      placeholder="Announcement Title"
                    />
                    <div ref={(el) => (quillRefs.current[idx] = el)}>
                      <ReactQuill
                        value={a.message}
                        onChange={(val) =>
                          handleAnnouncementMessageChange(idx, val)
                        }
                        modules={quillModules}
                        formats={quillFormats}
                        theme="snow"
                        className="bg-white text-black rounded mb-2"
                      />
                    </div>

                    {/* Display buttons for each image */}
                    {images.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-2">
                        {images.map((img, imgIdx) => (
                          <button
                            key={imgIdx}
                            className="px-2 py-1 bg-yellow-500 text-white rounded text-xs"
                            onClick={() => removeSingleImage(idx, imgIdx)}
                          >
                            Remove image {imgIdx + 1}
                          </button>
                        ))}
                      </div>
                    )}

                    <div className="flex gap-2 mb-2">
                      <button
                        type="button"
                        onClick={() =>
                          setAnnouncements((prev) =>
                            prev.map((it, i) =>
                              i === idx ? { ...it, message: "" } : it
                            )
                          )
                        }
                        className="px-3 py-1 bg-red-500 text-white rounded text-xs"
                      >
                        Clear message
                      </button>
                    </div>
                  </div>
                );
              })}
              <button
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm"
                onClick={addAnnouncement}
              >
                Add Announcement
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {announcements.length === 0 ? (
                <p className="text-center text-gray-600">
                  No announcements yet.
                </p>
              ) : (
                announcements.map(
                  (a, index) =>
                    a.title.trim() &&
                    a.message.trim() && (
                      <div
                        key={index}
                        className="bg-gray-50 border rounded p-4 shadow"
                      >
                        <h3 className="text-lg font-bold mb-1">{a.title}</h3>
                        <div
                          className="mb-2 text-gray-800 prose max-w-none"
                          dangerouslySetInnerHTML={{
                            __html: DOMPurify.sanitize(a.message || "", {
                              ADD_ATTR: ["class", "style"],
                            }),
                          }}
                        />
                        <p className="text-xs text-gray-500 text-right">
                          {a.date}
                        </p>
                      </div>
                    )
                )
              )}
            </div>
          )}
        </div>

        {isAdmin && (
          <div className="flex flex-wrap justify-center gap-3 mt-6">
            {isEditing ? (
              <>
                <button
                  className={`px-6 py-2 rounded font-semibold ${
                    saving || !hasChanges()
                      ? "bg-gray-400 cursor-not-allowed"
                      : "bg-green-600 hover:bg-green-700 text-white"
                  }`}
                  onClick={handleSaveChanges}
                  disabled={saving || !hasChanges()}
                >
                  {saving ? "Saving..." : "Save Changes"}
                </button>
                <button
                  className="bg-gray-600 hover:bg-gray-700 text-white px-6 py-2 rounded font-semibold"
                  onClick={handleCancelEdit}
                  disabled={saving}
                >
                  Cancel
                </button>
              </>
            ) : (
              <button
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded font-semibold"
                onClick={() => setIsEditing(true)}
              >
                Edit Announcements
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
