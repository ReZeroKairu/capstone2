import React from "react";

export default function Progressbar({
  currentStep = 0,
  steps = [],
  currentStatus,
}) {
  const isRejectedStatus =
    currentStatus === "Rejected" || currentStatus === "Peer Reviewer Rejected";
  const backToAdminIdx = steps.indexOf("Back to Admin");

  return (
    <div className="flex items-center w-full mb-4">
      {steps.map((status, idx) => {
        const isRejectedStep =
          status === "Rejected" || status === "Peer Reviewer Rejected";

        // Determine if this step is completed
        let isCompleted = false;
        if (isRejectedStatus) {
          // Completed only up to Back to Admin
          isCompleted = idx <= backToAdminIdx && !isRejectedStep;
        } else {
          isCompleted = idx < currentStep && !isRejectedStep;
        }

        const isCurrent =
          idx === currentStep && !isRejectedStep && !isRejectedStatus;

        // Circle color & content
        let circleClass = "bg-gray-300 border-gray-400 text-white";
        let circleContent = idx + 1;
        let circleOpacity = "";

        if (isRejectedStatus && idx > backToAdminIdx) {
          circleClass = "bg-red-500 border-red-500 text-white";
          circleContent = "X";
        } else if (
          status === "For Publication" &&
          currentStatus === "For Publication"
        ) {
          circleClass = "bg-green-500 border-green-500 text-white";
          circleContent = "✔";
          circleOpacity = "opacity-80";
        } else if (isCompleted) {
          circleClass = "bg-green-500 border-green-500 text-white";
          circleContent = "✔";
        } else if (isCurrent) {
          circleClass = "bg-yellow-400 border-yellow-400 text-black";
        }

        // Line color
        let lineClass = "bg-gray-300";
        if (isCompleted) lineClass = "bg-green-500";
        if (isRejectedStatus && idx >= backToAdminIdx) lineClass = "bg-red-500";

        return (
          <React.Fragment key={status}>
            <div className="flex flex-col items-center z-10">
              <div
                title={status}
                className={`w-8 h-8 rounded-full border-2 flex items-center justify-center font-bold transition-all duration-500 ${circleClass} ${circleOpacity}`}
              >
                {circleContent}
              </div>
              <p className="text-xs text-center mt-2 w-max max-w-[80px] break-words">
                {status}
              </p>
            </div>

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
