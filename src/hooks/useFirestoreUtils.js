import { Timestamp } from "firebase/firestore";

/**
 * Converts Firestore Timestamp or JS Date to readable string.
 * Example: "Oct 10, 2025, 3:45 PM"
 */
export const formatFirestoreDate = (date) => {
  if (!date) return "—";

  let jsDate;
  if (date instanceof Timestamp) {
    jsDate = date.toDate();
  } else if (date instanceof Date) {
    jsDate = date;
  } else if (date?.toDate) {
    jsDate = date.toDate();
  } else {
    return "—";
  }

  return jsDate.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

/**
 * Builds a URL-safe string for storage or document naming.
 * Removes spaces, slashes, and symbols.
 */
export const buildSafeFileName = (input) => {
  if (!input) return "unnamed";
  return input
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^\w-]/g, "")
    .slice(0, 80); // limit to avoid path overflow
};

/**
 * Extracts manuscript title safely from multiple field sources.
 */
export const extractManuscriptTitle = (ms) => {
  return (
    ms.manuscriptTitle ||
    ms.title ||
    ms.formTitle ||
    ms.answeredQuestions?.find((q) =>
      q.question?.toLowerCase().includes("title")
    )?.answer ||
    "Untitled Manuscript"
  );
};
