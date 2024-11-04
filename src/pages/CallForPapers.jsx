import React, { useEffect, useState, useRef } from "react";
import { auth, db } from "../firebase/firebase";
import { doc, getDoc, updateDoc, onSnapshot } from "firebase/firestore";

function CallForPapers() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [content, setContent] = useState({
    title: "",
    description: "",
    issues: [""],
  });
  const textareaRef = useRef(null);
  const issueRefs = useRef([]);

  useEffect(() => {
    const checkAdminRole = async () => {
      const user = auth.currentUser;
      if (user) {
        const docRef = doc(db, "Users", user.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists() && docSnap.data().role === "admin") {
          setIsAdmin(true);
        } else {
          setIsAdmin(false);
        }
      }
    };

    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (user) {
        await checkAdminRole();
      } else {
        setIsAdmin(false);
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const fetchContent = async () => {
      const docRef = doc(db, "Content", "CallForPapers");
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setContent(docSnap.data());
      }
    };

    fetchContent();

    const unsubscribe = onSnapshot(
      doc(db, "Content", "CallForPapers"),
      (doc) => {
        if (doc.exists()) {
          setContent(doc.data());
        }
      }
    );

    return () => unsubscribe();
  }, []);

  const handleResizeTextarea = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  };

  const handleResizeIssueInputs = (index) => {
    if (issueRefs.current[index]) {
      issueRefs.current[index].style.height = "auto";
      issueRefs.current[
        index
      ].style.height = `${issueRefs.current[index].scrollHeight}px`;
    }
  };

  useEffect(() => {
    handleResizeTextarea();
  }, [content.description]);

  const handleSaveChanges = async () => {
    try {
      const docRef = doc(db, "Content", "CallForPapers");
      await updateDoc(docRef, {
        title: content.title,
        description: content.description,
        issues: content.issues,
      });
      setIsEditing(false);
    } catch (error) {
      console.error("Failed to save content:", error);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Background Image */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-fixed"
        style={{
          backgroundImage: "url('/bg.jpg')",
        }}
      ></div>

      {/* Content Section */}
      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen py-24 w-full">
        <div className="rounded-sm p-6 w-full max-w-2xl mx-auto">
          <div className="bg-yellow-300 py-2 rounded-t-lg w-full flex items-center justify-center">
            <span className="text-2xl font-bold text-black text-center">
              {content.title}
            </span>
          </div>

          <div className="bg-red-800 text-white p-6 rounded-b-lg">
            {isEditing ? (
              <div className="flex flex-col items-center">
                <input
                  className="block w-full p-2 my-2 text-black rounded text-center overflow-hidden"
                  value={content.title}
                  onChange={(e) =>
                    setContent({ ...content, title: e.target.value })
                  }
                />
                <textarea
                  ref={textareaRef}
                  className="block w-full p-2 my-2 text-black rounded text-center resize-y overflow-hidden"
                  value={content.description}
                  onChange={(e) => {
                    setContent({ ...content, description: e.target.value });
                    handleResizeTextarea();
                  }}
                  style={{ minHeight: "40px", maxHeight: "300px" }}
                />
                <div className="my-4 w-full flex flex-col items-center">
                  {content.issues.map((issue, index) => (
                    <textarea
                      key={index}
                      ref={(el) => (issueRefs.current[index] = el)}
                      className="block w-full p-2 my-2 text-black rounded text-center resize-y overflow-hidden"
                      value={issue}
                      onChange={(e) => {
                        const updatedIssues = [...content.issues];
                        updatedIssues[index] = e.target.value;
                        setContent({ ...content, issues: updatedIssues });
                        handleResizeIssueInputs(index);
                      }}
                      style={{ minHeight: "40px", maxHeight: "300px" }}
                    />
                  ))}
                </div>
                <button
                  className="bg-green-600 text-white px-4 py-2 rounded mr-2"
                  onClick={handleSaveChanges}
                >
                  Save Changes
                </button>
                <button
                  className="bg-gray-600 text-white px-4 py-2 rounded"
                  onClick={() => setIsEditing(false)}
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div>
                {/* Apply `white-space: pre-line` to preserve line breaks and spaces */}
                <p className="text-lg mb-6" style={{ whiteSpace: "pre-line" }}>
                  {content.description}
                </p>
                <div className="text-center">
                  {content.issues.map((issue, index) => (
                    <p
                      key={index}
                      className="text-2xl font-bold my-2"
                      style={{ whiteSpace: "pre-line" }}
                    >
                      {issue}
                    </p>
                  ))}
                </div>
                {isAdmin && (
                  <div className="text-center mt-6">
                    <button
                      className="bg-blue-600 text-white px-4 py-2 rounded"
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
