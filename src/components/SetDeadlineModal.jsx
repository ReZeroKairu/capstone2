import React, { useState } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../firebase/firebase";

// Define all deadline types available
const DEADLINE_TYPES = [
  { key: "invitationDeadline", label: "Invitation Deadline" },
  { key: "reviewDeadline", label: "Review Deadline" },
  { key: "revisionDeadline", label: "Revision Deadline" },
  { key: "finalizationDeadline", label: "Finalization Deadline" },
];

const SetDeadlineModal = ({
  show,
  onClose,
  manuscriptId,
  reviewerId,
  onDeadlineSet
}) => {
  const [deadlineType, setDeadlineType] = useState("reviewDeadline");
  const [deadline, setDeadline] = useState("");
  const [enableReminder, setEnableReminder] = useState(true);
  const [reminderDays, setReminderDays] = useState(3);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSave = async () => {
    setError("");

    // Validation checks
    if (!deadlineType) {
      setError("Please select a deadline type.");
      return;
    }
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

      // Convert to Date
      const deadlineDate = new Date(deadline);
      if (isNaN(deadlineDate.getTime())) {
        setError("Invalid date format.");
        setLoading(false);
        return;
      }

      // Save to Firestore
      await updateDoc(reviewerMetaRef, {
        [`assignedReviewersMeta.${reviewerId}.${deadlineType}`]: deadlineDate,
        [`assignedReviewersMeta.${reviewerId}.reminderEnabled`]: enableReminder,
        [`assignedReviewersMeta.${reviewerId}.reminderDaysBefore`]: reminderDays
      });

      onDeadlineSet?.();
      onClose();
    } catch (err) {
      console.error("Error updating deadline:", err);
      setError("Failed to set deadline. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (!show) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onClose}
      aria-modal="true"
      role="dialog"
    >
      <div
        className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-xl font-semibold mb-4 text-gray-800">
          Set Reviewer Deadline
        </h3>

        {/* Error message */}
        {error && <div className="mb-4 text-red-600 font-medium">{error}</div>}

        {/* Deadline Type Selection */}
        <label className="block mb-2 font-medium text-gray-700">
          Deadline Type:
        </label>
        <select
          value={deadlineType}
          onChange={(e) => setDeadlineType(e.target.value)}
          className="w-full border rounded-md px-3 py-2 mb-4 bg-gray-50 focus:ring-2 focus:ring-blue-400"
        >
          {DEADLINE_TYPES.map((type) => (
            <option key={type.key} value={type.key}>
              {type.label}
            </option>
          ))}
        </select>

        {/* Deadline Picker */}
        <label className="block mb-2 font-medium text-gray-700">
          Deadline Date & Time:
        </label>
        <input
          type="datetime-local"
          value={deadline}
          onChange={(e) => setDeadline(e.target.value)}
          className="w-full border rounded-md px-3 py-2 mb-4 focus:ring-2 focus:ring-blue-400"
        />

        {/* Reminder Section */}
        <div className="flex items-center mb-4">
          <input
            id="enableReminder"
            type="checkbox"
            checked={enableReminder}
            onChange={(e) => setEnableReminder(e.target.checked)}
            className="mr-2"
          />
          <label htmlFor="enableReminder" className="text-gray-700">
            Enable automatic reminder
          </label>
        </div>

        {enableReminder && (
          <div className="mb-4">
            <label className="block mb-1 text-gray-700">
              Remind me X days before:
            </label>
            <input
              type="number"
              min={1}
              value={reminderDays}
              onChange={(e) => setReminderDays(Number(e.target.value))}
              className="w-24 border rounded-md px-2 py-1 focus:ring-2 focus:ring-blue-400"
            />
          </div>
        )}

        {/* Buttons */}
        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-300 text-gray-800 rounded-md hover:bg-gray-400 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition disabled:opacity-70"
          >
            {loading ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SetDeadlineModal;
