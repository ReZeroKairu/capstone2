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

const UserLog = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastVisible, setLastVisible] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState(null);

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
    } catch (error) {
      console.error("Error fetching logs:", error);
      setError("Failed to load logs. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteLog = async (logId) => {
    try {
      // Delete the log document from Firestore
      await deleteDoc(doc(db, "UserLog", logId));

      // Remove the deleted log from the state to update the UI
      setLogs((prevLogs) => prevLogs.filter((log) => log.id !== logId));
    } catch (error) {
      console.error("Error deleting log:", error);
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

  if (loading && logs.length === 0) {
    return (
      <div className="flex justify-center items-center min-h-screen pt-24">
        <div className="text-center">
          <span className="loader"></span>
          <p className="text-xl mt-4">Loading user logs...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-center items-center min-h-screen pt-24 bg-gray-100 p-4">
      <div className="w-full max-w-4xl bg-white shadow-lg rounded-lg border border-gray-300 flex flex-col">
        <h1 className="text-2xl font-bold text-center p-4 text-blue-600">
          User Logs
        </h1>
        {error && (
          <div className="text-red-500 text-center mb-4">
            <p>{error}</p>
          </div>
        )}
        <div className="overflow-x-auto flex-grow">
          <table className="w-full border-collapse text-xs md:text-sm">
            {" "}
            {/* Smaller font sizes */}
            <thead>
              <tr className="bg-gray-200 text-gray-700">
                <th className="px-4 py-2 text-left">Email</th>
                <th className="px-4 py-2 text-left w-[250px]">
                  {" "}
                  {/* Larger width for the Action column */}
                  Action
                </th>
                <th className="px-4 py-2 text-left">Admin ID</th>
                <th className="px-4 py-2 text-left">New First Name</th>
                <th className="px-4 py-2 text-left">New Last Name</th>
                <th className="px-4 py-2 text-left">Previous First Name</th>
                <th className="px-4 py-2 text-left">Previous Last Name</th>
                <th className="px-4 py-2 text-left">Timestamp</th>
                <th className="px-4 py-2 text-left">User ID</th>
                <th className="px-4 py-2 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {logs.length > 0 ? (
                logs.map((log) => (
                  <tr
                    key={log.id}
                    className="hover:bg-gray-100 transition-colors duration-200"
                  >
                    <td className="border px-4 py-3">{log.email}</td>
                    <td className="border px-4 py-3 w-[250px] truncate">
                      {" "}
                      {/* Truncate long text */}
                      {log.action}
                    </td>
                    <td className="border px-4 py-3">{log.adminId}</td>
                    <td className="border px-4 py-3">{log.newFirstName}</td>
                    <td className="border px-4 py-3">{log.newLastName}</td>
                    <td className="border px-4 py-3">
                      {log.previousFirstName}
                    </td>
                    <td className="border px-4 py-3">{log.previousLastName}</td>
                    <td className="border px-4 py-3">
                      {log.timestamp ? log.timestamp.toLocaleString() : "N/A"}
                    </td>
                    <td className="border px-4 py-3">{log.userId}</td>
                    <td className="border px-4 py-3 text-center">
                      <button
                        onClick={() => handleDeleteLog(log.id)}
                        className="text-red-500 hover:text-red-700 transition-colors"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="10" className="border px-4 py-3 text-center">
                    No logs found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {hasMore && (
          <div className="flex justify-center mt-4 mb-4">
            <button
              onClick={handleLoadMore}
              className="bg-blue-500 text-white px-6 py-2 rounded-md shadow hover:bg-blue-400 transition"
            >
              Load More
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default UserLog;
