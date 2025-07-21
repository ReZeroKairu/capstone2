import React, { useState, useEffect } from "react";
import { doc, updateDoc, getDoc, setDoc, onSnapshot } from "firebase/firestore";
import { auth, db } from "../firebase/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { FaEdit, FaTrashAlt, FaSave, FaTimes, FaPlus } from "react-icons/fa";

const PubEthics = () => {
  // Auth state
  const [isAdmin, setIsAdmin] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Edit state
  const [isEditing, setIsEditing] = useState(false);
  const [editingSectionId, setEditingSectionId] = useState(null);

  // Content state
  const [headerText, setHeaderText] = useState("");
  const [footerText, setFooterText] = useState("");
  const [sections, setSections] = useState([]);

  // Form state
  const [newSectionTitle, setNewSectionTitle] = useState("");
  const [newSectionContent, setNewSectionContent] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");

  // Error and saving state
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let unsubscribeContent = null;
    let unsubscribeAuth = null;

    const initializeComponent = async () => {
      try {
        setLoading(true);
        setError("");

        // Set up auth listener
        unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
          setUser(currentUser);

          if (currentUser) {
            try {
              const userDoc = doc(db, "Users", currentUser.uid);
              const userSnap = await getDoc(userDoc);
              if (userSnap.exists()) {
                setIsAdmin(userSnap.data().role === "Admin");
              }
            } catch (err) {
              console.error("Error checking user role:", err);
            }
          } else {
            setIsAdmin(false);
          }
        });

        // Set up content listener
        const docRef = doc(db, "Content", "PubEthics");
        unsubscribeContent = onSnapshot(
          docRef,
          (docSnap) => {
            if (docSnap.exists()) {
              const data = docSnap.data();
              setHeaderText(data.header || "");
              setFooterText(data.footer || "");
              setSections(data.sections || []);
            } else {
              // Initialize with empty content if document doesn't exist
              setHeaderText("");
              setFooterText("");
              setSections([]);
            }
            setLoading(false);
          },
          (err) => {
            console.error("Error fetching content:", err);
            setError("Failed to load content. Please refresh the page.");
            setLoading(false);
          }
        );
      } catch (err) {
        console.error("Error initializing component:", err);
        setError("Failed to initialize. Please refresh the page.");
        setLoading(false);
      }
    };

    initializeComponent();

    // Cleanup function
    return () => {
      if (unsubscribeContent) unsubscribeContent();
      if (unsubscribeAuth) unsubscribeAuth();
    };
  }, []);

  const handleSaveAll = async () => {
    if (!isAdmin) return;

    try {
      setSaving(true);
      setError("");

      const docRef = doc(db, "Content", "PubEthics");
      const docSnap = await getDoc(docRef);

      const contentData = {
        header: headerText.trim(),
        footer: footerText.trim(),
        sections: sections,
      };

      if (docSnap.exists()) {
        await updateDoc(docRef, contentData);
      } else {
        await setDoc(docRef, contentData);
      }

      setIsEditing(false);
      setNewSectionTitle("");
      setNewSectionContent("");
    } catch (err) {
      console.error("Error saving all changes:", err);
      setError("Failed to save changes. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditingSectionId(null);
    setNewSectionTitle("");
    setNewSectionContent("");
    setEditTitle("");
    setEditContent("");
    setError("");
  };

  const handleAddSection = () => {
    if (!newSectionTitle.trim() || !newSectionContent.trim()) {
      setError("Both title and content are required for the section.");
      return;
    }

    const newSection = {
      id: Date.now(), // Using timestamp as ID for simplicity
      title: newSectionTitle.trim(),
      content: newSectionContent.trim(),
    };

    setSections([...sections, newSection]);
    setNewSectionTitle("");
    setNewSectionContent("");
    setError("");
  };

  const handleStartEditSection = (section) => {
    setEditingSectionId(section.id);
    setEditTitle(section.title);
    setEditContent(section.content);
  };

  const handleSaveEditSection = () => {
    if (!editTitle.trim() || !editContent.trim()) {
      setError("Both title and content are required.");
      return;
    }

    const updatedSections = sections.map((section) =>
      section.id === editingSectionId
        ? { ...section, title: editTitle.trim(), content: editContent.trim() }
        : section
    );

    setSections(updatedSections);
    setEditingSectionId(null);
    setEditTitle("");
    setEditContent("");
    setError("");
  };

  const handleCancelEditSection = () => {
    setEditingSectionId(null);
    setEditTitle("");
    setEditContent("");
  };

  const handleRemoveSection = (id) => {
    if (window.confirm("Are you sure you want to remove this section?")) {
      const updatedSections = sections.filter((section) => section.id !== id);
      setSections(updatedSections);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-cover bg-center py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto bg-white bg-opacity-80 p-8 rounded-lg shadow-lg">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cover bg-center py-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto bg-white bg-opacity-80 p-8 rounded-lg shadow-lg relative">
        <h1 className="text-4xl font-bold text-center mb-8">
          Publication Ethics
        </h1>

        {/* Admin Controls */}
        {isAdmin && (
          <div className="absolute top-4 right-4">
            {!isEditing ? (
              <button
                onClick={() => setIsEditing(true)}
                className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded shadow hover:bg-blue-700 transition-colors"
              >
                <FaEdit /> Edit
              </button>
            ) : (
              <div className="flex gap-2">
                <button
                  onClick={handleCancelEdit}
                  disabled={saving}
                  className="flex items-center gap-2 bg-gray-500 text-white px-4 py-2 rounded shadow hover:bg-gray-600 transition-colors disabled:opacity-50"
                >
                  <FaTimes /> Cancel
                </button>
                <button
                  onClick={handleSaveAll}
                  disabled={saving}
                  className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded shadow hover:bg-green-700 transition-colors disabled:opacity-50"
                >
                  <FaSave /> {saving ? "Saving..." : "Save All"}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
            {error}
          </div>
        )}

        {/* Header Section */}
        <div className="mb-6">
          {isEditing ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Header Content
              </label>
              <textarea
                value={headerText}
                onChange={(e) => setHeaderText(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-md resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                rows="4"
                placeholder="Enter header content"
              />
            </div>
          ) : (
            headerText && (
              <h2 className="text-2xl font-semibold mb-4">{headerText}</h2>
            )
          )}
        </div>

        {/* Sections */}
        <div className="mb-6">
          {/* Existing Sections */}
          {sections.map((section) => (
            <div
              key={section.id}
              className="mb-6 p-4 border border-gray-200 rounded-lg"
            >
              {editingSectionId === section.id ? (
                <div>
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-md mb-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Section title"
                  />
                  <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-md resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    rows="4"
                    placeholder="Section content"
                  />
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={handleSaveEditSection}
                      className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700 transition-colors"
                    >
                      Save
                    </button>
                    <button
                      onClick={handleCancelEditSection}
                      className="bg-gray-500 text-white px-3 py-1 rounded text-sm hover:bg-gray-600 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <h3 className="text-xl font-bold mb-2">{section.title}</h3>
                  <p className="text-gray-700 leading-relaxed">
                    {section.content}
                  </p>
                  {isAdmin && isEditing && (
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={() => handleStartEditSection(section)}
                        className="bg-yellow-600 text-white px-3 py-1 rounded text-sm hover:bg-yellow-700 transition-colors"
                      >
                        <FaEdit className="inline mr-1" /> Edit
                      </button>
                      <button
                        onClick={() => handleRemoveSection(section.id)}
                        className="bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700 transition-colors"
                      >
                        <FaTrashAlt className="inline mr-1" /> Remove
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}

          {/* Add New Section Form */}
          {isEditing && (
            <div className="p-4 border-2 border-dashed border-gray-300 rounded-lg">
              <h4 className="text-lg font-semibold mb-3 flex items-center">
                <FaPlus className="mr-2" /> Add New Section
              </h4>
              <input
                type="text"
                value={newSectionTitle}
                onChange={(e) => setNewSectionTitle(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-md mb-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter section title"
              />
              <textarea
                value={newSectionContent}
                onChange={(e) => setNewSectionContent(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-md resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                rows="4"
                placeholder="Enter section content"
              />
              <button
                onClick={handleAddSection}
                className="bg-blue-600 text-white px-4 py-2 rounded mt-3 hover:bg-blue-700 transition-colors"
              >
                <FaPlus className="inline mr-1" /> Add Section
              </button>
            </div>
          )}
        </div>

        {/* Footer Section */}
        <div className="mb-6">
          {isEditing ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Footer Content
              </label>
              <textarea
                value={footerText}
                onChange={(e) => setFooterText(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-md resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                rows="4"
                placeholder="Enter footer content"
              />
            </div>
          ) : (
            footerText && (
              <p className="text-gray-700 leading-relaxed">{footerText}</p>
            )
          )}
        </div>
      </div>
    </div>
  );
};

export default PubEthics;
