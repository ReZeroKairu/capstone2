import React, { useState, useEffect, useRef, useCallback } from "react";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";
import { doc, updateDoc, getDoc, onSnapshot } from "firebase/firestore";
import { auth, db } from "../firebase/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { FaEdit, FaTrashAlt } from "react-icons/fa";

const quillModules = {
  toolbar: [
    [{ header: [1, 2, false] }],
    ["bold", "italic", "underline", "strike"],
    [{ color: [] }, { background: [] }],
    [
      { font: ["sans-serif", "serif", "monospace"] },
      { size: ["small", false, "large", "huge"] },
    ],
    [{ align: [] }],
    ["clean"],
  ],
};

const quillFormats = [
  "header",
  "bold",
  "italic",
  "underline",
  "strike",
  "color",
  "background",
  "font",
  "size",
  "align",
];

const Toast = ({ message, type, onClose }) => (
  <div
    className={`fixed top-6 left-1/2 transform -translate-x-1/2 px-4 py-3 rounded shadow text-white z-[9999] transition-all duration-300 ${
      type === "success"
        ? "bg-green-500"
        : type === "warning"
        ? "bg-yellow-500"
        : "bg-red-500"
    }`}
    style={{ maxWidth: "400px", width: "90vw" }}
    onClick={onClose}
  >
    {message}
  </div>
);

