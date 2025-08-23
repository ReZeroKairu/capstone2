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

const maroon = "#7B2E19";
const gray = "#e0e0e0";
const green = "#4CC97B";
const darkGray = "#6B6B6B";

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
      <p
        className="p-6 sm:p-12 md:p-28 text-red-500"
        style={{ fontFamily: "Poppins, Arial, sans-serif" }}
      >
        You do not have permission to create forms.
      </p>
    );

  // 0.5 inch is about 48px
  return (
    <div
      className="min-h-screen px-4 md:py-12 lg:py-16 mx-auto"
      style={{
        fontFamily: "Poppins, Arial, sans-serif",
        fontSize: "1rem",
        background: "#fff",
        maxWidth: "900px",
        marginTop: "48px",
      }}
    >
      {/* Header: Edit Form */}
      <h1
        style={{
          fontFamily: "Poppins, Arial, sans-serif",
          fontWeight: 600,
          fontSize: "2rem",
          marginBottom: "0.5rem",
          color: "#111",
        }}
      >
        Edit Form
      </h1>

      {/* Form Title Section */}
      <div style={{ marginBottom: "32px" }}>
        <div
          style={{
            fontStyle: "italic",
            marginBottom: "0.5rem",
            color: "#222",
            fontSize: "1.15rem",
            fontFamily: "Poppins, Arial, sans-serif",
          }}
        >
          Title
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "24px",
            maxWidth: "100%",
            marginBottom: "0.5rem",
          }}
        >
          {editingTitle ? (
            <>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full"
                style={{
                  fontFamily: "Poppins, Arial, sans-serif",
                  fontWeight: 500,
                  borderRadius: "36px",
                  background: gray,
                  border: "none",
                  padding: "7px 18px",
                  color: "#222",
                  height: "43px",
                  boxSizing: "border-box",
                  fontSize: "1.35rem",
                }}
                autoFocus
              />
              <button
                style={{
                  background: maroon,
                  color: "#fff",
                  borderRadius: "36px",
                  padding: "0 24px",
                  fontWeight: 500,
                  height: "43px",
                  border: "none",
                  minWidth: "120px",
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  fontSize: "1.05rem",
                  fontStyle: "italic",
                  fontFamily: "Poppins, Arial, sans-serif",
                  whiteSpace: "nowrap",
                }}
                onClick={() => setEditingTitle(false)}
              >
                Save Title
              </button>
            </>
          ) : (
            <>
              <div
                className="w-full"
                style={{
                  fontFamily: "Poppins, Arial, sans-serif",
                  fontWeight: 500,
                  borderRadius: "36px",
                  background: gray,
                  border: "none",
                  padding: "7px 18px",
                  color: "#222",
                  height: "43px",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  boxSizing: "border-box",
                  display: "flex",
                  alignItems: "center",
                  fontSize: "1.35rem",
                }}
              >
                {title}
              </div>
              <button
                style={{
                  background: maroon,
                  color: "#fff",
                  borderRadius: "36px",
                  padding: "0 24px",
                  fontWeight: 500,
                  height: "43px",
                  border: "none",
                  minWidth: "120px",
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  fontSize: "1.05rem",
                  fontStyle: "italic",
                  fontFamily: "Poppins, Arial, sans-serif",
                  whiteSpace: "nowrap",
                }}
                onClick={() => setEditingTitle(true)}
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
                      style={{
                        background: gray,
                        borderRadius: "16px",
                        padding: "12px 15px",
                        marginBottom: "0px",
                        ...provided.draggableProps.style,
                        fontSize: "1rem",
                        fontFamily: "Poppins, Arial, sans-serif",
                      }}
                      className="flex flex-col gap-2"
                    >
                      <div className="flex items-center gap-4">
                        <input
                          type="text"
                          placeholder="Question text"
                          value={q.text}
                          onChange={(e) =>
                            updateQuestion(index, "text", e.target.value)
                          }
                          className="italic font-normal rounded-lg px-3 py-1 w-full mb-0"
                          style={{
                            background: "#fff",
                            border: "none",
                            color: "#222",
                            fontSize: "1rem",
                            fontFamily: "Poppins, Arial, sans-serif",
                          }}
                        />
                      </div>
                      {/* Only the dropdown, no background bar or maroon triangle */}
                      <select
                        value={q.type}
                        onChange={(e) =>
                          updateQuestion(index, "type", e.target.value)
                        }
                        className="bg-[#f3f2ee] rounded-lg px-3 py-1 w-fit"
                        style={{
                          fontSize: "1rem",
                          color: "#222",
                          fontWeight: 500,
                          border: "none",
                          boxShadow: "0 1px 3px #0001",
                          appearance: "auto",
                          marginBottom: "6px",
                          fontFamily: "Poppins, Arial, sans-serif",
                        }}
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
                      {/* Required checkbox ONLY, left side, no check icon */}
                      <div
                        className="text-sm flex items-center gap-2"
                        style={{
                          color: "#222",
                          fontSize: "1rem",
                          marginLeft: 2,
                          fontFamily: "Poppins, Arial, sans-serif",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={q.required || false}
                          onChange={(e) =>
                            updateQuestion(index, "required", e.target.checked)
                          }
                          className="accent-green-500 scale-110"
                          style={{ fontSize: "1rem" }}
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
                                className="rounded-lg px-3 py-1 flex-1 min-w-[120px] border-none"
                                style={{
                                  background: "#fff",
                                  color: "#222",
                                  fontSize: "1rem",
                                  fontFamily: "Poppins, Arial, sans-serif",
                                }}
                              />
                              <button
                                onClick={() => removeOption(index, oIndex)}
                                style={{
                                  background: maroon,
                                  color: "#fff",
                                  borderRadius: "7px",
                                  fontWeight: "bold",
                                  padding: "0px 14px",
                                  border: "none",
                                  fontSize: "1rem",
                                  fontFamily: "Poppins, Arial, sans-serif",
                                }}
                              >
                                Remove
                              </button>
                            </div>
                          ))}
                          <button
                            onClick={() => addOption(index)}
                            style={{
                              background: darkGray,
                              color: "#fff",
                              borderRadius: "7px",
                              fontWeight: "bold",
                              padding: "7px 16px",
                              border: "none",
                              marginTop: "5px",
                              fontSize: "1rem",
                              width: "fit-content",
                              fontFamily: "Poppins, Arial, sans-serif",
                            }}
                          >
                            Add Option
                          </button>
                        </div>
                      )}
                      <button
                        onClick={() => removeQuestion(index)}
                        style={{
                          background: maroon,
                          color: "#fff",
                          borderRadius: "8px",
                          fontWeight: "bold",
                          padding: "8px 20px",
                          border: "none",
                          marginTop: "12px",
                          width: "fit-content",
                          fontSize: "1rem",
                          fontFamily: "Poppins, Arial, sans-serif",
                        }}
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
          style={{
            background: darkGray,
            color: "#fff",
            fontSize: "1rem",
            borderRadius: "11px",
            padding: "0 22px",
            height: "38px",
            fontWeight: 500,
            border: "none",
            fontFamily: "Poppins, Arial, sans-serif",
          }}
        >
          Add Question
        </button>
        <button
          onClick={saveForm}
          style={{
            background: green,
            color: "#fff",
            fontSize: "1rem",
            borderRadius: "11px",
            padding: "0 22px",
            height: "38px",
            fontWeight: 500,
            border: "none",
            fontFamily: "Poppins, Arial, sans-serif",
          }}
        >
          {formId ? "Update Form" : "Save Form"}
        </button>
      </div>
    </div>
  );
}
