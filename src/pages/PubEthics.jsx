import React, { useEffect, useState } from "react";
import { db, auth } from "../firebase/firebase";
import { doc, getDoc, setDoc, onSnapshot, updateDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

// EditableHeader Component
const EditableHeader = ({ headerData, onSave, isEditable, sectionType }) => {
  const [header, setHeader] = useState(headerData || "");
  const [isEditing, setIsEditing] = useState(false);

  const handleSave = () => {
    onSave(header);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setHeader(headerData);
    setIsEditing(false);
  };

  useEffect(() => {
    setHeader(headerData);
  }, [headerData]);

  const editButtonText =
    sectionType === "header" ? "Edit Header" : "Edit Footer";

  // Conditional text size classes based on sectionType
  const textSizeClass = sectionType === "header" ? "text-base" : "text-sm";

  return (
    <div className="mb-6">
      {isEditing && isEditable ? (
        <>
          <label className="block text-lg font-medium text-gray-700">
            {sectionType === "header" ? "Header" : "Footer"} Content
          </label>
          <textarea
            value={header}
            onChange={(e) => setHeader(e.target.value)}
            className="w-full mt-2 p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring- resize-y"
            placeholder={`Enter ${
              sectionType === "header" ? "header" : "footer"
            } content`}
            rows="4"
          />
          <div className="mt-4 flex space-x-4">
            <button
              onClick={handleSave}
              className="bg-blue-600 text-white px-6 py-2 rounded-md transition duration-300 hover:bg-blue-700"
            >
              Save {sectionType === "header" ? "Header" : "Footer"}
            </button>
            <button
              onClick={handleCancel}
              className="bg-gray-600 text-white px-6 py-2 rounded-md transition duration-300 hover:bg-gray-700"
            >
              Cancel
            </button>
          </div>
        </>
      ) : (
        <>
          <h2 className={`${textSizeClass} text-gray-800`}>{header}</h2>
          {isEditable && (
            <button
              onClick={() => setIsEditing(true)}
              className="bg-yellow-500 text-white px-4 py-2 rounded-md mt-4 transition duration-300 hover:bg-yellow-600"
            >
              {editButtonText}
            </button>
          )}
        </>
      )}
    </div>
  );
};

// EditableSection Component
const EditableSection = ({
  sectionKey,
  sectionData,
  onSave,
  onRemove,
  isEditable,
}) => {
  const [section, setSection] = useState(sectionData);
  const [isEditing, setIsEditing] = useState(false);

  const handleSave = () => {
    onSave(sectionKey, section);
    setIsEditing(false);
  };

  const handleRemove = () => {
    if (window.confirm("Are you sure you want to delete this section?")) {
      onRemove(sectionKey);
    }
  };

  return (
    <div className="mb-6 p-6 bg-white rounded-lg shadow-lg border border-gray-200 w-full">
      {isEditing && isEditable ? (
        <>
          <textarea
            value={section.text}
            onChange={(e) => setSection({ ...section, text: e.target.value })}
            className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring- resize-none"
            rows="6"
            placeholder="Enter section content"
          />
          <div className="mt-4 flex space-x-4">
            <button
              onClick={handleSave}
              className="bg-blue-600 text-white px-6 py-2 rounded-md transition duration-300 hover:bg-blue-700"
            >
              Save
            </button>
            <button
              onClick={() => setIsEditing(false)}
              className="bg-gray-600 text-white px-6 py-2 rounded-md transition duration-300 hover:bg-gray-700"
            >
              Cancel
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="text-gray-700 break-words">{section.text}</p>
          {isEditable && (
            <div className="mt-4 flex space-x-4">
              <button
                onClick={() => setIsEditing(true)}
                className="bg-yellow-500 text-white px-6 py-2 rounded-md transition duration-300 hover:bg-yellow-600"
              >
                Edit Section
              </button>
              <button
                onClick={handleRemove}
                className="bg-red-500 text-white px-6 py-2 rounded-md transition duration-300 hover:bg-red-600"
              >
                Delete
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

// Main PubEthics Component
const PubEthics = () => {
  const [content, setContent] = useState([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [headerAboveSections, setHeaderAboveSections] = useState("");
  const [footerBelowSections, setFooterBelowSections] = useState("");
  const [previewMode, setPreviewMode] = useState(false);

  useEffect(() => {
    const docRef = doc(db, "Content", "PubEthics");

    // Real-time listener for content
    const unsubscribeContent = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const fetchedData = docSnap.data();
        setContent(fetchedData.content || []);
        setHeaderAboveSections(fetchedData.headerAboveSections || "");
        setFooterBelowSections(fetchedData.footerBelowSections || "");
      }
    });

    const checkUserRole = () => {
      onAuthStateChanged(auth, async (user) => {
        if (user) {
          const userRef = doc(db, "Users", user.uid);
          const userSnap = await getDoc(userRef);
          if (userSnap.exists()) {
            const userRole = userSnap.data().role;
            setIsAdmin(userRole === "Admin");
          }
        }
      });
    };

    checkUserRole();

    return () => {
      unsubscribeContent(); // Cleanup listener on unmount
    };
  }, []);

  const handleSaveAboveHeader = async (newHeader) => {
    await setDoc(
      doc(db, "Content", "PubEthics"),
      { headerAboveSections: newHeader },
      { merge: true }
    );
  };

  const handleSaveFooter = async (newFooter) => {
    await setDoc(
      doc(db, "Content", "PubEthics"),
      { footerBelowSections: newFooter },
      { merge: true }
    );
  };

  const handleAddSection = () => {
    const newSection = { id: Date.now().toString(), text: "New Section" };
    setContent((prev) => {
      const newContent = [...prev, newSection];
      setDoc(
        doc(db, "Content", "PubEthics"),
        { content: newContent },
        { merge: true }
      );
      return newContent;
    });
  };

  const handleRemoveSection = (sectionKey) => {
    const newContent = content.filter((sec) => sec.id !== sectionKey);
    setContent(newContent);
    updateDoc(doc(db, "Content", "PubEthics"), {
      content: newContent,
    });
  };

  return (
    <div className="min-h-screen py-40 bg-gray-50 px-4 sm:px-6 lg:px-8 relative">
      {/* Background Image */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-fixed"
        style={{
          backgroundImage: "url('/bg.jpg')",
        }}
      ></div>

      <div className="max-w-5xl mx-auto bg-white rounded-lg shadow-xl p-8 relative z-10">
        <h1 className="text-4xl font-extrabold text-center text-gray-800 mb-8">
          Publication Ethics
        </h1>

        <button
          onClick={() => setPreviewMode((prev) => !prev)}
          className="bg-gray-800 text-white px-6 py-3 rounded-md mb-8 transition duration-300 hover:bg-gray-700"
        >
          {previewMode ? "Switch to Admin View" : "Preview as User"}
        </button>

        {/* Editable Header Above Sections */}
        <EditableHeader
          headerData={headerAboveSections}
          onSave={handleSaveAboveHeader}
          isEditable={isAdmin && !previewMode}
          sectionType="header" // Pass "header" here
        />

        {/* Main Content */}
        {content.map((section) => (
          <EditableSection
            key={section.id}
            sectionKey={section.id}
            sectionData={section}
            onSave={(id, data) =>
              setContent((prev) =>
                prev.map((sec) =>
                  sec.id === id ? { ...sec, text: data } : sec
                )
              )
            }
            onRemove={handleRemoveSection}
            isEditable={isAdmin && !previewMode}
          />
        ))}

        {/* Editable Footer Below Sections */}
        <EditableHeader
          headerData={footerBelowSections}
          onSave={handleSaveFooter}
          isEditable={isAdmin && !previewMode}
          sectionType="footer" // Pass "footer" here
        />

        {isAdmin && !previewMode && (
          <div className="mt-6">
            <button
              onClick={handleAddSection}
              className="bg-green-600 text-white px-6 py-2 rounded-md transition duration-300 hover:bg-green-700"
            >
              Add Section
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default PubEthics;
