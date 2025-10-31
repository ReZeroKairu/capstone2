import React from "react";

export default function Progressbar({
  currentStep = 0,
  steps = [],
  currentStatus,
}) {
  const isRejectedStatus =
    currentStatus === "Rejected" || 
    currentStatus === "Peer Reviewer Rejected" ||
    currentStatus === "non-Acceptance";
    
  const backToAdminIdx = steps.indexOf("Back to Admin");
  const isNonAcceptance = currentStatus === "non-Acceptance";

  // If status is non-Acceptance, only show the first step
  const displaySteps = isNonAcceptance ? [steps[0]] : steps;
  const displayStatus = isNonAcceptance ? "non-Acceptance" : null;

  return (
    <div className="flex items-center w-full mb-4">
      {displaySteps.map((status, idx) => {
        const isRejectedStep =
          status === "Rejected" || 
          status === "Peer Reviewer Rejected" ||
          (isNonAcceptance && idx === 0); // First step shows rejection for non-Acceptance

        // Determine if this is the current step
        const isCurrent = idx === currentStep - 1;
        
        // Determine if this step is completed (all steps before current are completed)
        let isCompleted = false;
        if (isRejectedStatus) {
          isCompleted = idx <= backToAdminIdx && !isRejectedStep;
        } else if (currentStep > 0) {
          isCompleted = idx < currentStep - 1 && !isRejectedStep;
        }

        // Circle color & content
        let circleClass = "bg-gray-300 border-gray-400 text-white";
        let circleContent = idx + 1;
        let circleOpacity = "";
        let displayText = status;

        if (isNonAcceptance) {
          // For non-Acceptance, show red X and change text
          circleClass = "bg-red-500 border-red-500 text-white";
          circleContent = "X";
          displayText = "non-Acceptance";
        } else if (isRejectedStatus && idx > backToAdminIdx) {
          circleClass = "bg-red-500 border-red-500 text-white";
          circleContent = "X";
        } else if (isCurrent) {
          // Current step should be yellow
          circleClass = "bg-yellow-400 border-yellow-400 text-black";
          circleContent = idx + 1;
          displayText = status; // Ensure we show the actual status text
        } else if (isCompleted) {
          // Completed steps get a green checkmark
          circleClass = "bg-green-500 border-green-500 text-white";
          circleContent = "✔";
        } else if (status === "For Publication" && currentStatus === "For Publication") {
          // Special case for final publication step
          circleClass = "bg-green-500 border-green-500 text-white";
          circleContent = "✔";
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
                {displayText}
              </p>
            </div>

            {/* Only show connecting line if not in non-Acceptance state and not the last step */}
            {!isNonAcceptance && idx !== steps.length - 1 && (
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
