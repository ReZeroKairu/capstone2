import React, { useState, useEffect } from "react";
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

  useEffect(() => {
    const fetchContent = async () => {
      const docRef = doc(db, "Content", "PubEthics");

      const unsubscribe = onSnapshot(docRef, (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          setHeaderText(data.header || "");
          setFooterText(data.footer || "");
          setSections(data.sections || []);
        } else {
          console.error("Document does not exist.");
        }
      });

      return unsubscribe;
    };

    const checkUserRole = async () => {
      onAuthStateChanged(auth, async (user) => {
        if (user) {
          const userDoc = doc(db, "Users", user.uid);
          const userSnap = await getDoc(userDoc);
          if (userSnap.exists()) {
            setIsAdmin(userSnap.data().role === "Admin");
          }
        }
      });
    };

    fetchContent();
    checkUserRole();
  }, []);

  const handleSaveAll = async () => {
    try {
      const docRef = doc(db, "Content", "PubEthics");
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        // Document exists, update it
        await updateDoc(docRef, {
          header: headerText,
          footer: footerText,
          sections: sections, // Save sections as an array in Firestore
        });
        alert("All changes saved successfully!");
      } else {
        // Document doesn't exist, create it
        await setDoc(docRef, {
          header: headerText,
          footer: footerText,
          sections: sections, // Save initial sections
        });
        alert("Document created and saved successfully!");
      }
      setIsEditing(false);
    } catch (error) {
      console.error("Error saving all changes:", error);
      alert("There was an error saving the content.");
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setNewSectionTitle("");
    setNewSectionContent("");
  };

  const handleAddSection = async () => {
    if (newSectionTitle.trim() && newSectionContent.trim()) {
      const newSection = {
        id: Date.now(),
        title: newSectionTitle.trim(),
        content: newSectionContent.trim(),
      };

      setSections([...sections, newSection]); // Temporarily add the section locally
      setNewSectionTitle("");
      setNewSectionContent("");

      try {
        const docRef = doc(db, "Content", "PubEthics");
        await updateDoc(docRef, {
          sections: arrayUnion(newSection), // Correctly add the new section to the Firestore array
        });
        console.log("New section added successfully.");
      } catch (error) {
        console.error("Error saving section:", error.message);
      }
    } else {
      alert("Both title and content are required for the section.");
    }
  };

  const handleEditSection = async (id, updatedTitle, updatedContent) => {
    const updatedSections = sections.map((section) =>
      section.id === id
        ? { ...section, title: updatedTitle, content: updatedContent }
        : section
    );
    setSections(updatedSections);

    try {
      const docRef = doc(db, "Content", "PubEthics");
      await updateDoc(docRef, {
        sections: updatedSections, // Update the sections in Firestore
      });
      console.log("Section updated successfully.");
    } catch (error) {
      console.error("Error updating section:", error);
    }
  };

  const handleRemoveSection = async (id) => {
    const sectionToRemove = sections.find((section) => section.id === id);
    const updatedSections = sections.filter((section) => section.id !== id);
    setSections(updatedSections);

    try {
      const docRef = doc(db, "Content", "PubEthics");
      await updateDoc(docRef, {
        sections: arrayRemove(sectionToRemove), // Correctly remove the section from the Firestore array
      });
      console.log("Section removed successfully.");
    } catch (error) {
      console.error("Error removing section:", error);
    }
  };

  return (
    <div className="min-h-screen bg-cover bg-center py-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto bg-white bg-opacity-80 p-8 rounded-lg shadow-lg relative">
        <h1 className="text-4xl font-bold text-center mb-8">
          Publication Ethics
        </h1>

        {isAdmin && (
          <div className="absolute top-4 right-4">
            {!isEditing && (
              <button
                onClick={() => setIsEditing(true)}
                className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded shadow hover:bg-blue-700"
              >
                <FaEdit /> Edit
              </button>
            )}
          </div>
        )}

        <div className="mb-6">
          {isEditing ? (
            <textarea
              value={headerText}
              onChange={(e) => setHeaderText(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded resize-none"
              rows="4"
              placeholder="Enter header content"
            />
          ) : (
            <h2 className="text-2xl font-semibold mb-2">{headerText}</h2>
          )}
        </div>

        {/* New Section: Between header and footer */}
        <div className="mb-6">
          {isEditing ? (
            <div>
              <input
                type="text"
                value={newSectionTitle}
                onChange={(e) => setNewSectionTitle(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded mb-2"
                placeholder="Enter section title"
              />
              <textarea
                value={newSectionContent}
                onChange={(e) => setNewSectionContent(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded resize-none"
                rows="4"
                placeholder="Enter section content"
              />
              <button
                onClick={handleAddSection}
                className="bg-green-600 text-white px-4 py-2 rounded mt-4"
              >
                Add Section
              </button>
            </div>
          ) : (
            sections.map((section) => (
              <div key={section.id} className="my-4">
                <h3 className="text-xl font-bold">{section.title}</h3>
                <p className="text-lg">{section.content}</p>
                {isAdmin && (
                  <div className="flex space-x-2 mt-2">
                    <button
                      onClick={() =>
                        handleEditSection(
                          section.id,
                          prompt("Edit title:", section.title),
                          prompt("Edit content:", section.content)
                        )
                      }
                      className="bg-yellow-600 text-white px-4 py-2 rounded"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleRemoveSection(section.id)}
                      className="bg-red-600 text-white px-4 py-2 rounded"
                    >
                      <FaTrashAlt /> Remove
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        <div className="mb-6">
          {isEditing ? (
            <textarea
              value={footerText}
              onChange={(e) => setFooterText(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded resize-none"
              rows="4"
              placeholder="Enter footer content"
            />
          ) : (
            <p>{footerText}</p>
          )}
        </div>

        {isEditing && (
          <div className="flex justify-between mt-8">
            <button
              onClick={handleCancelEdit}
              className="bg-gray-500 text-white px-4 py-2 rounded shadow hover:bg-gray-600"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveAll}
              className="bg-blue-600 text-white px-4 py-2 rounded shadow hover:bg-blue-700"
            >
              Save All
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default PubEthics;
