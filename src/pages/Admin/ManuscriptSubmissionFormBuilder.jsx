import React, { useState, useEffect } from "react";
import { db } from "../../firebase/firebase";
import {
  collection,
  addDoc,
  getDocs,
  getDoc,
  doc,
  query,
  orderBy,
  limit,
} from "firebase/firestore";
import { useAuth } from "../../authcontext/AuthContext";
import { v4 as uuidv4 } from "uuid";

const ManuscriptSubmissionFormBuilder = () => {
  const { currentUser } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [formTitle, setFormTitle] = useState("");
  const [formFields, setFormFields] = useState([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [latestForm, setLatestForm] = useState(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  useEffect(() => {
    const checkAdmin = async () => {
      if (currentUser?.uid) {
        try {
          const userDoc = await getDoc(doc(db, "Users", currentUser.uid));
          const userData = userDoc.data();
          setIsAdmin(userData?.role === "Admin");
        } catch (error) {
          console.error("Error checking admin status:", error);
        }
      }
    };
    checkAdmin();

    const fetchLatestForm = async () => {
      try {
        const q = query(
          collection(db, "forms"),
          orderBy("createdAt", "desc"),
          limit(1)
        );
        const querySnapshot = await getDocs(q);
        querySnapshot.forEach((doc) => {
          const formData = doc.data();
          setLatestForm(formData);
          setFormTitle(formData.title); // Set the form title to the latest form title
          setFormFields(formData.fields); // Set form fields to the latest form fields
        });
      } catch (error) {
        console.error("Error fetching latest form:", error);
      }
    };

    fetchLatestForm();
  }, [currentUser]);

  const addField = () => {
    const newField = {
      id: uuidv4(),
      label: "",
      placeholder: "",
      type: "text",
      required: true,
    };
    setFormFields((prevFields) => [...prevFields, newField]);
  };

  const updateField = (id, key, value) => {
    setFormFields((prevFields) =>
      prevFields.map((field) =>
        field.id === id ? { ...field, [key]: value } : field
      )
    );
  };

  const removeField = (id) => {
    setFormFields((prevFields) =>
      prevFields.filter((field) => field.id !== id)
    );
  };

  // Function to check if the form has changes compared to the latest saved form
  const hasChanges = () => {
    if (!latestForm) return true; // If no latest form, we assume changes have been made

    const fieldsChanged =
      formFields.length !== latestForm.fields.length ||
      formFields.some(
        (field, index) =>
          field.label !== latestForm.fields[index]?.label ||
          field.placeholder !== latestForm.fields[index]?.placeholder ||
          field.required !== latestForm.fields[index]?.required ||
          field.type !== latestForm.fields[index]?.type
      );

    return formTitle !== latestForm.title || fieldsChanged;
  };

  const saveForm = async () => {
    if (!formTitle.trim()) {
      setMessage("Please provide a form title.");
      return;
    }
    if (formFields.length === 0) {
      setMessage("Add at least one field before saving.");
      return;
    }

    if (!hasChanges()) {
      setMessage("No changes to save.");
      return; // Don't save if there are no changes
    }

    setLoading(true);
    setMessage("");
    try {
      const formData = {
        title: formTitle.trim(),
        fields: formFields.map((field) => ({
          id: field.id,
          label: field.label.trim(),
          placeholder: field.placeholder.trim(),
          required: field.required,
          type: field.type,
        })),
        createdAt: new Date(),
      };

      // Save the form to Firestore
      await addDoc(collection(db, "forms"), formData);

      // Retrieve and set the latest form after saving
      const q = query(
        collection(db, "forms"),
        orderBy("createdAt", "desc"),
        limit(1)
      );
      const querySnapshot = await getDocs(q);
      querySnapshot.forEach((doc) => {
        const formData = doc.data();
        setLatestForm(formData);
        setFormTitle(formData.title); // Set the form title to the latest form title
        setFormFields(formData.fields); // Set form fields to the latest form fields
      });

      setMessage("Form saved and updated successfully!");
      setFormTitle("");
      setFormFields([]);
    } catch (error) {
      console.error("Error saving form:", error);
      setMessage("An error occurred while saving the form.");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmSave = () => {
    setShowConfirmModal(true);
  };

  const handleCloseModal = () => {
    setShowConfirmModal(false);
  };

  const handleSaveWithConfirmation = () => {
    saveForm();
    setShowConfirmModal(false);
  };

  if (!isAdmin) {
    return (
      <div className="flex justify-center items-center h-screen">
        <p className="text-red-500 text-xl">Access denied. Admins only.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen">
      <header className="bg-blue-500 text-white py-4 shadow-md">
        <div className="container mx-auto px-4">
          <h1 className="text-xl font-bold">Admin Dashboard</h1>
        </div>
      </header>

      <main className="flex-1 flex justify-center items-center py-12 bg-gray-100">
        <div className="w-full max-w-2xl bg-white shadow-md rounded-lg p-6">
          <h1 className="text-2xl font-bold mb-4">Create a New Form</h1>
          <input
            type="text"
            value={formTitle}
            onChange={(e) => setFormTitle(e.target.value)}
            placeholder="Enter form title"
            className="w-full mb-4 p-2 border border-gray-300 rounded"
          />
          <button
            onClick={addField}
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 mb-4"
          >
            Add Field
          </button>
          <div>
            {formFields.map((field) => (
              <div
                key={field.id}
                className="flex flex-col mb-4 border-b border-gray-200 pb-4"
              >
                <input
                  type="text"
                  value={field.label}
                  onChange={(e) =>
                    updateField(field.id, "label", e.target.value)
                  }
                  placeholder="Field Label"
                  className="w-full mb-2 p-2 border border-gray-300 rounded"
                />

                <div className="flex justify-between items-center">
                  <select
                    value={field.type}
                    onChange={(e) =>
                      updateField(field.id, "type", e.target.value)
                    }
                    className="border border-gray-300 rounded p-2"
                  >
                    <option value="text">Text</option>
                    <option value="email">Email</option>
                    <option value="number">Number</option>
                  </select>
                  <button
                    onClick={() =>
                      updateField(field.id, "required", !field.required)
                    }
                    className={`px-4 py-2 rounded ${
                      field.required ? "bg-green-500" : "bg-gray-300"
                    } text-white`}
                  >
                    {field.required ? "Required" : "Optional"}
                  </button>

                  <button
                    onClick={() => removeField(field.id)}
                    className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
          <button
            onClick={handleConfirmSave}
            className={`w-full mt-4 px-4 py-2 rounded text-white ${
              loading ? "bg-gray-400" : "bg-green-500 hover:bg-green-600"
            }`}
            disabled={loading}
          >
            {loading ? "Saving..." : "Save Form"}
          </button>
          {message && (
            <p className="mt-4 text-center text-blue-600">{message}</p>
          )}
        </div>
      </main>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center">
          <div className="bg-white p-6 rounded shadow-lg w-96">
            <h2 className="text-xl font-bold mb-4">
              Are you sure you want to save this form?
            </h2>
            <div className="flex justify-end">
              <button
                onClick={handleSaveWithConfirmation}
                className="bg-green-500 text-white px-4 py-2 rounded mr-2"
              >
                Yes, Save
              </button>
              <button
                onClick={handleCloseModal}
                className="bg-red-500 text-white px-4 py-2 rounded"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManuscriptSubmissionFormBuilder;
