import React, { useEffect, useState } from "react";
import { db, auth } from "../firebase/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

const EditableHeader = ({ headerData, onSave, isAdmin }) => {
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

  return (
    <div className="mb-4">
      {isEditing && isAdmin ? (
        <>
          <label className="block text-sm font-medium text-gray-700">
            Header
          </label>
          <input
            type="text"
            value={header}
            onChange={(e) => setHeader(e.target.value)}
            className="w-full border p-2 mt-2 mb-4"
            placeholder="Enter header"
          />
          <div className="mt-4">
            <button
              onClick={handleSave}
              className="bg-blue-500 text-white px-4 py-2 rounded mr-2"
            >
              Save Header
            </button>
            <button
              onClick={handleCancel}
              className="bg-gray-500 text-white px-4 py-2 rounded"
            >
              Cancel
            </button>
          </div>
        </>
      ) : (
        <>
          <h2 className="text-2xl font-bold">{header}</h2>
          {isAdmin && (
            <button
              onClick={() => setIsEditing(true)}
              className="bg-yellow-500 text-white px-4 py-2 rounded mt-4"
            >
              Edit Header
            </button>
          )}
        </>
      )}
    </div>
  );
};

const EditableSection = ({
  sectionKey,
  sectionData,
  onSave,
  onRemove,
  isAdmin,
}) => {
  const [header, setHeader] = useState(sectionData.header || "");
  const [items, setItems] = useState(sectionData.items || []);
  const [originalData, setOriginalData] = useState({ header, items });
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    setHeader(sectionData.header);
    setItems(sectionData.items);
  }, [sectionData]);

  const handleItemChange = (index, value) => {
    const updatedItems = [...items];
    updatedItems[index] = value;
    setItems(updatedItems);
  };

  const handleAddItem = () => {
    setItems([...items, ""]);
  };

  const handleRemoveItem = (index) => {
    const updatedItems = items.filter((_, i) => i !== index);
    setItems(updatedItems);
  };

  const handleSaveSection = () => {
    onSave(sectionKey, { header, items });
    setOriginalData({ header, items });
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setHeader(originalData.header);
    setItems(originalData.items);
    setIsEditing(false);
  };

  return (
    <section className="mb-6">
      {isEditing && isAdmin ? (
        <>
          <label className="block text-sm font-medium text-gray-700">
            Header
          </label>
          <input
            type="text"
            value={header}
            onChange={(e) => setHeader(e.target.value)}
            className="w-full border p-2 mt-2 mb-4"
            placeholder="Enter section header"
          />

          <ul className="list-disc pl-6">
            {items.map((item, index) => (
              <li key={index} className="mb-2">
                <textarea
                  value={item}
                  onChange={(e) => handleItemChange(index, e.target.value)}
                  className="w-full border p-2"
                  placeholder={`Enter item ${index + 1}`}
                />
                <div className="mt-2">
                  <button
                    onClick={() => handleRemoveItem(index)}
                    className="bg-red-500 text-white px-3 py-1 rounded mr-2"
                  >
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>

          <button
            onClick={handleAddItem}
            className="bg-green-500 text-white px-4 py-2 rounded mt-4"
          >
            Add Item
          </button>

          <div className="mt-4">
            <button
              onClick={handleSaveSection}
              className="bg-blue-500 text-white px-4 py-2 rounded mr-2"
            >
              Save Section
            </button>
            <button
              onClick={handleCancelEdit}
              className="bg-gray-500 text-white px-4 py-2 rounded"
            >
              Cancel
            </button>
          </div>
        </>
      ) : (
        <>
          <h3 className="text-lg font-bold">{header}</h3>
          <ul className="list-disc pl-6">
            {items.map((item, index) => (
              <li key={index} className="mb-2">
                {item}
              </li>
            ))}
          </ul>
          {isAdmin && (
            <>
              <button
                onClick={() => setIsEditing(true)}
                className="bg-yellow-500 text-white px-4 py-2 rounded mt-4"
              >
                Edit Section
              </button>
              <button
                onClick={() => onRemove(sectionKey)}
                className="bg-red-500 text-white px-4 py-2 rounded ml-2 mt-4"
              >
                Remove Section
              </button>
            </>
          )}
        </>
      )}
    </section>
  );
};

const PubEthics = () => {
  const [content, setContent] = useState([
    {
      id: "h1",
      header: "Section 1",
      items: ["", ""],
    },
    {
      id: "h2",
      header: "Section 2",
      items: ["", ""],
    },
    {
      id: "h3",
      header: "Section 3",
      items: ["", ""],
    },
  ]);

  const [nextKey, setNextKey] = useState("h4");
  const [isAdmin, setIsAdmin] = useState(false);
  const [headerAboveSections, setHeaderAboveSections] = useState(
    "Header Above Sections"
  );
  const [headerBelowSections, setHeaderBelowSections] = useState(
    "Header Below Sections"
  );

  useEffect(() => {
    const fetchContent = async () => {
      const docRef = doc(db, "Content", "PubEthics");
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const fetchedData = docSnap.data();
        console.log("Fetched data from Firestore:", fetchedData); // Debugging log

        // Check if content is available
        if (fetchedData.content && Array.isArray(fetchedData.content)) {
          setContent(fetchedData.content);
        } else {
          console.log("Content is not an array or is missing");
        }

        // Log headers to verify if they exist
        if (fetchedData.headerAboveSections) {
          console.log(
            "Header Above Sections:",
            fetchedData.headerAboveSections
          );
          setHeaderAboveSections(fetchedData.headerAboveSections);
        } else {
          console.log("Header Above Sections not found");
        }

        if (fetchedData.headerBelowSections) {
          console.log(
            "Header Below Sections:",
            fetchedData.headerBelowSections
          );
          setHeaderBelowSections(fetchedData.headerBelowSections);
        } else {
          console.log("Header Below Sections not found");
        }
      } else {
        console.log("No content found, using default");
        setContent([
          { id: "h1", header: "Section 1", items: ["", ""] },
          { id: "h2", header: "Section 2", items: ["", ""] },
          { id: "h3", header: "Section 3", items: ["", ""] },
        ]);
      }
    };

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

    fetchContent();
    checkUserRole();
  }, []);

  const handleSave = (id, data) => {
    const updatedContent = content.map((section) =>
      section.id === id ? { ...section, ...data } : section
    );
    setContent(updatedContent);

    const docRef = doc(db, "Content", "PubEthics");
    setDoc(docRef, { content: updatedContent }, { merge: true })
      .then(() => {
        console.log("Content saved successfully!");
      })
      .catch((error) => {
        console.error("Error saving content: ", error);
      });
  };

  const handleAddSection = () => {
    const newSection = {
      id: nextKey,
      header: "New Section",
      items: [""],
    };

    setContent([...content, newSection]);

    const nextSectionKey = `h${parseInt(nextKey.substring(1)) + 1}`;
    setNextKey(nextSectionKey);
  };

  const handleRemoveSection = (sectionId) => {
    const updatedContent = content.filter(
      (section) => section.id !== sectionId
    );
    setContent(updatedContent);
  };

  const handleSaveAboveHeader = (newHeader) => {
    setHeaderAboveSections(newHeader);

    const docRef = doc(db, "Content", "PubEthics");
    setDoc(docRef, { headerAboveSections: newHeader }, { merge: true })
      .then(() => {
        console.log("Header Above Section saved successfully!");
      })
      .catch((error) => {
        console.error("Error saving header above section: ", error);
      });
  };

  const handleSaveBelowHeader = (newHeader) => {
    setHeaderBelowSections(newHeader);

    const docRef = doc(db, "Content", "PubEthics");
    setDoc(docRef, { headerBelowSections: newHeader }, { merge: true })
      .then(() => {
        console.log("Header Below Section saved successfully!");
      })
      .catch((error) => {
        console.error("Error saving header below section: ", error);
      });
  };

  return (
    <div className="min-h-screen p-6 pt-32 bg-gray-100 flex justify-center items-center">
      <div className="container mx-auto bg-white shadow-lg rounded-lg p-6">
        <h1 className="text-3xl font-bold text-center mb-6">
          {" "}
          Publication Ethics{" "}
        </h1>
        {/* Add padding to push content below navbar */}
        <EditableHeader
          headerData={headerAboveSections}
          onSave={handleSaveAboveHeader}
          isAdmin={isAdmin}
        />
        {content.map((section) => (
          <EditableSection
            key={section.id}
            sectionKey={section.id}
            sectionData={section}
            onSave={handleSave}
            onRemove={handleRemoveSection}
            isAdmin={isAdmin}
          />
        ))}
        <EditableHeader
          headerData={headerBelowSections}
          onSave={handleSaveBelowHeader}
          isAdmin={isAdmin}
        />
        {isAdmin && (
          <button
            onClick={handleAddSection}
            className="bg-green-500 text-white px-4 py-2 rounded"
          >
            Add Section
          </button>
        )}
      </div>
    </div>
  );
};

export default PubEthics;
