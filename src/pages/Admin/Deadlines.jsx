import { useEffect, useState } from "react";
import { db } from "../../firebase/firebase";
import { collection, getDocs, updateDoc, doc, deleteField } from "firebase/firestore";
import SetDeadlineModal from "../../components/SetDeadlineModal";
import { getDeadlineColor, getRemainingTime } from "../../utils/deadlineUtils";

const FILTERS = ["All", "Pending", "Overdue", "Completed"];

export default function Deadlines() {
  const [reviewers, setReviewers] = useState([]);
  const [manuscripts, setManuscripts] = useState([]);
  const [selectedFilter, setSelectedFilter] = useState("All");
  const [modalOpen, setModalOpen] = useState(false);
  const [modalManuscriptId, setModalManuscriptId] = useState(null);
  const [modalReviewerId, setModalReviewerId] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const usersSnap = await getDocs(collection(db, "Users"));
        const allUsers = usersSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
        const reviewersOnly = allUsers.filter((u) => u.role === "Peer Reviewer");

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

  const markCompleted = async (manuscriptId, reviewerId) => {
    try {
      const msRef = doc(db, "manuscripts", manuscriptId);
      const selected = manuscripts.find((m) => m.id === manuscriptId);

      const updatedAssigned = (selected.assignedReviewers || []).filter(
        (id) => id !== reviewerId
      );
      const newStatus = updatedAssigned.length === 0 ? "Back to Admin" : selected.status;

      await updateDoc(msRef, {
        assignedReviewers: updatedAssigned,
        [`assignedReviewersMeta.${reviewerId}`]: deleteField(),
        status: newStatus,
      });

      setManuscripts((prev) =>
        prev.map((m) =>
          m.id === manuscriptId
            ? {
                ...m,
                assignedReviewers: updatedAssigned,
                status: newStatus,
                assignedReviewersMeta: { ...m.assignedReviewersMeta, [reviewerId]: undefined },
              }
            : m
        )
      );
    } catch (err) {
      console.error("Error marking review completed:", err);
    }
  };

  const filterManuscripts = (msList) => {
    if (selectedFilter === "All") return msList;
    if (selectedFilter === "Completed") return msList.filter((m) => m.status === "Back to Admin");
    return msList.filter((m) => {
      if (selectedFilter === "Pending") return m.assignedReviewers?.length > 0;
      if (selectedFilter === "Overdue") {
        return m.assignedReviewers?.some((rId) => {
          const deadlineTs = m.assignedReviewersMeta?.[rId]?.deadline;
          if (!deadlineTs) return false;
          const parsedDeadline = deadlineTs?.toDate ? deadlineTs.toDate() : new Date(deadlineTs);
          const { days: remaining } = getRemainingTime(parsedDeadline);
          return remaining <= 0;
        });
      }
      return true;
    });
  };

  return (
    <div className="pt-28 px-10 pb-24">
      <h1 className="text-2xl sm:text-3xl font-bold mb-6">Peer Reviewer Deadlines</h1>

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

      {filterManuscripts(manuscripts).length === 0 ? (
        <p>No manuscripts to display.</p>
      ) : (
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
                    const reviewerMeta = m.assignedReviewersMeta?.[reviewer.id];
                    const deadlineTs = reviewerMeta?.deadline;
                    if (!deadlineTs) return null;

                    const acceptedAt = reviewerMeta?.acceptedAt || reviewerMeta?.assignedAt;
                    const parsedStart = acceptedAt?.toDate ? acceptedAt.toDate() : new Date(acceptedAt || Date.now());
                    const parsedDeadline = deadlineTs?.toDate ? deadlineTs.toDate() : new Date(deadlineTs);

                    const colorClass = getDeadlineColor(parsedStart, parsedDeadline);
                    const { days: remaining } = getRemainingTime(parsedDeadline);

                    return (
                      <li key={m.id} className="text-sm flex flex-col gap-1">
                        <div className="flex justify-between items-center">
                          <span>
                            <strong>{m.title || m.formTitle}</strong> - Status: {m.status}
                          </span>

                          <div
                            className={`inline-block px-3 py-1 rounded-lg text-sm font-medium ${colorClass}`}
                          >
                            Deadline: {parsedDeadline.toLocaleDateString()}{" "}
                            {remaining > 0 ? `(${remaining} day${remaining > 1 ? "s" : ""} left)` : "⚠️ Past Deadline"}
                          </div>
                        </div>

                        <div className="flex gap-2 mt-1">
                          <button
                            onClick={() => markCompleted(m.id, reviewer.id)}
                            className="px-2 py-1 bg-green-500 text-white rounded hover:bg-green-600 text-xs"
                          >
                            Mark Completed
                          </button>
                          <button
                            onClick={() => {
                              setModalManuscriptId(m.id);
                              setModalReviewerId(reviewer.id);
                              setModalOpen(true);
                            }}
                            className="px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-xs"
                          >
                            Set Deadline
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </li>
            ))}
        </ul>
      )}

      {modalOpen && (
        <SetDeadlineModal
          show={modalOpen}
          manuscriptId={modalManuscriptId}
          reviewerId={modalReviewerId}
          onClose={() => setModalOpen(false)}
          onDeadlineSet={() => setManuscripts((prev) => [...prev])}
        />
      )}
    </div>
  );
}
