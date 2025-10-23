// src/components/manuscriptComp/DeadlineBadge.jsx
import React, { useEffect, useState } from "react";
import { getDeadlineColor, getRemainingTime } from "../../utils/deadlineUtils";

const DeadlineBadge = ({ start, end, formatDate }) => {
  const [timeLeft, setTimeLeft] = useState("");
  const [isOverdue, setIsOverdue] = useState(false);
  const [colorClass, setColorClass] = useState("");

  useEffect(() => {
    const updateCountdown = () => {
      const { days, hours, minutes, isOverdue: overdue } = getRemainingTime(end);
      setColorClass(getDeadlineColor(start, end));
      setIsOverdue(overdue);

      if (overdue) {
        setTimeLeft("Overdue");
      } else {
        setTimeLeft(`${days}d ${hours}h ${minutes}m left`);
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [start, end]);

  return (
    <span
      className={`inline-flex items-center px-3 py-1 rounded-full text-xs sm:text-sm font-semibold shadow-sm ${
        isOverdue ? 'bg-red-100 text-red-800' : colorClass
      }`}
    >
      {isOverdue ? '⚠️ Overdue' : `⏳ Deadline: ${formatDate(end)}`}
      {!isOverdue && <span className="ml-2 text-gray-600">({timeLeft})</span>}
    </span>
  );
};

export default DeadlineBadge;
