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
        <p className="text-center text-xl">Loading user logs...</p>
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
          <table className="w-full border-collapse text-sm md:text-base">
            <thead>
              <tr className="bg-gray-200 text-gray-700">
                <th className="px-4 py-2 text-left">Email</th>
                <th className="px-4 py-2 text-left">Action</th>
                <th className="px-4 py-2 text-left">Timestamp</th>
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
                    <td className="border px-4 py-3">{log.action}</td>
                    <td className="border px-4 py-3">
                      {log.timestamp ? log.timestamp.toLocaleString() : "N/A"}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="3" className="border px-4 py-3 text-center">
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
