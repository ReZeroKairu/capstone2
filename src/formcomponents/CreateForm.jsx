import React, { useState, useEffect, useRef } from "react";
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
  const [mtError, setMtError] = useState(false); // error state
  const manuscriptTitleRef = useRef(null);

  // ✅ Check admin and fetch latest form
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
              const formData = latestForm.data();

              setFormId(latestForm.id);
              setTitle(formData.title);
              // ✅ Backward compatibility: if no manuscriptTitle, fallback to MT question
              const manuscriptTitle =
                formData.manuscriptTitle ||
                formData.questions?.find((q) => q.isManuscriptTitle)?.text ||
                "";

              setQuestions(formData.questions || []);
              // We don’t set manuscriptTitle in state directly, just keep it in questions
            }
          }
        }
      });
    };
    checkAdminAndFetch();
  }, []);

  // ✅ Always ensure Manuscript Title exists
  useEffect(() => {
    setQuestions((prev) => {
      const hasMT = prev.some((q) => q.isManuscriptTitle);
      if (!hasMT) {
        return [
          {
            text: "Manuscript Title",
            type: "text",
            required: true,
            options: [],
            isManuscriptTitle: true,
          },
          ...prev,
        ];
      }
      return prev.map((q) =>
        q.isManuscriptTitle ? { ...q, type: "text", required: true } : q
      );
    });
  }, [questions]);

  const addQuestion = () =>
    setQuestions([
      ...questions,
      { text: "", type: "text", required: false, options: [] },
    ]);

  const removeQuestion = (index) => {
    if (questions[index].isManuscriptTitle) return; // ❌ Cannot remove MT
    setQuestions(questions.filter((_, i) => i !== index));
  };

  // ✅ Update question (with MT validation clearing)
  const updateQuestion = (index, field, value) => {
    const updated = [...questions];
    updated[index][field] = value;

    if (updated[index].isManuscriptTitle && field === "text") {
      if (/manuscript title/i.test(value.trim())) {
        setMtError(false); // clear error if fixed
      }
    }

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

    if (removed.isManuscriptTitle) {
      reordered.splice(result.destination.index, 0, removed); // ✅ MT can move, but not removed
    } else {
      reordered.splice(result.destination.index, 0, removed);
    }
    setQuestions(reordered);
  };

  const saveForm = async () => {
    if (!title.trim()) return alert("Form title is required!");
    if (questions.some((q) => !q.text.trim()))
      return alert("All questions must have text!");

    const mtQuestion = questions.find((q) => q.isManuscriptTitle);
    if (!mtQuestion || !/manuscript title/i.test(mtQuestion.text.trim())) {
      setMtError(true);
      manuscriptTitleRef.current?.focus();
      return;
    }
    setMtError(false);

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

    // ✅ Save top-level manuscriptTitle too
    const data = {
      title,
      questions,
      manuscriptTitle: mtQuestion.text.trim(),
      updatedAt: new Date(),
    };

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
    <div className="min-h-screen px-4 md:py-12 lg:py-16 mx-auto max-w-3xl mt-12 bg-white text-[#222]">
      {/* Header */}
      <h1 className="text-2xl font-semibold mb-2 text-[#111]">
        {formId ? "Edit Form" : "Create a Form"}
      </h1>

      {/* Form Title */}
      <div className="mb-8">
        <p className=" mb-2 text-[1.15rem]">Title</p>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full font-medium rounded-full bg-[#e0e0e0] border-none px-[18px] py-[7px] h-[43px] text-xl text-[#222]"
        />
      </div>

      {/* Questions (drag & drop) */}
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
                      className="bg-[#e0e0e0] rounded-xl p-4 flex flex-col gap-2"
                    >
                      {/* Question */}
                      <div className="flex flex-col gap-1">
                        <input
                          type="text"
                          placeholder="Question text"
                          value={q.text}
                          onChange={(e) =>
                            updateQuestion(index, "text", e.target.value)
                          }
                          className={` rounded-lg px-3 py-2 w-full bg-white text-base ${
                            q.isManuscriptTitle && mtError
                              ? "border-2 border-red-500"
                              : "border-none"
                          }`}
                          ref={q.isManuscriptTitle ? manuscriptTitleRef : null}
                        />
                        {q.isManuscriptTitle && mtError && (
                          <p className="text-sm text-red-600">
                            This field must contain "Manuscript Title".
                          </p>
                        )}
                      </div>

                      {/* Type */}
                      <select
                        value={q.type}
                        onChange={(e) =>
                          updateQuestion(index, "type", e.target.value)
                        }
                        className="bg-[#f3f2ee] rounded-lg px-3 py-1 w-fit text-base font-medium border-none shadow-sm"
                        disabled={q.isManuscriptTitle} // MT is always text
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
                      <label className="flex items-center gap-2 text-base">
                        <input
                          type="checkbox"
                          checked={q.required || false}
                          onChange={(e) =>
                            updateQuestion(index, "required", e.target.checked)
                          }
                          className="accent-[#4CC97B] scale-110"
                        />
                        Required
                      </label>

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
                                className="rounded-lg px-3 py-1 flex-1 bg-white border-none"
                              />
                              <button
                                onClick={() => removeOption(index, oIndex)}
                                className="bg-[#7B2E19] text-white rounded-md px-3 font-bold"
                              >
                                Remove
                              </button>
                            </div>
                          ))}
                          <button
                            onClick={() => addOption(index)}
                            className="bg-[#6B6B6B] text-white rounded-md px-4 py-1 font-bold mt-1 w-fit"
                          >
                            Add Option
                          </button>
                        </div>
                      )}

                      {/* Remove question */}
                      {!q.isManuscriptTitle && (
                        <button
                          onClick={() => removeQuestion(index)}
                          className="bg-[#7B2E19] text-white rounded-md px-4 py-2 font-bold mt-2 w-fit"
                        >
                          Remove Question
                        </button>
                      )}
                    </div>
                  )}
                </Draggable>
              ))}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>

      {/* Footer */}
      <div className="flex gap-4 mt-8 justify-between">
        <button
          onClick={addQuestion}
          className="bg-[#6B6B6B] text-white text-base rounded-lg px-[22px] h-[38px] font-medium"
        >
          Add Question
        </button>
        <button
          onClick={saveForm}
          className="bg-[#4CC97B] text-white text-base rounded-lg px-[22px] h-[38px] font-medium"
        >
          {formId ? "Update Form" : "Save Form"}
        </button>
      </div>
    </div>
  );
}
