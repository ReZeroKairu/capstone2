import React, { useEffect, useState, useRef, useCallback } from "react";
import { auth, db } from "../firebase/firebase";
import { onAuthStateChanged } from "firebase/auth";
import {
  doc,
  getDoc,
  updateDoc,
  onSnapshot,
  collection,
  addDoc,
} from "firebase/firestore";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";
import { quillModules, quillFormats } from "../utils/quillConfig";
import DOMPurify from "dompurify";

export default function CallForPapers() {
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

  const quillRefs = useRef({ description: null, issues: [] });
  const notificationTimeoutRef = useRef(null);

  const showNotification = useCallback((message, type) => {
    setNotification({ message, type });
    if (notificationTimeoutRef.current)
      clearTimeout(notificationTimeoutRef.current);
    notificationTimeoutRef.current = setTimeout(() => {
      setNotification({ message: "", type: "" });
    }, 4000);
  }, []);

  const checkAdminRole = useCallback(async (user) => {
    if (!user) return setIsAdmin(false);
    try {
      const docRef = doc(db, "Users", user.uid);
      const docSnap = await getDoc(docRef);
      setIsAdmin(docSnap.exists() && docSnap.data().role === "Admin");
    } catch (err) {
      console.error(err);
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
    const docRef = doc(db, "Content", "CallForPapers");
    const unsubscribe = onSnapshot(
      docRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          setContent(data);
          setOriginalContent(data);
        } else {
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
      (err) => {
        console.error(err);
        setError("Failed to load content");
        setLoading(false);
      }
    );
    return () => unsubscribe();
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

  const addIssue = useCallback(
    () => setContent((prev) => ({ ...prev, issues: [...prev.issues, ""] })),
    []
  );

  const removeIssue = useCallback(
    (index) => {
      if (content.issues.length > 1) {
        setContent((prev) => ({
          ...prev,
          issues: prev.issues.filter((_, i) => i !== index),
        }));
        quillRefs.current.issues.splice(index, 1);
      }
    },
    [content.issues.length]
  );

  const hasChanges = () =>
    JSON.stringify(originalContent) !== JSON.stringify(content);

  const removeImageAtIndex = (field, index, issueIndex = null) => {
    let quill;
    if (field === "description") {
      quill = quillRefs.current.description.getEditor();
    } else if (field === "issues") {
      quill = quillRefs.current.issues[issueIndex].getEditor();
    }
    if (!quill) return;

    const delta = quill.getContents();
    let imageCount = -1;
    const newOps = delta.ops.filter((op) => {
      if (op.insert?.image) {
        imageCount++;
        if (imageCount === index) return false;
      }
      return true;
    });
    quill.setContents({ ops: newOps });
    if (field === "description") {
      handleContentChange("description", quill.root.innerHTML);
    } else {
      const updatedIssues = [...content.issues];
      updatedIssues[issueIndex] = quill.root.innerHTML;
      handleContentChange("issues", updatedIssues);
    }
    showNotification("Image removed.", "success");
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
        issues: content.issues.filter((i) => i.trim() !== ""),
      });

      const logRef = collection(db, "UserLog");
      await addDoc(logRef, {
        action: "Edited Call for Papers",
        adminId: auth.currentUser?.uid,
        userId: auth.currentUser?.uid,
        email: auth.currentUser?.email,
        timestamp: new Date(),
      });

      setIsEditing(false);
      setOriginalContent(content);
      showNotification("Changes saved successfully!", "success");
    } catch (err) {
      console.error(err);
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

  if (loading)
    return (
      <div className="flex items-center justify-center min-h-screen text-white text-xl">
        Loading...
      </div>
    );

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div
        className="absolute inset-0 bg-cover bg-center bg-fixed"
        style={{ backgroundImage: "url('/bg.jpg')" }}
      />
      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen mt-11 py-24 w-full">
        <div className="rounded-sm p-6 w-full max-w-2xl mx-auto">
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

          {error && (
            <div className="bg-red-500 text-white p-3 rounded-lg mb-4 text-center">
              {error}
            </div>
          )}

          <div className="bg-yellow-300 py-2 rounded-t-lg w-full flex items-center justify-center">
            <span className="text-2xl font-bold text-black text-center">
              {isEditing ? "Editing: " : ""}
              {content.title}
            </span>
          </div>

          <div className="bg-red-800 text-white p-6 rounded-b-lg w-full">
            {isEditing ? (
              <div className="flex flex-col items-center space-y-4 w-full">
                {/* Title */}
                <input
                  className="block w-full p-3 text-black rounded text-center border-2 border-gray-300 focus:border-blue-500 focus:outline-none transition-colors"
                  placeholder="Enter title"
                  value={content.title}
                  onChange={(e) => handleContentChange("title", e.target.value)}
                />

                {/* Description */}
                <div className="mb-4 w-full">
                  <label className="block font-semibold mb-2">
                    Description
                  </label>
                  <ReactQuill
                    ref={(el) => (quillRefs.current.description = el)}
                    value={content.description || ""}
                    onChange={(val) => handleContentChange("description", val)}
                    modules={quillModules}
                    formats={quillFormats}
                    theme="snow"
                    className="bg-white text-black rounded mb-2"
                  />
                  <div className="flex flex-wrap gap-2 mt-2">
                    {Array.from(
                      new DOMParser()
                        .parseFromString(content.description, "text/html")
                        .querySelectorAll("img")
                    ).map((img, idx) => (
                      <div key={idx} className="relative">
                        <img
                          src={img.src}
                          alt={img.alt || ""}
                          className="w-24 h-24 object-cover rounded"
                        />
                        <button
                          type="button"
                          className="absolute top-0 right-0 bg-red-600 text-white rounded-full w-5 h-5 text-xs"
                          onClick={() => removeImageAtIndex("description", idx)}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

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
                  {content.issues.map((issue, idx) => (
                    <div key={idx} className="mb-3 w-full">
                      <ReactQuill
                        ref={(el) => (quillRefs.current.issues[idx] = el)}
                        value={issue || ""}
                        onChange={(val) => handleIssueChange(idx, val)}
                        modules={quillModules}
                        formats={quillFormats}
                        theme="snow"
                        className="bg-white text-black rounded mb-2"
                      />
                      <div className="flex flex-wrap gap-2 mt-2">
                        {Array.from(
                          new DOMParser()
                            .parseFromString(issue || "", "text/html")
                            .querySelectorAll("img")
                        ).map((img, iidx) => (
                          <div key={iidx} className="relative">
                            <img
                              src={img.src}
                              alt={img.alt || ""}
                              className="w-24 h-24 object-cover rounded"
                            />
                            <button
                              type="button"
                              className="absolute top-0 right-0 bg-red-600 text-white rounded-full w-5 h-5 text-xs"
                              onClick={() =>
                                removeImageAtIndex("issues", iidx, idx)
                              }
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                      {content.issues.length > 1 && (
                        <button
                          className="bg-red-600 hover:bg-red-700 text-white px-2 py-1 rounded text-sm mt-1"
                          onClick={() => removeIssue(idx)}
                        >
                          Remove Issue
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                {/* Action buttons */}
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
                <div
                  className="mb-6 leading-relaxed max-w-none"
                  dangerouslySetInnerHTML={{
                    __html: DOMPurify.sanitize(content.description || "", {
                      ADD_ATTR: [
                        "class",
                        "style",
                        "src",
                        "alt",
                        "height",
                        "width",
                      ],
                    }),
                  }}
                />
                <div className="space-y-4">
                  {content.issues.map(
                    (issue, idx) =>
                      issue.trim() && (
                        <div
                          key={idx}
                          dangerouslySetInnerHTML={{
                            __html: DOMPurify.sanitize(issue, {
                              ADD_ATTR: [
                                "class",
                                "style",
                                "src",
                                "alt",
                                "height",
                                "width",
                              ],
                            }),
                          }}
                        />
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
