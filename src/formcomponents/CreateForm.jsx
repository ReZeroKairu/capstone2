import React, { useState, useEffect, useRef } from "react";
import { db, auth } from "../firebase/firebase";
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  orderBy,
} from "firebase/firestore";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";

export default function CreateForm() {
  const [title, setTitle] = useState("");
  const [questions, setQuestions] = useState([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [formId, setFormId] = useState(null);
  const [forms, setForms] = useState([]);
  const [mtError, setMtError] = useState(false);
  const [initialFormState, setInitialFormState] = useState(null); // NEW
  const manuscriptTitleRef = useRef(null);

  const [currentPage, setCurrentPage] = useState(0);
  const questionsPerPage = 5; // show 5 questions per page

  // Load all forms if Admin
  useEffect(() => {
    const checkAdminAndFetch = async () => {
      auth.onAuthStateChanged(async (user) => {
        if (!user) return;
        const userDoc = await getDoc(doc(db, "Users", user.uid));
        const admin = userDoc.exists() && userDoc.data().role === "Admin";
        setIsAdmin(admin);
        if (!admin) return;

        const formsCollection = collection(db, "forms");
        const q = query(formsCollection, orderBy("createdAt", "desc"));
        const snapshot = await getDocs(q);

        if (!snapshot.empty) {
          const loadedForms = snapshot.docs.map((docSnap) => ({
            id: docSnap.id,
            ...docSnap.data(),
          }));
          setForms(loadedForms);

          // Load the latest form by default
          const latestForm = loadedForms[0];
          loadForm(latestForm.id, latestForm);
        }
      });
    };
    checkAdminAndFetch();
  }, []);

  // Load form by ID
  const loadForm = (id, data = null) => {
    const formData = data || forms.find((f) => f.id === id);
    if (!formData) return;

    setFormId(formData.id);
    setTitle(formData.title);
    setCurrentPage(0); // Reset to first page when loading a form

    let loadedQuestions = formData.questions || [];

    // Ensure Manuscript Title and Manuscript File exist
    if (!loadedQuestions.some((q) => q.isManuscriptTitle)) {
      loadedQuestions.unshift({
        id: "manuscript-title",
        text: "Manuscript Title",
        type: "text",
        isManuscriptTitle: true,
        required: true,
        options: [],
      });
    }

    if (!loadedQuestions.some((q) => q.isManuscriptFile)) {
      loadedQuestions.push({
        id: "manuscript-file",
        text: "Upload Manuscript",
        type: "file",
        isManuscriptFile: true,
        required: true,
        options: [],
      });
    }

    if (!loadedQuestions.some((q) => q.isAbstract)) {
      loadedQuestions.splice(1, 0, {
        id: "abstract",
        text: "Abstract",
        type: "textarea",
        isAbstract: true,
        required: true,
        options: [],
      });
    }

    if (!loadedQuestions.some((q) => q.type === "coauthors")) {
      loadedQuestions.push({
        id: "coauthors",
        text: "Co-Authors / Tag Researchers",
        type: "coauthors",
        options: [],
      });
    }

    const mappedQuestions = loadedQuestions.map((q) => ({
      ...q,
      id: q.id || Date.now().toString() + Math.random(),
      options: (q.options || []).map((o) => ({
        id: o.id || Date.now().toString() + Math.random(),
        value: o.value || o,
      })),
    }));

    setQuestions(mappedQuestions);

    // NEW: store initial state for cancel / change detection
    setInitialFormState({
      title: formData.title,
      questions: mappedQuestions,
    });
  };

  // NEW: Detect if form has changes
  const hasChanges = () => {
    if (!initialFormState) return true; // new form
    return (
      initialFormState.title !== title ||
      JSON.stringify(initialFormState.questions) !== JSON.stringify(questions)
    );
  };

  // NEW: Cancel changes
const cancelChanges = () => {
  if (!initialFormState) {
    setTitle("");
    setQuestions([]);
    setFormId(null);
  } else {
    setTitle(initialFormState.title);
    setQuestions(initialFormState.questions);
    setCurrentPage(0); // Reset to first page
    setMtError(false); // Clear any manuscript title error
  }
};

  // Questions CRUD
  const addQuestion = () => {
    const newQuestion = {
      id: Date.now().toString() + Math.random(),
      text: "",
      type: "text",
      required: false,
      options: [],
    };

    const updatedQuestions = [...questions, newQuestion];
    setQuestions(updatedQuestions);

    const lastPage = Math.floor((updatedQuestions.length - 1) / questionsPerPage);
    setCurrentPage(lastPage);
  };

  const removeQuestion = (index) => {
    if (
      questions[index].isManuscriptTitle ||
      questions[index].isManuscriptFile ||
      questions[index].isAbstract
    ) return;

    const updatedQuestions = questions.filter((_, i) => i !== index);
    setQuestions(updatedQuestions);

    const lastPage = Math.max(
      0,
      Math.ceil(updatedQuestions.length / questionsPerPage) - 1
    );
    if (currentPage > lastPage) setCurrentPage(lastPage);
  };

  const updateQuestion = (index, field, value) => {
    const updated = [...questions];
    updated[index][field] = value;

    if (updated[index].isManuscriptTitle && field === "text") {
      if (/manuscript title/i.test(value.trim())) setMtError(false);
    }

    if (updated[index].isAbstract && field === "text") {
      if (value.trim() === "") console.log("Abstract cannot be empty");
    }

    if (field === "type") {
      if (
        updated[index].isManuscriptTitle ||
        updated[index].isManuscriptFile ||
        updated[index].isAbstract
      ) {
        updated[index].type = updated[index].isManuscriptTitle
          ? "text"
          : updated[index].isManuscriptFile
          ? "file"
          : "textarea";
        return;
      }
    }

    if (
      field === "type" &&
      !["multiple", "radio", "checkbox", "select", "coauthors"].includes(value)
    ) {
      updated[index].options = [];
    }

    setQuestions(updated);
  };

  const addOption = (qIndex) => {
    const updated = [...questions];
    updated[qIndex].options = updated[qIndex].options || [];
    updated[qIndex].options.push({
      id: Date.now().toString() + Math.random(),
      value: "",
    });
    setQuestions(updated);
  };

  const updateOption = (qIndex, oIndex, value) => {
    const updated = [...questions];
    updated[qIndex].options[oIndex].value = value;
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

  // Save / Update form
  const saveForm = async (e) => {
    e.preventDefault();

    if (!hasChanges()) {
      alert("No changes to save.");
      return;
    }

    if (!title.trim()) return alert("Form title is required!");
    const manuscriptTitleQuestion = questions.find((q) => q.isManuscriptTitle);
    if (!manuscriptTitleQuestion || !manuscriptTitleQuestion.text.trim())
      return alert("Manuscript Title field is required!");
    if (questions.length === 0) return alert("Please add at least one question!");
    if (
      questions.some(
        (q) =>
          !q.text.trim() &&
          !q.isManuscriptTitle &&
          !q.isManuscriptFile &&
          !q.isAbstract
      )
    )
      return alert("All questions must have text!");
    const abstractQuestion = questions.find((q) => q.isAbstract);
    if (!abstractQuestion || abstractQuestion.text.trim() === "")
      return alert("Abstract is required and cannot be empty!");
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

    const updatedQuestions = questions.map((q) => {
      if (q.isManuscriptTitle) {
        return {
          ...q,
          type: "text",
          required: true,
          text: q.text.trim() || "Manuscript Title",
        };
      }
      return q;
    });

    const data = {
      title,
      questions: updatedQuestions,
      manuscriptTitle: manuscriptTitleQuestion.text.trim(),
      coAuthors: [],
      updatedAt: new Date(),
      hasManuscriptTitle: true,
    };

    try {
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
        setForms([{ id: docRef.id, ...data }, ...forms]);
      }

      // NEW: update initial state after save
      setInitialFormState({
        title,
        questions: updatedQuestions,
      });
    } catch (error) {
      console.error("Error saving form:", error);
      alert("Failed to save form. Please try again.");
    }
  };

  // Delete form without deleting responses
  const deleteForm = async () => {
    if (!formId) return;
    const confirmDelete = window.confirm(
      "Are you sure you want to delete this form? Responses will NOT be deleted."
    );
    if (!confirmDelete) return;

    await deleteDoc(doc(db, "forms", formId));
    alert("Form deleted successfully!");

    setForms(forms.filter((f) => f.id !== formId));
    setFormId(null);
    setTitle("");
    setQuestions([
      {
        id: "manuscript-title",
        text: "Manuscript Title",
        type: "text",
        isManuscriptTitle: true,
        required: true,
        options: [],
      },
      {
        id: "abstract",
        text: "Abstract",
        type: "textarea",
        isAbstract: true,
        required: true,
        options: [],
      },
      {
        id: "manuscript-file",
        text: "Upload Manuscript",
        type: "file",
        isManuscriptFile: true,
        required: true,
        options: [],
      },
      {
        id: "coauthors",
        text: "Co-Authors / Tag Researchers",
        type: "coauthors",
        options: [],
      },
    ]);

    // reset initial state
    setInitialFormState(null);
  };

  if (!isAdmin)
    return (
      <p className="p-6 sm:p-12 md:p-28 text-red-500">
        You do not have permission to create forms.
      </p>
    );

  return (
    <div className="min-h-screen px-4 md:py-12 lg:py-16 mx-auto max-w-3xl mt-12 bg-white text-[#222]">
      <h1 className="text-2xl font-semibold mb-2 text-[#111]">
        {formId ? "Edit Form" : "Create a Form"}
      </h1>

      {/* Dropdown to switch forms */}
      {forms.length > 0 && (
        <div className="mb-6">
          <label className="block mb-1 font-medium">Select Form</label>
          <select
            value={formId || ""}
            onChange={(e) => {
              if (!e.target.value) {
                setFormId(null);
                setTitle("");
                setQuestions([
                  {
                    id: "manuscript-title",
                    text: "Manuscript Title",
                    type: "text",
                    isManuscriptTitle: true,
                    required: true,
                    options: [],
                  },
                  {
                    id: "manuscript-file",
                    text: "Upload Manuscript",
                    type: "file",
                    isManuscriptFile: true,
                    required: true,
                    options: [],
                  },
                  {
                    id: "abstract",
                    text: "Abstract",
                    type: "textarea",
                    isAbstract: true,
                    required: true,
                    options: [],
                  },
                  {
                    id: "coauthors",
                    text: "Co-Authors / Tag Researchers",
                    type: "coauthors",
                    options: [],
                  },
                ]);
                setInitialFormState(null); // NEW
              } else {
                loadForm(e.target.value);
              }
            }}
            className="w-full border rounded px-3 py-2 bg-[#f3f2ee]"
          >
            {forms.map((f) => (
              <option key={f.id} value={f.id}>
                {f.title}
              </option>
            ))}
            <option value="">➕ Create New Form</option>
          </select>
        </div>
      )}

      {/* Title */}
      <div className="mb-8">
        <p className="italic mb-2 text-[1.15rem]">Title</p>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full font-medium rounded-full bg-[#e0e0e0] border-none px-[18px] py-[7px] h-[43px] text-xl text-[#222]"
        />
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
              {questions
                .slice(
                  currentPage * questionsPerPage,
                  (currentPage + 1) * questionsPerPage
                )
                .map((q, index) => {
                  const globalIndex = currentPage * questionsPerPage + index;
                  return (
                    <Draggable key={q.id} draggableId={q.id} index={globalIndex}>
                      {(provided) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          {...provided.dragHandleProps}
                          className="bg-[#e0e0e0] rounded-xl p-4 flex flex-col gap-2"
                        >
                          {q.type === "coauthors" ? (
                            <label className="font-semibold mb-1 block">
                              {q.text} (Tagging disabled here)
                            </label>
                          ) : (
                            <>
                              <div className="flex flex-col gap-1">
                                <input
                                  type="text"
                                  placeholder="Question text"
                                  value={q.text}
                                  onChange={(e) =>
                                    updateQuestion(globalIndex, "text", e.target.value)
                                  }
                                  className={`italic rounded-lg px-3 py-2 w-full bg-white text-base ${
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

                              <select
                                value={q.type}
                                onChange={(e) => {
                                  const newType = e.target.value;
                                  if (newType === "file" && !q.isManuscriptFile) {
                                    alert(
                                      "Only the Manuscript File question can be of type 'file'."
                                    );
                                    return;
                                  }
                                  updateQuestion(globalIndex, "type", newType);
                                }}
                                className="bg-[#f3f2ee] rounded-lg px-3 py-1 w-fit text-base font-medium border-none shadow-sm"
                                disabled={q.isManuscriptTitle || q.isManuscriptFile}
                              >
                                <option value="text">Text</option>
                                <option value="textarea">Paragraph</option>
                                <option value="multiple">Multiple Choice</option>
                                <option value="radio">Radio</option>
                                <option value="checkbox">Checkbox</option>
                                <option value="select">Dropdown</option>
                                <option value="number">Number</option>
                                <option value="date">Date</option>
                                {q.isManuscriptFile && <option value="file">File</option>}
                              </select>

                              <label className="flex items-center gap-2 text-base">
                                <input
                                  type="checkbox"
                                  checked={q.required || false}
                                  onChange={(e) =>
                                    updateQuestion(globalIndex, "required", e.target.checked)
                                  }
                                  className="accent-[#4CC97B] scale-110"
                                />
                                Required
                              </label>

                              {(q.type === "multiple" ||
                                q.type === "radio" ||
                                q.type === "checkbox" ||
                                q.type === "select") && (
                                <div className="flex flex-col gap-2 mt-2">
                                  {q.options?.map((opt, oIndex) => (
                                    <div key={opt.id} className="flex gap-2">
                                      <input
                                        type="text"
                                        value={opt.value}
                                        onChange={(e) =>
                                          updateOption(globalIndex, oIndex, e.target.value)
                                        }
                                        className="rounded-lg px-3 py-1 flex-1 bg-white border-none"
                                      />
                                      <button
                                        onClick={() => removeOption(globalIndex, oIndex)}
                                        className="bg-[#7B2E19] text-white rounded-md px-3 font-bold"
                                      >
                                        Remove
                                      </button>
                                    </div>
                                  ))}
                                  <button
                                    onClick={() => addOption(globalIndex)}
                                    className="bg-[#6B6B6B] text-white rounded-md px-4 py-1 font-bold mt-1 w-fit"
                                  >
                                    Add Option
                                  </button>
                                </div>
                              )}

                              {!q.isManuscriptTitle &&
                                !q.isManuscriptFile &&
                                !q.isAbstract && (
                                  <button
                                    onClick={() => removeQuestion(globalIndex)}
                                    className="bg-[#7B2E19] text-white rounded-md px-4 py-2 font-bold mt-2 w-fit"
                                  >
                                    Remove Question
                                  </button>
                                )}
                            </>
                          )}
                        </div>
                      )}
                    </Draggable>
                  );
                })}

              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>

     {/* Pagination Controls */}
<div className="flex justify-between items-center mt-4">
  <button
    onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 0))}
    disabled={currentPage === 0}
    className={`px-4 py-2 rounded-lg ${
      currentPage === 0 ? "bg-gray-300 cursor-not-allowed" : "bg-[#6B6B6B] text-white"
    }`}
  >
    Previous
  </button>

  <span className="text-base font-medium">
    Page {currentPage + 1} of {Math.ceil(questions.length / questionsPerPage)}
  </span>

  <button
    onClick={() =>
      setCurrentPage((prev) =>
        prev < Math.ceil(questions.length / questionsPerPage) - 1
          ? prev + 1
          : prev
      )
    }
    disabled={currentPage >= Math.ceil(questions.length / questionsPerPage) - 1}
    className={`px-4 py-2 rounded-lg ${
      currentPage >= Math.ceil(questions.length / questionsPerPage) - 1
        ? "bg-gray-300 cursor-not-allowed"
        : "bg-[#6B6B6B] text-white"
    }`}
  >
    Next
  </button>
</div>


      
      {/* Buttons */}
      <div className="flex gap-4 mt-8 justify-between">
        <button
          onClick={addQuestion}
          className="bg-[#6B6B6B] text-white text-base rounded-lg px-[22px] h-[38px] font-medium"
        >
          Add Question
        </button>

        <div className="flex gap-2">
          <button
            onClick={saveForm}
            className="bg-[#4CC97B] text-white text-base rounded-lg px-[22px] h-[38px] font-medium"
          >
            {formId ? "Update Form" : "Save Form"}
          </button>

          {formId && (
            <>
              <button
                onClick={cancelChanges} // NEW
                className="bg-gray-500 text-white text-base rounded-lg px-[22px] h-[38px] font-medium"
              >
                Cancel Changes
              </button>

              <button
                onClick={deleteForm}
                className="bg-red-600 text-white text-base rounded-lg px-[22px] h-[38px] font-medium"
              >
                Delete Form
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}