const PubEthics = () => {
  const [isAdmin, setIsAdmin] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [headerText, setHeaderText] = useState("");
  const [footerText, setFooterText] = useState("");
  const [sections, setSections] = useState([]);
  const [newSectionTitle, setNewSectionTitle] = useState("");
  const [newSectionContent, setNewSectionContent] = useState("");
  const [notifications, setNotifications] = useState([]);
  const notificationIdRef = useRef(0);

  const originalContentRef = useRef({ header: "", footer: "", sections: [] });

  const showNotification = useCallback((message, type = "success") => {
    const id = notificationIdRef.current++;
    setNotifications((prev) => [...prev, { id, message, type }]);
    setTimeout(
      () => setNotifications((prev) => prev.filter((n) => n.id !== id)),
      4000
    );
  }, []);

  useEffect(() => {
    const docRef = doc(db, "Content", "PubEthics");
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setHeaderText(data.header || "");
        setFooterText(data.footer || "");
        setSections(data.sections || []);
      }
    });

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const userDoc = doc(db, "Users", user.uid);
        const userSnap = await getDoc(userDoc);
        setIsAdmin(userSnap.exists() && userSnap.data().role === "Admin");
      } else setIsAdmin(false);
    });

    return () => {
      unsubscribe();
      unsubscribeAuth();
    };
  }, []);

  const startEditing = () => {
    originalContentRef.current = {
      header: headerText,
      footer: footerText,
      sections: JSON.parse(JSON.stringify(sections)),
    };
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setHeaderText(originalContentRef.current.header);
    setFooterText(originalContentRef.current.footer);
    setSections(originalContentRef.current.sections);
    setIsEditing(false);
  };

  const saveAllChanges = async () => {
    const original = originalContentRef.current;
    const changesMade =
      headerText !== original.header ||
      footerText !== original.footer ||
      JSON.stringify(sections) !== JSON.stringify(original.sections);

    if (!changesMade) {
      showNotification("No changes made to save", "warning");
      return;
    }

    try {
      const docRef = doc(db, "Content", "PubEthics");
      await updateDoc(docRef, {
        header: headerText,
        footer: footerText,
        sections,
      });
      showNotification("All changes saved!", "success");
      originalContentRef.current = {
        header: headerText,
        footer: footerText,
        sections: JSON.parse(JSON.stringify(sections)),
      };
      setIsEditing(false);
    } catch (err) {
      console.error(err);
      showNotification("Error saving changes", "error");
    }
  };

  const updateSectionContent = (id, content) => {
    setSections((prev) =>
      prev.map((s) => (s.id === id ? { ...s, content } : s))
    );
  };

  const updateSectionTitle = (id, title) => {
    setSections((prev) => prev.map((s) => (s.id === id ? { ...s, title } : s)));
  };

  const addSection = () => {
    if (!newSectionTitle.trim() && !newSectionContent.trim()) {
      showNotification("Both title and content are required", "warning");
      return;
    }
    const newSection = {
      id: Date.now(),
      title: newSectionTitle,
      content: newSectionContent,
    };
    setSections((prev) => [...prev, newSection]);
    setNewSectionTitle("");
    setNewSectionContent("");
  };

  const removeSection = (id) => {
    setSections((prev) => prev.filter((s) => s.id !== id));
  };

  return (
    <div
      className="min-h-screen bg-cover bg-center py-20 px-2 sm:px-8 lg:px-32 flex items-center justify-center"
      style={{ backgroundImage: "url('/bg.jpg')" }}
    >
      <div className="w-full max-w-4xl mx-auto rounded-lg shadow-lg my-8">
        {notifications.map((n) => (
          <Toast
            key={n.id}
            message={n.message}
            type={n.type}
            onClose={() =>
              setNotifications((prev) => prev.filter((x) => x.id !== n.id))
            }
          />
        ))}

        <div className="bg-yellow-300 py-2 rounded-t-lg w-full flex items-center justify-center">
          <h1 className="text-2xl sm:text-3xl font-bold text-black text-center">
            Publication Ethics
          </h1>
        </div>

        <div className="bg-red-800 bg-opacity-95 text-white p-3 sm:p-8 rounded-b-lg">
          {/* Header */}
          <div className="mb-6">
            {isEditing ? (
              <ReactQuill
                value={headerText}
                onChange={setHeaderText}
                modules={quillModules}
                formats={quillFormats}
                theme="snow"
                className="bg-white text-black rounded mb-2"
              />
            ) : (
              <div dangerouslySetInnerHTML={{ __html: headerText }} />
            )}
          </div>

          {/* Sections */}
          <div className="mb-6">
            {sections.map((section) => (
              <div
                key={section.id}
                className="my-6 bg-red-900 rounded p-4 shadow"
              >
                {isEditing ? (
                  <>
                    <input
                      type="text"
                      value={section.title}
                      onChange={(e) =>
                        updateSectionTitle(section.id, e.target.value)
                      }
                      className="w-full p-2 mb-2 text-black rounded"
                      placeholder="Section Title"
                    />
                    <ReactQuill
                      value={section.content}
                      onChange={(val) => updateSectionContent(section.id, val)}
                      modules={quillModules}
                      formats={quillFormats}
                      theme="snow"
                      className="bg-white text-black rounded mb-2"
                    />
                    <button
                      onClick={() => removeSection(section.id)}
                      className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded font-semibold flex items-center gap-2 mt-2"
                    >
                      <FaTrashAlt /> Remove
                    </button>
                  </>
                ) : (
                  <>
                    <h3 className="text-xl font-bold mb-2">{section.title}</h3>
                    <div
                      dangerouslySetInnerHTML={{ __html: section.content }}
                    />
                  </>
                )}
              </div>
            ))}

            {isEditing && (
              <div className="mb-6">
                <input
                  type="text"
                  value={newSectionTitle}
                  onChange={(e) => setNewSectionTitle(e.target.value)}
                  className="w-full p-3 mb-2 rounded text-black"
                  placeholder="New Section Title"
                />
                <ReactQuill
                  value={newSectionContent}
                  onChange={setNewSectionContent}
                  modules={quillModules}
                  formats={quillFormats}
                  theme="snow"
                  className="bg-white text-black rounded mb-2"
                />
                <button
                  onClick={addSection}
                  className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded font-semibold"
                >
                  Add Section
                </button>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="mb-6">
            {isEditing ? (
              <ReactQuill
                value={footerText}
                onChange={setFooterText}
                modules={quillModules}
                formats={quillFormats}
                theme="snow"
                className="bg-white text-black rounded mb-2"
              />
            ) : (
              <div dangerouslySetInnerHTML={{ __html: footerText }} />
            )}
          </div>

          {/* Controls */}
          {isAdmin && (
            <div className="text-center mt-8 flex justify-center gap-4">
              {!isEditing ? (
                <button
                  onClick={startEditing}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded font-semibold"
                >
                  <FaEdit className="inline mr-2" /> Edit Publication Ethics
                </button>
              ) : (
                <>
                  <button
                    onClick={saveAllChanges}
                    className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded font-semibold"
                  >
                    Save
                  </button>
                  <button
                    onClick={cancelEditing}
                    className="bg-gray-600 hover:bg-gray-700 text-white px-6 py-3 rounded font-semibold"
                  >
                    Cancel
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PubEthics;
