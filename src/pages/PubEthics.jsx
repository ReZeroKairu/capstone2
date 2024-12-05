import React, { useState, useEffect } from "react";
import { doc, setDoc, getDoc, updateDoc, onSnapshot } from "firebase/firestore";
import { auth, db } from "../firebase/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { FaEdit } from "react-icons/fa";

const PubEthics = () => {
  const [isAdmin, setIsAdmin] = useState(false);
  const [headerText, setHeaderText] = useState("");
  const [footerText, setFooterText] = useState("");
  const [sections, setSections] = useState([]);

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
          try {
            const userDoc = doc(db, "Users", user.uid);
            const userSnap = await getDoc(userDoc);
            if (userSnap.exists()) {
              setIsAdmin(userSnap.data().role === "Admin");
            } else {
              console.error("User document does not exist.");
            }
          } catch (error) {
            console.error("Error checking user role:", error);
          }
        }
      });
    };

    fetchContent();
    checkUserRole();
  }, []);

  const handleSaveHeader = async (newHeader) => {
    try {
      await setDoc(
        doc(db, "Content", "PubEthics"),
        { header: newHeader },
        { merge: true }
      );
    } catch (error) {
      console.error("Error saving header:", error);
    }
  };

  const handleSaveFooter = async (newFooter) => {
    try {
      await setDoc(
        doc(db, "Content", "PubEthics"),
        { footer: newFooter },
        { merge: true }
      );
    } catch (error) {
      console.error("Error saving footer:", error);
    }
  };

  const handleAddSection = async () => {
    const newSection = {
      id: Date.now().toString(),
      title: "New Section",
      text: "Content here",
    };
    const updatedSections = [...sections, newSection];
    setSections(updatedSections);
    try {
      await updateDoc(doc(db, "Content", "PubEthics"), {
        sections: updatedSections,
      });
    } catch (error) {
      console.error("Error adding section:", error);
    }
  };

  const handleSaveSection = async (id, updatedData) => {
    const updatedSections = sections.map((section) =>
      section.id === id ? { ...section, ...updatedData } : section
    );
    setSections(updatedSections);
    try {
      await updateDoc(doc(db, "Content", "PubEthics"), {
        sections: updatedSections,
      });
    } catch (error) {
      console.error("Error saving section:", error);
    }
  };

  const handleRemoveSection = async (id) => {
    const updatedSections = sections.filter((section) => section.id !== id);
    setSections(updatedSections);
    try {
      await updateDoc(doc(db, "Content", "PubEthics"), {
        sections: updatedSections,
      });
    } catch (error) {
      console.error("Error removing section:", error);
    }
  };

  const EditableSection = ({
    sectionKey,
    sectionData,
    onSave,
    onRemove,
    isEditable,
    hasTitle = true,
  }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [section, setSection] = useState({
      title: sectionData?.title || "",
      text: sectionData?.text || "",
    });

    useEffect(() => {
      setSection({
        title: sectionData?.title || "",
        text: sectionData?.text || "",
      });
    }, [sectionData]);

    const handleSave = () => {
      if (hasTitle && !section.title.trim()) {
        alert("Title is required.");
        return;
      }
      if (!section.text.trim()) {
        alert("Content cannot be empty.");
        return;
      }
      onSave(sectionKey, section);
      setIsEditing(false);
    };

    const handleRemove = () => {
      if (window.confirm("Are you sure you want to delete this section?")) {
        onRemove(sectionKey);
      }
    };

    return (
      <div className="mb-6 relative">
        {isEditable && !isEditing && (
          <FaEdit
            onClick={() => setIsEditing(true)}
            className="absolute top-0 right-0 text-gray-600 cursor-pointer hover:text-gray-800"
          />
        )}
        {isEditing ? (
          <>
            {hasTitle && (
              <input
                type="text"
                value={section.title}
                onChange={(e) =>
                  setSection({ ...section, title: e.target.value })
                }
                className="w-full mb-2 p-2 border border-gray-300 rounded"
                placeholder="Enter section title"
              />
            )}
            <textarea
              value={section.text}
              onChange={(e) => setSection({ ...section, text: e.target.value })}
              className="w-full p-2 border border-gray-300 rounded resize-none"
              rows="4"
              placeholder="Enter section content"
            />
            <div className="mt-2 flex space-x-2">
              <button
                onClick={handleSave}
                className="bg-blue-600 text-white px-4 py-2 rounded"
              >
                Save
              </button>
              <button
                onClick={() => setIsEditing(false)}
                className="bg-gray-600 text-white px-4 py-2 rounded"
              >
                Cancel
              </button>
            </div>
          </>
        ) : (
          <>
            {hasTitle && (
              <h2 className="text-2xl font-semibold mb-2">{section.title}</h2>
            )}
            <p>{section.text}</p>
          </>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen py-20 bg-gray-50 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold text-center mb-8">
          Publication Ethics
        </h1>

        <EditableSection
          sectionKey="header"
          sectionData={{ text: headerText }}
          onSave={(key, data) => handleSaveHeader(data.text)}
          isEditable={isAdmin}
          hasTitle={false}
        />

        {sections.map((section) => (
          <EditableSection
            key={section.id}
            sectionKey={section.id}
            sectionData={section}
            onSave={handleSaveSection}
            onRemove={handleRemoveSection}
            isEditable={isAdmin}
          />
        ))}

        <EditableSection
          sectionKey="footer"
          sectionData={{ text: footerText }}
          onSave={(key, data) => handleSaveFooter(data.text)}
          isEditable={isAdmin}
          hasTitle={false}
        />

        {isAdmin && (
          <button
            onClick={handleAddSection}
            className="bg-blue-600 text-white px-6 py-2 rounded mt-6"
          >
            Add New Section
          </button>
        )}
      </div>
    </div>
  );
};

export default PubEthics;
