// src/utils/deadlineUtils.js

/**
 * Returns Tailwind color classes based on how close the deadline is.
 * Works dynamically whether the deadline is 3 days or 30 days away.
 * startDate should be the reviewer accepted date (or invitation date if not yet accepted)
 */
export function getDeadlineColor(startDate, endDate) {
  if (!startDate || !endDate) return "bg-gray-200 text-gray-800";

  const now = new Date();

  // Total time between start and deadline
  const totalDays = (endDate - startDate) / (1000 * 60 * 60 * 24);

  // Time elapsed since start
  const elapsedDays = (now - startDate) / (1000 * 60 * 60 * 24);

  // Remaining days
  const remainingDays = totalDays - elapsedDays;

  if (remainingDays <= 0) return "bg-red-700 text-white"; // Deadline passed

  const percentLeft = (remainingDays / totalDays) * 100;

  if (percentLeft >= 50) return "bg-green-100 text-green-800";  // plenty of time
  if (percentLeft >= 25) return "bg-orange-200 text-orange-800"; // mid-way
  return "bg-red-100 text-red-800"; // urgent
}

/**
 * Utility to get remaining days (rounded)
 * startDate defaults to now if not provided, but you should pass acceptedAt when available
 */
export function getRemainingDays(endDate, startDate = new Date()) {
  if (!endDate) return null;
  const diff = (endDate - startDate) / (1000 * 60 * 60 * 24);
  return Math.ceil(diff);
}
