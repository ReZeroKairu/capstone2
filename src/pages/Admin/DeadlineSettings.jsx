    import React, { useState, useEffect } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../../firebase/firebase";

const DEADLINE_TYPES = [
  { key: "invitationDeadline", label: "Invitation Deadline" },
  { key: "reviewDeadline", label: "Review Deadline" },
  { key: "revisionDeadline", label: "Revision Deadline" },
  { key: "finalizationDeadline", label: "Finalization Deadline" },
];

const DeadlineSettings = () => {
  const [deadlines, setDeadlines] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  // Fetch current defaults from Firestore
  useEffect(() => {
    const fetchDefaults = async () => {
      try {
        const ref = doc(db, "deadlineSettings", "deadlines");
        const snap = await getDoc(ref);
        if (snap.exists()) {
          setDeadlines(snap.data());
        } else {
          setDeadlines({
            invitationDeadline: 7,
            reviewDeadline: 30,
            revisionDeadline: 14,
            finalizationDeadline: 5,
          });
        }
      } catch (err) {
        console.error("Failed to load defaults:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchDefaults();
  }, []);

  // Save updated defaults
  const handleSave = async () => {
    setSaving(true);
    setMessage("");

    try {
      const ref = doc(db, "deadlineSettings", "deadlines");
      await setDoc(ref, deadlines);
      setMessage("✅ Default deadlines saved successfully!");
    } catch (err) {
      console.error(err);
      setMessage("❌ Failed to save deadlines. Try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (key, value) => {
    setDeadlines((prev) => ({ ...prev, [key]: Number(value) }));
  };

  if (loading) return <div className="p-6">Loading deadline settings...</div>;

  return (
    <div className="max-w-3xl pt-28 mx-auto bg-white rounded-xl shadow-md p-8 mt-10">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">
        🕒 Default Deadline Settings
      </h1>

      <p className="text-gray-600 mb-6">
        Set default number of days for each manuscript review stage.  
        These defaults will automatically apply when assigning new reviewers or creating new manuscripts.
      </p>

      <div className="space-y-5">
        {DEADLINE_TYPES.map((type) => (
          <div
            key={type.key}
            className="flex justify-between items-center border-b pb-3"
          >
            <label className="font-medium text-gray-700">
              {type.label}
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                value={deadlines[type.key] || ""}
                onChange={(e) => handleChange(type.key, e.target.value)}
                className="w-24 border rounded-md px-2 py-1 focus:ring-2 focus:ring-blue-400"
              />
              <span className="text-gray-600">days</span>
            </div>
          </div>
        ))}
      </div>

      {message && (
        <div className="mt-5 text-center font-medium text-green-600">
          {message}
        </div>
      )}

      <div className="flex justify-end mt-8">
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 transition disabled:opacity-70"
        >
          {saving ? "Saving..." : "Save Settings"}
        </button>
      </div>
    </div>
  );
};

export default DeadlineSettings;
