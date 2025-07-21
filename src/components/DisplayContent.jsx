import React from "react";

const DisplayContent = ({ content, isAdmin, onEdit }) => {
  return (
    <div>
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
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors"
            onClick={onEdit}
          >
            Edit Content
          </button>
        </div>
      )}
    </div>
  );
};

export default DisplayContent;
