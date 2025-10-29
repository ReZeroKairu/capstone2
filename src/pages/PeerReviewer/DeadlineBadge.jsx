// src/components/manuscriptComp/DeadlineBadge.jsx
import React, { useEffect, useState } from "react";
import { getDeadlineColor, getRemainingTime } from "../../utils/deadlineUtils";

// Helper function to safely parse dates from Firestore timestamps or other formats
const parseDate = (date) => {
  if (!date) return null;

  // Handle Firestore Timestamp
  if (date.toDate && typeof date.toDate === "function") {
    return date.toDate();
  }

  // Handle ISO strings or timestamps
  const parsed = new Date(date);
  return isNaN(parsed.getTime()) ? null : parsed;
};

// Default date formatter function
const defaultFormatDate = (date) => {
  const d = parseDate(date);
  if (!d) return "No deadline";

  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const DeadlineBadge = ({ start, end, formatDate = defaultFormatDate }) => {
  const [timeLeft, setTimeLeft] = useState("");
  const [isOverdue, setIsOverdue] = useState(false);
  const [colorClass, setColorClass] = useState("");

  useEffect(() => {
    if (!end) return;

    const updateCountdown = () => {
      try {
        const {
          days,
          hours,
          minutes,
          isOverdue: overdue,
        } = getRemainingTime(end);
        setColorClass(getDeadlineColor(start, end));
        setIsOverdue(overdue);

        if (overdue) {
          setTimeLeft("Overdue");
        } else {
          setTimeLeft(`${days}d ${hours}h ${minutes}m left`);
        }
      } catch (error) {
        console.error("Error updating countdown:", error);
        setTimeLeft("Error");
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [start, end]);

  if (!end) return null;

  return (
    <span
      className={`inline-flex items-center px-3 py-1 rounded-full text-xs sm:text-sm font-semibold shadow-sm ${
        isOverdue ? "bg-red-100 text-red-800" : colorClass
      }`}
    >
      {isOverdue ? "⚠️ Overdue" : `⏳ Deadline: ${formatDate(end)}`}
      {!isOverdue && <span className="ml-2 text-gray-600">({timeLeft})</span>}
    </span>
  );
};

export default DeadlineBadge;
