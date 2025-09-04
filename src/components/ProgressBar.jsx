import React from "react";

const STATUS_ORDER = [
  "Pending",
  "Assigning Peer Reviewer",
  "Peer Reviewer Assigned",
  "Peer Reviewer Reviewing",
  "Back to Admin",
  "For Revision",
  "For Publication",
  "Rejected",
];

export default function Progressbar({ currentStatus }) {
  const currentIndex = STATUS_ORDER.indexOf(currentStatus);

  return (
    <div className="flex flex-wrap justify-between mb-4 relative">
      {STATUS_ORDER.map((status, idx) => (
        <div
          key={status}
          className="flex flex-col items-center relative w-1/9 min-w-[60px] mb-4 transition-all duration-500"
        >
          {/* Circle */}
          <div
            title={status} // Use browser tooltip for full text
            className={`w-8 h-8 rounded-full border-2 flex items-center justify-center z-10 font-bold transition-all duration-500
              ${
                idx < currentIndex
                  ? "bg-green-500 border-green-500 text-white"
                  : idx === currentIndex
                  ? "bg-yellow-400 border-yellow-400 text-black"
                  : "bg-gray-300 border-gray-400 text-white"
              }`}
          >
            {idx < currentIndex ? "✔" : idx + 1}
          </div>

          {/* Connecting Line */}
          {idx !== STATUS_ORDER.length - 1 && (
            <div
              className={`absolute top-4 left-1/2 w-full h-1 -z-0 transition-all duration-500
                ${idx < currentIndex ? "bg-green-500" : "bg-gray-300"}`}
              style={{ transform: "translateX(50%)" }}
            />
          )}

          {/* Label */}
          <p className="text-xs text-center mt-2 w-auto break-words">
            {status}
          </p>
        </div>
      ))}
    </div>
  );
}
