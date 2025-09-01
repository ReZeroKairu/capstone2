import React, { useEffect, useState } from "react";
import { getAuth } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import {
  collection,
  onSnapshot,
  doc,
  getDoc,
  getDocs,
  updateDoc,
} from "firebase/firestore";
import { db } from "../firebase/firebase";

const Manuscripts = () => {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [manuscripts, setManuscripts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState({});
  const [users, setUsers] = useState([]);
  const [showAssignList, setShowAssignList] = useState({});
  const navigate = useNavigate();

  const toggleExpand = (id) =>
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  const toggleAssignList = (id) =>
    setShowAssignList((prev) => ({ ...prev, [id]: !prev[id] }));

  const unassignReviewer = async (manuscriptId) => {
    try {
      const msRef = doc(db, "manuscripts", manuscriptId);
      await updateDoc(msRef, {
        assignedReviewers: [],
        status: "Assigning Peer Reviewer",
      });
    } catch (err) {
      console.error("Error unassigning reviewer:", err);
    }
  };

  const handleAssign = async (manuscriptId, reviewerId) => {
    try {
      const msRef = doc(db, "manuscripts", manuscriptId);
      const msSnap = await getDoc(msRef);
      if (!msSnap.exists()) return;

      const assigned = msSnap.data().assignedReviewers || [];
      if (!assigned.includes(reviewerId)) {
        await updateDoc(msRef, {
          assignedReviewers: [...assigned, reviewerId],
          status: "Peer Reviewer Assigned",
        });
      }
      setShowAssignList((prev) => ({ ...prev, [manuscriptId]: false }));
    } catch (err) {
      console.error("Error assigning reviewer:", err);
    }
  };

  useEffect(() => {
    const auth = getAuth();
    let unsubscribeManuscripts = null;

    const fetchData = async (currentUser) => {
      try {
        // Fetch users once
        const usersSnap = await getDocs(collection(db, "Users"));
        const allUsers = usersSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setUsers(allUsers);

        const userRef = doc(db, "Users", currentUser.uid);
        const docSnap = await getDoc(userRef);
        const userRole = docSnap.exists() ? docSnap.data().role : "User";
        setRole(userRole);
        setUser(currentUser); // Set user immediately

        const manuscriptsRef = collection(db, "manuscripts");
        unsubscribeManuscripts = onSnapshot(manuscriptsRef, (snapshot) => {
          const allMss = snapshot.docs.map((doc) => {
            const data = doc.data();
            const assignedReviewersNames = data.assignedReviewers?.map((id) => {
              const u = allUsers.find((user) => user.id === id);
              return u ? `${u.firstName} ${u.lastName}` : id;
            });
            return { id: doc.id, ...data, assignedReviewersNames };
          });

          allMss.sort(
            (a, b) =>
              (b.submittedAt?.seconds || 0) - (a.submittedAt?.seconds || 0)
          );

          setManuscripts(
            userRole === "Admin"
              ? allMss
              : allMss.filter((m) => m.userId === currentUser.uid)
          );
        });
      } catch (err) {
        console.error("Error fetching manuscripts:", err);
      } finally {
        setLoading(false);
      }
    };

    const unsubscribeAuth = auth.onAuthStateChanged((currentUser) => {
      if (currentUser) fetchData(currentUser);
      else {
        setUser(null);
        setRole(null);
        setManuscripts([]);
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeManuscripts) unsubscribeManuscripts();
    };
  }, []); // empty dependency array, runs once

  if (loading)
    return <div className="p-28 text-gray-700">Loading manuscripts...</div>;
  if (!user)
    return (
      <div className="p-28 text-red-600 text-center">
        You must be signed in to view manuscripts.
      </div>
    );

  return (
    <div className="pt-24 px-4 sm:px-6 lg:px-24 pb-24">
      <h1 className="text-3xl font-bold mb-6 text-center sm:text-left">
        Manuscripts
      </h1>

      <ul className="space-y-4">
        {manuscripts.map((m) => {
          const showAssignButton =
            role === "Admin" &&
            (m.status === "Assigning Peer Reviewer" ||
              m.status === "Peer Reviewer Assigned");

          const hasReviewer = m.assignedReviewers?.length > 0;

          // 🔹 Extract Manuscript Title flexibly
          const manuscriptTitle =
            m.title ||
            m.answeredQuestions?.find((q) =>
              q.question?.toLowerCase().trim().startsWith("manuscript title")
            )?.answer ||
            "Untitled";

          return (
            <li
              key={m.id}
              className="border p-4 rounded shadow-sm bg-white hover:shadow-md transition w-full sm:w-auto"
            >
              <p
                className="font-semibold text-lg cursor-pointer break-words"
                onClick={() => toggleExpand(m.id)}
              >
                {manuscriptTitle}
              </p>
              <p className="text-sm text-gray-600 break-words">
                By {m.firstName || "Unknown"} {m.lastName || ""} (
                {m.role || "N/A"})
              </p>
              {m.submittedAt && (
                <p className="text-sm text-gray-500">
                  Submitted:{" "}
                  {new Date(m.submittedAt.seconds * 1000).toLocaleString()}
                </p>
              )}

              <p className="text-sm mt-1">
                <strong>Status:</strong>{" "}
                <span
                  className={`font-semibold ${
                    m.status === "Peer Reviewer Assigned"
                      ? "text-indigo-600"
                      : "text-gray-500"
                  }`}
                >
                  {m.status}
                </span>
              </p>

              {hasReviewer && m.assignedReviewersNames?.length > 0 && (
                <p className="text-sm text-gray-700 mt-1">
                  <strong>
                    Assigned Reviewer
                    {m.assignedReviewersNames.length > 1 ? "s" : ""}:
                  </strong>{" "}
                  {m.assignedReviewersNames.join(", ")}
                </p>
              )}

              {showAssignButton && (
                <div className="mt-2">
                  {!hasReviewer ? (
                    <button
                      onClick={() =>
                        navigate(`/admin/reviewer-list?manuscriptId=${m.id}`)
                      }
                      className="px-3 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
                    >
                      Assign Peer Reviewer
                    </button>
                  ) : (
                    <button
                      onClick={() => unassignReviewer(m.id)}
                      className="px-3 py-2 bg-red-500 text-white rounded hover:bg-red-600 text-sm"
                    >
                      Unassign Peer Reviewer
                    </button>
                  )}

                  {showAssignList[m.id] && (
                    <ul className="mt-2 border p-2 rounded bg-gray-50">
                      {users
                        .filter((u) => u.role === "Peer Reviewer")
                        .map((r) => (
                          <li
                            key={r.id}
                            className="flex justify-between items-center mb-1"
                          >
                            <span>
                              {r.firstName} {r.lastName}
                            </span>
                            <button
                              onClick={() => handleAssign(m.id, r.id)}
                              className="px-2 py-1 bg-green-500 text-white rounded hover:bg-green-600 text-xs"
                            >
                              Assign
                            </button>
                          </li>
                        ))}
                    </ul>
                  )}
                </div>
              )}

              {expanded[m.id] && (
                <div className="mt-2 border-t pt-2 max-h-96 overflow-y-auto">
                  {m.answeredQuestions
                    ?.filter(
                      (q) =>
                        !q.question
                          ?.toLowerCase()
                          .trim()
                          .startsWith("manuscript title")
                    )
                    .map((q, idx) => (
                      <p key={idx} className="text-sm sm:text-base break-words">
                        <strong>{q.question}:</strong> {q.answer}
                      </p>
                    ))}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default Manuscripts;
