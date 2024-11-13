import { useState, useEffect } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../../firebase/firebase"; // Adjust your Firebase import path

const UserLog = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const logsRef = collection(db, "userLogs");
        const logsSnapshot = await getDocs(logsRef);
        const logsData = logsSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setLogs(logsData);
        setLoading(false);
      } catch (error) {
        console.error("Error fetching user logs:", error);
        setLoading(false);
      }
    };

    fetchLogs();
  }, []);

  if (loading) {
    return <p>Loading user logs...</p>;
  }

  return (
    <div className="user-log">
      <h1>User Logs</h1>
      <table>
        <thead>
          <tr>
            <th>Timestamp</th>
            <th>Admin</th>
            <th>Action</th>
            <th>Target User</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log) => (
            <tr key={log.id}>
              <td>{new Date(log.timestamp).toLocaleString()}</td>
              <td>{log.adminName}</td>
              <td>{log.action}</td>
              <td>{log.targetUser}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default UserLog;
