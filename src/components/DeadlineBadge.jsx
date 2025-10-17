import { useEffect, useState } from "react";
import { getDeadlineColor } from "../utils/deadlineUtils";

const DeadlineBadge = ({ deadline, label, className = "" }) => {
  const [remaining, setRemaining] = useState(null);

  useEffect(() => {
    if (!deadline) return;
    
    const updateRemaining = () => {
      const now = new Date();
      const deadlineDate = deadline?.toDate ? deadline.toDate() : new Date(deadline);
      const diff = (deadlineDate - now) / (1000 * 60 * 60 * 24);
      setRemaining(Math.ceil(diff));
    };

    updateRemaining();
    const interval = setInterval(updateRemaining, 60 * 60 * 1000); // Update hourly
    
    return () => clearInterval(interval);
  }, [deadline]);

  if (!deadline) return null;

  const colorClass = getDeadlineColor(new Date(), deadline);
  const isOverdue = remaining < 0;
  const displayText = isOverdue 
    ? `Overdue by ${Math.abs(remaining)} days` 
    : `${remaining} days remaining`;

  return (
    <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${colorClass} ${className}`}>
      <span className="font-semibold">{label}:</span>
      <span className="ml-1">{displayText}</span>
      {isOverdue && <span className="ml-1">⚠️</span>}
    </div>
  );
};

export default DeadlineBadge;
