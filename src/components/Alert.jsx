import React from "react";

const Alert = ({ message, type }) => {
  const alertStyles = {
    warning: "bg-yellow-300 text-yellow-800 border-yellow-400",
    error: "bg-red-300 text-red-800 border-red-400",
    success: "bg-green-300 text-green-800 border-green-400",
  };

  return (
    <div
      className={`flex items-center p-4 mb-4 border-l-4 rounded-md ${alertStyles[type]}`}
      role="alert"
    >
      <svg
        className="w-5 h-5 mr-2 text-yellow-800"
        fill="currentColor"
        viewBox="0 0 20 20"
      >
        <path
          fillRule="evenodd"
          d="M10 1a1 1 0 00-.894.553L.328 15.5A1 1 0 001 17h18a1 1 0 00.672-1.5l-8.778-13A1 1 0 0010 1z"
          clipRule="evenodd"
        />
      </svg>
      <div>{message}</div>
    </div>
  );
};

export default Alert;
