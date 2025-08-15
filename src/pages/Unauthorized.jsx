import React from "react";
import { useNavigate } from "react-router-dom";

function Unauthorized() {
  const navigate = useNavigate();

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <div className="p-10 text-center bg-white rounded-lg shadow-lg max-w-lg">
        <h1 className="text-4xl font-bold text-red-600 mb-4">
          403 - Not Authorized
        </h1>
        <p className="text-gray-600 mb-6">
          Sorry, you do not have permission to access this page.
        </p>

        <button
          onClick={() => navigate("/home")} // Redirects to the homepage
          className="bg-red-700 text-white px-6 py-2 rounded-md hover:bg-red-800 active:scale-95 active:bg-red-900"
        >
          Go to Homepage
        </button>
      </div>
    </div>
  );
}

export default Unauthorized;
