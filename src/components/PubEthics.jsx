import React, { useState, useEffect, useRef } from "react";
import {
  doc,
  updateDoc,
  getDoc,
  setDoc,
  onSnapshot,
  arrayUnion,
  arrayRemove,
} from "firebase/firestore";
import { auth, db } from "../firebase/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { FaEdit, FaTrashAlt } from "react-icons/fa";

const PubEthics = () => {
  const [isAdmin, setIsAdmin] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [headerText, setHeaderText] = useState("");
  const [footerText, setFooterText] = useState("");
  const [sections, setSections] = useState([]);
  const [newSectionTitle, setNewSectionTitle] = useState("");
  const [newSectionContent, setNewSectionContent] = useState("");
  const [notification, setNotification] = useState({ message: "", type: "" });
  const notificationTimeoutRef = useRef(null);
  const notificationBarRef = useRef(null);
  // Store original content for cancel
  const [original, setOriginal] = useState({
    header: "",
    footer: "",
    sections: [],
  });
  // Compare current state with original to detect changes
  const hasChanges = () => {
    if (headerText !== original.header) return true;
    if (footerText !== original.footer) return true;
    // Compare sections (shallow)
    if (sections.length !== original.sections.length) return true;
    for (let i = 0; i < sections.length; i++) {
      if (
        sections[i].title !== original.sections[i]?.title ||
        sections[i].content !== original.sections[i]?.content
      ) {
        return true;
      }
    }
    return false;
  };

  useEffect(() => {
    if (notification.message && notificationBarRef.current) {
      notificationBarRef.current.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }
  }, [notification.message]);

  // Fetch content and user role
  useEffect(() => {
    const docRef = doc(db, "Content", "PubEthics");
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setHeaderText(data.header || "");
        setFooterText(data.footer || "");
        setSections(data.sections || []);
        setOriginal({
          header: data.header || "",
          footer: data.footer || "",
          sections: data.sections || [],
        });
      } else {
        setHeaderText("");
        setFooterText("");
        setSections([]);
        setOriginal({ header: "", footer: "", sections: [] });
      }
    });

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const userDoc = doc(db, "Users", user.uid);
        const userSnap = await getDoc(userDoc);
        if (userSnap.exists()) {
          setIsAdmin(userSnap.data().role === "Admin");
        } else {
          setIsAdmin(false);
        }
      } else {
        setIsAdmin(false);
      }
    });

    return () => {
      unsubscribe();
      unsubscribeAuth();
    };
  }, []);

  // Notification utility
  const showNotification = (message, type) => {
    setNotification({ message, type });
    if (notificationTimeoutRef.current) {
      clearTimeout(notificationTimeoutRef.current);
    }
    notificationTimeoutRef.current = setTimeout(() => {
      setNotification({ message: "", type: "" });
    }, 4000);
  };

  // Save all changes
  const handleSaveAll = async () => {
    try {
      const docRef = doc(db, "Content", "PubEthics");
      await setDoc(docRef, {
        header: headerText,
        footer: footerText,
        sections: sections,
      });
      setIsEditing(false);
      showNotification("All changes saved successfully!", "success");
    } catch (error) {
      console.error("Error saving all changes:", error);
      showNotification("There was an error saving the content.", "error");
    }
  };

  // Cancel editing and revert to original
  const handleCancelEdit = () => {
    setHeaderText(original.header);
    setFooterText(original.footer);
    setSections(original.sections);
    setNewSectionTitle("");
    setNewSectionContent("");
    setIsEditing(false);
  };

  // Add a new section
  const handleAddSection = async () => {
    if (newSectionTitle.trim() && newSectionContent.trim()) {
      const newSection = {
        id: Date.now(),
        title: newSectionTitle.trim(),
        content: newSectionContent.trim(),
      };
      const updatedSections = [...sections, newSection];
      setSections(updatedSections);
      setNewSectionTitle("");
      setNewSectionContent("");
      showNotification("Section added.", "success");

      // Save immediately to Firestore
      try {
        const docRef = doc(db, "Content", "PubEthics");
        await updateDoc(docRef, {
          sections: updatedSections,
        });
      } catch (error) {
        showNotification("Error saving section to database.", "error");
      }
    } else {
      showNotification(
        "Both title and content are required for the section.",
        "warning"
      );
    }
  };

  // Edit a section (inline editing)
  const handleEditSection = (id, updatedTitle, updatedContent) => {
    setSections((prev) =>
      prev.map((section) =>
        section.id === id
          ? { ...section, title: updatedTitle, content: updatedContent }
          : section
      )
    );
    showNotification("Section updated. Don't forget to Save All!", "success");
  };

  // Remove a section
  const handleRemoveSection = (id) => {
    setSections((prev) => prev.filter((section) => section.id !== id));
    showNotification("Section removed. Don't forget to Save All!", "success");
  };

  return (
    <div
      className="min-h-screen bg-cover bg-center py-40 px-4 sm:px-6 lg:px-8"
      style={{ backgroundImage: "url('/bg.jpg')" }}
    >
      <div className="max-w-4xl mx-auto rounded-lg shadow-lg relative">
        {/* Notification Bar */}
        {notification.message && (
          <div
            ref={notificationBarRef}
            className={`w-full max-w-md mx-auto mb-4 py-3 text-center font-semibold rounded-lg text-white z-50 transition-all duration-300 ${
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

        <div className="bg-yellow-300 py-2 rounded-t-lg w-full flex items-center justify-center">
          <h1 className="text-3xl font-bold text-black text-center">
            Publication Ethics
          </h1>
        </div>

        <div className="bg-red-800 bg-opacity-95 text-white p-8 rounded-b-lg">
          {/* Header */}
          <div className="mb-6">
            {isEditing ? (
              <>
                <label className="block text-lg font-semibold mb-2 text-yellow-200">
                  Title:
                </label>
                <textarea
                  value={headerText}
                  onChange={(e) => setHeaderText(e.target.value)}
                  className="w-full p-3 border-2 border-gray-300 rounded resize-none text-black text-lg"
                  rows="3"
                  placeholder="Enter header content"
                />
              </>
            ) : (
              <h2 className="text-2xl font-semibold mb-2">{headerText}</h2>
            )}
          </div>

          {/* Sections */}
          <div className="mb-6">
            {isEditing && (
              <label className="block text-lg font-semibold mb-2 text-yellow-200">
                Sections:
              </label>
            )}
            {sections.map((section) => (
              <div
                key={section.id}
                className="my-4 bg-red-900 rounded p-4 shadow"
              >
                {isEditing ? (
                  <>
                    <label className="block text-base font-semibold mb-1 text-yellow-100">
                      Section Title:
                    </label>
                    <input
                      type="text"
                      value={section.title}
                      onChange={(e) =>
                        setSections((prev) =>
                          prev.map((s) =>
                            s.id === section.id
                              ? { ...s, title: e.target.value }
                              : s
                          )
                        )
                      }
                      className="w-full p-2 mb-2 text-black rounded border-2 border-gray-300"
                      placeholder="Section Title"
                    />
                    <label className="block text-base font-semibold mb-1 text-yellow-100">
                      Section Content:
                    </label>
                    <textarea
                      value={section.content}
                      onChange={(e) =>
                        setSections((prev) =>
                          prev.map((s) =>
                            s.id === section.id
                              ? { ...s, content: e.target.value }
                              : s
                          )
                        )
                      }
                      className="w-full p-2 mb-2 text-black rounded border-2 border-gray-300 resize-none"
                      rows="3"
                      placeholder="Section Content"
                    />
                    <div className="flex space-x-2 mt-2">
                      <button
                        onClick={() => handleRemoveSection(section.id)}
                        className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded font-semibold flex items-center gap-2"
                      >
                        <FaTrashAlt /> Remove
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <h3 className="text-xl font-bold">{section.title}</h3>
                    <p className="text-lg">{section.content}</p>
                    {!isEditing && isAdmin && (
                      <div className="flex space-x-2 mt-2">
                        <button
                          onClick={() => setIsEditing(true)}
                          className="bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded font-semibold"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleRemoveSection(section.id)}
                          className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded font-semibold flex items-center gap-2"
                        >
                          <FaTrashAlt /> Remove
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            ))}

            {/* Add Section form below existing sections */}
            {isEditing ? (
              <div className="mb-8">
                <label className="block text-base font-semibold mb-1 text-yellow-100">
                  Section Title:
                </label>
                <input
                  type="text"
                  value={newSectionTitle}
                  onChange={(e) => setNewSectionTitle(e.target.value)}
                  className="w-full p-3 border-2 border-gray-300 rounded mb-2 text-black"
                  placeholder="Enter section title"
                />
                <label className="block text-base font-semibold mb-1 text-yellow-100">
                  Section Content:
                </label>
                <textarea
                  value={newSectionContent}
                  onChange={(e) => setNewSectionContent(e.target.value)}
                  className="w-full p-3 border-2 border-gray-300 rounded resize-none text-black"
                  rows="3"
                  placeholder="Enter section content"
                />
                <div className="flex justify-end">
                  <button
                    onClick={handleAddSection}
                    className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded mt-4 font-semibold"
                  >
                    Add Section
                  </button>
                </div>
              </div>
            ) : null}
          </div>

          {/* Footer */}
          <div className="mb-6">
            {isEditing ? (
              <>
                <label className="block text-lg font-semibold mb-2 text-yellow-200">
                  Footer:
                </label>
                <textarea
                  value={footerText}
                  onChange={(e) => setFooterText(e.target.value)}
                  className="w-full p-3 border-2 border-gray-300 rounded resize-none text-black text-lg"
                  rows="3"
                  placeholder="Enter footer content"
                />
              </>
            ) : (
              <p className="text-lg">{footerText}</p>
            )}
          </div>

          {/* Move Edit button below content */}
          {!isEditing && isAdmin && (
            <div className="text-center mt-8">
              <button
                onClick={() => setIsEditing(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded font-semibold transition-colors"
              >
                <FaEdit className="inline-block mr-2" />
                Edit Publication Ethics
              </button>
            </div>
          )}

          {isEditing && (
            <div className="flex justify-between mt-8">
              <button
                onClick={handleCancelEdit}
                className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded shadow font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveAll}
                className={`bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded shadow font-semibold ${
                  !hasChanges() ? "opacity-50 cursor-not-allowed" : ""
                }`}
                disabled={!hasChanges()}
              >
                Save All
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PubEthics;
