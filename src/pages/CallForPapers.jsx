import React, { useEffect, useState } from "react";
import { auth, db } from "../firebase/firebase";
import { doc, getDoc, updateDoc, onSnapshot } from "firebase/firestore";
import bg from "../assets/bg.jpg"; // Background image

function CallForPapers() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [content, setContent] = useState({
    title: "",
    description: "",
    issues: [""],
  });

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
        className="absolute inset-0 bg-cover bg-center bg-fixed z-0"
        style={{
          backgroundImage: `url(${bg})`,
          filter: "blur(4px)",
        }}
      ></div>

      {/* Content Section */}
      <div className="relative z-10 flex items-center justify-center min-h-screen">
        <div className="rounded-sm p-36">
          <div className="bg-yellow-300 py-2 rounded-t-lg w-72">
            <span className="text-2xl font-bold font-poppins ml-10 text-black">
              {content.title}
            </span>
          </div>

          <div className="bg-red-800 text-white p-6 rounded-b-lg">
            {isEditing ? (
              <div>
                <input
                  className="block w-full p-2 my-2 text-black rounded"
                  value={content.title}
                  onChange={(e) =>
                    setContent({ ...content, title: e.target.value })
                  }
                />
                <textarea
                  className="block w-full p-2 my-2 text-black rounded"
                  value={content.description}
                  onChange={(e) =>
                    setContent({ ...content, description: e.target.value })
                  }
                />
                <div className="my-4">
                  {content.issues.map((issue, index) => (
                    <input
                      key={index}
                      className="block w-full p-2 my-2 text-black rounded"
                      value={issue}
                      onChange={(e) => {
                        const updatedIssues = [...content.issues];
                        updatedIssues[index] = e.target.value;
                        setContent({ ...content, issues: updatedIssues });
                      }}
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
