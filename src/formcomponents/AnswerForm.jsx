import React, { useEffect, useState } from "react";
import { db, auth } from "../firebase/firebase";
import {
  collection,
  getDocs,
  query,
  orderBy,
  limit,
  addDoc,
} from "firebase/firestore";

export default function AnswerForm() {
  const [form, setForm] = useState(null);
  const [answers, setAnswers] = useState({});
  const [formId, setFormId] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    // Get the latest form
    const fetchLatestForm = async () => {
      const q = query(
        collection(db, "forms"),
        orderBy("createdAt", "desc"),
        limit(1)
      );
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        const docSnap = snapshot.docs[0];
        setForm(docSnap.data());
        setFormId(docSnap.id);
      }
    };

    fetchLatestForm();

    // Get current user info
    const unsub = auth.onAuthStateChanged(async (user) => {
      if (user) {
        setCurrentUser(user);
      }
    });

    return () => unsub();
  }, []);

  const handleChange = (index, value) => {
    setAnswers({ ...answers, [index]: value });
  };

  const submitAnswers = async () => {
    if (!form || !currentUser) return;

    // Prepare answeredQuestions array
    const answeredQuestions = form.questions.map((q, index) => ({
      question: q.text,
      type: q.type,
      answer: answers[index] || "",
    }));

    const userSnapshot = await getDocs(collection(db, "Users"));
    const userDoc = userSnapshot.docs.find((doc) => doc.id === currentUser.uid);
    const userInfo = userDoc ? userDoc.data() : {};

    // Initial status and history
    const initialStatus = "Pending"; // Admin starts review
    const initialHistory = [
      {
        status: initialStatus,
        timestamp: new Date(),
        updatedBy: `${userInfo.firstName || ""} ${userInfo.lastName || ""}`,
      },
    ];

    await addDoc(collection(db, "form_responses"), {
      formId,
      formTitle: form.title,
      userId: currentUser.uid,
      firstName: userInfo.firstName || "",
      lastName: userInfo.lastName || "",
      email: userInfo.email || "",
      role: userInfo.role || "Researcher",
      answeredQuestions,
      status: initialStatus,
      history: initialHistory,
      submittedAt: new Date(),
    });

    alert("Form submitted successfully!");
    setAnswers({});
  };

  if (!form) return <p className="text-center py-10">Loading form...</p>;

  return (
    <div className="py-36 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">{form.title}</h1>
      {form.questions.map((q, index) => (
        <div key={index} className="mb-4">
          <label className="block font-semibold mb-1">{q.text}</label>
          {q.type === "text" && (
            <input
              type="text"
              value={answers[index] || ""}
              onChange={(e) => handleChange(index, e.target.value)}
              className="border p-2 w-full"
            />
          )}
          {q.type === "textarea" && (
            <textarea
              value={answers[index] || ""}
              onChange={(e) => handleChange(index, e.target.value)}
              className="border p-2 w-full"
            />
          )}
        </div>
      ))}
      <button
        onClick={submitAnswers}
        className="bg-green-500 text-white px-4 py-2 rounded"
      >
        Submit
      </button>
    </div>
  );
}
