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
  const textareaRef = useRef(null); // Create a ref for the textarea
  const issueRefs = useRef([]); // Create a ref for the issue inputs

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
        await checkAdminRole(); // Only check admin role if user is signed in
      } else {
        setIsAdmin(false); // Reset isAdmin on sign out
      }
    });

    return () => unsubscribe(); // Cleanup on unmount
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

    return () => unsubscribe(); // Cleanup listener on unmount
  }, []);

  const handleResizeTextarea = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto"; // Reset height
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`; // Set to scroll height
    }
  };

  const handleResizeIssueInputs = (index) => {
    if (issueRefs.current[index]) {
      issueRefs.current[index].style.height = "auto"; // Reset height
      issueRefs.current[
        index
      ].style.height = `${issueRefs.current[index].scrollHeight}px`; // Set to scroll height
    }
  };

  useEffect(() => {
    handleResizeTextarea(); // Adjust height when description changes
  }, [content.description]); // Run when description changes

  const handleSaveChanges = async () => {
    try {
      const docRef = doc(db, "Content", "CallForPapers");
      await updateDoc(docRef, {
        title: content.title,
        description: content.description,
        issues: content.issues,
      });
      setIsEditing(false); // Close edit mode on save
    } catch (error) {
      console.error("Failed to save content:", error);
    }
  };

  return (
    <div className="relative min-h-screen">
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
          <div className="bg-yellow-300 py-2 rounded-t-lg w-56 flex items-center justify-center">
            <span className="text-2xl font-bold text-black text-center">
              {content.title}
            </span>
          </div>

          <div className="bg-red-800 text-white p-6 rounded-b-lg">
            {isEditing ? (
              <div className="flex flex-col items-center">
                {/* Flex container for centering */}
                <input
                  className="block w-full max-w-md p-2 my-2 text-black rounded text-center overflow-hidden" // Center text and prevent overflow
                  value={content.title}
                  onChange={(e) =>
                    setContent({ ...content, title: e.target.value })
                  }
                />
                <textarea
                  ref={textareaRef} // Attach ref to textarea
                  className="block w-full max-w-md p-2 my-2 text-black rounded text-center resize-y overflow-hidden" // Center text and allow vertical resizing
                  value={content.description}
                  onChange={(e) => {
                    setContent({ ...content, description: e.target.value });
                    handleResizeTextarea(); // Adjust height when the value changes
                  }}
                  style={{ minHeight: "40px", maxHeight: "300px" }} // Set min and max height
                />
                <div className="my-4 w-full flex flex-col items-center">
                  {/* Flex container for issues */}
                  {content.issues.map((issue, index) => (
                    <textarea
                      key={index}
                      ref={(el) => (issueRefs.current[index] = el)} // Attach ref for each issue input
                      className="block w-full max-w-md p-2 my-2 text-black rounded text-center resize-y overflow-hidden" // Center text and allow vertical resizing
                      value={issue}
                      onChange={(e) => {
                        const updatedIssues = [...content.issues];
                        updatedIssues[index] = e.target.value;
                        setContent({ ...content, issues: updatedIssues });
                        handleResizeIssueInputs(index); // Adjust height for the current input
                      }}
                      style={{ minHeight: "40px", maxHeight: "300px" }} // Set min and max height
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
                <p className="text-lg mb-6">{content.description}</p>
                <div className="text-center">
                  {content.issues.map((issue, index) => (
                    <p key={index} className="text-2xl font-bold my-2">
                      {issue}
                    </p>
                  ))}
                </div>
                {/* Edit Button for Admin */}
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
