import React from "react";

export default function Progressbar({
  currentStep = 0,
  steps = [],
  currentStatus,
}) {
  return (
    <div className="flex items-center w-full mb-4">
      {steps.map((status, idx) => {
        const isCompleted = idx < currentStep;
        const isCurrent = idx === currentStep;

        // Determine circle color
        let circleClass = "bg-gray-300 border-gray-400 text-white";
        let circleContent = idx + 1;

        if (isCurrent && currentStatus === "Rejected") {
          circleClass = "bg-red-500 border-red-500 text-white";
          circleContent = "X";
        } else if (isCompleted) {
          circleClass = "bg-green-500 border-green-500 text-white";
          circleContent = "✔";
        } else if (isCurrent) {
          circleClass = "bg-yellow-400 border-yellow-400 text-black";
        }

        // Determine line color
        let lineClass = "bg-gray-300";
        if (isCompleted) lineClass = "bg-green-500";
        if (isCurrent && currentStatus === "Rejected") lineClass = "bg-red-500";

        return (
          <React.Fragment key={status}>
            {/* Circle + Label */}
            <div className="flex flex-col items-center z-10">
              <div
                title={status}
                className={`w-8 h-8 rounded-full border-2 flex items-center justify-center font-bold transition-all duration-500 ${circleClass}`}
              >
                {circleContent}
              </div>
              <p className="text-xs text-center mt-2 w-max max-w-[80px] break-words">
                {status}
              </p>
            </div>

            {/* Connecting line */}
            {idx !== steps.length - 1 && (
              <div
                className={`flex-1 h-1 transition-all duration-500 self-center ${lineClass}`}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}
