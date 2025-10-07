import React, { useState } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../firebase/firebase";

const SetDeadlineModal = ({
  show,
  onClose,
  manuscriptId,
  reviewerId,
  currentDeadline,
  onDeadlineSet
}) => {
  const [deadline, setDeadline] = useState(currentDeadline || "");
  const [enableReminder, setEnableReminder] = useState(true);
  const [reminderDays, setReminderDays] = useState(3);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSave = async () => {
    setError("");

    if (!deadline) {
      setError("Please select a deadline.");
      return;
    }

    if (enableReminder && reminderDays < 1) {
      setError("Reminder days must be at least 1.");
      return;
    }

    setLoading(true);
    try {
      const reviewerMetaRef = doc(db, "manuscripts", manuscriptId);

      // Convert to proper Date object
      const deadlineDate = new Date(deadline);
      if (isNaN(deadlineDate.getTime())) {
        setError("Invalid date format.");
        setLoading(false);
        return;
      }

      await updateDoc(reviewerMetaRef, {
        [`assignedReviewersMeta.${reviewerId}.deadline`]: deadlineDate,
        [`assignedReviewersMeta.${reviewerId}.reminderEnabled`]: enableReminder,
        [`assignedReviewersMeta.${reviewerId}.reminderDaysBefore`]: reminderDays
      });

      onDeadlineSet?.();
      onClose();
    } catch (err) {
      console.error(err);
      setError("Failed to set deadline. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (!show) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
      onClick={onClose}
      aria-modal="true"
      role="dialog"
    >
      <div
        className="bg-white rounded-md p-6 w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold mb-4">Set Deadline</h3>

        {error && (
          <div className="mb-4 text-red-600 font-medium">{error}</div>
        )}

        <label htmlFor="deadline" className="block mb-2 font-medium">
          Deadline:
        </label>
        <input
          id="deadline"
          type="datetime-local"
          value={deadline}
          onChange={(e) => setDeadline(e.target.value)}
          className="w-full border rounded px-3 py-2 mb-4"
        />

        <div className="flex items-center mb-4">
          <input
            id="enableReminder"
            type="checkbox"
            checked={enableReminder}
            onChange={(e) => setEnableReminder(e.target.checked)}
            className="mr-2"
          />
          <label htmlFor="enableReminder">Enable automatic reminder</label>
        </div>

        {enableReminder && (
          <div className="mb-4">
            <label htmlFor="reminderDays" className="block mb-1">
              Remind me X days before:
            </label>
            <input
              id="reminderDays"
              type="number"
              min={1}
              value={reminderDays}
              onChange={(e) => setReminderDays(Number(e.target.value))}
              className="w-20 border rounded px-2 py-1"
            />
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            disabled={loading}
          >
            {loading ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SetDeadlineModal;
