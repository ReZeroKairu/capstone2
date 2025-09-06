import React, { useEffect, useState } from "react";
import { db, auth } from "../../firebase/firebase";
import {
  collection,
  getDocs,
  query,
  orderBy,
  limit,
  addDoc,
  doc,
  getDoc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";

export default function SubmitManuscript() {
  const [form, setForm] = useState(null);
  const [answers, setAnswers] = useState({});
  const [formId, setFormId] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [cooldown, setCooldown] = useState(0);
  const [message, setMessage] = useState("");

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

    const unsub = auth.onAuthStateChanged(async (user) => {
      if (user) {
        setCurrentUser(user);

        const userRef = doc(db, "Users", user.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          const lastSubmittedAt = userSnap.data().lastSubmittedAt?.toMillis?.();
          if (lastSubmittedAt) {
            const diff = Date.now() - lastSubmittedAt;
            if (diff < 5000) {
              setCooldown(Math.ceil((5000 - diff) / 1000));
            }
          }
        }
      } else {
        setCurrentUser(null);
      }
      setLoading(false);
    });

    return () => unsub();
  }, []);

  useEffect(() => {
    if (cooldown > 0) {
      const timer = setInterval(() => {
        setCooldown((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [cooldown]);

  const handleChange = (index, value, type) => {
    if (type === "checkbox") {
      const prev = answers[index] || [];
      if (prev.includes(value)) {
        setAnswers({ ...answers, [index]: prev.filter((v) => v !== value) });
      } else {
        setAnswers({ ...answers, [index]: [...prev, value] });
      }
    } else {
      setAnswers({ ...answers, [index]: value });
    }
  };

  const submitAnswers = async () => {
    if (cooldown > 0) {
      setMessage(`You already submitted. Please wait ${cooldown} seconds.`);
      return;
    }
    if (!form) {
      setMessage("Form is not loaded yet.");
      return;
    }
    if (!currentUser) {
      setMessage("You must be signed in to submit the form.");
      return;
    }

    const missingRequired = form.questions.some(
      (q, index) => q.required && !answers[index]
    );
    if (missingRequired) {
      setMessage("Please fill in all required fields before submitting.");
      return;
    }

    const manuscriptTitleIndex = form.questions.findIndex(
      (q) => q.isManuscriptTitle
    );

    if (manuscriptTitleIndex === -1) {
      setMessage("The form must include a 'Manuscript Title' field.");
      return;
    }

    const manuscriptTitleAnswer = answers[manuscriptTitleIndex] || "";

    if (!manuscriptTitleAnswer.trim()) {
      setMessage("Please enter a Manuscript Title before submitting.");
      return;
    }

    try {
      const answeredQuestions = form.questions.map((q, index) => ({
        question: q.text,
        type: q.type,
        required: q.required || false,
        answer: answers[index] || "",
      }));

      const userRef = doc(db, "Users", currentUser.uid);
      const userSnap = await getDoc(userRef);
      if (!userSnap.exists()) {
        setMessage("User record not found in database.");
        return;
      }
      const userInfo = userSnap.data();
      const initialStatus = "Pending";

      const searchIndex = [
        (userInfo.firstName || "").toLowerCase(),
        (userInfo.lastName || "").toLowerCase(),
        `${(userInfo.firstName || "").toLowerCase()} ${(
          userInfo.lastName || ""
        ).toLowerCase()}`,
        (userInfo.email || "").toLowerCase(),
        manuscriptTitleAnswer.toLowerCase(),
      ];

      let responseRef;
      try {
        responseRef = await addDoc(collection(db, "form_responses"), {
          formId,
          formTitle: form.title,
          manuscriptTitle: manuscriptTitleAnswer,
          userId: currentUser.uid,
          firstName: userInfo.firstName || "",
          lastName: userInfo.lastName || "",
          email: userInfo.email || "",
          role: userInfo.role || "Researcher",
          answeredQuestions,
          status: initialStatus,
          submittedAt: serverTimestamp(),
          searchIndex,
        });

        await addDoc(
          collection(db, "form_responses", responseRef.id, "history"),
          {
            status: initialStatus,
            updatedBy: `${userInfo.firstName || ""} ${userInfo.lastName || ""}`,
            timestamp: serverTimestamp(),
          }
        );
      } catch (err) {
        console.error("Failed to save in form_responses:", err);
        setMessage("Failed to save submission. Check console for details.");
        return;
      }

      await addDoc(collection(db, "manuscripts"), {
        responseId: responseRef.id,
        formId,
        formTitle: form.title,
        manuscriptTitle: manuscriptTitleAnswer,
        answeredQuestions,
        userId: currentUser.uid,
        firstName: userInfo.firstName || "",
        lastName: userInfo.lastName || "",
        role: userInfo.role || "Researcher",
        submittedAt: serverTimestamp(),
        status: initialStatus,
        reasonForRejection: null,
        assignedReviewers: [],
        searchIndex,
      });

      await updateDoc(userRef, { lastSubmittedAt: serverTimestamp() });

      setCooldown(5);
      setAnswers({});
      setMessage("Form submitted successfully!");
    } catch (error) {
      console.error("Submit error:", error);
      setMessage("Failed to submit form. Check console for details.");
    }
  };

  if (loading) return <p className="text-center py-10">Loading...</p>;
  if (!form) return <p className="text-center py-10">No form available.</p>;

  return (
    <div className="min-h-screen px-4 md:py-12 lg:py-16 mx-auto max-w-3xl mt-12 bg-white text-[#222]">
      <h1 className="text-2xl font-semibold mb-6 text-[#111] text-center">
        {form.title}
      </h1>

      <div className="flex flex-col gap-6">
        {form.questions.map((q, index) => (
          <div
            key={index}
            className="bg-[#e0e0e0] rounded-xl p-4 flex flex-col gap-2"
          >
            <label className="italic text-base font-medium">
              {q.text} {q.required && <span className="text-red-500">*</span>}
            </label>

            {q.type === "text" && (
              <input
                type="text"
                value={answers[index] || ""}
                onChange={(e) => handleChange(index, e.target.value)}
                className="italic rounded-lg px-3 py-2 w-full bg-white text-base border-none focus:outline-none"
              />
            )}

            {q.type === "textarea" && (
              <textarea
                value={answers[index] || ""}
                onChange={(e) => handleChange(index, e.target.value)}
                rows={4}
                className="italic rounded-lg px-3 py-2 w-full bg-white text-base border-none focus:outline-none"
              />
            )}

            {q.type === "radio" && (
              <div className="flex flex-col gap-2 mt-2">
                {q.options?.map((option, optIndex) => {
                  const value =
                    typeof option === "object" ? option.value : option;
                  return (
                    <label
                      key={optIndex}
                      className="flex items-center gap-2 bg-white rounded-lg px-3 py-1"
                    >
                      <input
                        type="radio"
                        name={`question-${index}`}
                        value={value}
                        checked={answers[index] === value}
                        onChange={() => handleChange(index, value)}
                        className="accent-[#4CC97B] scale-110"
                      />
                      <span className="italic">{value}</span>
                    </label>
                  );
                })}
              </div>
            )}

            {q.type === "checkbox" && (
              <div className="flex flex-col gap-2 mt-2">
                {q.options?.map((option, optIndex) => {
                  const value =
                    typeof option === "object" ? option.value : option;
                  return (
                    <label
                      key={optIndex}
                      className="flex items-center gap-2 bg-white rounded-lg px-3 py-1"
                    >
                      <input
                        type="checkbox"
                        value={value}
                        checked={(answers[index] || []).includes(value)}
                        onChange={() => handleChange(index, value, "checkbox")}
                        className="accent-[#4CC97B] scale-110"
                      />
                      <span className="italic">{value}</span>
                    </label>
                  );
                })}
              </div>
            )}

            {q.type === "select" && (
              <select
                value={answers[index] || ""}
                onChange={(e) => handleChange(index, e.target.value)}
                className="italic rounded-lg px-3 py-2 w-full bg-white text-base border-none focus:outline-none"
              >
                <option value="">Select an option</option>
                {q.options?.map((option, optIndex) => {
                  const value =
                    typeof option === "object" ? option.value : option;
                  return (
                    <option key={optIndex} value={value}>
                      {value}
                    </option>
                  );
                })}
              </select>
            )}
          </div>
        ))}
      </div>

      <div className="flex justify-end mt-8">
        <button
          onClick={submitAnswers}
          className={`${
            cooldown > 0 ? "bg-gray-400 cursor-not-allowed" : "bg-[#4CC97B]"
          } text-white text-base rounded-lg px-[22px] h-[38px] font-medium`}
          disabled={!currentUser || cooldown > 0}
        >
          {cooldown > 0 ? `Please wait ${cooldown}s` : "Submit"}
        </button>
      </div>

      {message && (
        <p className="mt-2 text-center text-sm text-red-500">{message}</p>
      )}

      {!currentUser && (
        <p className="text-red-500 mt-2 text-sm text-center">
          You must be signed in to submit the form.
        </p>
      )}
    </div>
  );
}
