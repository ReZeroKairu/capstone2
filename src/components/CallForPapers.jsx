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

function CallForPapers() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [content, setContent] = useState({
    title: "",
    description: "",
    issues: [""],
  });
  const [originalContent, setOriginalContent] = useState({});
  const [notification, setNotification] = useState({ message: "", type: "" });
  const [error, setError] = useState("");

  const textareaRef = useRef(null);
  const issueRefs = useRef([]);
  const notificationTimeoutRef = useRef(null);

  // Auto-resize textarea utility
  const autoResize = useCallback((element) => {
    if (element) {
      element.style.height = "auto";
      element.style.height = `${element.scrollHeight}px`;
    }
  }, []);

  // Show notification with auto-dismiss
  const showNotification = useCallback((message, type) => {
    setNotification({ message, type });

    // Clear existing timeout
    if (notificationTimeoutRef.current) {
      clearTimeout(notificationTimeoutRef.current);
    }

    // Set new timeout
    notificationTimeoutRef.current = setTimeout(() => {
      setNotification({ message: "", type: "" });
    }, 4000);
  }, []);

  // Check if user is admin
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

  // Auth state listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setLoading(true);
      await checkAdminRole(user);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [checkAdminRole]);

  // Content listener
  useEffect(() => {
    const docRef = doc(db, "Content", "CallForPapers");

    const unsubscribe = onSnapshot(
      docRef,
      (doc) => {
        if (doc.exists()) {
          const data = doc.data();
          setContent(data);
          setOriginalContent(data);
        } else {
          // Initialize with default content if document doesn't exist
          const defaultContent = {
            title: "Call for Papers",
            description: "Submit your research papers here.",
            issues: ["Issue 1"],
          };
          setContent(defaultContent);
          setOriginalContent(defaultContent);
        }
        setLoading(false);
      },
      (error) => {
        console.error("Error fetching content:", error);
        setError("Failed to load content");
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // Auto-resize textareas when content changes
  useEffect(() => {
    if (isEditing) {
      autoResize(textareaRef.current);
    }
  }, [content.description, isEditing, autoResize]);

  // Scroll to top when notification appears
  useEffect(() => {
    if (notification.message) {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [notification.message]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (notificationTimeoutRef.current) {
        clearTimeout(notificationTimeoutRef.current);
      }
    };
  }, []);

  const handleContentChange = useCallback((field, value) => {
    setContent((prev) => ({ ...prev, [field]: value }));
  }, []);

  const handleIssueChange = useCallback((index, value) => {
    setContent((prev) => ({
      ...prev,
      issues: prev.issues.map((issue, i) => (i === index ? value : issue)),
    }));
  }, []);

  const addIssue = useCallback(() => {
    setContent((prev) => ({
      ...prev,
      issues: [...prev.issues, ""],
    }));
  }, []);

  const removeIssue = useCallback(
    (index) => {
      if (content.issues.length > 1) {
        setContent((prev) => ({
          ...prev,
          issues: prev.issues.filter((_, i) => i !== index),
        }));
      }
    },
    [content.issues.length]
  );

  const hasChanges = () => {
    return JSON.stringify(originalContent) !== JSON.stringify(content);
  };

  const handleSaveChanges = async () => {
    if (!hasChanges()) {
      showNotification("No changes made.", "warning");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const docRef = doc(db, "Content", "CallForPapers");

      await updateDoc(docRef, {
        title: content.title,
        description: content.description,
        issues: content.issues.filter((issue) => issue.trim() !== ""), // Remove empty issues
      });

      // Log the change
      const logRef = collection(db, "UserLog");
      const logEntry = {
        action: "Edited Call for Papers",
        adminId: auth.currentUser?.uid,
        userId: auth.currentUser?.uid,
        email: auth.currentUser?.email,
        timestamp: new Date(),
      };

      await setDoc(doc(logRef), logEntry);

      setIsEditing(false);
      setOriginalContent(content);
      showNotification("Changes saved successfully!", "success");
    } catch (error) {
      console.error("Failed to save content:", error);
      setError("Failed to save changes. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEdit = useCallback(() => {
    setContent(originalContent);
    setIsEditing(false);
    setError("");
  }, [originalContent]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div
        className="absolute inset-0 bg-cover bg-center bg-fixed"
        style={{ backgroundImage: "url('/bg.jpg')" }}
      />

      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen mt-11 py-24 w-full">
        <div className="rounded-sm p-6 w-full max-w-2xl mx-auto">
          {/* Notification Bar */}
          {notification.message && (
            <div
              className={`fixed top-5 left-1/2 transform -translate-x-1/2 w-full max-w-md py-3 text-center font-semibold rounded-lg text-white z-50 transition-all duration-300 ${
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

          {/* Error Message */}
          {error && (
            <div className="bg-red-500 text-white p-3 rounded-lg mb-4 text-center">
              {error}
            </div>
          )}

          {/* Content */}
          <div className="bg-yellow-300 py-2 rounded-t-lg w-full flex items-center justify-center">
            <span className="text-2xl font-bold text-black text-center">
              {isEditing ? "Editing: " : ""}
              {content.title}
            </span>
          </div>

          <div className="bg-red-800 text-white p-6 rounded-b-lg">
            {isEditing ? (
              <div className="flex flex-col items-center space-y-4">
                {/* Title Input */}
                <input
                  className="block w-full p-3 text-black rounded text-center border-2 border-gray-300 focus:border-blue-500 focus:outline-none transition-colors"
                  placeholder="Enter title"
                  value={content.title}
                  onChange={(e) => handleContentChange("title", e.target.value)}
                />

                {/* Description Input */}
                <textarea
                  ref={textareaRef}
                  className="block w-full p-3 text-black rounded text-center resize-none border-2 border-gray-300 focus:border-blue-500 focus:outline-none transition-colors"
                  placeholder="Enter description"
                  value={content.description}
                  onChange={(e) => {
                    handleContentChange("description", e.target.value);
                    autoResize(textareaRef.current);
                  }}
                  style={{ minHeight: "80px", maxHeight: "300px" }}
                />

                {/* Issues */}
                <div className="w-full">
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="text-lg font-semibold">Issues</h3>
                    <button
                      className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm transition-colors"
                      onClick={addIssue}
                    >
                      Add Issue
                    </button>
                  </div>

                  {content.issues.map((issue, index) => (
                    <div
                      key={index}
                      className="flex items-center space-x-2 mb-3"
                    >
                      <textarea
                        ref={(el) => (issueRefs.current[index] = el)}
                        className="flex-1 p-3 text-black rounded text-center resize-none border-2 border-gray-300 focus:border-blue-500 focus:outline-none transition-colors"
                        placeholder={`Issue ${index + 1}`}
                        value={issue}
                        onChange={(e) => {
                          handleIssueChange(index, e.target.value);
                          autoResize(issueRefs.current[index]);
                        }}
                        style={{ minHeight: "60px", maxHeight: "200px" }}
                      />
                      {content.issues.length > 1 && (
                        <button
                          className="bg-red-600 hover:bg-red-700 text-white px-2 py-1 rounded text-sm transition-colors"
                          onClick={() => removeIssue(index)}
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                {/* Action Buttons */}
                <div className="flex space-x-3 pt-4">
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
                  <p className="text-yellow-300 text-sm">
                    You have unsaved changes
                  </p>
                )}
              </div>
            ) : (
              <div>
                <p
                  className="text-lg mb-6 leading-relaxed"
                  style={{ whiteSpace: "pre-line" }}
                >
                  {content.description}
                </p>

                <div className="text-center space-y-4">
                  {content.issues.map(
                    (issue, index) =>
                      issue.trim() && (
                        <p
                          key={index}
                          className="text-2xl font-bold"
                          style={{ whiteSpace: "pre-line" }}
                        >
                          {issue}
                        </p>
                      )
                  )}
                </div>

                {isAdmin && (
                  <div className="text-center mt-8">
                    <button
                      className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded font-semibold transition-colors"
                      onClick={() => setIsEditing(true)}
                    >
                      Edit Content
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

export default CallForPapers;
