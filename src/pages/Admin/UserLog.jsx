import { useState, useEffect } from "react";
import {
  collection,
  query,
  getDocs,
  orderBy,
  limit,
  startAfter,
  Timestamp,
} from "firebase/firestore";
import { db } from "../../firebase/firebase"; // Adjust your Firebase import path

const UserLog = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastVisible, setLastVisible] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState(null);

  // Function to fetch logs
  const fetchLogs = async (isInitialLoad = false) => {
    try {
      const logsRef = collection(db, "UserLog"); // Top-level 'UserLogs' collection
      let logsQuery = query(
        logsRef,
        orderBy("timestamp", "desc"), // Order by timestamp in descending order
        limit(10) // Limit to 10 logs per fetch
      );

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
              : new Date(data.timestamp.seconds * 1000), // Ensure correct Date conversion
          email: data.email || "Unknown Email",
          action: data.action || "No action recorded",
        };
      });

      setLogs((prevLogs) =>
        isInitialLoad ? fetchedLogs : [...prevLogs, ...fetchedLogs]
      );
      setLastVisible(logsSnapshot.docs[logsSnapshot.docs.length - 1]);
      setHasMore(fetchedLogs.length > 0); // Check if there are more logs
    } catch (error) {
      console.error("Error fetching logs:", error);
      setError("Failed to load logs. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  // Initial fetch of logs when component mounts
  useEffect(() => {
    setLogs([]);
    setLastVisible(null);
    setHasMore(true);
    setLoading(true);
    setError(null); // Reset error state on mount
    fetchLogs(true);
  }, []);

  const handleLoadMore = () => {
    if (hasMore) {
      fetchLogs();
    }
  };

  if (loading) {
    return <p className="text-center text-xl">Loading user logs...</p>;
  }

  return (
    <div className="flex justify-center items-center min-h-screen bg-gray-100 py-10">
      <div className="w-full max-w-4xl p-6 bg-white shadow-lg rounded-xl border border-gray-200">
        <h1 className="text-3xl font-semibold text-center mb-6 text-blue-600">
          User Logs
        </h1>
        {error && (
          <div className="text-red-500 text-center mb-4">
            <p>{error}</p>
          </div>
        )}
        <table className="w-full table-auto border-collapse">
          <thead>
            <tr>
              <th className="px-4 py-2 text-left text-gray-700">Email</th>
              <th className="px-4 py-2 text-left text-gray-700">Action</th>
              <th className="px-4 py-2 text-left text-gray-700">Timestamp</th>
            </tr>
          </thead>
          <tbody>
            {logs.length > 0 ? (
              logs.map((log) => (
                <tr
                  key={log.id}
                  className="hover:bg-gray-100 transition-colors duration-200"
                >
                  <td className="border px-4 py-3 text-gray-600">
                    {log.email}
                  </td>
                  <td className="border px-4 py-3 text-gray-600">
                    {log.action}
                  </td>
                  <td className="border px-4 py-3 text-gray-600">
                    {log.timestamp ? log.timestamp.toLocaleString() : "N/A"}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan="3"
                  className="border px-4 py-3 text-center text-gray-600"
                >
                  No logs found
                </td>
              </tr>
            )}
          </tbody>
        </table>
        {hasMore && (
          <div className="flex justify-center mt-6">
            <button
              onClick={handleLoadMore}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg shadow-md hover:bg-blue-500 transition-colors"
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
