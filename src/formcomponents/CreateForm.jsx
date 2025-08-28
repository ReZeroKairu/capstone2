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
// ✅ Swap to the maintained fork
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";

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
            }
          }
        }
      });
    };
    checkAdminAndFetch();
  }, []);

  const addQuestion = () =>
    setQuestions([
      ...questions,
      { text: "", type: "text", required: false, options: [] },
    ]);

  const removeQuestion = (index) =>
    setQuestions(questions.filter((_, i) => i !== index));

  const updateQuestion = (index, field, value) => {
    const updated = [...questions];
    updated[index][field] = value;
    if (
      field === "type" &&
      !["multiple", "radio", "checkbox", "select"].includes(value)
    ) {
      updated[index].options = [];
    }
    setQuestions(updated);
  };

  const addOption = (qIndex) => {
    const updated = [...questions];
    updated[qIndex].options = updated[qIndex].options || [];
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

  const onDragEnd = (result) => {
    if (!result.destination) return;
    const reordered = Array.from(questions);
    const [removed] = reordered.splice(result.source.index, 1);
    reordered.splice(result.destination.index, 0, removed);
    setQuestions(reordered);
  };

  const saveForm = async () => {
    if (!title.trim()) return alert("Form title is required!");
    if (questions.some((q) => !q.text.trim()))
      return alert("All questions must have text!");
    if (
      questions.some(
        (q) =>
          q.required &&
          ["multiple", "radio", "checkbox", "select"].includes(q.type) &&
          (!q.options || q.options.length === 0)
      )
    )
      return alert(
        "All required choice questions must have at least one option!"
      );

    const data = { title, questions, updatedAt: new Date() };
    if (formId) {
      await updateDoc(doc(db, "forms", formId), data);
      alert("Form updated successfully!");
    } else {
      const docRef = await addDoc(collection(db, "forms"), {
        ...data,
        createdAt: new Date(),
      });
      setFormId(docRef.id);
      alert("Form saved successfully!");
    }
  };

  if (!isAdmin)
    return (
      <p className="p-6 sm:p-12 md:p-28 text-red-500">
        You do not have permission to create forms.
      </p>
    );

  return (
    <div className="p-4 sm:p-6 md:p-8 lg:p-12 md:pt-24 lg:pt-32 max-w-full sm:max-w-xl md:max-w-3xl lg:max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">
        {formId ? "Edit Form" : "Create a Form"}
      </h1>
      <input
        type="text"
        placeholder="Form title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="border p-2 w-full mb-4 rounded"
      />

      <button
        onClick={() => setPreviewMode(!previewMode)}
        className="bg-gray-500 text-white px-4 py-2 rounded mb-4 w-full sm:w-auto"
      >
        {previewMode ? "Edit Mode" : "Preview Mode"}
      </button>

      {!previewMode && (
        <DragDropContext onDragEnd={onDragEnd}>
          <Droppable droppableId="questions">
            {(provided) => (
              <div
                {...provided.droppableProps}
                ref={provided.innerRef}
                className="flex flex-col gap-4"
              >
                {questions.map((q, index) => (
                  <Draggable
                    key={index}
                    draggableId={`q-${index}`}
                    index={index}
                  >
                    {(provided) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        {...provided.dragHandleProps}
                        className="border p-4 rounded flex flex-col gap-2 bg-gray-50"
                      >
                        {/* ✅ Question Input and Options */}
                        <input
                          type="text"
                          placeholder="Question text"
                          value={q.text}
                          onChange={(e) =>
                            updateQuestion(index, "text", e.target.value)
                          }
                          className="border p-2 w-full rounded"
                        />
                        <select
                          value={q.type}
                          onChange={(e) =>
                            updateQuestion(index, "type", e.target.value)
                          }
                          className="border p-2 w-full rounded"
                        >
                          <option value="text">Short Answer</option>
                          <option value="textarea">Paragraph</option>
                          <option value="multiple">Multiple Choice</option>
                          <option value="radio">Radio</option>
                          <option value="checkbox">Checkbox</option>
                          <option value="select">Dropdown</option>
                          <option value="number">Number</option>
                          <option value="date">Date</option>
                        </select>

                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={q.required || false}
                            onChange={(e) =>
                              updateQuestion(
                                index,
                                "required",
                                e.target.checked
                              )
                            }
                          />
                          Required
                        </label>

                        {(q.type === "multiple" ||
                          q.type === "radio" ||
                          q.type === "checkbox" ||
                          q.type === "select") && (
                          <div className="flex flex-col gap-2">
                            {q.options?.map((opt, oIndex) => (
                              <div
                                key={oIndex}
                                className="flex flex-wrap gap-2"
                              >
                                <input
                                  type="text"
                                  value={opt}
                                  onChange={(e) =>
                                    updateOption(index, oIndex, e.target.value)
                                  }
                                  className="border p-2 flex-1 min-w-[120px] rounded"
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
                              className="bg-blue-500 text-white px-3 py-1 rounded mt-1 w-full sm:w-auto"
                            >
                              Add Option
                            </button>
                          </div>
                        )}

                        <button
                          onClick={() => removeQuestion(index)}
                          className="bg-red-500 text-white px-3 py-1 rounded mt-2 w-full sm:w-auto"
                        >
                          Remove Question
                        </button>
                      </div>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>
      )}

      {previewMode && (
        <div className="mb-4">
          {/* ✅ Preview Section */}
          <h2 className="text-xl font-semibold mb-4 text-center sm:text-left">
            Preview
          </h2>
          {questions.map((q, idx) => (
            <div key={idx} className="mb-4 border p-3 rounded bg-gray-50">
              <p className="font-medium mb-2 break-words">
                {q.text} {q.required && <span className="text-red-500">*</span>}
              </p>

              {q.type === "text" && (
                <input type="text" className="border p-2 w-full rounded mb-2" />
              )}
              {q.type === "textarea" && (
                <textarea className="border p-2 w-full rounded mb-2" />
              )}
              {q.type === "number" && (
                <input
                  type="number"
                  className="border p-2 w-full rounded mb-2"
                />
              )}
              {q.type === "date" && (
                <input type="date" className="border p-2 w-full rounded mb-2" />
              )}

              {(q.type === "multiple" ||
                q.type === "radio" ||
                q.type === "checkbox" ||
                q.type === "select") &&
                q.options?.map((opt, i) => (
                  <label key={i} className="flex items-center gap-2">
                    <input
                      type={
                        q.type === "radio"
                          ? "radio"
                          : q.type === "checkbox"
                          ? "checkbox"
                          : "radio"
                      }
                      name={`q${idx}`}
                      className="accent-blue-500"
                    />
                    <span className="break-words">{opt}</span>
                  </label>
                ))}
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-2 mt-4">
        <button
          onClick={addQuestion}
          className="bg-blue-500 text-white px-4 py-2 rounded w-full sm:w-auto"
        >
          Add Question
        </button>
        <button
          onClick={saveForm}
          className="bg-green-500 text-white px-4 py-2 rounded w-full sm:w-auto"
        >
          {formId ? "Update Form" : "Save Form"}
        </button>
      </div>
    </div>
  );
}
