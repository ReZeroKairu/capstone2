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
          email: data.email || "Unknown Email",
          action: data.action || "No action recorded",
          adminId: data.adminId || "No admin",
          newFirstName: data.newFirstName || "No first name",
          newLastName: data.newLastName || "No last name",
          previousFirstName: data.previousFirstName || "No previous first name",
          previousLastName: data.previousLastName || "No previous last name",
          userId: data.userId || "No user ID",
        };
      });

      setLogs((prevLogs) =>
        isInitialLoad ? fetchedLogs : [...prevLogs, ...fetchedLogs]
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
      setLogs((prevLogs) => prevLogs.filter((log) => log.id !== logId));
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

  const filteredLogs = logs.filter((log) => {
    const matchesSearch =
      log.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.userId.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStartDate = startDate
      ? new Date(log.timestamp) >= new Date(startDate)
      : true;

    const matchesEndDate = endDate
      ? new Date(log.timestamp) <= new Date(endDate + "T23:59:59")
      : true;

    return matchesSearch && matchesStartDate && matchesEndDate;
  });

  return (
    <div className="flex justify-center items-start min-h-screen pt-24 md:pt-24 bg-gray-100 p-2 md:p-4">
      <div className="w-full max-w-6xl bg-white shadow-lg rounded-lg border border-gray-300 flex flex-col">
        <h1 className="text-2xl md:text-3xl font-bold text-center p-4 text-blue-600">
          User Logs
        </h1>

        {/* Filters */}
        <div className="flex flex-col md:flex-row gap-2 md:gap-4 px-2 md:px-4 pb-4 items-center">
          <input
            type="text"
            placeholder="Search by email, action, or user ID..."
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

        {error && (
          <div className="text-red-500 text-center mb-4 px-4">{error}</div>
        )}

        {/* Desktop Table (compressed) */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="min-w-full border-collapse text-xs md:text-sm">
            <thead>
              <tr className="bg-gray-200 text-gray-700">
                <th className="px-1 md:px-2 py-1">Timestamp</th>
                <th className="px-1 md:px-2 py-1">Email</th>
                <th className="px-1 md:px-2 py-1">Action</th>
                <th className="px-1 md:px-2 py-1">User ID</th>
                <th className="px-1 md:px-2 py-1">New First</th>
                <th className="px-1 md:px-2 py-1">New Last</th>
                <th className="px-1 md:px-2 py-1">Prev First</th>
                <th className="px-1 md:px-2 py-1">Prev Last</th>
                <th className="px-1 md:px-2 py-1">Admin ID</th>
                <th className="px-1 md:px-2 py-1">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.length > 0 ? (
                filteredLogs.map((log) => (
                  <tr
                    key={log.id}
                    className="hover:bg-gray-100 transition-colors duration-200"
                  >
                    <td className="border px-1 md:px-2 py-1">
                      {log.timestamp?.toLocaleString() || "N/A"}
                    </td>
                    <td className="border px-1 md:px-2 py-1 truncate">
                      {log.email}
                    </td>
                    <td className="border px-1 md:px-2 py-1 truncate">
                      {log.action}
                    </td>
                    <td className="border px-1 md:px-2 py-1">{log.userId}</td>
                    <td className="border px-1 md:px-2 py-1">
                      {log.newFirstName}
                    </td>
                    <td className="border px-1 md:px-2 py-1">
                      {log.newLastName}
                    </td>
                    <td className="border px-1 md:px-2 py-1">
                      {log.previousFirstName}
                    </td>
                    <td className="border px-1 md:px-2 py-1">
                      {log.previousLastName}
                    </td>
                    <td className="border px-1 md:px-2 py-1">{log.adminId}</td>
                    <td className="border px-1 md:px-2 py-1 text-center">
                      <button
                        onClick={() => handleDeleteLog(log.id)}
                        className="text-red-500 hover:text-red-700 transition-colors text-sm md:text-base"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan="10"
                    className="border px-2 py-3 text-center text-gray-500"
                  >
                    {loading ? "Loading logs..." : "No logs found"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Cards (unchanged) */}
        <div className="sm:hidden flex flex-col space-y-2 px-2 md:px-4">
          {filteredLogs.length > 0 ? (
            filteredLogs.map((log) => (
              <div
                key={log.id}
                className="bg-gray-50 rounded-lg border border-gray-200 p-3 shadow-sm"
              >
                <p>
                  <span className="font-semibold text-gray-700">
                    Timestamp:
                  </span>{" "}
                  {log.timestamp?.toLocaleString() || "N/A"}
                </p>
                <p>
                  <span className="font-semibold text-gray-700">Email:</span>{" "}
                  {log.email}
                </p>
                <p>
                  <span className="font-semibold text-gray-700">Action:</span>{" "}
                  {log.action}
                </p>
                <p>
                  <span className="font-semibold text-gray-700">
                    New First Name:
                  </span>{" "}
                  {log.newFirstName}
                </p>
                <p>
                  <span className="font-semibold text-gray-700">
                    New Last Name:
                  </span>{" "}
                  {log.newLastName}
                </p>
                <p>
                  <span className="font-semibold text-gray-700">
                    Previous First Name:
                  </span>{" "}
                  {log.previousFirstName}
                </p>
                <p>
                  <span className="font-semibold text-gray-700">
                    Previous Last Name:
                  </span>{" "}
                  {log.previousLastName}
                </p>

                <p>
                  <span className="font-semibold text-gray-700">User ID:</span>{" "}
                  {log.userId}
                </p>
                <p>
                  <span className="font-semibold text-gray-700">Admin ID:</span>{" "}
                  {log.adminId}
                </p>
                <div className="flex justify-end mt-2">
                  <button
                    onClick={() => handleDeleteLog(log.id)}
                    className="text-red-500 hover:text-red-700 transition-colors text-sm"
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
          <div className="flex justify-center mt-4 mb-4">
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
