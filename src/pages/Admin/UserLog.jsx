import { useState, useEffect, useMemo } from "react";
import {
  collection,
  query,
  getDocs,
  orderBy,
  limit,
  startAfter,
  Timestamp,
  doc,
  deleteDoc,
  where,
} from "firebase/firestore";
import { db } from "../../firebase/firebase";
import { userCache, getUserInfo } from "../../utils/userCache";
import { useNavigate } from "react-router-dom";



const UserLog = ({ onLogsUpdated }) => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pageCursors, setPageCursors] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [logsPerPage, setLogsPerPage] = useState(10);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  const [roleFilter, setRoleFilter] = useState("all");
const navigate = useNavigate();

  const fetchFullName = async (log) => {
    let first = log.previousFirstName || log.newFirstName || "";
    let middle = log.previousMiddleName || log.newMiddleName || "";
    let last = log.previousLastName || log.newLastName || "";

    if (!first && !middle && !last && log.userId) {
      try {
        const info = await getUserInfo(log.userId);
        const nameParts = info.fullName.split(" ");
        first = nameParts[0] || "";
        middle = nameParts.length > 2 ? nameParts[1] : "";
        last =
          nameParts.length > 2
            ? nameParts.slice(2).join(" ")
            : nameParts[1] || "";
      } catch (err) {
        console.error("Error fetching user full name:", err);
      }
    }

    return [first, middle, last].filter(Boolean).join(" ");
  };

  const fetchLogs = async (page = 1) => {
    try {
      setLoading(true);
      const logsRef = collection(db, "UserLog");
      const baseQuery = [orderBy("timestamp", "desc"), limit(logsPerPage)];

      let logsQuery;
      if (page === 1) {
        logsQuery = query(logsRef, ...baseQuery);
      } else {
        const cursor = pageCursors[page - 2];
        logsQuery = query(logsRef, ...baseQuery, startAfter(cursor));
      }

      const logsSnapshot = await getDocs(logsQuery);

      if (logsSnapshot.empty) {
        setHasMore(false);
        return;
      }

      const fetchedLogs = await Promise.all(
        logsSnapshot.docs.map(async (doc) => {
          const data = doc.data();
          const fullName = await fetchFullName(data);
          const timestamp =
            data.timestamp instanceof Timestamp
              ? data.timestamp.toDate()
              : data.timestamp?.seconds
              ? new Date(data.timestamp.seconds * 1000)
              : new Date();

          return {
            id: doc.id,
            timestamp,
            formattedTimestamp: timestamp.toLocaleString(),
            email: data.email || "",
            action: data.action || "",
            adminId: data.adminId || "",
            newFirstName: data.newFirstName || "",
            newMiddleName: data.newMiddleName || "",
            newLastName: data.newLastName || "",
            previousFirstName: data.previousFirstName || "",
            previousMiddleName: data.previousMiddleName || "",
            previousLastName: data.previousLastName || "",
            userId: data.userId || "",
            fullName,
          };
        })
      );

      setLogs(fetchedLogs);

      const lastDoc = logsSnapshot.docs[logsSnapshot.docs.length - 1];
      setPageCursors((prev) => {
        const newCursors = [...prev];
        newCursors[page - 1] = lastDoc;
        return newCursors;
      });

      setHasMore(fetchedLogs.length === logsPerPage);
      if (onLogsUpdated) onLogsUpdated(fetchedLogs);
    } catch (err) {
      console.error("Error fetching logs:", err);
      setError("Failed to load logs. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteLog = async (logId) => {
    if (!window.confirm("Are you sure you want to delete this log?")) return;

    try {
      await deleteDoc(doc(db, "UserLog", logId));
      setLogs((prev) => prev.filter((log) => log.id !== logId));
    } catch (err) {
      console.error("Error deleting log:", err);
      setError("Failed to delete log. Please try again.");
    }
  };

  useEffect(() => {
    fetchLogs(currentPage);
  }, [currentPage, logsPerPage]);

  const filteredLogs = useMemo(
    () =>
      logs.filter((log) => {
        const fullName = log.fullName || "";
        const matchesSearch =
          log.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
          log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
          log.userId.toLowerCase().includes(searchTerm.toLowerCase()) ||
          fullName.toLowerCase().includes(searchTerm.toLowerCase());

        const matchesStartDate = startDate
          ? log.timestamp >= new Date(startDate)
          : true;
        const matchesEndDate = endDate
          ? log.timestamp <=
            new Date(new Date(endDate).setHours(23, 59, 59, 999))
          : true;

        return matchesSearch && matchesStartDate && matchesEndDate;
      }),
    [logs, searchTerm, startDate, endDate]
  );

  // Reliable total pages based on Firestore cursor
  const totalPages = pageCursors.length + (hasMore ? 1 : 0);

  const getPageNumbers = (current, total) => {
    const delta = 2;
    const range = [];
    const rangeWithDots = [];

    for (let i = 1; i <= total; i++) {
      if (
        i === 1 ||
        i === total ||
        (i >= current - delta && i <= current + delta)
      ) {
        range.push(i);
      }
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

  return (
    <div className="flex justify-center items-start min-h-screen pt-28 md:pt-24 bg-gray-100 p-2 md:p-4">
      <div className="w-full max-w-6xl flex flex-col gap-4">
        <h1 className="text-2xl md:text-3xl font-bold text-center text-blue-600">
          User Logs
        </h1>

        {/* Filters */}
        <div className="flex flex-col md:flex-row gap-2 md:gap-4 items-center">
          <input
            type="text"
            placeholder="Search by email, action, user ID, or name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full md:w-1/2 border rounded-md px-3 py-2 shadow-sm focus:outline-none focus:ring focus:ring-blue-300 text-sm md:text-base"
          />
          <div className="flex gap-2 w-full md:w-1/2">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-1/2 border rounded-md px-3 py-2 shadow-sm focus:outline-none focus:ring focus:ring-blue-300 text-sm md:text-base"
            />
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-1/2 border rounded-md px-3 py-2 shadow-sm focus:outline-none focus:ring focus:ring-blue-300 text-sm md:text-base"
            />
          </div>
        </div>

        {error && <div className="text-red-500 text-center mb-2">{error}</div>}

        {/* Cards */}
        <div className="flex flex-col gap-3">
          {filteredLogs.length > 0 ? (
            filteredLogs.map((log) => (
              <div
                key={log.id}
                className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm flex flex-col md:flex-row md:justify-between gap-2"
              >
                <div className="flex flex-col gap-1">
                  <p className="text-sm md:text-base truncate">
  <span className="font-semibold text-gray-700">Email:</span>{" "}
  {log.userId ? (
    <span
      className="text-red-800 cursor-pointer hover:underline"
      onClick={() => navigate(`/profile/${log.userId}`)}
    >
      {log.email}
    </span>
  ) : (
    log.email
  )}
</p>

                  <p className="text-sm md:text-base truncate">
                    <span className="font-semibold text-gray-700">
                      Timestamp:
                    </span>{" "}
                    {log.formattedTimestamp}
                  </p>
                  {log.newFirstName && (
                    <p className="text-sm md:text-base truncate">
                      <span className="font-semibold text-gray-700">
                        New First Name:
                      </span>{" "}
                      {log.newFirstName}
                    </p>
                  )}
                  {log.newMiddleName && (
                    <p className="text-sm md:text-base truncate">
                      <span className="font-semibold text-gray-700">
                        New Middle Name:
                      </span>{" "}
                      {log.newMiddleName}
                    </p>
                  )}
                  {log.newLastName && (
                    <p className="text-sm md:text-base truncate">
                      <span className="font-semibold text-gray-700">
                        New Last Name:
                      </span>{" "}
                      {log.newLastName}
                    </p>
                  )}
                  {log.previousFirstName && (
                    <p className="text-sm md:text-base truncate">
                      <span className="font-semibold text-gray-700">
                        Previous First Name:
                      </span>{" "}
                      {log.previousFirstName}
                    </p>
                  )}
                  {log.previousMiddleName && (
                    <p className="text-sm md:text-base truncate">
                      <span className="font-semibold text-gray-700">
                        Previous Middle Name:
                      </span>{" "}
                      {log.previousMiddleName}
                    </p>
                  )}
                  {log.previousLastName && (
                    <p className="text-sm md:text-base truncate">
                      <span className="font-semibold text-gray-700">
                        Previous Last Name:
                      </span>{" "}
                      {log.previousLastName}
                    </p>
                  )}
                  {log.action && (
                    <p className="text-sm md:text-base truncate">
                      <span className="font-semibold text-gray-700">
                        Action:
                      </span>{" "}
                      {log.action}
                    </p>
                  )}
                  {log.userId && (
                    <p className="text-sm md:text-base truncate">
                      <span className="font-semibold text-gray-700">
                        User ID:
                      </span>{" "}
                      {log.userId}
                    </p>
                  )}
                </div>

                <div className="flex justify-end items-start md:items-center mt-2 md:mt-0">
                  <button
                    onClick={() => handleDeleteLog(log.id)}
                    className="text-red-500 hover:text-red-700 transition-colors text-sm md:text-base"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))
          ) : (
            <p className="text-center text-gray-500 py-4">
              {loading ? "Loading logs..." : "No logs found"}
            </p>
          )}
        </div>

        {/* Pagination */}
        <div className="mt-4 p-2 bg-yellow-400 shadow-lg flex flex-col sm:flex-row justify-between items-center gap-2 rounded-sm">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-bold text-red-900">Page Size:</span>
            <select
              value={logsPerPage}
              onChange={(e) => {
                setLogsPerPage(Number(e.target.value));
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
              onClick={() => setCurrentPage(Math.max(currentPage - 1, 1))}
              disabled={currentPage === 1}
              className="px-3 py-1 mr-1 bg-yellow-400 text-red-900 rounded-md border border-red-900 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Prev
            </button>

            {getPageNumbers(currentPage, totalPages).map((num, idx) =>
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
              onClick={() => hasMore && setCurrentPage(currentPage + 1)}
              disabled={!hasMore}
              className="px-3 py-1 mr-1 bg-yellow-400 text-red-900 rounded-md border border-red-900 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
            <button
              onClick={() => setCurrentPage(totalPages)}
              disabled={!hasMore}
              className="px-3 py-1 mr-1 bg-yellow-400 text-red-900 rounded-md border border-red-900 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Last
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserLog;
