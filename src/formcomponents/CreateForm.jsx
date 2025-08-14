// src/formcomponents/CreateForm.jsx
import React, { useState, useEffect } from "react";
import { db, auth } from "../firebase/firebase";
import {
  collection,
  addDoc,
  updateDoc,
  doc,
  getDoc,
  getDocs,
  query,
  orderBy,
  limit,
} from "firebase/firestore";

export default function CreateForm() {
  const [title, setTitle] = useState("");
  const [questions, setQuestions] = useState([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [formId, setFormId] = useState(null);
  const [previewMode, setPreviewMode] = useState(false);

  useEffect(() => {
    const checkAdminAndFetch = async () => {
      auth.onAuthStateChanged(async (user) => {
        if (user) {
          const userDoc = await getDoc(doc(db, "Users", user.uid));
          const admin = userDoc.exists() && userDoc.data().role === "Admin";
          setIsAdmin(admin);

          if (admin) {
            const formsCollection = collection(db, "forms");
            const q = query(
              formsCollection,
              orderBy("createdAt", "desc"),
              limit(1)
            );
            const snapshot = await getDocs(q);

            if (!snapshot.empty) {
              const latestForm = snapshot.docs[0];
              setFormId(latestForm.id);
              setTitle(latestForm.data().title);
              setQuestions(latestForm.data().questions || []);
            } else {
              setTitle("");
              setQuestions([]);
            }
          }
        }
      });
    };

    checkAdminAndFetch();
  }, []);

  const addQuestion = () => {
    setQuestions([
      ...questions,
      { text: "", type: "text", required: false, options: [] },
    ]);
  };

  const removeQuestion = (index) => {
    const updated = [...questions];
    updated.splice(index, 1);
    setQuestions(updated);
  };

  const updateQuestion = (index, field, value) => {
    const updated = [...questions];
    updated[index][field] = value;
    setQuestions(updated);
  };

  const addOption = (qIndex) => {
    const updated = [...questions];
    if (!updated[qIndex].options) updated[qIndex].options = [];
    updated[qIndex].options.push("");
    setQuestions(updated);
  };

  const updateOption = (qIndex, oIndex, value) => {
    const updated = [...questions];
    updated[qIndex].options[oIndex] = value;
    setQuestions(updated);
  };

  const removeOption = (qIndex, oIndex) => {
    const updated = [...questions];
    updated[qIndex].options.splice(oIndex, 1);
    setQuestions(updated);
  };

  const saveForm = async () => {
    if (!title.trim()) return alert("Form title is required!");
    if (questions.some((q) => !q.text.trim()))
      return alert("All questions must have text!");

    if (formId) {
      await updateDoc(doc(db, "forms", formId), {
        title,
        questions,
        updatedAt: new Date(),
      });
      alert("Form updated successfully!");
    } else {
      const docRef = await addDoc(collection(db, "forms"), {
        title,
        questions,
        createdAt: new Date(),
      });
      setFormId(docRef.id);
      alert("Form saved successfully!");
    }
  };

  if (!isAdmin) {
    return (
      <p className="p-6 sm:p-12 md:p-28 text-red-500">
        You do not have permission to create forms.
      </p>
    );
  }

  return (
    <div className="p-6 sm:p-12 md:p-28 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">
        {formId ? "Edit Form" : "Create a Form"}
      </h1>
      <input
        type="text"
        placeholder="Form title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="border p-2 w-full mb-4"
      />

      <button
        onClick={() => setPreviewMode((prev) => !prev)}
        className="bg-gray-500 text-white px-4 py-2 rounded mb-4"
      >
        {previewMode ? "Edit Mode" : "Preview Mode"}
      </button>

      {!previewMode &&
        questions.map((q, index) => (
          <div key={index} className="mb-4 border p-4 rounded">
            <input
              type="text"
              placeholder="Question text"
              value={q.text}
              onChange={(e) => updateQuestion(index, "text", e.target.value)}
              className="border p-2 w-full mb-2"
            />
            <select
              value={q.type}
              onChange={(e) => updateQuestion(index, "type", e.target.value)}
              className="border p-2 w-full mb-2"
            >
              <option value="text">Short Answer</option>
              <option value="textarea">Paragraph</option>
              <option value="multiple">Multiple Choice</option>
            </select>

            <label className="flex items-center gap-2 mb-2">
              <input
                type="checkbox"
                checked={q.required || false}
                onChange={(e) =>
                  updateQuestion(index, "required", e.target.checked)
                }
              />
              Required
            </label>

            {q.type === "multiple" && (
              <div className="mb-2">
                {q.options?.map((opt, oIndex) => (
                  <div key={oIndex} className="flex flex-wrap gap-2 mb-1">
                    <input
                      type="text"
                      value={opt}
                      onChange={(e) =>
                        updateOption(index, oIndex, e.target.value)
                      }
                      className="border p-2 flex-1 min-w-[120px]"
                    />
                    <button
                      onClick={() => removeOption(index, oIndex)}
                      className="bg-red-500 text-white px-2 rounded"
                    >
                      Remove
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => addOption(index)}
                  className="bg-blue-500 text-white px-3 py-1 rounded mt-1"
                >
                  Add Option
                </button>
              </div>
            )}

            <button
              onClick={() => removeQuestion(index)}
              className="bg-red-500 text-white px-3 py-1 rounded mt-2"
            >
              Remove Question
            </button>
          </div>
        ))}

      {previewMode && (
        <div className="mb-4">
          <h2 className="text-xl font-semibold mb-2">Preview</h2>
          {questions.map((q, idx) => (
            <div key={idx} className="mb-2">
              <p>
                {q.text} {q.required ? "*" : ""}
              </p>
              {q.type === "text" && (
                <input type="text" className="border p-1 w-full" />
              )}
              {q.type === "textarea" && (
                <textarea className="border p-1 w-full" />
              )}
              {q.type === "multiple" &&
                q.options?.map((opt, i) => (
                  <div key={i}>
                    <label>
                      <input type="radio" name={`q${idx}`} /> {opt}
                    </label>
                  </div>
                ))}
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          onClick={addQuestion}
          className="bg-blue-500 text-white px-4 py-2 rounded"
        >
          Add Question
        </button>
        <button
          onClick={saveForm}
          className="bg-green-500 text-white px-4 py-2 rounded"
        >
          {formId ? "Update Form" : "Save Form"}
        </button>
      </div>
    </div>
  );
}
