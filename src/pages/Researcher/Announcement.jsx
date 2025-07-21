import React, { useState, useEffect } from "react";
import { db } from "../../firebase/firebase";
import {
  collection,
  getDocs,
  query,
  orderBy,
  limit,
  doc,
  setDoc,
} from "firebase/firestore";

const SubmitManuscript = () => {
  const [latestForm, setLatestForm] = useState(null);
  const [responses, setResponses] = useState({});
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [formSubmitted, setFormSubmitted] = useState(false);

  useEffect(() => {
    const fetchLatestForm = async () => {
      try {
        const q = query(
          collection(db, "forms"),
          orderBy("createdAt", "desc"),
          limit(1)
        );
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
          const formDoc = querySnapshot.docs[0];
          setLatestForm({ ...formDoc.data(), id: formDoc.id });
        } else {
          setMessage("No forms found.");
        }
      } catch (error) {
        console.error("Error fetching latest form:", error);
        setMessage("Error fetching form.");
      } finally {
        setLoading(false);
      }
    };

    fetchLatestForm();
  }, []);

  const handleInputChange = (fieldId, value, label) => {
    setResponses((prevResponses) => ({
      ...prevResponses,
      [fieldId]: { value, label },
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const isConfirmed = window.confirm(
      "Are you sure you want to submit the form?"
    );

    if (!isConfirmed) {
      return;
    }

    if (!latestForm?.id) {
      setMessage("Form ID is missing.");
      return;
    }

    try {
      const formData = {
        userId: "anonymous",
        responses: {},
        submittedAt: new Date(),
      };

      latestForm?.fields.forEach((field) => {
        if (responses[field.id]) {
          formData.responses[field.label] = responses[field.id].value;
        }
      });

      const formRef = doc(db, "forms", latestForm.id);
      const responsesRef = collection(formRef, "responses");

      await setDoc(doc(responsesRef), formData);
      console.log("Form submitted:", formData);

      setFormSubmitted(true);
      setMessage("Your response has been submitted.");
    } catch (error) {
      console.error("Error submitting form:", error);
      setMessage("Error submitting form.");
    }
  };

  const handleReset = () => {
    setResponses({});
    setFormSubmitted(false);
    setMessage("");
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="flex flex-col min-h-screen">
      <header className="bg-blue-500 text-white py-4 shadow-md">
        <div className="container mx-auto px-4">
          <h1 className="text-xl font-bold">Form</h1>
        </div>
      </header>

      <main className="flex-1 flex justify-center items-center py-12 bg-gray-100">
        <div className="w-full max-w-2xl bg-white shadow-md rounded-lg p-6">
          <h1 className="text-2xl font-bold mb-4">{latestForm?.title}</h1>
          {formSubmitted ? (
            <div className="mb-4 text-green-600">
              <p>{message}</p>
              <p>Would you like to fill out the form again?</p>
              <button
                onClick={handleReset}
                className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 mt-2"
              >
                Fill Again
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              {latestForm?.fields.map((field) => (
                <div key={field.id} className="mb-4">
                  <label className="block text-lg font-medium">
                    {field.label}
                  </label>
                  <input
                    type={field.type}
                    required={field.required}
                    value={responses[field.id]?.value || ""}
                    onChange={(e) =>
                      handleInputChange(field.id, e.target.value, field.label)
                    }
                    className="w-full p-2 border border-gray-300 rounded"
                    placeholder={field.placeholder}
                  />
                </div>
              ))}
              <button
                type="submit"
                className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
              >
                Submit
              </button>
            </form>
          )}
        </div>
      </main>
    </div>
  );
};

export default SubmitManuscript;
