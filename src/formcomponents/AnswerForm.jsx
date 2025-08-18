import React, { useEffect, useState } from "react";
import { db, auth } from "../firebase/firebase";
import {
  collection,
  getDocs,
  query,
  orderBy,
  limit,
  addDoc,
  doc,
  getDoc,
  serverTimestamp,
} from "firebase/firestore";

export default function AnswerForm() {
  const [form, setForm] = useState(null);
  const [answers, setAnswers] = useState({});
  const [formId, setFormId] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLatestForm = async () => {
      try {
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
      } catch (error) {
        console.error("Failed to fetch latest form:", error);
      }
    };

    fetchLatestForm();

    const unsub = auth.onAuthStateChanged((user) => {
      if (user) setCurrentUser(user);
      else setCurrentUser(null);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  const handleChange = (index, value) => {
    setAnswers({ ...answers, [index]: value });
  };

  const submitAnswers = async () => {
    if (!form) {
      alert("Form is not loaded yet.");
      return;
    }
    if (!currentUser) {
      alert("You must be signed in to submit the form.");
      return;
    }

    try {
      const answeredQuestions = form.questions.map((q, index) => ({
        question: q.text,
        type: q.type,
        answer: answers[index] || "",
      }));

      const userRef = doc(db, "Users", currentUser.uid);
      const userSnap = await getDoc(userRef);
      if (!userSnap.exists()) {
        alert("User record not found in database.");
        return;
      }
      const userInfo = userSnap.data();

      const initialStatus = "Pending";

      const responseRef = await addDoc(collection(db, "form_responses"), {
        formId,
        formTitle: form.title,
        userId: currentUser.uid,
        firstName: userInfo.firstName || "",
        lastName: userInfo.lastName || "",
        email: userInfo.email || "",
        role: userInfo.role || "Researcher",
        answeredQuestions,
        status: initialStatus,
        submittedAt: serverTimestamp(),
      });

      await addDoc(
        collection(db, "form_responses", responseRef.id, "history"),
        {
          status: initialStatus,
          updatedBy: `${userInfo.firstName || ""} ${userInfo.lastName || ""}`,
          timestamp: serverTimestamp(),
        }
      );

      alert("Form submitted successfully!");
      setAnswers({});
    } catch (error) {
      console.error("Submit error:", error);
      alert("Failed to submit form. Check console for details.");
    }
  };

  if (loading) return <p className="text-center py-10">Loading...</p>;
  if (!form) return <p className="text-center py-10">No form available.</p>;

  return (
    <div className="pt-36 pb-10 px-4 sm:py-36 sm:px-6 md:px-8 max-w-3xl mx-auto">
      <h1 className="text-2xl sm:text-3xl font-bold mb-4 text-center sm:text-left">
        {form.title}
      </h1>

      {form.questions.map((q, index) => (
        <div key={index} className="mb-4">
          <label className="block font-semibold mb-1">{q.text}</label>
          {q.type === "text" && (
            <input
              type="text"
              value={answers[index] || ""}
              onChange={(e) => handleChange(index, e.target.value)}
              className="border p-2 w-full rounded focus:outline-none focus:ring-2 focus:ring-green-400"
            />
          )}
          {q.type === "textarea" && (
            <textarea
              value={answers[index] || ""}
              onChange={(e) => handleChange(index, e.target.value)}
              className="border p-2 w-full rounded focus:outline-none focus:ring-2 focus:ring-green-400"
              rows={4}
            />
          )}
        </div>
      ))}

      <button
        onClick={submitAnswers}
        className="bg-green-500 text-white px-4 py-2 rounded w-full sm:w-auto block sm:inline-block"
        disabled={!currentUser}
      >
        Submit
      </button>

      {!currentUser && (
        <p className="text-red-500 mt-2 text-sm text-center sm:text-left">
          You must be signed in to submit the form.
        </p>
      )}
    </div>
  );
}
