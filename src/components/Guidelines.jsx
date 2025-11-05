import React, { useState, useEffect, useRef, useCallback } from "react";
import { ChevronDown, Trash2, Plus } from "lucide-react";
import { auth, db } from "../firebase/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";
import { quillModules, quillFormats } from "../utils/quillConfig";
import SafeHTML from "./common/SafeHTML";

const Guidelines = () => {
  const [sections, setSections] = useState([]);
  const [originalSections, setOriginalSections] = useState([]);
  const [openIndex, setOpenIndex] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notification, setNotification] = useState({ message: "", type: "" });
  const notificationTimeoutRef = useRef(null);
  const newSectionRef = useRef(null);
  const quillRefs = useRef([]);

  // Toggle accordion
  const toggleSection = (index) =>
    setOpenIndex(openIndex === index ? null : index);

  // Show notification
  const showNotification = useCallback((message, type) => {
    setNotification({ message, type });
    if (notificationTimeoutRef.current)
      clearTimeout(notificationTimeoutRef.current);
    notificationTimeoutRef.current = setTimeout(() => {
      setNotification({ message: "", type: "" });
    }, 4000);
  }, []);

  // Fetch guidelines
  useEffect(() => {
    const fetchGuidelines = async () => {
      setLoading(true);
      try {
        const docRef = doc(db, "Content", "Guidelines");
        const docSnap = await getDoc(docRef);
        if (docSnap.exists() && docSnap.data().sections) {
          setSections(docSnap.data().sections);
        } else {
          setSections([]);
        }
      } catch (error) {
        console.error("Failed to load guidelines:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchGuidelines();
  }, []);

  // Check admin role
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) return setIsAdmin(false);
      try {
        const docRef = doc(db, "Users", user.uid);
        const docSnap = await getDoc(docRef);
        setIsAdmin(docSnap.exists() && docSnap.data().role === "Admin");
      } catch (error) {
        console.error("Failed to check admin role:", error);
        setIsAdmin(false);
      }
    });
    return () => unsubscribe();
  }, []);

  // Start editing
  const startEditing = () => {
    setOriginalSections(JSON.parse(JSON.stringify(sections)));
    setIsEditing(true);
  };

  // Cancel editing
  const cancelEditing = () => {
    setSections(originalSections);
    setIsEditing(false);
  };

  // Save guidelines
  const handleSaveGuidelines = async () => {
    if (JSON.stringify(sections) === JSON.stringify(originalSections)) {
      showNotification("No changes made", "error");
      return;
    }
    setSaving(true);
    try {
      const docRef = doc(db, "Content", "Guidelines");
      await setDoc(docRef, { sections }, { merge: true });
      setOriginalSections(JSON.parse(JSON.stringify(sections)));
      setIsEditing(false);
      showNotification("Guidelines saved successfully!", "success");
    } catch (error) {
      console.error("Failed to save guidelines:", error);
      showNotification("Failed to save guidelines.", "error");
    } finally {
      setSaving(false);
    }
  };

  // Add new section
  const addSection = () => {
    const newSec = {
      title: "New Section",
      content: "• Add your content here.",
    };
    setSections((prev) => [...prev, newSec]);
    setOpenIndex(sections.length);
    setTimeout(() => {
      if (newSectionRef.current) {
        newSectionRef.current.focus();
      }
    }, 100);
  };

  // Delete section
  const deleteSection = (index) => {
    setSections((prev) => prev.filter((_, i) => i !== index));
    setOpenIndex(null);
  };

  // Remove image from section content
  const removeImageAtIndex = (sectionIndex, imageIndex) => {
    const quill = quillRefs.current[sectionIndex]?.getEditor();
    if (!quill) return;

    const delta = quill.getContents();
    let imgCounter = -1;
    const newOps = delta.ops.filter((op) => {
      if (op.insert?.image) {
        imgCounter++;
        if (imgCounter === imageIndex) return false;
      }
      return true;
    });

    quill.setContents({ ops: newOps });
    setSections((prev) =>
      prev.map((s, i) =>
        i === sectionIndex ? { ...s, content: quill.root.innerHTML } : s
      )
    );
    showNotification("Image removed.", "success");
  };

  if (loading)
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-black text-xl">Loading...</div>
      </div>
    );

  return (
    <div className="min-h-screen flex flex-col">
      <main className="flex-grow w-full px-12 mt-32 pb-10">
        <div className="text-4xl font-bold text-[#7a0f0f] mb-12">
          Guidelines for Submission
        </div>

        {notification.message && (
          <div
            className={`w-full mb-4 py-3 text-center font-semibold rounded text-white ${
              notification.type === "success"
                ? "bg-green-500"
                : notification.type === "error"
                ? "bg-red-500"
                : "bg-yellow-500"
            }`}
          >
            {notification.message}
          </div>
        )}

        {sections.map((section, index) => {
          const isOpen = openIndex === index;
          const images =
            isEditing && section.content
              ? Array.from(
                  new DOMParser()
                    .parseFromString(section.content, "text/html")
                    .querySelectorAll("img")
                )
              : [];

          return (
            <div key={index} className="mb-6">
              <div
                onClick={() => toggleSection(index)}
                className={`w-full flex items-center border-l-4 ${
                  isOpen ? "border-[#FFD700]" : "border-[#7a0f0f]"
                } pl-4 py-3 cursor-pointer text-lg bg-white hover:bg-gray-50 transition`}
              >
                <div className="flex-1 font-semibold flex items-center gap-2">
                  {isEditing && isAdmin ? (
                    <input
                      ref={index === sections.length - 1 ? newSectionRef : null}
                      type="text"
                      value={section.title}
                      onChange={(e) =>
                        setSections((prev) =>
                          prev.map((s, i) =>
                            i === index ? { ...s, title: e.target.value } : s
                          )
                        )
                      }
                      className="w-full px-2 py-1 border-b border-gray-300 focus:outline-none text-lg font-semibold"
                    />
                  ) : (
                    <SafeHTML
                      content={section.title}
                      className="inline"
                      textColor="text-black"
                    />
                  )}

                  {isEditing && isAdmin && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteSection(index);
                      }}
                      className="text-red-500 hover:text-red-700"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>

                <ChevronDown
                  className={`ml-auto transition-transform duration-300 ${
                    isOpen ? "rotate-180 text-[#FFD700]" : ""
                  }`}
                />
              </div>

              <div
                className={`overflow-hidden transition-all duration-500 ease-in-out ${
                  isOpen
                    ? "max-h-[500px] opacity-100 py-4"
                    : "max-h-0 opacity-0 py-0"
                }`}
              >
                <div className="text-gray-800 text-base border border-[#FFD700] rounded-md px-6 py-4 leading-relaxed max-h-[300px] overflow-y-auto">
                  {isEditing && isAdmin ? (
                    <>
                      <ReactQuill
                        ref={(el) => (quillRefs.current[index] = el)}
                        value={section.content}
                        onChange={(value) =>
                          setSections((prev) =>
                            prev.map((s, i) =>
                              i === index ? { ...s, content: value } : s
                            )
                          )
                        }
                        modules={quillModules}
                        formats={quillFormats}
                        theme="snow"
                      />
                      {/* Image preview + remove */}
                      <div className="flex flex-wrap gap-2 mt-2">
                        {images.map((img, imgIdx) => (
                          <div key={imgIdx} className="relative">
                            <img
                              src={img.src}
                              alt={img.alt || ""}
                              className="w-24 h-24 object-cover rounded"
                            />
                            <button
                              type="button"
                              className="absolute top-0 right-0 bg-red-600 text-white rounded-full w-5 h-5 text-xs"
                              onClick={() => removeImageAtIndex(index, imgIdx)}
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <SafeHTML
                      content={section.content}
                      className="mt-2"
                      textColor="text-black"
                    />
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {isAdmin && (
          <div className="flex gap-3 mt-6 items-center">
            {isEditing ? (
              <>
                <button
                  className={`px-6 py-2 rounded font-semibold ${
                    saving
                      ? "bg-gray-400 cursor-not-allowed"
                      : "bg-green-600 hover:bg-green-700 text-white"
                  }`}
                  onClick={handleSaveGuidelines}
                  disabled={saving}
                >
                  {saving ? "Saving..." : "Save Changes"}
                </button>
                <button
                  className="bg-gray-600 hover:bg-gray-700 text-white px-6 py-2 rounded font-semibold"
                  onClick={cancelEditing}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded flex items-center gap-1"
                  onClick={addSection}
                >
                  <Plus size={16} /> Add Section
                </button>
              </>
            ) : (
              <button
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded font-semibold"
                onClick={startEditing}
              >
                Edit Guidelines
              </button>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default Guidelines;
