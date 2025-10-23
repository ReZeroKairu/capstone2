import { useEffect, useState, useMemo, useRef } from "react";
import { getDeadlineColor } from "../../utils/deadlineUtils";
import { parseDateSafe } from "../../utils/dateUtils";

export const DeadlineBadge = ({ startDate, endDate }) => {
  const [remainingText, setRemainingText] = useState("");
  const [percentLeft, setPercentLeft] = useState(null);
  const [colorClass, setColorClass] = useState("");
  
  // Refs to track previous values
  const prevValues = useRef({
    remainingText: "",
    percentLeft: null,
    colorClass: ""
  });
  
  // Memoize the parsed dates
  const parsedDates = useMemo(() => {
    if (!startDate || !endDate) return null;
    const s = parseDateSafe(startDate);
    const e = parseDateSafe(endDate);
    return s && e ? { start: s, end: e } : null;
  }, [startDate, endDate]);

  useEffect(() => {
    if (!parsedDates) return;
    
    const { start: s, end: e } = parsedDates;
    
    const updateCountdown = () => {
      const now = new Date();
      const total = e - s;
      const remaining = e - now;

      if (remaining <= 0) {
        setRemainingText("⚠️ Past Deadline");
        setColorClass("bg-red-200 text-red-800");
        setPercentLeft(0);
        return;
      }

      const days = Math.floor(remaining / (1000 * 60 * 60 * 24));
      const hours = Math.floor(
        (remaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
      );
      const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((remaining % (1000 * 60)) / 1000);

      // Format countdown text
      const timeParts = [];
      if (days > 0) timeParts.push(`${days}d`);
      if (hours > 0 || days > 0) timeParts.push(`${hours}h`);
      if (minutes > 0 || (days === 0 && hours === 0)) timeParts.push(`${minutes}m`);
      if (days === 0 && hours === 0) timeParts.push(`${seconds}s`);
      
      const newRemainingText = `${timeParts.join(" ")} left`;
      const newPercentLeft = Math.max(0, Math.min(1, remaining / total));
      const newColorClass = getDeadlineColor(s, e);

      // Only update state if values have actually changed
      if (newRemainingText !== prevValues.current.remainingText) {
        setRemainingText(newRemainingText);
        prevValues.current.remainingText = newRemainingText;
      }
      if (newPercentLeft !== prevValues.current.percentLeft) {
        setPercentLeft(newPercentLeft);
        prevValues.current.percentLeft = newPercentLeft;
      }
      if (newColorClass !== prevValues.current.colorClass) {
        setColorClass(newColorClass);
        prevValues.current.colorClass = newColorClass;
      }
    };

    updateCountdown();
    const timer = setInterval(updateCountdown, 1000);
    return () => clearInterval(timer);
  }, [parsedDates]); // Only depend on parsedDates

  if (!parsedDates) return null;
  const { end } = parsedDates;

  return (
    <div
      className={`inline-block px-3 py-1 mb-2 rounded-lg text-xs font-medium transition-colors duration-300 ${colorClass}`}
      title={
        percentLeft !== null
          ? `${(percentLeft * 100).toFixed(1)}% of time remaining`
          : ""
      }
    >
      Deadline:{" "}
      {end.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })}
      {" "}
      — {remainingText}
    </div>
  );
};
