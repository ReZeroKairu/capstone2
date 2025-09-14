import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { db } from "../../firebase/firebase";
import {
  collection,
  getDocs,
  doc,
  updateDoc,
  query,
  where,
  getDoc,
} from "firebase/firestore";
import { FaSearch } from "react-icons/fa";

export default function PeerReviewerList() {
  const [reviewers, setReviewers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(5);
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const manuscriptId = params.get("manuscriptId");

  // Pagination utility
  const getPageNumbers = (current, total) => {
    const delta = 2;
    const range = [];
    const rangeWithDots = [];
    for (let i = 1; i <= total; i++) {
      if (
        i === 1 ||
        i === total ||
        (i >= current - delta && i <= current + delta)
      )
        range.push(i);
    }
    let prev = null;
    for (let num of range) {
      if (prev) {
        if (num - prev === 2) rangeWithDots.push(prev + 1);
        else if (num - prev > 2) rangeWithDots.push("...");
      }
      rangeWithDots.push(num);
      prev = num;
    }
    return rangeWithDots;
  };

  const fetchReviewers = async () => {
    setLoading(true);
    try {
      const usersSnap = await getDocs(collection(db, "Users"));
      const allUsers = usersSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const reviewersOnly = allUsers.filter((u) => u.role === "Peer Reviewer");

      const reviewersWithCount = await Promise.all(
        reviewersOnly.map(async (r) => {
          const manuscriptsSnap = await getDocs(
            query(
              collection(db, "manuscripts"),
              where("assignedReviewers", "array-contains", r.id)
            )
          );
          return { ...r, assignedCount: manuscriptsSnap.size };
        })
      );

      setReviewers(reviewersWithCount);
    } catch (err) {
      console.error("Error fetching reviewers:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReviewers();
  }, []);

  const handleAssign = async (reviewerId) => {
    if (!manuscriptId) {
      alert("No manuscript selected for assignment.");
      return;
    }
    try {
      const msRef = doc(db, "manuscripts", manuscriptId);
      const msSnap = await getDoc(msRef);
      if (!msSnap.exists()) {
        alert("Manuscript not found.");
        return;
      }
      const assigned = msSnap.data().assignedReviewers || [];
      if (!assigned.includes(reviewerId)) {
        await updateDoc(msRef, {
          assignedReviewers: [...assigned, reviewerId],
          status: "Peer Reviewer Assigned",
        });
      }
      fetchReviewers();
      alert("Reviewer successfully assigned!");
    } catch (err) {
      console.error(err);
      alert("Failed to assign reviewer.");
    }
  };

  // Filter reviewers
  const filteredReviewers = reviewers.filter((r) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      r.firstName?.toLowerCase().includes(q) ||
      r.lastName?.toLowerCase().includes(q) ||
      r.middleName?.toLowerCase().includes(q) ||
      r.email?.toLowerCase().includes(q)
    );
  });

  const indexOfLast = currentPage * itemsPerPage;
  const indexOfFirst = indexOfLast - itemsPerPage;
  const currentReviewers = filteredReviewers.slice(indexOfFirst, indexOfLast);
  const totalPages = Math.ceil(filteredReviewers.length / itemsPerPage);

  return (
    <div className="p-4 pb-28 sm:p-8 bg-gray-50 min-h-screen pt-28 md:pt-24 relative mb-11">
      <h2 className="text-2xl sm:text-3xl font-bold text-center mb-6 sm:mb-10 text-gray-800">
        Select Peer Reviewer
      </h2>

      {/* Search */}
      <div className="relative mb-4 w-full sm:w-72 mx-auto">
        <input
          type="text"
          placeholder="Search reviewer"
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setCurrentPage(1);
          }}
          className="w-full pl-10 pr-2 py-1 sm:py-2 border-[3px] border-red-900 rounded text-sm sm:text-base focus:outline-none focus:border-red-900 focus:ring-2 focus:ring-red-900"
        />
        <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-yellow-500" />
      </div>

      {loading ? (
        <p className="text-center text-gray-500 text-base">
          Loading reviewers...
        </p>
      ) : (
        <div className="overflow-x-auto max-h-[400px]">
          <div className="hidden sm:grid bg-yellow-400 text-red-800 rounded-t-md p-3 grid-cols-5 text-center font-semibold text-base">
            <span>Name</span>
            <span>Email</span>
            <span>Assigned Count</span>
            <span>Status</span>
            <span>Action</span>
          </div>

          <div className="border-2 border-red-800 rounded-b-md overflow-hidden mt-0">
            {currentReviewers.map((r, idx) => (
              <div
                key={r.id}
                className="bg-white hover:bg-gray-100 border-b border-red-800 sm:border-none p-3"
              >
                {/* Mobile */}
                <div className="flex flex-col sm:hidden gap-1">
                  <span>
                    <strong>Name:</strong>{" "}
                    {r.name || `${r.firstName} ${r.lastName}`}
                  </span>
                  <span>
                    <strong>Email:</strong> {r.email}
                  </span>
                  <span>
                    <strong>Assigned:</strong> {r.assignedCount}
                  </span>
                  <button
                    className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 text-sm mt-2"
                    onClick={() => handleAssign(r.id)}
                  >
                    Assign
                  </button>
                </div>

                {/* Desktop */}
                <div className="hidden sm:grid grid-cols-5 items-center text-center">
                  <span className="text-red-800">
                    {r.name || `${r.firstName} ${r.lastName}`}
                  </span>
                  <span className="text-red-800">{r.email}</span>
                  <span className="text-red-800">{r.assignedCount}</span>
                  <span className="text-red-800">
                    {r.assignedCount > 0 ? "Busy" : "Available"}
                  </span>
                  <button
                    className="bg-blue-500 text-white px-3 py-2 rounded hover:bg-blue-600 text-sm"
                    onClick={() => handleAssign(r.id)}
                  >
                    Assign
                  </button>
                </div>
              </div>
            ))}
            {currentReviewers.length === 0 && (
              <div className="p-4 text-center text-gray-600">
                No reviewers found.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Pagination */}
      <div className="mt-4 p-2 bg-yellow-400 shadow-lg flex flex-col sm:flex-row justify-between items-center gap-2 rounded-sm">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-bold text-red-900">Page Size:</span>
          <select
            value={itemsPerPage}
            onChange={(e) => {
              setItemsPerPage(Number(e.target.value));
              setCurrentPage(1);
            }}
            className="border-2 border-red-800 bg-yellow-400 rounded-md text-red-900 font-bold text-sm"
          >
            <option value={5}>5</option>
            <option value={10}>10</option>
            <option value={20}>20</option>
          </select>
        </div>

        <div className="flex items-center flex-wrap gap-1 text-sm">
          <button
            onClick={() => setCurrentPage(1)}
            disabled={currentPage === 1}
            className="px-3 py-1 mr-1 bg-yellow-400 text-red-900 rounded-md border border-red-900 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            First
          </button>
          <button
            onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
            disabled={currentPage === 1}
            className="px-3 py-1 mr-4 bg-yellow-400 text-red-900 rounded-md border border-red-900 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Prev
          </button>
          {getPageNumbers(
            currentPage,
            Math.ceil(filteredReviewers.length / itemsPerPage)
          ).map((num, idx) =>
            num === "..." ? (
              <span key={idx} className="px-3 py-1">
                ...
              </span>
            ) : (
              <button
                key={idx}
                onClick={() => setCurrentPage(num)}
                className={`px-3 py-1 mr-1 rounded-lg ${
                  num === currentPage
                    ? "bg-red-900 text-white border border-red-900"
                    : "bg-yellow-400 text-red-900 border border-red-900"
                }`}
              >
                {num}
              </button>
            )
          )}
          <button
            onClick={() =>
              setCurrentPage((prev) =>
                Math.min(
                  prev + 1,
                  Math.ceil(filteredReviewers.length / itemsPerPage)
                )
              )
            }
            disabled={
              currentPage === Math.ceil(filteredReviewers.length / itemsPerPage)
            }
            className="px-3 py-1 ml-3 mr-1 bg-yellow-400 text-red-900 rounded-md border border-red-900 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
          </button>
          <button
            onClick={() =>
              setCurrentPage(Math.ceil(filteredReviewers.length / itemsPerPage))
            }
            disabled={
              currentPage === Math.ceil(filteredReviewers.length / itemsPerPage)
            }
            className="px-3 py-1 mr-1 bg-yellow-400 text-red-900 rounded-md border border-red-900 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Last
          </button>
        </div>
      </div>
    </div>
  );
}
