import React from "react";

const statusSteps = [
  "Pending",
  "Under Review by Peer Reviewer",
  "Returned for Revision",
  "Reviewed by Peer Reviewer",
  "Accepted / Rejected by Admin",
];

export default function ProgressBar({ currentStatus }) {
  const currentIndex = statusSteps.indexOf(currentStatus);

  return (
    <div className="w-full mb-4">
      <div className="flex justify-between mb-1">
        {statusSteps.map((status, index) => (
          <span
            key={index}
            className={`text-xs font-semibold ${
              index <= currentIndex ? "text-green-600" : "text-gray-400"
            }`}
          >
            {status}
          </span>
        ))}
      </div>
      <div className="relative w-full h-2 bg-gray-200 rounded">
        <div
          className="absolute h-2 bg-green-600 rounded"
          style={{
            width: `${((currentIndex + 1) / statusSteps.length) * 100}%`,
          }}
        ></div>
      </div>
    </div>
  );
}
