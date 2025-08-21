import { useEffect, useState } from "react";
import { db } from "../../firebase/firebase";
import { collection, getDocs, updateDoc, doc } from "firebase/firestore";

const FILTERS = ["All", "Pending", "Overdue", "Completed"];

export default function Deadlines() {
  const [reviewers, setReviewers] = useState([]);
  const [manuscripts, setManuscripts] = useState([]);
  const [selectedFilter, setSelectedFilter] = useState("All");

  useEffect(() => {
    const fetchData = async () => {
      try {
        const usersSnap = await getDocs(collection(db, "Users"));
        const allUsers = usersSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
        const reviewersOnly = allUsers.filter(
          (u) => u.role === "Peer Reviewer"
        );

        const msSnap = await getDocs(collection(db, "manuscripts"));
        const allMss = msSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

        setReviewers(reviewersOnly);
        setManuscripts(allMss);
      } catch (err) {
        console.error("Error fetching data:", err);
      }
    };
    fetchData();
  }, []);

  const getProgress = (assignedAt) => {
    if (!assignedAt) return { deadline: "N/A", percent: 0 };
    const start = new Date(assignedAt.seconds * 1000);
    const end = new Date(start);
    end.setMonth(end.getMonth() + 3);
    const now = new Date();
    const totalTime = end - start;
    const elapsed = now - start;
    const percent = Math.min(Math.max((elapsed / totalTime) * 100, 0), 100);
    return { deadline: end.toLocaleDateString(), percent };
  };

  const markCompleted = async (manuscriptId, reviewerId) => {
    try {
      const msRef = doc(db, "manuscripts", manuscriptId);
      const selected = manuscripts.find((m) => m.id === manuscriptId);

      const updatedAssigned = (selected.assignedReviewers || []).filter(
        (id) => id !== reviewerId
      );
      const newStatus =
        updatedAssigned.length === 0 ? "Back to Admin" : selected.status;

      await updateDoc(msRef, {
        assignedReviewers: updatedAssigned,
        status: newStatus,
      });

      setManuscripts((prev) =>
        prev.map((m) =>
          m.id === manuscriptId
            ? { ...m, assignedReviewers: updatedAssigned, status: newStatus }
            : m
        )
      );
    } catch (err) {
      console.error("Error marking review completed:", err);
    }
  };

  const filterManuscripts = (msList) => {
    if (selectedFilter === "All") return msList;
    if (selectedFilter === "Completed") {
      // Show only Back to Admin manuscripts
      return msList.filter((m) => m.status === "Back to Admin");
    }
    return msList.filter((m) => {
      if (selectedFilter === "Pending") return m.assignedReviewers?.length > 0;
      if (selectedFilter === "Overdue") {
        const { percent } = getProgress(m.assignedAt || m.submittedAt);
        return percent >= 100;
      }
      return true;
    });
  };

  return (
    <div className="pt-28 px-10 pb-24">
      <h1 className="text-2xl sm:text-3xl font-bold mb-6">
        Peer Reviewer Deadlines
      </h1>

      <div className="flex gap-2 mb-6 flex-wrap">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setSelectedFilter(f)}
            className={`px-4 py-2 rounded text-sm font-semibold ${
              selectedFilter === f
                ? "bg-green-500 text-white"
                : "bg-gray-200 text-gray-700 hover:bg-gray-300"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {selectedFilter === "Completed" ? (
        // Show all Back to Admin manuscripts here
        <ul className="space-y-6">
          {filterManuscripts(manuscripts).map((m) => (
            <li key={m.id} className="p-4 border rounded bg-white shadow-sm">
              <p>
                <strong>{m.title || m.formTitle}</strong> - Status: {m.status}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        // Show reviewer-based lists for other tabs
        <ul className="space-y-6">
          {reviewers
            .map((r) => {
              const assignedManuscripts = filterManuscripts(
                manuscripts.filter((m) => m.assignedReviewers?.includes(r.id))
              );
              return { reviewer: r, assignedManuscripts };
            })
            .filter((entry) => entry.assignedManuscripts.length > 0)
            .map(({ reviewer, assignedManuscripts }) => (
              <li
                key={reviewer.id}
                className="p-4 border rounded flex flex-col gap-3 bg-white shadow-sm"
              >
                <div>
                  <p className="font-semibold">
                    {reviewer.firstName} {reviewer.lastName} ({reviewer.email})
                  </p>
                  <p className="text-sm text-gray-600">
                    Assigned Manuscripts: {assignedManuscripts.length}
                  </p>
                </div>

                <ul className="ml-4 mt-2 space-y-2">
                  {assignedManuscripts.map((m) => {
                    const { deadline, percent } = getProgress(
                      m.assignedAt || m.submittedAt
                    );
                    const isOverdue = percent >= 100;
                    return (
                      <li key={m.id} className="text-sm flex flex-col gap-1">
                        <div className="flex justify-between items-center">
                          <span>
                            <strong>{m.title || m.formTitle}</strong> - Status:{" "}
                            {m.status} - Deadline: {deadline}
                          </span>
                          <button
                            onClick={() => markCompleted(m.id, reviewer.id)}
                            className="px-2 py-1 bg-green-500 text-white rounded hover:bg-green-600 text-xs"
                          >
                            Mark Completed
                          </button>
                        </div>
                        <div className="w-full bg-gray-200 h-2 rounded mt-1">
                          <div
                            className={`h-2 rounded ${
                              isOverdue ? "bg-red-500" : "bg-blue-500"
                            }`}
                            style={{ width: `${Math.min(percent, 100)}%` }}
                          />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </li>
            ))}
        </ul>
      )}
    </div>
  );
}
