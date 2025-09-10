import React, { useEffect, useState, useRef } from "react";
import { db, auth } from "../../firebase/firebase";
import {
  collection,
  getDocs,
  doc,
  getDoc,
  addDoc,
  updateDoc,
  serverTimestamp,
  query,
  orderBy,
} from "firebase/firestore";

export default function SubmitManuscript() {
  const [forms, setForms] = useState([]);
  const [form, setForm] = useState(null);
  const [answers, setAnswers] = useState({});
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [cooldown, setCooldown] = useState(0);
  const [message, setMessage] = useState("");

  // Co-author state
  const [allResearchers, setAllResearchers] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [userSearch, setUserSearch] = useState("");
  const [filteredUsers, setFilteredUsers] = useState([]);

  const cooldownRef = useRef(0);
  useEffect(() => {
    cooldownRef.current = cooldown;
  }, [cooldown]);

  // Fetch forms and researchers
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch all forms
        const formsSnap = await getDocs(
          query(collection(db, "forms"), orderBy("createdAt", "desc"))
        );
        const formsList = formsSnap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));
        setForms(formsList);

        // Preload first form by default
        if (formsList.length > 0) selectForm(formsList[0].id);

        // Fetch researchers
        const usersSnap = await getDocs(collection(db, "Users"));
        setAllResearchers(
          usersSnap.docs
            .map((d) => ({ id: d.id, ...d.data() }))
            .filter((u) => u.role === "Researcher")
        );

        auth.onAuthStateChanged((user) => {
          setCurrentUser(user || null);
          setLoading(false);
        });
      } catch (err) {
        console.error("Error fetching data:", err);
        setMessage("Failed to load forms or users.");
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // Select a form
  const selectForm = async (formId) => {
    try {
      const docSnap = await getDoc(doc(db, "forms", formId));
      if (docSnap.exists()) {
        const questions = (docSnap.data().questions || []).map((q, i) => ({
          ...q,
          options: (q.options || []).map((o, idx) =>
            typeof o === "string"
              ? { id: `${i}-${idx}-${Date.now()}`, value: o }
              : o
          ),
        }));
        setForm({ id: docSnap.id, ...docSnap.data(), questions });

        // Preload co-authors
        const coAuthors =
          docSnap.data().coAuthors?.map((c) => ({
            id: c.id,
            name: c.name,
            email: c.email,
          })) || [];
        setSelectedUsers(coAuthors);
        setAnswers({});
      }
    } catch (err) {
      console.error("Error selecting form:", err);
      setMessage("Failed to load selected form.");
    }
  };

  // Filter researchers
  useEffect(() => {
    if (!userSearch.trim()) return setFilteredUsers([]);
    const term = userSearch.toLowerCase();
    setFilteredUsers(
      allResearchers.filter(
        (u) =>
          (u.firstName?.toLowerCase().includes(term) ||
            u.lastName?.toLowerCase().includes(term) ||
            (u.email || "").toLowerCase().includes(term)) &&
          !selectedUsers.some((su) => su.id === u.id)
      )
    );
  }, [userSearch, selectedUsers, allResearchers]);

  // Cooldown timer
  useEffect(() => {
    if (cooldown > 0) {
      const timer = setInterval(() => {
        setCooldown((prev) => {
          const next = prev > 0 ? prev - 1 : 0;
          cooldownRef.current = next;
          return next;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [cooldown]);

  // Handle answers
  const handleChange = (index, value, type) => {
    if (type === "checkbox") {
      const prev = answers[index] || [];
      setAnswers({
        ...answers,
        [index]: prev.includes(value)
          ? prev.filter((v) => v !== value)
          : [...prev, value],
      });
    } else {
      setAnswers({ ...answers, [index]: value });
    }
  };

  // Co-author handlers
  const addUser = (user) => {
    if (!selectedUsers.some((u) => u.id === user.id)) {
      setSelectedUsers([...selectedUsers, user]);
    }
    setUserSearch("");
    setFilteredUsers([]);
  };
  const removeUser = (id) =>
    setSelectedUsers(selectedUsers.filter((u) => u.id !== id));

  // Submit answers
  const submitAnswers = async () => {
    if (!form) return setMessage("No form selected.");
    if (cooldownRef.current > 0) {
      setMessage(`You already submitted. Please wait ${cooldownRef.current}s.`);
      return;
    }
    if (!currentUser) {
      setMessage("User not signed in.");
      return;
    }

    const missingRequired = form.questions.some((q, index) =>
      q.required
        ? q.type === "checkbox"
          ? !(answers[index]?.length > 0)
          : !answers[index]
        : false
    );
    if (missingRequired) return setMessage("Please fill all required fields.");

    const manuscriptTitleIndex = form.questions.findIndex(
      (q) => q.isManuscriptTitle
    );
    if (manuscriptTitleIndex === -1)
      return setMessage("Form must have a 'Manuscript Title' field.");
    const manuscriptTitleAnswer = answers[manuscriptTitleIndex] || "";
    if (!manuscriptTitleAnswer.trim())
      return setMessage("Please enter a Manuscript Title.");

    try {
      const userSnap = await getDoc(doc(db, "Users", currentUser.uid));
      if (!userSnap.exists()) return setMessage("User record not found.");
      const userInfo = userSnap.data();
      const initialStatus = "Pending";

      const answeredQuestions = form.questions.map((q, index) =>
        q.type === "coauthors"
          ? {
              question: "Co-Authors",
              type: "coauthors",
              required: q.required || false,
              answer: selectedUsers.map((u) => `${u.name} (${u.email})`),
            }
          : {
              question: q.text,
              type: q.type,
              required: q.required || false,
              answer:
                q.type === "checkbox"
                  ? answers[index] || []
                  : answers[index] || "",
            }
      );

      const coAuthors = selectedUsers.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
      }));
      const coAuthorsIds = selectedUsers.map((u) => u.id);

      const searchIndex = [
        (userInfo.email || "").toLowerCase(),
        ((userInfo.firstName || "") + " " + (userInfo.lastName || ""))
          .trim()
          .toLowerCase(),
        manuscriptTitleAnswer.toLowerCase(),
        ...selectedUsers.map((u) => (u.email || "").toLowerCase()),
        ...selectedUsers.map((u) => (u.name || "").toLowerCase()),
      ].filter(Boolean);

      setCooldown(5);
      cooldownRef.current = 5;

      const responseRef = await addDoc(collection(db, "form_responses"), {
        formId: form.id,
        formTitle: form.title || "",
        manuscriptTitle: manuscriptTitleAnswer,
        userId: currentUser.uid,
        firstName: userInfo.firstName || "",
        lastName: userInfo.lastName || "",
        email: userInfo.email || "",
        role: userInfo.role || "Researcher",
        answeredQuestions,
        coAuthors,
        coAuthorsIds,
        searchIndex,
        status: initialStatus,
        versionNumber: 1,
        parentResponseId: null,
        submittedAt: serverTimestamp(),
      });

      await addDoc(collection(db, "manuscripts"), {
        responseId: responseRef.id,
        formId: form.id,
        formTitle: form.title || "",
        manuscriptTitle: manuscriptTitleAnswer,
        answeredQuestions,
        userId: currentUser.uid,
        firstName: userInfo.firstName || "",
        lastName: userInfo.lastName || "",
        role: userInfo.role || "Researcher",
        coAuthors,
        coAuthorsIds,
        assignedReviewers: [],
        status: initialStatus,
        versionNumber: 1,
        parentResponseId: null,
        searchIndex,
        submittedAt: serverTimestamp(),
      });

      await updateDoc(doc(db, "Users", currentUser.uid), {
        lastSubmittedAt: serverTimestamp(),
      });

      setAnswers({});
      setSelectedUsers([]);
      setMessage("Form submitted successfully!");
      setTimeout(() => setMessage(""), 4000);
    } catch (err) {
      console.error("Error submitting form:", err);
      setMessage("Failed to submit form. Check console for details.");
    }
  };

  if (loading) return <p className="text-center py-10">Loading...</p>;

  return (
    <div className="min-h-screen px-4 md:py-12 lg:py-16 mx-auto max-w-3xl mt-12 bg-white text-[#222]">
      <h1 className="text-2xl font-semibold mb-6 text-[#111] text-center">
        Submit Manuscript
      </h1>

      {/* Form selection dropdown */}
      <div className="mb-6">
        <label className="block mb-2 font-semibold">Select Form:</label>
        <select
          value={form?.id || ""}
          onChange={(e) => selectForm(e.target.value)}
          className="border p-2 rounded w-full focus:outline-none focus:ring-2 focus:ring-green-400"
        >
          <option value="" disabled>
            -- Select a Form --
          </option>
          {forms.map((f) => (
            <option key={f.id} value={f.id}>
              {f.title}
            </option>
          ))}
        </select>
      </div>

      {!form && <p className="text-center py-10">No form selected.</p>}

      {form && (
        <>
          <h2 className="text-xl font-semibold mb-4 text-center">
            {form.title}
          </h2>

          <div className="flex flex-col gap-6">
            {form.questions.map((q, index) => (
              <div
                key={q.id || index}
                className="bg-[#e0e0e0] rounded-xl p-4 flex flex-col gap-2"
              >
                {q.type === "coauthors" ? (
                  <>
                    <label className="block font-semibold mb-2">
                      Co-Authors
                    </label>
                    <input
                      type="text"
                      placeholder="Type name or email to add co-author..."
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                      className="border p-2 w-full rounded mb-2 focus:outline-none focus:ring-2 focus:ring-green-400"
                    />
                    {userSearch && filteredUsers.length > 0 && (
                      <div className="border rounded bg-white max-h-40 overflow-y-auto mb-2">
                        {filteredUsers.map((u) => (
                          <div
                            key={u.id}
                            className="p-2 cursor-pointer hover:bg-gray-200 break-words"
                            onClick={() =>
                              addUser({
                                id: u.id,
                                name: `${u.firstName} ${u.lastName}`,
                                email: u.email,
                              })
                            }
                          >
                            {u.firstName} {u.lastName} ({u.email})
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="flex flex-wrap gap-2 mt-2">
                      {selectedUsers.map((u) => (
                        <span
                          key={u.id}
                          className="px-2 py-1 rounded bg-blue-200 text-blue-800 flex items-center gap-1"
                        >
                          {u.name} ({u.email})
                          <button onClick={() => removeUser(u.id)}>x</button>
                        </span>
                      ))}
                    </div>
                  </>
                ) : (
                  <>
                    <label className="block font-semibold mb-1">
                      {q.text}{" "}
                      {q.required && <span className="text-red-500">*</span>}
                    </label>
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
                    {["radio", "checkbox", "select", "multiple"].includes(
                      q.type
                    ) &&
                      q.options.map((opt) => (
                        <label
                          key={opt.id}
                          className="flex items-center gap-2 break-words"
                        >
                          <input
                            type={q.type === "checkbox" ? "checkbox" : "radio"}
                            name={`q${index}`}
                            value={opt.value}
                            checked={
                              q.type === "checkbox"
                                ? answers[index]?.includes(opt.value) || false
                                : answers[index] === opt.value
                            }
                            onChange={() =>
                              handleChange(index, opt.value, q.type)
                            }
                            className="accent-blue-500"
                          />
                          <span>{opt.value}</span>
                        </label>
                      ))}
                  </>
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
            <p
              className={`mt-2 text-center text-sm ${
                message.toLowerCase().includes("successfully")
                  ? "text-green-500"
                  : "text-red-500"
              }`}
            >
              {message}
            </p>
          )}
        </>
      )}

      {!currentUser && (
        <p className="text-red-500 mt-2 text-sm text-center">
          You must be signed in to submit the form.
        </p>
      )}
    </div>
  );
}
