import React, { useState, useEffect } from "react";
import { getAuth } from "firebase/auth";
import { getFirestore, doc, getDoc, setDoc } from "firebase/firestore";

const PubEthics = () => {
  const [isEditing, setIsEditing] = useState(false);
  const [userRole, setUserRole] = useState(null); // Store user role
  const [content, setContent] = useState({
    heading: "",
    headers: {
      h1: "",
      h2: "",
      h3: "",
    },
    h1: [],
    h2: [],
    h3: [],
    footer: "",
  });

  const auth = getAuth();
  const db = getFirestore();

  // Fetch the user's role from Firestore
  useEffect(() => {
    const user = auth.currentUser;
    if (user) {
      const fetchUserRole = async () => {
        const userDocRef = doc(db, "Users", user.uid);
        const userDoc = await getDoc(userDocRef);
        if (userDoc.exists()) {
          const userData = userDoc.data();
          setUserRole(userData.role);
        }
      };
      fetchUserRole();
    }
  }, [auth.currentUser]);

  // Fetch the content from Firestore
  useEffect(() => {
    const fetchContent = async () => {
      const contentDocRef = doc(db, "Content", "PubEthics");
      const contentDoc = await getDoc(contentDocRef);
      if (contentDoc.exists()) {
        setContent(contentDoc.data());
      }
    };
    fetchContent();
  }, []);

  const handleEdit = () => setIsEditing(true);
  const handleSave = async () => {
    try {
      const contentDocRef = doc(db, "Content", "PubEthics");
      await setDoc(contentDocRef, content);
      setIsEditing(false);
    } catch (error) {
      console.error("Error saving content: ", error);
    }
  };

  const handleChange = (section, index, value) => {
    setContent((prevContent) => {
      const updatedContent = { ...prevContent };
      if (index !== null) {
        updatedContent[section][index] = value;
      } else {
        updatedContent[section] = value;
      }
      return updatedContent;
    });
  };

  const handleHeaderChange = (header, value) => {
    setContent((prevContent) => ({
      ...prevContent,
      headers: {
        ...prevContent.headers,
        [header]: value,
      },
    }));
  };

  const addInput = (section) => {
    setContent((prevContent) => ({
      ...prevContent,
      [section]: [...prevContent[section], ""],
    }));
  };

  const removeInput = (section, index) => {
    setContent((prevContent) => ({
      ...prevContent,
      [section]: prevContent[section].filter((_, i) => i !== index),
    }));
  };

  return (
    <div className="min-h-screen pt-[92px] p-6">
      <div className="container mx-auto">
        <h1 className="text-2xl font-bold mb-4">
          {isEditing && userRole === "Admin" ? (
            <>
              <label className="block text-sm font-medium text-gray-700">
                Heading
              </label>
              <textarea
                value={content.heading}
                onChange={(e) => handleChange("heading", null, e.target.value)}
                className="w-full border p-2 mt-1"
              />
            </>
          ) : (
            content.heading
          )}
        </h1>
        <section className="mb-6">
          <h2 className="text-xl font-semibold">
            {isEditing && userRole === "Admin" ? (
              <>
                <label className="block text-sm font-medium text-gray-700">
                  Authors Header
                </label>
                <input
                  type="text"
                  value={content.headers.authors || ""}
                  onChange={(e) =>
                    handleHeaderChange("authors", e.target.value)
                  }
                  className="w-full border p-2 mt-1 border-b"
                />
              </>
            ) : (
              content.headers.authors
            )}
          </h2>
          <ul className="list-disc pl-6 list-inside text-red-500">
            {(content.authors || []).map((item, index) => (
              <li key={index}>
                {isEditing && userRole === "Admin" ? (
                  <>
                    <label className="block text-sm font-medium text-gray-700">
                      Author {index + 1}
                    </label>
                    <textarea
                      value={item}
                      onChange={(e) =>
                        handleChange("authors", index, e.target.value)
                      }
                      className="w-full border p-2 mt-1 border-b"
                    />
                    <button
                      onClick={() => removeInput("authors", index)}
                      className="text-red-500 mt-2"
                    >
                      Remove
                    </button>
                  </>
                ) : (
                  item
                )}
              </li>
            ))}
          </ul>
          {isEditing && userRole === "Admin" && (
            <button
              onClick={() => addInput("authors")}
              className="bg-blue-500 text-white px-4 py-2 rounded mt-2"
            >
              New Bullet
            </button>
          )}
        </section>

        <section className="mb-6">
          <h2 className="text-xl font-semibold">
            {isEditing && userRole === "Admin" ? (
              <>
                <label className="block text-sm font-medium text-gray-700">
                  Peer Reviewers Header
                </label>
                <input
                  type="text"
                  value={content.headers.peerReviewers || ""}
                  onChange={(e) =>
                    handleHeaderChange("peerReviewers", e.target.value)
                  }
                  className="w-full border p-2 mt-1 border-b"
                />
              </>
            ) : (
              content.headers.peerReviewers
            )}
          </h2>
          <ul className="list-disc pl-6 list-inside text-red-500">
            {(content.peerReviewers || []).map((item, index) => (
              <li key={index}>
                {isEditing && userRole === "Admin" ? (
                  <>
                    <label className="block text-sm font-medium text-gray-700">
                      Peer Reviewer {index + 1}
                    </label>
                    <textarea
                      value={item}
                      onChange={(e) =>
                        handleChange("peerReviewers", index, e.target.value)
                      }
                      className="w-full border p-2 mt-1 border-b"
                    />
                    <button
                      onClick={() => removeInput("peerReviewers", index)}
                      className="text-red-500 mt-2"
                    >
                      Remove
                    </button>
                  </>
                ) : (
                  item
                )}
              </li>
            ))}
          </ul>
          {isEditing && userRole === "Admin" && (
            <button
              onClick={() => addInput("peerReviewers")}
              className="bg-blue-500 text-white px-4 py-2 rounded mt-2"
            >
              New Bullet
            </button>
          )}
        </section>

        <section className="mb-6">
          <h2 className="text-xl font-semibold">
            {isEditing && userRole === "Admin" ? (
              <>
                <label className="block text-sm font-medium text-gray-700">
                  Editors Header
                </label>
                <input
                  type="text"
                  value={content.headers.editors || ""}
                  onChange={(e) =>
                    handleHeaderChange("editors", e.target.value)
                  }
                  className="w-full border p-2 mt-1 border-b"
                />
              </>
            ) : (
              content.headers.editors
            )}
          </h2>
          <ul className="list-disc pl-6 list-inside text-red-500">
            {(content.editors || []).map((item, index) => (
              <li key={index}>
                {isEditing && userRole === "Admin" ? (
                  <>
                    <label className="block text-sm font-medium text-gray-700">
                      Editor {index + 1}
                    </label>
                    <textarea
                      value={item}
                      onChange={(e) =>
                        handleChange("editors", index, e.target.value)
                      }
                      className="w-full border p-2 mt-1 border-b"
                    />
                    <button
                      onClick={() => removeInput("editors", index)}
                      className="text-red-500 mt-2"
                    >
                      Remove
                    </button>
                  </>
                ) : (
                  item
                )}
              </li>
            ))}
          </ul>
          {isEditing && userRole === "Admin" && (
            <button
              onClick={() => addInput("editors")}
              className="bg-blue-500 text-white px-4 py-2 rounded mt-2"
            >
              New Bullet
            </button>
          )}
        </section>

        <div className="mt-4">
          {isEditing && userRole === "Admin" ? (
            <button
              onClick={handleSave}
              className="bg-blue-500 text-white px-4 py-2 rounded"
            >
              Save
            </button>
          ) : (
            <button
              onClick={handleEdit}
              className="bg-green-500 text-white px-4 py-2 rounded"
            >
              Edit
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default PubEthics;
