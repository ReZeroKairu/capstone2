// src/hooks/useSubmissionHistory.js
// Utility hook to prepare submission history data if needed by other components
import { useMemo } from "react";

export const useSubmissionHistory = (submissionHistory = []) => {
  return useMemo(() => {
    if (!Array.isArray(submissionHistory)) return [];

    return submissionHistory.map((s, idx) => {
      const submittedAtDate =
        s?.submittedAt?.toDate?.() ||
        (s?.submittedAt ? new Date(s.submittedAt) : null);

      return {
        ...s,
        idx,
        submittedAtDate,
      };
    });
  }, [submissionHistory]);
};
