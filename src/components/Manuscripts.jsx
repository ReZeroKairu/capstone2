import React, { useState, useEffect } from "react";
import { db } from "../firebase/firebase";
import { collection, getDocs, query, orderBy, limit } from "firebase/firestore";

const Manuscripts = () => {
  const [responses, setResponses] = useState([]);
  const [filteredResponses, setFilteredResponses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [selectedLabel, setSelectedLabel] = useState("");
  const [searchValue, setSearchValue] = useState("");
  const [labels, setLabels] = useState([]);

  useEffect(() => {
    const fetchResponses = async () => {
      try {
        const q = query(
          collection(db, "forms"), // Updated collection
          orderBy("createdAt", "desc"),
          limit(10)
        );
        const querySnapshot = await getDocs(q);
        let allResponses = [];
        let uniqueLabels = new Set();

        for (const formDoc of querySnapshot.docs) {
          const form = formDoc.data();
          const formId = formDoc.id;
          const responseRef = collection(db, "forms", formId, "responses"); // Updated reference
          const fields = form.fields || [];

          fields.forEach((field) => uniqueLabels.add(field.label));

          const responseSnapshot = await getDocs(responseRef);
          responseSnapshot.forEach((responseDoc) => {
            const responseData = responseDoc.data();

            console.log("Fetched Response Data:", responseData); // Debugging log

            // Ensure responses are properly structured
            const structuredResponses = {};
            fields.forEach((field) => {
              structuredResponses[field.id] = responseData[field.id] || "-";
            });

            allResponses.push({
              formTitle: form.title || "Untitled Manuscript",
              responses: structuredResponses,
              submittedAt:
                responseData.submittedAt
                  ?.toDate?.()
                  ?.toISOString()
                  ?.split("T")[0] || "N/A",
              formFields: fields,
            });
          });
        }

        setLabels(Array.from(uniqueLabels));
        if (allResponses.length === 0) {
          setMessage("No responses found.");
        } else {
          setResponses(allResponses);
          setFilteredResponses(allResponses);
        }
      } catch (error) {
        console.error("Error fetching responses:", error);
        setMessage("Error fetching responses.");
      } finally {
        setLoading(false);
      }
    };

    fetchResponses();
  }, []);

  useEffect(() => {
    let filtered = responses;

    if (selectedLabel && searchValue) {
      filtered = filtered.filter((response) =>
        response.formFields.some(
          (field) =>
            field.label === selectedLabel &&
            response.responses[field.id] &&
            String(response.responses[field.id])
              .toLowerCase()
              .includes(searchValue.toLowerCase())
        )
      );
    }

    setFilteredResponses(filtered);
  }, [selectedLabel, searchValue, responses]);

  return (
    <div className="min-h-screen bg-gray-100 py-32 flex flex-col items-center">
      <div className="max-w-screen-md w-full px-6">
        <h1 className="text-3xl font-bold text-center mb-6">Manuscripts</h1>
        <div className="bg-white p-6 rounded-lg shadow-lg mb-6">
          <select
            value={selectedLabel}
            onChange={(e) => setSelectedLabel(e.target.value)}
            className="p-3 border rounded-lg w-full mb-4"
          >
            <option value="">Select Label</option>
            {labels.map((label, index) => (
              <option key={index} value={label}>
                {label}
              </option>
            ))}
          </select>
          <input
            type="text"
            placeholder="Search by label value..."
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            className="w-full p-3 border rounded-lg"
            disabled={!selectedLabel}
          />
        </div>

        {loading ? (
          <p className="text-center">Loading...</p>
        ) : message ? (
          <p className="text-center text-red-500">{message}</p>
        ) : (
          <div className="flex flex-wrap justify-center gap-6">
            {filteredResponses.map((response, index) => (
              <div
                key={index}
                className="bg-white p-6 rounded-lg shadow-md w-full md:w-2/3"
              >
                <h2 className="text-xl font-semibold mb-2 text-center">
                  {response.formTitle}
                </h2>
                <p className="text-sm text-gray-500 mb-2 text-center">
                  Submitted At: {response.submittedAt}
                </p>
                {response.formFields.map((field) => (
                  <div key={field.id} className="text-sm border-b py-2">
                    <strong>{field.label}:</strong>{" "}
                    {typeof response.responses[field.id] === "object" ? (
                      <pre className="whitespace-pre-wrap text-sm bg-gray-100 p-2 rounded">
                        {JSON.stringify(response.responses[field.id], null, 2)}
                      </pre>
                    ) : (
                      response.responses[field.id]
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Manuscripts;
