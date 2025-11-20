import React, {
  useEffect,
  useState,
  useRef,
  useMemo,
  useCallback,
} from "react";
import { db, auth } from "../../firebase/firebase";
import {
  collection,
  getDocs,
  doc,
  getDoc,
  setDoc,
  addDoc,
  updateDoc,
  serverTimestamp,
  query,
  orderBy,
} from "firebase/firestore";
import { useNotifications } from "../../hooks/useNotifications";
import { useUserLogs } from "../../hooks/useUserLogs";
import FileUpload from "../../components/FileUpload";
import { debounce } from "lodash";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { useNavigate } from "react-router-dom";

export default function SubmitManuscript() {
  const [forms, setForms] = useState([]);
  const [form, setForm] = useState(null);
  const [answers, setAnswers] = useState({});
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isDraftSaving, setIsDraftSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const formDataRef = useRef({ answers: {}, fileData: null });
  const saveTimeoutRef = useRef(null);
  const fileQuestionIndex =
    form?.questions?.findIndex((q) => q.type === "file") ?? -1;
  const [cooldown, setCooldown] = useState(0);

  const [allResearchers, setAllResearchers] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [userSearch, setUserSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(0);
  const questionsPerPage = 5;

  const [monthlyCount, setMonthlyCount] = useState(0);
  const [monthlyLimit, setMonthlyLimit] = useState(6);
  const [isFileUploading, setIsFileUploading] = useState(false);

  const cooldownRef = useRef(0);
  useEffect(() => {
    cooldownRef.current = cooldown;
  }, [cooldown]);

  const [message, setMessage] = useState("");
  const [messageVisible, setMessageVisible] = useState(false);
  const showMessage = (msg) => {
    setMessage(msg);
    setMessageVisible(true);
    setTimeout(() => setMessageVisible(false), 4000);
  };

  const { notifyManuscriptSubmission } = useNotifications();
  const { logManuscriptSubmission } = useUserLogs();

  const getMonthKey = (date = new Date()) => {
    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, "0");
    return `${y}-${m}`;
  };

  // Fetch forms, researchers, and user info
  useEffect(() => {
    const fetchData = async () => {
      try {
        const formsSnap = await getDocs(
          query(collection(db, "forms"), orderBy("createdAt", "desc"))
        );
        const formsList = formsSnap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));
        setForms(formsList);
        if (formsList.length) selectForm(formsList[0].id);

        const usersSnap = await getDocs(collection(db, "Users"));
        setAllResearchers(
          usersSnap.docs
            .map((d) => ({ id: d.id, ...d.data() }))
            .filter((u) => u.role === "Researcher")
        );

        auth.onAuthStateChanged(async (user) => {
          if (!user) {
            setCurrentUser(null);
            setLoading(false);
            return;
          }
          setCurrentUser(user);

          const userSnap = await getDoc(doc(db, "Users", user.uid));
          if (!userSnap.exists()) return showMessage("User record not found.");
          const role = userSnap.data().role || "Researcher";
          setMonthlyLimit(role === "Researcher" ? 6 : Infinity);

          const monthKey = getMonthKey();
          const counterDoc = await getDoc(
            doc(db, `submissionCounters/${user.uid}_${monthKey}`)
          );
          setMonthlyCount(
            counterDoc.exists() ? counterDoc.data().count || 0 : 0
          );

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
      if (!docSnap.exists()) return;

      const questions = (docSnap.data().questions || []).map((q, i) => ({
        ...q,
        options: (q.options || []).map((o, idx) =>
          typeof o === "string"
            ? { id: `${i}-${idx}-${Date.now()}`, value: o }
            : o
        ),
      }));
      setForm({ id: docSnap.id, ...docSnap.data(), questions });

      setSelectedUsers(
        docSnap.data().coAuthors?.map((c) => ({
          id: c.id,
          firstName: c.firstName,
          middleName: c.middleName || "",
          lastName: c.lastName,
          email: c.email,
        })) || []
      );
      setAnswers({});
      setCurrentPage(0);
    } catch (err) {
      console.error("Error selecting form:", err);
      showMessage("Failed to load selected form.");
    }
  };

  const handlePageChange = (newPage) => {
    setCurrentPage(newPage);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const filteredUsers = useMemo(() => {
    if (!userSearch.trim()) return [];
    const term = userSearch.toLowerCase();
    return allResearchers.filter(
      (u) =>
        (u.firstName?.toLowerCase().includes(term) ||
          u.lastName?.toLowerCase().includes(term) ||
          u.middleName?.toLowerCase().includes(term) ||
          (u.email || "").toLowerCase().includes(term)) &&
        !selectedUsers.some((su) => su.id === u.id)
    );
  }, [userSearch, selectedUsers, allResearchers]);

  useEffect(() => {
    if (!cooldown) return;
    const timer = setInterval(
      () =>
        setCooldown((prev) => {
          cooldownRef.current = Math.max(prev - 1, 0);
          return Math.max(prev - 1, 0);
        }),
      1000
    );
    return () => clearInterval(timer);
  }, [cooldown]);

  const handleChange = (index, value, type) => {
    setAnswers((prevAnswers) => {
      if (type === "checkbox") {
        const prev = prevAnswers[index] || [];
        return {
          ...prevAnswers,
          [index]: prev.includes(value)
            ? prev.filter((v) => v !== value)
            : [...prev, value],
        };
      }
      return { ...prevAnswers, [index]: value };
    });
  };

  const addUser = (user) => {
    if (!selectedUsers.some((u) => u.id === user.id))
      setSelectedUsers([...selectedUsers, user]);
    setUserSearch("");
  };
  const removeUser = (id) =>
    setSelectedUsers(selectedUsers.filter((u) => u.id !== id));
  const formatName = (first, middle, last) =>
    `${first || ""} ${middle ? middle.charAt(0) + ". " : ""}${
      last || ""
    }`.trim();

  // Check if user's profile is complete
  const isProfileComplete = async (userId) => {
    try {
      // Always check Firestore for the latest data
      const userDoc = await getDoc(doc(db, "Users", userId));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        
        // Basic required fields for all users
        const basicRequiredFields = [
          'firstName', 'lastName', 'email', 'phone', 'department'
        ];
        
        // Role-specific required fields
        const roleSpecificFields = {
          'Researcher': ['institution', 'fieldOfStudy', 'researchInterests'],
          'Peer Reviewer': ['affiliation', 'specialty', 'expertise']
        };

        const role = userData.role || 'Researcher';
        const allRequiredFields = [
          ...basicRequiredFields,
          ...(roleSpecificFields[role] || [])
        ];

        // Check all required fields are present and non-empty
        return allRequiredFields.every(field => {
          const value = userData[field];
          return value !== undefined && 
                 value !== null && 
                 (typeof value !== 'string' || value.trim() !== '');
        });
      }
      return false;
    } catch (error) {
      console.error('Error checking profile completion:', error);
      return false;
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (loading) return; // Prevent multiple submissions
    
    setLoading(true);
    
    try {
      // Check if profile is complete
      const profileComplete = await isProfileComplete(currentUser.uid);
      if (!profileComplete) {
        alert('Please complete your profile before submitting a manuscript. All required fields must be filled out.');
        navigate('/profile');
        return;
      }

      // Clear the draft on successful submission
      localStorage.removeItem("manuscriptDraft");
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      if (!form) {
        showMessage("No form selected.");
        setLoading(false);
        return;
      }
      if (cooldownRef.current > 0) {
        showMessage(`You already submitted. Please wait ${cooldownRef.current}s.`);
        setLoading(false);
        return;
      }
      
      if (!currentUser) {
        showMessage("User not signed in.");
        setLoading(false);
        return;
      }
      
      if (monthlyCount >= monthlyLimit) {
        showMessage(`Monthly submission limit of ${monthlyLimit} reached.`);
        setLoading(false);
        return;
      }

      const fileQuestionIndex = form.questions.findIndex(
        (q) => q.type === "file"
      );
      const fileData = answers[fileQuestionIndex];
      if (fileQuestionIndex === -1 || !fileData) {
        showMessage("Please upload a manuscript file.");
        setLoading(false);
        return;
      }
      if (![
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ].includes(fileData.type)) {
        showMessage("Only Word documents (.doc or .docx) are allowed.");
        setLoading(false);
        return;
      }

      const missingRequired = form.questions.some((q, i) =>
        q.required
          ? q.type === "checkbox"
            ? !(answers[i]?.length > 0)
            : !answers[i]
          : false
      );
      if (missingRequired) {
        showMessage("Please fill all required fields.");
        setLoading(false);
        return;
      }

      const manuscriptTitleIndex = form.questions.findIndex(
        (q) => q.isManuscriptTitle
      );
      if (manuscriptTitleIndex === -1) {
        showMessage("Form must have a 'Manuscript Title' field.");
        setLoading(false);
        return;
      }
      const manuscriptTitleAnswer = answers[manuscriptTitleIndex] || "";
      if (!manuscriptTitleAnswer.trim()) {
        showMessage("Please enter a Manuscript Title.");
        setLoading(false);
        return;
      }

      // If we got here, all validations passed
      const userSnap = await getDoc(doc(db, "Users", currentUser.uid));
      if (!userSnap.exists()) {
        showMessage("User record not found.");
        return;
      }
      const userInfo = userSnap.data();
      const initialStatus = "Pending";

      const exactStoragePath = fileData.storagePath;
      const downloadURL = fileData.url;

      const answeredQuestions = form.questions.map((q, i) => {
        if (q.type === "coauthors")
          return {
            question: "Co-Authors",
            type: "coauthors",
            required: q.required || false,
            answer: selectedUsers.map(
              (u) =>
                `${formatName(u.firstName, u.middleName, u.lastName)} (${
                  u.email
                })`
            ),
          };
        if (q.type === "file")
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
        return {
          question: q.text,
          type: q.type,
          required: q.required || false,
          answer: q.type === "checkbox" ? answers[i] || [] : answers[i] || "",
        };
      });

      const coAuthors = selectedUsers.map((u) => ({
        id: u.id,
        firstName: u.firstName,
        middleName: u.middleName || "",
        lastName: u.lastName,
        email: u.email,
      }));
      const coAuthorsIds = selectedUsers.map((u) => u.id);

      const searchIndex = [
        (userInfo.email || "").toLowerCase(),
        `${userInfo.firstName || ""} ${userInfo.middleName || ""} ${
          userInfo.lastName || ""
        }`
          .trim()
          .toLowerCase(),
        manuscriptTitleAnswer.toLowerCase(),
        ...selectedUsers.map((u) => (u.email || "").toLowerCase()),
        ...selectedUsers.map((u) =>
          `${u.firstName || ""} ${u.middleName || ""} ${u.lastName || ""}`
            .trim()
            .toLowerCase()
        ),
      ].filter(Boolean);

      setCooldown(5);
      cooldownRef.current = 5;

      // Create submission history entry for the initial submission
      const initialSubmission = {
        versionNumber: 1,
        submittedAt: new Date(), // Use client-side date for the initial submission
        fileUrl: downloadURL,
        fileName: fileData.name,
        fileType: fileData.type,
        fileSize: fileData.size,
        storagePath: exactStoragePath,
        revisionNotes: "Initial submission",
        status: initialStatus,
      };

      // Add manuscript to the manuscripts collection
      const manuscriptRef = await addDoc(collection(db, "manuscripts"), {
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
        submissionHistory: [initialSubmission],
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

      const monthKey = getMonthKey();
      const counterRef = doc(
        db,
        `submissionCounters/${currentUser.uid}_${monthKey}`
      );
      await updateDoc(counterRef, { count: monthlyCount + 1 }).catch(
        async () =>
          await setDoc(counterRef, {
            count: 1,
            uid: currentUser.uid,
            month: monthKey,
          })
      );
      setMonthlyCount((prev) => prev + 1);

      await notifyManuscriptSubmission(
        manuscriptRef.id,
        manuscriptTitleAnswer || form.title || "Untitled Manuscript",
        currentUser.uid
      );
      await logManuscriptSubmission(
        currentUser.uid,
        manuscriptRef.id,
        manuscriptTitleAnswer || form.title || "Untitled Manuscript"
      );

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

  // Track last saved draft content
  const lastSavedDraft = useRef(null);

  // Save draft to localStorage
  const saveDraft = useCallback(() => {
    if (loading) return;

    const currentDraft = {
      answers,
      fileData: fileQuestionIndex >= 0 ? answers[fileQuestionIndex] : null,
      formId: form?.id,
    };

    // Only save if there are actual changes
    const currentDraftStr = JSON.stringify(currentDraft);
    if (lastSavedDraft.current === currentDraftStr) {
      return; // No changes, don't save
    }

    const draftData = {
      ...currentDraft,
      timestamp: new Date().toISOString(),
    };

    lastSavedDraft.current = currentDraftStr;
    localStorage.setItem("manuscriptDraft", JSON.stringify(draftData));
    setLastSaved(new Date());
    setIsDraftSaving(false);

    // Only show toast if not the initial load
    if (lastSavedDraft.current !== null) {
      toast.info("Draft saved", { autoClose: 2000 });
    }
  }, [answers, fileQuestionIndex, form?.id, loading]);

  // Memoize the debounced save function
  const debouncedSave = useMemo(
    () =>
      debounce(() => {
        if (!loading) {
          saveDraft();
        }
      }, 10000),
    [saveDraft, loading]
  );

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      debouncedSave.cancel();
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [debouncedSave]);

  // Load draft when form loads
  useEffect(() => {
    if (!form?.id) return;

    const loadDraft = () => {
      try {
        const savedDraft = localStorage.getItem("manuscriptDraft");
        if (!savedDraft) return;

        const draft = JSON.parse(savedDraft);
        if (draft.formId === form.id) {
          // Only update state if there are actual changes
          setAnswers((prev) => {
            // Skip if answers are the same
            if (JSON.stringify(prev) === JSON.stringify(draft.answers || {})) {
              return prev;
            }
            return draft.answers || {};
          });

          // Restore file data if exists
          if (draft.fileData) {
            const fileQIndex = form.questions.findIndex(
              (q) => q.type === "file"
            );
            if (fileQIndex >= 0) {
              setAnswers((prev) => ({
                ...prev,
                [fileQIndex]: draft.fileData,
              }));
            }
          }

          toast.info("Draft restored", { autoClose: 3000 });
          setLastSaved(new Date(draft.timestamp));
        }
      } catch (error) {
        console.error("Error loading draft:", error);
      }
    };

    loadDraft();

    // Auto-save interval
    const autoSaveInterval = setInterval(() => {
      if (
        Object.keys(answers).length > 0 ||
        (fileQuestionIndex >= 0 && answers[fileQuestionIndex])
      ) {
        saveDraft();
      }
    }, 30000); // Auto-save every 30 seconds

    return () => {
      clearInterval(autoSaveInterval);
    };
  }, [form?.id]); // Removed saveDraft and answers from dependencies

  // Auto-save on changes with debounce and change detection
  useEffect(() => {
    const hasAnswers = Object.keys(answers).length > 0;
    const hasFileData = fileQuestionIndex >= 0 && answers[fileQuestionIndex]?.file;
    const hasChanges = hasAnswers || hasFileData;

    if (hasChanges && !loading) {
      // Only set saving state if there are actual changes
      const currentDraft = {
        answers,
        fileData: fileQuestionIndex >= 0 ? answers[fileQuestionIndex] : null,
        formId: form?.id,
      };
      
      if (lastSavedDraft.current !== JSON.stringify(currentDraft)) {
        setIsDraftSaving(true);
        debouncedSave();
      }
    }

    return () => {
      debouncedSave.cancel();
    };
  }, [answers, fileQuestionIndex, debouncedSave, loading, form?.id]);

  if (loading) return <p className="text-center py-10">Loading...</p>;

  return (
    <div className="min-h-screen px-4 md:py-12 lg:py-16 mx-auto max-w-3xl mt-12 bg-white text-[#222] relative">
      <ToastContainer
        position="top-right"
        autoClose={3000}
        hideProgressBar={false}
        newestOnTop
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
      />
      <h1 className="text-2xl font-semibold mb-6 text-[#111] text-center">
        Submit Manuscript
      </h1>

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

      {!currentUser ? (
        <p className="text-red-500 mt-2 text-sm text-center">
          You must be signed in to submit the form.
        </p>
      ) : !form ? (
        <p className="text-center py-10">No form selected.</p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          <h2 className="text-xl font-semibold mb-4 text-center">
            {form.title}
          </h2>
          <div className="flex flex-col gap-6">
            {form.questions
              .slice(
                currentPage * questionsPerPage,
                (currentPage + 1) * questionsPerPage
              )
              .map((q, index) => {
                const globalIndex = currentPage * questionsPerPage + index;
                const renderOptions = () => {
                  if (q.type === 'select') {
                    return (
                      <select
                        value={answers[globalIndex] || ''}
                        onChange={(e) => handleChange(globalIndex, e.target.value, 'select')}
                        className="mt-1 block w-full border border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                        required={q.required}
                      >
                        <option value="">-- Select an option --</option>
                        {q.options.map((opt) => (
                          <option key={opt.id || opt.value} value={opt.value}>
                            {opt.value}
                          </option>
                        ))}
                      </select>
                    );
                  }
                  
                  return q.options.map((opt, optIndex) => (
                    <div
                      key={opt.id || optIndex}
                      className="flex items-center gap-2"
                    >
                      <input
                        id={`question-${globalIndex}-${optIndex}`}
                        type={q.type === "checkbox" ? "checkbox" : "radio"}
                        name={`q${globalIndex}`}
                        value={opt.value}
                        checked={
                          q.type === "checkbox"
                            ? answers[globalIndex]?.includes(opt.value) || false
                            : answers[globalIndex] === opt.value
                        }
                        onChange={() =>
                          handleChange(globalIndex, opt.value, q.type)
                        }
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500"
                        required={q.required && optIndex === 0}
                      />
                      <label
                        htmlFor={`question-${globalIndex}-${optIndex}`}
                        className="block text-sm font-medium text-gray-700"
                      >
                        {opt.value}
                      </label>
                    </div>
                  ));
                };
                
                return (
                  <div
                    key={q.id || globalIndex}
                    className="bg-[#e0e0e0] rounded-xl p-4 flex flex-col gap-2"
                  >
                    {q.type === "coauthors" ? (
                      <>
                        <label
                          htmlFor="coauthor-search"
                          className="block font-semibold mb-2"
                        >
                          Co-Authors
                        </label>
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
                            {filteredUsers.map((u) => (
                              <div
                                key={u.id}
                                className="p-2 cursor-pointer hover:bg-gray-200 break-words"
                                onClick={() => addUser(u)}
                              >
                                {formatName(
                                  u.firstName,
                                  u.middleName,
                                  u.lastName
                                )}{" "}
                                ({u.email})
                              </div>
                            ))}
                          </div>
                        )}
                        <div className="flex flex-wrap gap-2 mt-2">
                          {selectedUsers.map((u) => (
                            <span
                              key={u.id}
                              title={`${u.firstName} ${u.middleName || ""} ${
                                u.lastName
                              }`}
                              className="px-2 py-1 rounded bg-blue-200 text-blue-800 flex items-center gap-1"
                            >
                              {formatName(
                                u.firstName,
                                u.middleName,
                                u.lastName
                              )}{" "}
                              ({u.email})
                              <button
                                type="button"
                                onClick={() => removeUser(u.id)}
                                className="ml-1 text-blue-600 hover:text-blue-800"
                                aria-label={`Remove ${u.firstName} ${u.lastName}`}
                              >
                                ×
                              </button>
                            </span>
                          ))}
                        </div>
                      </>
                    ) : q.type === "file" ? (
                      <div className="mb-2">
                        <label className="block font-semibold mb-1">
                          {q.text}
                          {q.required && (
                            <span className="text-red-500 ml-1">*</span>
                          )}
                        </label>
                        <FileUpload
                          id={`question-${globalIndex}`}
                          name={`question-${globalIndex}`}
                          onUploadSuccess={(file) =>
                            handleChange(globalIndex, file)
                          }
                          onUploadError={(error) => {
                            console.error("Upload failed:", error);
                            showMessage("Failed to upload file: " + (error?.message || "Unknown error"));
                            setIsFileUploading(false);
                          }}
                          onUploadStart={() => setIsFileUploading(true)}
                          onUploadComplete={() => setIsFileUploading(false)}
                          accept=".doc,.docx"
                          buttonText="Upload File"
                          uploadingText="Uploading..."
                          className="mb-0"
                        />
                      </div>
                    ) : (
                      <>
                        <label
                          htmlFor={`question-${globalIndex}`}
                          className="block font-semibold mb-1"
                        >
                          {q.text}
                          {q.required && (
                            <span className="text-red-500 ml-1">*</span>
                          )}
                        </label>
                        {q.type === "text" && (
                          <input
                            id={`question-${globalIndex}`}
                            type="text"
                            value={answers[globalIndex] || ""}
                            onChange={(e) =>
                              handleChange(globalIndex, e.target.value)
                            }
                            className="border p-2 w-full rounded focus:outline-none focus:ring-2 focus:ring-green-400"
                            required={q.required}
                          />
                        )}
                        {q.type === "textarea" && (
                          <textarea
                            id={`question-${globalIndex}`}
                            value={answers[globalIndex] || ""}
                            onChange={(e) =>
                              handleChange(globalIndex, e.target.value)
                            }
                            className="border p-2 w-full rounded focus:outline-none focus:ring-2 focus:ring-green-400"
                            rows={4}
                            required={q.required}
                          />
                        )}
                        {["radio", "checkbox", "select", "multiple"].includes(
                          q.type
                        ) && renderOptions()}
                      </>
                    )}
                  </div>
                );
              })}
          </div>

          {form.questions.length > questionsPerPage && (
            <div className="flex justify-between items-center mt-4">
              <button
                type="button"
                onClick={() => handlePageChange(Math.max(currentPage - 1, 0))}
                disabled={
                  currentPage === 0 || form.questions.length <= questionsPerPage
                }
                className={`px-4 py-2 rounded-lg ${
                  currentPage === 0
                    ? "bg-gray-300 cursor-not-allowed"
                    : "bg-[#6B6B6B] text-white"
                }`}
              >
                Previous
              </button>
              <span className="text-base font-medium">
                Page {currentPage + 1} of{" "}
                {Math.ceil(form.questions.length / questionsPerPage)}
              </span>
              <button
                type="button"
                onClick={() =>
                  handlePageChange(
                    Math.min(
                      currentPage + 1,
                      Math.ceil(form.questions.length / questionsPerPage) - 1
                    )
                  )
                }
                disabled={
                  currentPage >=
                    Math.ceil(form.questions.length / questionsPerPage) - 1 ||
                  form.questions.length <= questionsPerPage
                }
                className={`px-4 py-2 rounded-lg ${
                  currentPage >=
                  Math.ceil(form.questions.length / questionsPerPage) - 1
                    ? "bg-gray-300 cursor-not-allowed"
                    : "bg-[#6B6B6B] text-white"
                }`}
              >
                Next
              </button>
            </div>
          )}

          <div className="flex flex-col items-end mt-8 space-y-2">
            <div className="flex items-center">
              <button
                type="submit"
                disabled={
                  !currentUser ||
                  cooldown > 0 ||
                  loading ||
                  monthlyCount >= monthlyLimit ||
                  isFileUploading
                }
                className={`px-6 py-2 rounded-lg font-medium text-base transition-colors duration-200 ${
                  !currentUser ||
                  cooldown > 0 ||
                  loading ||
                  monthlyCount >= monthlyLimit ||
                  isFileUploading
                    ? "bg-gray-400 cursor-not-allowed"
                    : "bg-green-600 hover:bg-green-700 text-white focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
                }`}
                aria-busy={loading}
              >
                {loading ? "Submitting..." : "Submit Manuscript"}
              </button>
            </div>
            {isFileUploading && (
              <div className="text-sm text-amber-600 flex items-center">
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-amber-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Please wait while your file finishes uploading...
              </div>
            )}
          </div>

       
        </form>
      )}

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
