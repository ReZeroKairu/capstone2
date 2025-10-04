import React, { useEffect, useState, useRef } from "react";
import { db, auth, storage } from "../../firebase/firebase";
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
import { ref, getDownloadURL } from "firebase/storage";
import { useNotifications } from "../../hooks/useNotifications";
import { useUserLogs } from "../../hooks/useUserLogs";
import FileUpload from '../../components/FileUpload';

export default function SubmitManuscript() {
  const [forms, setForms] = useState([]);
  const [form, setForm] = useState(null);
  const [answers, setAnswers] = useState({});
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [cooldown, setCooldown] = useState(0);

  const { notifyManuscriptSubmission } = useNotifications();
  const { logManuscriptSubmission } = useUserLogs();

  const [allResearchers, setAllResearchers] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [userSearch, setUserSearch] = useState("");
  const [filteredUsers, setFilteredUsers] = useState([]);

  const cooldownRef = useRef(0);
  useEffect(() => { cooldownRef.current = cooldown; }, [cooldown]);

  // Floating message state
  const [message, setMessage] = useState("");
  const [messageVisible, setMessageVisible] = useState(false);

  const showMessage = (msg) => {
    setMessage(msg);
    setMessageVisible(true);
    setTimeout(() => setMessageVisible(false), 4000);
  };

  // Fetch forms and users
  useEffect(() => {
    const fetchData = async () => {
      try {
        const formsSnap = await getDocs(query(collection(db, "forms"), orderBy("createdAt", "desc")));
        const formsList = formsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        setForms(formsList);
        if (formsList.length > 0) selectForm(formsList[0].id);

        const usersSnap = await getDocs(collection(db, "Users"));
        setAllResearchers(usersSnap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter(u => u.role === "Researcher")
        );

        auth.onAuthStateChanged((user) => {
          setCurrentUser(user || null);
          setLoading(false);
        });
      } catch (err) {
        console.error("Error fetching data:", err);
        showMessage("Failed to load forms or users.");
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const selectForm = async (formId) => {
    try {
      const docSnap = await getDoc(doc(db, "forms", formId));
      if (docSnap.exists()) {
        const questions = (docSnap.data().questions || []).map((q, i) => ({
          ...q,
          options: (q.options || []).map((o, idx) =>
            typeof o === "string" ? { id: `${i}-${idx}-${Date.now()}`, value: o } : o
          ),
        }));
        setForm({ id: docSnap.id, ...docSnap.data(), questions });

        const coAuthors = docSnap.data().coAuthors?.map(c => ({
          id: c.id,
          firstName: c.firstName,
          middleName: c.middleName || "",
          lastName: c.lastName,
          email: c.email,
        })) || [];
        setSelectedUsers(coAuthors);
        setAnswers({});
      }
    } catch (err) {
      console.error("Error selecting form:", err);
      showMessage("Failed to load selected form.");
    }
  };

  useEffect(() => {
    if (!userSearch.trim()) return setFilteredUsers([]);
    const term = userSearch.toLowerCase();
    setFilteredUsers(allResearchers.filter(u =>
      (u.firstName?.toLowerCase().includes(term) ||
       u.lastName?.toLowerCase().includes(term) ||
       u.middleName?.toLowerCase().includes(term) ||
       (u.email || "").toLowerCase().includes(term)) &&
      !selectedUsers.some(su => su.id === u.id)
    ));
  }, [userSearch, selectedUsers, allResearchers]);

  useEffect(() => {
    if (cooldown > 0) {
      const timer = setInterval(() => {
        setCooldown(prev => {
          const next = prev > 0 ? prev - 1 : 0;
          cooldownRef.current = next;
          return next;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [cooldown]);

  const handleChange = (index, value, type) => {
    if (type === "checkbox") {
      const prev = answers[index] || [];
      setAnswers({
        ...answers,
        [index]: prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value],
      });
    } else {
      setAnswers({ ...answers, [index]: value });
    }
  };

  const addUser = (user) => {
    if (!selectedUsers.some(u => u.id === user.id)) setSelectedUsers([...selectedUsers, user]);
    setUserSearch("");
    setFilteredUsers([]);
  };
  const removeUser = (id) => setSelectedUsers(selectedUsers.filter(u => u.id !== id));

  const formatName = (first, middle, last) => {
    if (!first && !last) return "";
    const middleInitial = middle ? `${middle.charAt(0)}.` : "";
    return `${first || ""} ${middleInitial} ${last || ""}`.trim();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form) return showMessage("No form selected.");
    if (cooldownRef.current > 0) return showMessage(`You already submitted. Please wait ${cooldownRef.current}s.`);
    if (!currentUser) return showMessage("User not signed in.");

    const fileQuestionIndex = form.questions.findIndex(q => q.type === 'file');
    const fileData = answers[fileQuestionIndex];

    if (fileQuestionIndex === -1 || !fileData) {
      showMessage("Please upload a manuscript file.");
      return;
    }

    const allowedTypes = [
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];
    if (!allowedTypes.includes(fileData.type)) {
      showMessage("Only Word documents (.doc or .docx) are allowed.");
      return;
    }

    const missingRequired = form.questions.some((q, index) =>
      q.required ? (q.type === "checkbox" ? !(answers[index]?.length > 0) : !answers[index]) : false
    );
    if (missingRequired) return showMessage("Please fill all required fields.");

    const manuscriptTitleIndex = form.questions.findIndex(q => q.isManuscriptTitle);
    if (manuscriptTitleIndex === -1) return showMessage("Form must have a 'Manuscript Title' field.");
    const manuscriptTitleAnswer = answers[manuscriptTitleIndex] || "";
    if (!manuscriptTitleAnswer.trim()) return showMessage("Please enter a Manuscript Title.");

    try {
      setLoading(true);
      const userSnap = await getDoc(doc(db, "Users", currentUser.uid));
      if (!userSnap.exists()) return showMessage("User record not found.");
      const userInfo = userSnap.data();
      const initialStatus = "Pending";

      const exactStoragePath = fileData.storagePath;
      const downloadURL = fileData.url;

      const answeredQuestions = form.questions.map((q, index) => {
        if (q.type === "coauthors") {
          return {
            question: "Co-Authors",
            type: "coauthors",
            required: q.required || false,
            answer: selectedUsers.map(u => `${formatName(u.firstName, u.middleName, u.lastName)} (${u.email})`),
          };
        }
        if (q.type === "file") {
          return {
            question: q.text,
            type: "file",
            required: q.required || false,
            answer: downloadURL || null,
            fileName: fileData?.name || null,
            fileType: fileData?.type || null,
            fileSize: fileData?.size || null,
            storagePath: exactStoragePath,
          };
        }
        return {
          question: q.text,
          type: q.type,
          required: q.required || false,
          answer: q.type === "checkbox" ? answers[index] || [] : answers[index] || "",
        };
      });

      const coAuthors = selectedUsers.map(u => ({
        id: u.id,
        firstName: u.firstName,
        middleName: u.middleName || "",
        lastName: u.lastName,
        email: u.email,
      }));
      const coAuthorsIds = selectedUsers.map(u => u.id);

      const searchIndex = [
        (userInfo.email || "").toLowerCase(),
        ((userInfo.firstName || "") + " " + (userInfo.middleName || "") + " " + (userInfo.lastName || "")).trim().toLowerCase(),
        manuscriptTitleAnswer.toLowerCase(),
        ...selectedUsers.map(u => (u.email || "").toLowerCase()),
        ...selectedUsers.map(u => ((u.firstName || "") + " " + (u.middleName || "") + " " + (u.lastName || "")).trim().toLowerCase()),
      ].filter(Boolean);

      setCooldown(5);
      cooldownRef.current = 5;

      const responseRef = await addDoc(collection(db, "form_responses"), {
        formId: form.id,
        formTitle: form.title || "",
        manuscriptTitle: manuscriptTitleAnswer,
        userId: currentUser.uid,
        firstName: userInfo.firstName || "",
        middleName: userInfo.middleName || "",
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
        fileUrl: downloadURL,
        fileName: fileData.name,
        fileType: fileData.type,
        fileSize: fileData.size,
        storagePath: exactStoragePath,
      });

      const manuscriptRef = await addDoc(collection(db, "manuscripts"), {
        responseId: responseRef.id,
        formId: form.id,
        formTitle: form.title || "",
        manuscriptTitle: manuscriptTitleAnswer,
        answeredQuestions,
        submitterId: currentUser.uid,
        firstName: userInfo.firstName || "",
        middleName: userInfo.middleName || "",
        lastName: userInfo.lastName || "",
        email: userInfo.email || "",
        role: userInfo.role || "Researcher",
        coAuthors,
        coAuthorsIds,
        assignedReviewers: [],
        status: initialStatus,
        versionNumber: 1,
        parentResponseId: null,
        searchIndex,
        submittedAt: serverTimestamp(),
        fileUrl: downloadURL,
        fileName: fileData.name,
        fileType: fileData.type,
        fileSize: fileData.size,
        storagePath: exactStoragePath,
        hasFile: true,
        fileUploadedAt: serverTimestamp(),
      });

      await updateDoc(doc(db, "Users", currentUser.uid), {
        lastSubmittedAt: serverTimestamp(),
        lastSubmissionFile: {
          name: fileData.name,
          size: fileData.size,
          type: fileData.type,
          url: downloadURL,
          storagePath: exactStoragePath,
          uploadedAt: serverTimestamp(),
        },
      });

      await notifyManuscriptSubmission(manuscriptRef.id, manuscriptTitleAnswer || form.title || "Untitled Manuscript", currentUser.uid);
      await logManuscriptSubmission(currentUser.uid, manuscriptRef.id, manuscriptTitleAnswer || form.title || "Untitled Manuscript");

      setAnswers({});
      setSelectedUsers([]);
      showMessage("Manuscript submitted successfully!");
    } catch (err) {
      console.error("Error submitting form:", err);
      showMessage("Failed to submit form. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <p className="text-center py-10">Loading...</p>;

  return (
    <div className="min-h-screen px-4 md:py-12 lg:py-16 mx-auto max-w-3xl mt-12 bg-white text-[#222] relative">
      <h1 className="text-2xl font-semibold mb-6 text-[#111] text-center">Submit Manuscript</h1>

      {/* Form selection dropdown */}
      <div className="mb-6">
        <label className="block mb-2 font-semibold">Select Form:</label>
        <select
          value={form?.id || ""}
          onChange={(e) => selectForm(e.target.value)}
          className="border p-2 rounded w-full focus:outline-none focus:ring-2 focus:ring-green-400"
        >
          <option value="" disabled>-- Select a Form --</option>
          {forms.map(f => <option key={f.id} value={f.id}>{f.title}</option>)}
        </select>
      </div>

      {!currentUser ? (
        <p className="text-red-500 mt-2 text-sm text-center">You must be signed in to submit the form.</p>
      ) : !form ? (
        <p className="text-center py-10">No form selected.</p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          <h2 className="text-xl font-semibold mb-4 text-center">{form.title}</h2>

          <div className="flex flex-col gap-6">
            {form.questions.map((q, index) => (
              <div key={q.id || index} className="bg-[#e0e0e0] rounded-xl p-4 flex flex-col gap-2">
                {q.type === "coauthors" ? (
                  <>
                    <label htmlFor="coauthor-search" className="block font-semibold mb-2">Co-Authors</label>
                    <input
                      id="coauthor-search"
                      type="text"
                      placeholder="Type name or email to add co-author..."
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                      className="border p-2 w-full rounded mb-2 focus:outline-none focus:ring-2 focus:ring-green-400"
                    />
                    {userSearch && filteredUsers.length > 0 && (
                      <div className="border rounded bg-white max-h-40 overflow-y-auto mb-2">
                        {filteredUsers.map(u => (
                          <div
                            key={u.id}
                            className="p-2 cursor-pointer hover:bg-gray-200 break-words"
                            onClick={() => addUser({ id: u.id, firstName: u.firstName, middleName: u.middleName || "", lastName: u.lastName, email: u.email })}
                          >
                            {formatName(u.firstName, u.middleName, u.lastName)} ({u.email})
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="flex flex-wrap gap-2 mt-2">
                      {selectedUsers.map(u => (
                        <span key={u.id} title={`${u.firstName} ${u.middleName || ""} ${u.lastName}`} className="px-2 py-1 rounded bg-blue-200 text-blue-800 flex items-center gap-1">
                          {formatName(u.firstName, u.middleName, u.lastName)} ({u.email})
                          <button type="button" onClick={() => removeUser(u.id)} className="ml-1 text-blue-600 hover:text-blue-800" aria-label={`Remove ${u.firstName} ${u.lastName}`}>×</button>
                        </span>
                      ))}
                    </div>
                  </>
                ) : q.type === "file" ? (
                  <FileUpload
  id={`question-${index}`}
  name={`question-${index}`}
  onUploadSuccess={(file) => handleChange(index, file)}
  onUploadError={(error) => {
    console.error("Upload failed:", error);
    handleChange(index, null);
    setMessage(error.message || "Failed to upload file.");
  }}
  accept=".doc,.docx"
  buttonText="Upload File"
  uploadingText="Uploading..."
  className="mb-2"
/>

                ) : (
                  <>
                    <label htmlFor={`question-${index}`} className="block font-semibold mb-1">
                      {q.text}{q.required && <span className="text-red-500 ml-1">*</span>}
                    </label>
                    {q.type === "text" && (
                      <input
                        id={`question-${index}`}
                        type="text"
                        value={answers[index] || ""}
                        onChange={(e) => handleChange(index, e.target.value)}
                        className="border p-2 w-full rounded focus:outline-none focus:ring-2 focus:ring-green-400"
                        required={q.required}
                      />
                    )}
                    {q.type === "textarea" && (
                      <textarea
                        id={`question-${index}`}
                        value={answers[index] || ""}
                        onChange={(e) => handleChange(index, e.target.value)}
                        className="border p-2 w-full rounded focus:outline-none focus:ring-2 focus:ring-green-400"
                        rows={4}
                        required={q.required}
                      />
                    )}
                    {["radio","checkbox","select","multiple"].includes(q.type) &&
                      q.options.map((opt, optIndex) => (
                        <div key={opt.id || optIndex} className="flex items-center gap-2">
                          <input
                            id={`question-${index}-${optIndex}`}
                            type={q.type === "checkbox" ? "checkbox" : "radio"}
                            name={`q${index}`}
                            value={opt.value}
                            checked={q.type === "checkbox" ? answers[index]?.includes(opt.value) || false : answers[index] === opt.value}
                            onChange={() => handleChange(index, opt.value, q.type)}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500"
                            required={q.required && optIndex === 0}
                          />
                          <label htmlFor={`question-${index}-${optIndex}`} className="block text-sm font-medium text-gray-700">{opt.value}</label>
                        </div>
                      ))
                    }
                  </>
                )}
              </div>
            ))}
          </div>

            <div className="flex justify-end mt-8">
            <button
              type="submit"
              disabled={!currentUser || cooldown > 0 || loading}
              className={`px-6 py-2 rounded-lg font-medium text-base transition-colors duration-200 ${
                !currentUser || cooldown > 0 || loading ? "bg-gray-400 cursor-not-allowed" : "bg-green-600 hover:bg-green-700 text-white focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
              }`}
              aria-busy={loading}
            >
              {loading ? "Submitting..." : cooldown > 0 ? `Please wait ${cooldown}s` : "Submit Manuscript"}
            </button>
          </div>
        </form>
      )}

      {/* Floating message */}
      {message && messageVisible && (
        <div
          className={`fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 px-6 py-4 rounded-lg shadow-lg z-50 transition-opacity duration-500 ${
            message.toLowerCase().includes("successfully")
              ? "bg-green-100 text-green-700"
              : "bg-red-100 text-red-700"
          }`}
        >
          {message}
        </div>
      )}
    </div>
  );
}