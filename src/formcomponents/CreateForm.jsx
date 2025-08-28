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
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";

export default function CreateForm() {
  const [title, setTitle] = useState("");
  const [questions, setQuestions] = useState([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [formId, setFormId] = useState(null);
  const [editingTitle, setEditingTitle] = useState(false);

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
      <p className="p-6 sm:p-12 md:p-28 text-red-500 font-poppins">
        You do not have permission to create forms.
      </p>
    );

  return (
    <div className="min-h-screen px-4 md:py-12 lg:py-16 mx-auto bg-white font-poppins text-base max-w-[900px] mt-12">
      {/* Header */}
      <h1 className="font-poppins font-semibold text-2xl text-gray-900 mb-2">
        Edit Form
      </h1>

      {/* Form Title */}
      <div className="mb-8">
        <div className="italic mb-2 text-gray-800 text-lg font-poppins">
          Title
        </div>
        <div className="flex items-center gap-6 max-w-full mb-2">
          {editingTitle ? (
            <>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full font-poppins font-medium rounded-full bg-gray-200 px-4 py-2 text-gray-800 text-xl"
                autoFocus
              />
              <button
                onClick={() => setEditingTitle(false)}
                className="bg-[#7B2E19] text-white rounded-full px-6 h-11 min-w-[120px] flex justify-center items-center font-medium italic font-poppins text-base"
              >
                Save Title
              </button>
            </>
          ) : (
            <>
              <div className="w-full font-poppins font-medium rounded-full bg-gray-200 px-4 py-2 text-gray-800 text-xl flex items-center truncate">
                {title}
              </div>
              <button
                onClick={() => setEditingTitle(true)}
                className="bg-[#7B2E19] text-white rounded-full px-6 h-11 min-w-[120px] flex justify-center items-center font-medium italic font-poppins text-base"
              >
                Edit Title
              </button>
            </>
          )}
        </div>
      </div>

      {/* Questions */}
      <DragDropContext onDragEnd={onDragEnd}>
        <Droppable droppableId="questions">
          {(provided) => (
            <div
              {...provided.droppableProps}
              ref={provided.innerRef}
              className="flex flex-col gap-6"
            >
              {questions.map((q, index) => (
                <Draggable key={index} draggableId={`q-${index}`} index={index}>
                  {(provided) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      {...provided.dragHandleProps}
                      className="flex flex-col gap-2 bg-gray-200 rounded-xl p-4 font-poppins text-base"
                      style={provided.draggableProps.style}
                    >
                      <div className="flex items-center gap-4">
                        <input
                          type="text"
                          placeholder="Question text"
                          value={q.text}
                          onChange={(e) =>
                            updateQuestion(index, "text", e.target.value)
                          }
                          className="italic font-normal rounded-lg px-3 py-2 w-full bg-white text-gray-800 text-base"
                        />
                      </div>

                      {/* Question Type */}
                      <select
                        value={q.type}
                        onChange={(e) =>
                          updateQuestion(index, "type", e.target.value)
                        }
                        className="bg-gray-100 rounded-lg px-3 py-2 w-fit text-gray-800 font-medium shadow-sm"
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

                      {/* Required */}
                      <div className="text-sm flex items-center gap-2 text-gray-800 text-base">
                        <input
                          type="checkbox"
                          checked={q.required || false}
                          onChange={(e) =>
                            updateQuestion(index, "required", e.target.checked)
                          }
                          className="accent-green-500 scale-110"
                        />
                        <span>Required</span>
                      </div>

                      {/* Options */}
                      {(q.type === "multiple" ||
                        q.type === "radio" ||
                        q.type === "checkbox" ||
                        q.type === "select") && (
                        <div className="flex flex-col gap-2 mt-2">
                          {q.options?.map((opt, oIndex) => (
                            <div key={oIndex} className="flex gap-2">
                              <input
                                type="text"
                                value={opt}
                                onChange={(e) =>
                                  updateOption(index, oIndex, e.target.value)
                                }
                                className="rounded-lg px-3 py-2 flex-1 min-w-[120px] bg-white text-gray-800 text-base"
                              />
                              <button
                                onClick={() => removeOption(index, oIndex)}
                                className="bg-[#7B2E19] text-white rounded-md font-bold px-4 py-1 text-base"
                              >
                                Remove
                              </button>
                            </div>
                          ))}
                          <button
                            onClick={() => addOption(index)}
                            className="bg-gray-600 text-white rounded-md font-bold px-4 py-2 mt-1 text-base w-fit"
                          >
                            Add Option
                          </button>
                        </div>
                      )}

                      <button
                        onClick={() => removeQuestion(index)}
                        className="bg-[#7B2E19] text-white rounded-md font-bold px-5 py-2 mt-3 text-base w-fit"
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

      {/* Footer Actions */}
      <div className="flex gap-6 mt-10 justify-between">
        <button
          onClick={addQuestion}
          className="bg-gray-600 text-white text-base rounded-lg px-6 h-10 font-medium font-poppins"
        >
          Add Question
        </button>
        <button
          onClick={saveForm}
          className="bg-green-500 text-white text-base rounded-lg px-6 h-10 font-medium font-poppins"
        >
          {formId ? "Update Form" : "Save Form"}
        </button>
      </div>
    </div>
  );
}
