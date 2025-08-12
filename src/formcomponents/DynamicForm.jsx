import { useEffect, useState } from "react";
import { db, auth } from "../firebase/firebase";
import {
  doc,
  setDoc,
  onSnapshot,
  addDoc,
  collection,
  serverTimestamp,
  getDoc,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

export default function DynamicForm() {
  const [mode, setMode] = useState("user"); // "admin" or "user"
  const [form, setForm] = useState({ title: "", questions: [] });
  const [answers, setAnswers] = useState({});
  const [role, setRole] = useState(null); // Store user role
  const formId = "my-form"; // Can be dynamic

  // Get logged-in user & fetch role
  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const userDoc = await getDoc(doc(db, "Users", user.uid));
        if (userDoc.exists()) {
          setRole(userDoc.data().role);
        }
      } else {
        setRole(null);
      }
    });

    return () => unsubAuth();
  }, []);

  // Live form fetch
  useEffect(() => {
    const unsub = onSnapshot(doc(db, "forms", formId), (docSnap) => {
      if (docSnap.exists()) {
        setForm(docSnap.data());
      }
    });
    return () => unsub();
  }, []);

  // Admin: Add question
  const addQuestion = () => {
    setForm((prev) => ({
      ...prev,
      questions: [
        ...prev.questions,
        { id: `q${Date.now()}`, text: "", type: "text", options: [] },
      ],
    }));
  };

  // Admin: Update question
  const updateQuestion = (index, field, value) => {
    const updated = [...form.questions];
    updated[index][field] = value;
    setForm((prev) => ({ ...prev, questions: updated }));
  };

  // Admin: Add option to a multiple choice question
  const addOption = (index) => {
    const updated = [...form.questions];
    updated[index].options.push("");
    setForm((prev) => ({ ...prev, questions: updated }));
  };

  // Admin: Save form to Firestore
  const saveForm = async () => {
    await setDoc(doc(db, "forms", formId), {
      title: form.title,
      questions: form.questions,
      updatedAt: serverTimestamp(),
    });
    alert("Form saved!");
  };

  // User: Handle answer change
  const handleChange = (id, value) => {
    setAnswers((prev) => ({ ...prev, [id]: value }));
  };

  // User: Submit answers
  const submitAnswers = async () => {
    await addDoc(collection(db, "responses"), {
      formId,
      answers,
      submittedAt: serverTimestamp(),
    });
    setAnswers({});
    alert("Response submitted!");
  };

  return (
    <div className="py-36 max-w-4xl mx-auto ">
      {/* Mode Toggle */}
      <div className="flex justify-end mb-4">
        <button
          className={`px-4 py-2 mr-2 rounded ${
            mode === "user" ? "bg-blue-500 text-white" : "bg-gray-200"
          }`}
          onClick={() => setMode("user")}
        >
          User Mode
        </button>

        {/* Only show Admin Mode button if role === "Admin" */}
        {role === "Admin" && (
          <button
            className={`px-4 py-2 rounded ${
              mode === "admin" ? "bg-green-500 text-white" : "bg-gray-200"
            }`}
            onClick={() => setMode("admin")}
          >
            Admin Mode
          </button>
        )}
      </div>

      {/* ADMIN VIEW */}
      {mode === "admin" && role === "Admin" ? (
        <div className="space-y-4">
          <input
            className="border p-2 w-full"
            placeholder="Form Title"
            value={form.title}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, title: e.target.value }))
            }
          />

          {form.questions.map((q, index) => (
            <div key={q.id} className="border p-4 rounded space-y-2">
              <input
                className="border p-2 w-full"
                placeholder="Question text"
                value={q.text}
                onChange={(e) => updateQuestion(index, "text", e.target.value)}
              />
              <select
                className="border p-2"
                value={q.type}
                onChange={(e) => updateQuestion(index, "type", e.target.value)}
              >
                <option value="text">Text</option>
                <option value="radio">Multiple Choice</option>
              </select>

              {q.type === "radio" && (
                <div className="space-y-1">
                  {q.options.map((opt, optIndex) => (
                    <input
                      key={optIndex}
                      className="border p-1 w-full"
                      placeholder={`Option ${optIndex + 1}`}
                      value={opt}
                      onChange={(e) => {
                        const updated = [...form.questions];
                        updated[index].options[optIndex] = e.target.value;
                        setForm((prev) => ({ ...prev, questions: updated }));
                      }}
                    />
                  ))}
                  <button
                    className="bg-gray-200 px-2 py-1 rounded"
                    onClick={() => addOption(index)}
                  >
                    Add Option
                  </button>
                </div>
              )}
            </div>
          ))}

          <button
            className="bg-blue-500 text-white px-4 py-2 rounded"
            onClick={addQuestion}
          >
            Add Question
          </button>
          <button
            className="bg-green-500 text-white px-4 py-2 rounded ml-2"
            onClick={saveForm}
          >
            Save Form
          </button>
        </div>
      ) : (
        /* USER VIEW */
        <div className="space-y-4">
          <h1 className="text-2xl font-bold">{form.title}</h1>
          {form.questions.map((q) => (
            <div key={q.id} className="space-y-1">
              <label className="font-semibold">{q.text}</label>
              {q.type === "text" && (
                <input
                  className="border p-2 w-full"
                  value={answers[q.id] || ""}
                  onChange={(e) => handleChange(q.id, e.target.value)}
                />
              )}
              {q.type === "radio" &&
                q.options.map((opt) => (
                  <label key={opt} className="block">
                    <input
                      type="radio"
                      name={q.id}
                      value={opt}
                      checked={answers[q.id] === opt}
                      onChange={(e) => handleChange(q.id, e.target.value)}
                    />{" "}
                    {opt}
                  </label>
                ))}
            </div>
          ))}

          <button
            className="bg-green-500 text-white px-4 py-2 rounded"
            onClick={submitAnswers}
          >
            Submit
          </button>
        </div>
      )}
    </div>
  );
}
