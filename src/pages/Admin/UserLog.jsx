import { useState, useEffect } from "react";
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
} from "firebase/firestore";
import { db } from "../../firebase/firebase";

const UserLog = ({ onLogsUpdated }) => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastVisible, setLastVisible] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const fetchLogs = async (isInitialLoad = false) => {
    try {
      const logsRef = collection(db, "UserLog");
      let logsQuery = query(logsRef, orderBy("timestamp", "desc"), limit(10));

      if (!isInitialLoad && lastVisible) {
        logsQuery = query(
          logsRef,
          orderBy("timestamp", "desc"),
          startAfter(lastVisible),
          limit(10)
        );
      }

      const logsSnapshot = await getDocs(logsQuery);
      if (logsSnapshot.empty) {
        setHasMore(false);
        return;
      }

      const fetchedLogs = logsSnapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          timestamp:
            data.timestamp instanceof Timestamp
              ? data.timestamp.toDate()
              : new Date(data.timestamp.seconds * 1000),
          email: data.email || "",
          action: data.action || "",
          adminId: data.adminId || "",
          newFirstName: data.newFirstName || "",
          newLastName: data.newLastName || "",
          previousFirstName: data.previousFirstName || "",
          previousLastName: data.previousLastName || "",
          userId: data.userId || "",
        };
      });

      setLogs((prev) =>
        isInitialLoad ? fetchedLogs : [...prev, ...fetchedLogs]
      );
      setLastVisible(logsSnapshot.docs[logsSnapshot.docs.length - 1]);
      setHasMore(fetchedLogs.length > 0);

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
    setLogs([]);
    setLastVisible(null);
    setHasMore(true);
    setLoading(true);
    setError(null);
    fetchLogs(true);
  }, []);

  const handleLoadMore = () => {
    if (hasMore && !loading) {
      setLoading(true);
      fetchLogs();
    }
  };

  // Filtered logs based on search, name, and date
  const filteredLogs = logs.filter((log) => {
    const fullName = `${log.newFirstName} ${log.newLastName} ${log.previousFirstName} ${log.previousLastName}`;
    const matchesSearch =
      log.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.userId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      fullName.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStartDate = startDate
      ? log.timestamp >= new Date(startDate)
      : true;

    const matchesEndDate = endDate
      ? log.timestamp <= new Date(new Date(endDate).setHours(23, 59, 59, 999))
      : true;

    return matchesSearch && matchesStartDate && matchesEndDate;
  });

  // Determine which columns actually have data
  const allColumns = [
    { key: "timestamp", label: "Timestamp" },
    { key: "email", label: "Email" },
    { key: "action", label: "Action" },
    { key: "userId", label: "User ID" },
    { key: "newFirstName", label: "New First Name" },
    { key: "newLastName", label: "New Last Name" },
    { key: "previousFirstName", label: "Previous First Name" },
    { key: "previousLastName", label: "Previous Last Name" },
    { key: "adminId", label: "Admin ID" },
  ];

  const visibleColumns = allColumns.filter((col) =>
    filteredLogs.some((log) => log[col.key])
  );

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

        {/* Cards layout for all screens */}
        <div className="flex flex-col gap-3">
          {filteredLogs.length > 0 ? (
            filteredLogs.map((log) => (
              <div
                key={log.id}
                className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm flex flex-col md:flex-row md:justify-between gap-2"
              >
                <div className="flex flex-col gap-1">
                  {Object.entries(log).map(([key, value]) => {
                    if (!value || key === "id") return null;
                    return (
                      <p key={key} className="text-sm md:text-base truncate">
                        <span className="font-semibold text-gray-700">
                          {allColumns.find((c) => c.key === key)?.label || key}:
                        </span>{" "}
                        {value instanceof Date ? value.toLocaleString() : value}
                      </p>
                    );
                  })}
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

        {/* Load More */}
        {hasMore && !loading && (
          <div className="flex justify-center mt-4">
            <button
              onClick={handleLoadMore}
              className="bg-blue-500 text-white px-6 py-2 rounded-md shadow hover:bg-blue-400 transition"
            >
              Load More
            </button>
          </div>
        )}

        {loading && logs.length > 0 && (
          <div className="text-center py-2 text-gray-500">
            Loading more logs...
          </div>
        )}
      </div>
    </div>
  );
};

export default UserLog;
