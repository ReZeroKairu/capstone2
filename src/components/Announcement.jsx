import React, { useEffect, useState, useRef, useCallback } from "react";
import { auth, db } from "../firebase/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, updateDoc, onSnapshot, setDoc } from "firebase/firestore";
import { processHtmlImages } from "../utils/imageUpload";
import ReactQuill from "react-quill";
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import "react-quill/dist/quill.snow.css";
import { quillModules, quillFormats } from "../utils/quillConfig";
import SafeHTML from "./common/SafeHTML";

// Draggable announcement item component
const SortableItem = ({ id, index, moveItem, children }) => {
  const ref = useRef(null);
  const scrollContainerRef = useRef(null);
  const scrollRegionHeight = 150; // Pixels from top/bottom of viewport where scrolling starts
  
  // Auto-scroll when dragging near the edges of the viewport
  const handleScroll = useCallback((e) => {
    if (!isDragging) return;
    
    const viewportHeight = window.innerHeight;
    const { clientY } = e;
    
    // Calculate distance from top and bottom of viewport
    const distanceFromTop = clientY;
    const distanceFromBottom = viewportHeight - clientY;
    
    // Calculate scroll speed based on distance from edge
    const scrollSpeed = Math.max(5, Math.floor((scrollRegionHeight - Math.min(distanceFromTop, distanceFromBottom)) / 3));
    
    // Get the scrollable container
    const container = scrollContainerRef.current;
    if (!container) return;
    
    // Scroll up if near the top of the viewport
    if (distanceFromTop < scrollRegionHeight) {
      window.scrollBy(0, -scrollSpeed);
      e.preventDefault();
    } 
    // Scroll down if near the bottom of the viewport
    else if (distanceFromBottom < scrollRegionHeight) {
      window.scrollBy(0, scrollSpeed);
      e.preventDefault();
    }
  }, []);
  
  const [{ isDragging }, drag] = useDrag({
    type: 'ANNOUNCEMENT',
    item: { index },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  const [, drop] = useDrop({
    accept: 'ANNOUNCEMENT',
    hover(item, monitor) {
      if (!ref.current) return;
      const dragIndex = item.index;
      const hoverIndex = index;
      
      // Don't replace items with themselves
      if (dragIndex === hoverIndex) return;
      
      // Determine rectangle on screen
      const hoverBoundingRect = ref.current?.getBoundingClientRect();
      // Get vertical middle
      const hoverMiddleY = (hoverBoundingRect.bottom - hoverBoundingRect.top) / 2;
      // Determine mouse position
      const clientOffset = monitor.getClientOffset();
      // Get pixels to the top
      const hoverClientY = clientOffset.y - hoverBoundingRect.top;
      
      // Only perform the move when the mouse has crossed half of the items height
      // When dragging downwards, only move when the cursor is below 50%
      // When dragging upwards, only move when the cursor is above 50%
      // Dragging downwards
      if (dragIndex < hoverIndex && hoverClientY < hoverMiddleY) return;
      // Dragging upwards
      if (dragIndex > hoverIndex && hoverClientY > hoverMiddleY) return;
      
      // Time to actually perform the action
      moveItem(dragIndex, hoverIndex);
      
      // Note: we're mutating the monitor item here!
      // Generally it's better to avoid mutations,
      // but it's good here for the sake of performance
      // to avoid expensive index searches.
      item.index = hoverIndex;
    },
  });

  // Set up auto-scroll on drag
  useEffect(() => {
    if (isDragging) {
      // Use the document body for scrolling
      scrollContainerRef.current = document.documentElement;
      
      // Add event listeners for smooth scrolling
      document.addEventListener('mousemove', handleScroll, { passive: false });
      
      // Prevent default to avoid text selection during drag
      const preventDefault = (e) => e.preventDefault();
      document.addEventListener('selectstart', preventDefault);
      
      return () => {
        document.removeEventListener('mousemove', handleScroll);
        document.removeEventListener('selectstart', preventDefault);
      };
    }
  }, [isDragging, handleScroll]);

  const opacity = isDragging ? 0.4 : 1;
  drag(drop(ref));
  
  return (
    <div 
      ref={ref}
      style={{ opacity }} 
      className="relative"
    >
      {children(drag)}
    </div>
  );
};

export default function Announcement() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [announcements, setAnnouncements] = useState([
    { id: Date.now().toString(), title: "", message: "", date: "" },
  ]);
  const [originalAnnouncements, setOriginalAnnouncements] = useState([]);
  const [notification, setNotification] = useState({ message: "", type: "" });
  const [error, setError] = useState("");

  const notificationBarRef = useRef(null);
  const quillRefs = useRef([]);
  const notificationTimeoutRef = useRef(null);
  const announcementsContainerRef = useRef(null);

  const showNotification = useCallback((message, type) => {
    setNotification({ message, type });
    if (notificationTimeoutRef.current)
      clearTimeout(notificationTimeoutRef.current);
    notificationTimeoutRef.current = setTimeout(
      () => setNotification({ message: "", type: "" }),
      4000
    );
  }, []);

  const checkAdminRole = useCallback(async (user) => {
    if (!user) return setIsAdmin(false);
    try {
      const docRef = doc(db, "Users", user.uid);
      const docSnap = await getDoc(docRef);
      setIsAdmin(docSnap.exists() && docSnap.data().role === "Admin");
    } catch (err) {
      console.error(err);
      setError("Failed to verify admin permissions");
      setIsAdmin(false);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setLoading(true);
      await checkAdminRole(user);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [checkAdminRole]);

  useEffect(() => {
    const docRef = doc(db, "Content", "Announcements");
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      const data = docSnap.exists() ? docSnap.data() : {};
      const defaultAnnouncements = [
        {
          title: "Welcome!",
          message: "Stay tuned for updates.",
          date: new Date().toLocaleDateString(),
        },
      ];
      const loaded = data.announcements || defaultAnnouncements;
      setAnnouncements(loaded);
      setOriginalAnnouncements(loaded);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleAnnouncementMessageChange = (idx, value) => {
    setAnnouncements((prev) =>
      prev.map((a, i) => (i === idx ? { ...a, message: value } : a))
    );
  };

  const moveItem = useCallback((dragIndex, hoverIndex) => {
    setAnnouncements((prevAnnouncements) => {
      const newAnnouncements = [...prevAnnouncements];
      const [movedItem] = newAnnouncements.splice(dragIndex, 1);
      newAnnouncements.splice(hoverIndex, 0, movedItem);
      return newAnnouncements;
    });
  }, []);

  const addAnnouncement = useCallback(() => {
    const newAnnouncement = {
      id: Date.now().toString(),
      title: "",
      message: "",
      date: new Date().toISOString().slice(0, 10)
    };
    
    setAnnouncements((prev) => [newAnnouncement, ...prev]);
    
    // Scroll to the top of the announcements container after the state updates
    setTimeout(() => {
      if (announcementsContainerRef.current) {
        announcementsContainerRef.current.scrollTo({
          top: 0,
          behavior: 'smooth'
        });
      }
    }, 0);
  }, []);

  const removeAnnouncement = useCallback(
    (index) => {
      if (announcements.length > 1)
        setAnnouncements((prev) => prev.filter((_, i) => i !== index));
    },
    [announcements.length]
  );

  const hasChanges = () =>
    JSON.stringify(originalAnnouncements) !== JSON.stringify(announcements);

  const removeImageAtIndex = (announcementIdx, imageIdx) => {
    const quillWrapper = quillRefs.current[announcementIdx];
    if (!quillWrapper || !quillWrapper.querySelector) return;

    const editor = quillWrapper.querySelector(".ql-editor");
    if (!editor) return;

    const parser = new DOMParser();
    const docHTML = parser.parseFromString(editor.innerHTML, "text/html");
    const images = docHTML.querySelectorAll("img");

    if (images[imageIdx]) {
      images[imageIdx].remove();
      const newHTML = docHTML.body.innerHTML;

      setAnnouncements((prev) =>
        prev.map((a, i) =>
          i === announcementIdx ? { ...a, message: newHTML } : a
        )
      );
      showNotification("Image removed.", "success");
    }
  };

  const handleSaveChanges = async () => {
    if (!hasChanges()) {
      showNotification("No changes made.", "warning");
      return;
    }

    setSaving(true);
    setError("");

    try {
      // Create a completely clean array of announcements
      const announcementsToSave = [];
      
      for (const a of announcements) {
        if (!a.title?.trim() || !a.message?.trim()) continue;
        
        // Process the message to handle base64 images
        let message = String(a.message);
        let hasImages = false;
        
        // Check if there are any base64 images
        const base64Images = message.match(/data:image\/[^;]+;base64[^"]+/g) || [];
        
        if (base64Images.length > 0) {
          try {
            // Process and upload images
            const { content: processedContent } = await processHtmlImages(message);
            message = processedContent;
            hasImages = true;
          } catch (error) {
            console.error('Error processing images:', error);
            showNotification("Error processing images. Please try again.", "error");
            continue;
          }
        }
        
        // Create a new plain object with the processed content
        const cleanAnnouncement = {
          id: a.id || `announcement-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          title: String(a.title).trim(),
          message: message,
          date: a.date || new Date().toISOString().slice(0, 10),
          hasImages: hasImages
        };
        
        announcementsToSave.push(cleanAnnouncement);
      }

      // Create a new document with the updated data
      const docRef = doc(db, "Content", "Announcements");
      
      // First, try to get the existing document to preserve other fields
      const docSnap = await getDoc(docRef);
      const existingData = docSnap.exists() ? docSnap.data() : {};
      
      // Create a completely new object with only the data we want to save
      const updateData = {
        ...existingData, // Keep existing fields
        announcements: announcementsToSave.map(a => ({
          id: a.id,
          title: a.title,
          message: a.message,
          date: a.date
        })),
        lastUpdated: new Date().toISOString()
      };

      // Log the data we're about to save
      console.log('Saving data:', JSON.stringify(updateData, null, 2));
      
      // Try a direct update with a clean object
      await updateDoc(docRef, updateData);

      // Update local state
      setIsEditing(false);
      setOriginalAnnouncements(announcementsToSave);
      setAnnouncements(announcementsToSave);
      showNotification("Announcements saved successfully!", "success");
    } catch (err) {
      console.error("Failed to save announcements:", err);
      setError("Failed to save changes. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEdit = useCallback(() => {
    setAnnouncements(originalAnnouncements);
    setIsEditing(false);
    setError("");
  }, [originalAnnouncements]);

  if (loading)
    return (
      <div className="flex items-center justify-center min-h-screen text-black text-xl">
        Loading...
      </div>
    );

  // Add DnD provider at the root level
  return (
    <DndProvider backend={HTML5Backend}>
      <div className="relative flex flex-col items-center mt-10 p-6 pt-28 pb-40 sm:p-16 sm:pt-28 sm:pb-16">
      <div className="relative w-full max-w-3xl bg-white border border-gray-300 rounded-lg shadow p-6 pt-11">
        <div className="absolute -top-5 left-1/2 transform -translate-x-1/2 bg-red-800 text-white px-6 py-2 rounded-lg font-bold text-lg">
          {isEditing ? "Editing Announcements" : "Announcements"}
        </div>

        {notification.message && (
          <div
            ref={notificationBarRef}
            className={`w-full mb-4 py-3 text-center font-semibold rounded text-white ${
              notification.type === "success"
                ? "bg-green-500"
                : notification.type === "warning"
                ? "bg-yellow-500"
                : "bg-red-500"
            }`}
          >
            {notification.message}
          </div>
        )}
        {error && (
          <div className="bg-red-500 text-white p-3 rounded mb-4 text-center">
            {error}
          </div>
        )}

        <div ref={announcementsContainerRef} className="announcements-container max-h-[60vh] overflow-y-auto">
          {isEditing && (
            <div className="mb-4">
              <button
                onClick={addAnnouncement}
                className="w-full py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-md font-medium transition-colors"
              >
                + Add New Announcement
              </button>
            </div>
          )}
          <div className="flex flex-col space-y-4">
            {announcements.map((a, idx) => (
              <SortableItem 
                key={a.id || idx}
                id={a.id || idx.toString()}
                index={idx}
                moveItem={isEditing ? moveItem : () => {}}
              >
                {drag => (
                  <div className="mb-4 relative border rounded p-4 bg-white">
                    {/* Drag handle - only draggable on this area */}
                    {isEditing && announcements.length > 1 && (
                      <div 
                        ref={drag}
                        className="absolute -left-2 -top-2 w-6 h-6 flex items-center justify-center bg-gray-200 rounded-full cursor-move"
                        title="Drag to reorder"
                      >
                        <svg 
                          className="w-4 h-4 text-gray-600" 
                          fill="none" 
                          stroke="currentColor" 
                          viewBox="0 0 24 24" 
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <path 
                            strokeLinecap="round" 
                            strokeLinejoin="round" 
                            strokeWidth={2} 
                            d="M4 8h16M4 16h16" 
                          />
                        </svg>
                      </div>
                  )}
                  {isEditing ? (
                    <>
                      {/* Title input for editing */}
                      <input
                        type="text"
                        value={a.title}
                        onChange={(e) =>
                          setAnnouncements((prev) =>
                            prev.map((it, i) =>
                              i === idx ? { ...it, title: e.target.value } : it
                            )
                          )
                        }
                        className="w-full p-2 border rounded mb-2"
                        placeholder="Announcement Title"
                      />

                      {/* Remove Announcement Button */}
                      {announcements.length > 1 && (
                        <button
                          type="button"
                          className="absolute top-2 right-2 bg-red-600 text-white px-2 py-1 rounded text-sm hover:bg-red-700"
                          onClick={() => removeAnnouncement(idx)}
                        >
                          Remove
                        </button>
                      )}

                      {/* Quill editor for editing */}
                      <div ref={(el) => (quillRefs.current[idx] = el)}>
                        <ReactQuill
                          value={a.message}
                          onChange={(val) => handleAnnouncementMessageChange(idx, val)}
                          modules={quillModules}
                          formats={quillFormats}
                          theme="snow"
                          className="bg-white text-black rounded mb-2"
                        />
                      </div>

                      {/* Image previews with remove buttons */}
                      <div className="flex flex-wrap gap-2 mt-2">
                        {Array.from(
                          new DOMParser()
                            .parseFromString(a.message, "text/html")
                            .querySelectorAll("img")
                        ).map((img, iidx) => (
                          <div key={iidx} className="relative">
                            <img
                              src={img.src}
                              alt={`Preview ${iidx + 1}`}
                              className="h-20 w-auto object-cover rounded border"
                            />
                            <button
                              type="button"
                              onClick={() => removeImageAtIndex(idx, iidx)}
                              className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>

                      {/* Date input */}
                      <div className="mt-2">
                        <input
                          type="date"
                          value={a.date || new Date().toISOString().slice(0, 10)}
                          onChange={(e) =>
                            setAnnouncements((prev) =>
                              prev.map((it, i) =>
                                i === idx ? { ...it, date: e.target.value } : it
                              )
                            )
                          }
                          className="p-1 border rounded text-sm"
                        />
                      </div>
                    </>
                  ) : (
                    /* View mode for non-editing */
                    <>
                      <h3 className="text-lg font-bold mb-1">{a.title}</h3>
                      <div className="mb-2">
                        <SafeHTML 
                          content={a.message} 
                          className="text-gray-800 prose max-w-none"
                        />
                      </div>
                      {a.date && (
                        <p className="text-xs text-gray-500 text-right">
                          {new Date(a.date).toLocaleDateString()}
                        </p>
                      )}
                    </>
                  )}
                  </div>
                )}
              </SortableItem>
            ))}
          </div>
        </div>

        {isAdmin && (
          <div className="flex flex-wrap justify-center gap-3 mt-6">
            {isEditing ? (
              <>
                <button
                  className={`px-6 py-2 rounded font-semibold ${
                    saving || !hasChanges()
                      ? "bg-gray-400 cursor-not-allowed"
                      : "bg-green-600 hover:bg-green-700 text-white"
                  }`}
                  onClick={handleSaveChanges}
                  disabled={saving || !hasChanges()}
                >
                  {saving ? "Saving..." : "Save Changes"}
                </button>
                <button
                  className="bg-gray-600 hover:bg-gray-700 text-white px-6 py-2 rounded font-semibold"
                  onClick={handleCancelEdit}
                  disabled={saving}
                >
                  Cancel
                </button>
              </>
            ) : (
              <button
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded font-semibold"
                onClick={() => setIsEditing(true)}
              >
                Edit Announcements
              </button>
            )}
          </div>
        )}
        </div>
      </div>
    </DndProvider>
  );
}
