import React, { useRef, useEffect } from "react";
import { resizeTextarea, resizeTextareaByIndex } from "../utils/textareaUtils";

const EditableContent = ({ content, setContent, onSave, onCancel }) => {
  const textareaRef = useRef(null);
  const issueRefs = useRef([]);

  useEffect(() => {
    resizeTextarea(textareaRef);
  }, [content.description]);

  const handleDescriptionChange = (e) => {
    setContent({ ...content, description: e.target.value });
    resizeTextarea(textareaRef);
  };

  const handleIssueChange = (index, value) => {
    const updatedIssues = [...content.issues];
    updatedIssues[index] = value;
    setContent({ ...content, issues: updatedIssues });
    resizeTextareaByIndex(issueRefs, index);
  };

  return (
    <div className="flex flex-col items-center">
      <input
        className="block w-full p-2 my-2 text-black rounded text-center overflow-hidden"
        value={content.title}
        onChange={(e) => setContent({ ...content, title: e.target.value })}
        placeholder="Enter title..."
      />

      <textarea
        ref={textareaRef}
        className="block w-full p-2 my-2 text-black rounded text-center resize-y overflow-hidden"
        value={content.description}
        onChange={handleDescriptionChange}
        style={{ minHeight: "40px", maxHeight: "300px" }}
        placeholder="Enter description..."
      />

      <div className="my-4 w-full flex flex-col items-center">
        {content.issues.map((issue, index) => (
          <textarea
            key={index}
            ref={(el) => (issueRefs.current[index] = el)}
            className="block w-full p-2 my-2 text-black rounded text-center resize-y overflow-hidden"
            value={issue}
            onChange={(e) => handleIssueChange(index, e.target.value)}
            style={{ minHeight: "40px", maxHeight: "300px" }}
            placeholder={`Enter issue ${index + 1}...`}
          />
        ))}
      </div>

      <div className="flex gap-2">
        <button
          className="bg-green-600 text-white px-4 py-2 mb-4 rounded hover:bg-green-700 transition-colors"
          onClick={onSave}
        >
          Save Changes
        </button>
        <button
          className="bg-gray-600 text-white px-4 py-2 mb-4 rounded hover:bg-gray-700 transition-colors"
          onClick={onCancel}
        >
          Cancel
        </button>
      </div>
    </div>
  );
};

export default EditableContent;
