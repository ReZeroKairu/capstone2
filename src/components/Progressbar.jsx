import React from "react";

const STATUS_STEPS = [
  "Pending",
  "Accepted",
  "Assigning Peer Reviewer",
  "Peer Reviewer Assigned",
  "Peer Reviewer Reviewing",
  "Back to Admin",
  "For Revision",
  "For Publication",
  "Rejected",
];

export default function Progressbar({
  currentStep = 0,
  steps = [],
  currentStatus,
}) {
  const isRejectedStatus =
    currentStatus === "Rejected" ||
    currentStatus === "Peer Reviewer Rejected" ||
    currentStatus === "Non-Acceptance";

  const backToAdminIdx = steps.indexOf("Back to Admin");
  const isNonAcceptance = currentStatus === "Non-Acceptance";

  // If status is Non-Acceptance, only show the first step
  // If status is For Publication, exclude Rejected status
  const displaySteps = isNonAcceptance 
    ? [steps[0]] 
    : currentStatus === "For Publication" 
      ? steps.filter(step => step !== "Rejected" && step !== "Peer Reviewer Rejected") 
      : steps;
  const displayStatus = isNonAcceptance ? "Non-Acceptance" : null;

  return (
    <div className="flex items-center w-full mb-4">
      {displaySteps.map((status, idx) => {
        const isRejectedStep =
          status === "Rejected" ||
          status === "Peer Reviewer Rejected" ||
          (isNonAcceptance && idx === 0); // First step shows rejection for Non-Acceptance

        // Determine if this is the current step
        const isCurrent = idx === currentStep - 1;

        // Check if this is a Rejected step
        const isRejectedStatusStep =
          status === "Rejected" || status === "Peer Reviewer Rejected";

        // Special handling for For Publication status
        const isForPublication = currentStatus === "For Publication";

        // Determine if this step is completed (all steps before current are completed)
        let isCompleted = false;
        if (currentStatus === "For Publication") {
          // When status is For Publication, all steps up to For Publication are completed
          // and Rejected steps should be grayed out
          isCompleted =
            STATUS_STEPS.indexOf(status) <
              STATUS_STEPS.indexOf("For Publication") && !isRejectedStatusStep;
        } else if (isRejectedStatus) {
          isCompleted = idx <= backToAdminIdx && !isRejectedStatusStep;
        } else if (currentStep > 0) {
          isCompleted = idx < currentStep - 1 && !isRejectedStatusStep;
        }

        // Circle color & content
        let circleClass = "bg-gray-300 border-gray-400 text-white";
        let circleContent = idx + 1;
        let circleOpacity = "";
        let displayText = status;

        // Handle Rejected step when status is For Publication (this needs to be checked first)
        if (isForPublication && isRejectedStatusStep) {
          // Gray out Rejected step when status is For Publication
          circleClass = "bg-gray-200 border-gray-300 text-gray-400";
          circleContent = "✖";
          isCompleted = false;
        }
        // Handle other cases
        else if (isNonAcceptance) {
          // For Non-Acceptance, show red X and change text
          circleClass = "bg-red-500 border-red-500 text-white";
          circleContent = "X";
          displayText = "Non-Acceptance";
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
        } else if (
          status === "For Publication" &&
          currentStatus === "For Publication"
        ) {
          // Special case for final publication step
          circleClass = "bg-green-500 border-green-500 text-white";
          circleContent = "✔";
        }

        // Line color
        let lineClass = "bg-gray-300";
        if (isForPublication) {
          // For For Publication status, show green line up to For Publication step, then gray
          lineClass =
            STATUS_STEPS.indexOf(status) <
            STATUS_STEPS.indexOf("For Publication")
              ? "bg-green-500"
              : "bg-gray-200";
        } else if (isCompleted) {
          lineClass = "bg-green-500";
        } else if (isRejectedStatus && idx >= backToAdminIdx) {
          lineClass = "bg-red-500";
        }

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

            {/* Show connecting line if:
                - Not in Non-Acceptance state
                - Not the last step
                - AND (current status is not 'For Publication' OR current step is not 'For Publication') */}
            {!isNonAcceptance && 
             idx !== steps.length - 1 && 
             (currentStatus !== "For Publication" || status !== "For Publication") && (
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
