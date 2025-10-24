import React, { useState, useEffect } from 'react';
import { getRemainingTime } from '../../utils/deadlineUtils';

export const DeadlineCountdown = ({ deadline }) => {
  const [timeLeft, setTimeLeft] = useState('');
  const [isOverdue, setIsOverdue] = useState(false);

  useEffect(() => {
    if (!deadline) return;

    const updateCountdown = () => {
      const { days, hours, minutes, isOverdue: overdue } = getRemainingTime(deadline);
      setIsOverdue(overdue);
      
      if (overdue) {
        setTimeLeft(`Overdue by ${days}d ${hours}h ${minutes}m`);
      } else if (days > 0) {
        setTimeLeft(`${days}d ${hours}h left`);
      } else if (hours > 0) {
        setTimeLeft(`${hours}h ${minutes}m left`);
      } else {
        setTimeLeft(`${minutes}m left`);
      }
    };

    // Update immediately and then every minute
    updateCountdown();
    const interval = setInterval(updateCountdown, 60000);

    return () => clearInterval(interval);
  }, [deadline]);

  if (!deadline) return null;

  return (
    <span className={`text-xs ${isOverdue ? 'text-red-500' : 'text-gray-600'}`}>
      ({timeLeft})
    </span>
  );
};

export default DeadlineCountdown;
