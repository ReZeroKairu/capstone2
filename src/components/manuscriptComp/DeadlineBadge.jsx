// src/components/manuscriptComp/DeadlineBadge.jsx
import React, { useEffect, useState } from "react";
import { getDeadlineColor, getRemainingTime } from "../../utils/deadlineUtils";

const DeadlineBadge = ({ start, end, formatDate }) => {
  const [timeLeft, setTimeLeft] = useState("");
  const [colorClass, setColorClass] = useState("");

  useEffect(() => {
    const updateCountdown = () => {
      const { days, hours, minutes } = getRemainingTime(end);
      setColorClass(getDeadlineColor(start, end));

      setTimeLeft(`${days}d ${hours}h ${minutes}m left`);
      if (days === 0 && hours === 0 && minutes === 0)
        setTimeLeft("Deadline Passed");
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [start, end]);

  return (
    <span
      className={`inline-flex items-center px-3 py-1 rounded-full text-xs sm:text-sm font-semibold shadow-sm ${colorClass}`}
    >
      ⏳ Deadline: {formatDate(end)}
      <span className="ml-2 text-gray-600">({timeLeft})</span>
    </span>
  );
};

export default DeadlineBadge;
