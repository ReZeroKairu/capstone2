import { collection, getDocs, query, where, updateDoc, doc, Timestamp } from "firebase/firestore";
import { db } from "../firebase/firebase";

/**
 * Checks for and updates manuscripts with passed deadlines
 * @returns {Promise<{updatedCount: number, error: Error|null}>}
 */
export const checkOverdueDeadlines = async () => {
  try {
    const now = Timestamp.now();
    const manuscriptsRef = collection(db, "manuscripts");
    
    // Find manuscripts with passed revision deadlines
    const revisionQuery = query(
      manuscriptsRef,
      where("status", "in", ["For Revision (Minor)", "For Revision (Major)"]),
      where("revisionDeadline", "<", now)
    );

    // Find manuscripts with passed finalization deadlines
    const finalizationQuery = query(
      manuscriptsRef,
      where("status", "==", "In Finalization"),
      where("finalizationDeadline", "<", now)
    );

    const [revisionSnapshot, finalizationSnapshot] = await Promise.all([
      getDocs(revisionQuery),
      getDocs(finalizationQuery)
    ]);

    const updates = [];
    const nowDate = now.toDate();

    // Handle revision deadlines
    revisionSnapshot.forEach((docSnapshot) => {
      const data = docSnapshot.data();
      updates.push(
        updateDoc(docSnapshot.ref, {
          status: "Revision Overdue",
          revisionOverdue: true,
          lastUpdated: nowDate,
          statusHistory: [...(data.statusHistory || []), {
            status: "Revision Overdue",
            note: "Revision deadline passed",
            changedBy: "system",
            timestamp: nowDate,
          }]
        })
      );
    });

    // Handle finalization deadlines
    finalizationSnapshot.forEach((docSnapshot) => {
      const data = docSnapshot.data();
      updates.push(
        updateDoc(docSnapshot.ref, {
          status: "Finalized",
          finalizedAt: nowDate,
          lastUpdated: nowDate,
          statusHistory: [...(data.statusHistory || []), {
            status: "Finalized",
            note: "Finalization period ended",
            changedBy: "system",
            timestamp: nowDate,
          }]
        })
      );
    });

    await Promise.all(updates);
    return { 
      updatedCount: updates.length, 
      error: null 
    };
  } catch (error) {
    console.error("❌ Error checking deadlines:", error);
    return { 
      updatedCount: 0, 
      error 
    };
  }
};

/**
 * Sends deadline reminders for manuscripts approaching their deadlines
 * @returns {Promise<{sentCount: number, error: Error|null}>}
 */
export const sendDeadlineReminders = async () => {
  try {
    const now = Timestamp.now();
    const soon = new Date(now.toDate().getTime() + 3 * 24 * 60 * 60 * 1000); // 3 days from now
    
    const manuscriptsRef = collection(db, "manuscripts");
    
    // Find manuscripts with deadlines in the next 3 days
    const upcomingDeadlineQuery = query(
      manuscriptsRef,
      where("status", "in", [
        "For Revision (Minor)", 
        "For Revision (Major)", 
        "In Finalization"
      ]),
      where("revisionDeadline", ">", now),
      where("revisionDeadline", "<=", Timestamp.fromDate(soon))
    );

    const snapshot = await getDocs(upcomingDeadlineQuery);
    const reminders = [];

    // In a real implementation, you would send actual notifications here
    // For now, we'll just log them
    snapshot.forEach((doc) => {
      const data = doc.data();
      const deadline = data.revisionDeadline?.toDate();
      const daysLeft = Math.ceil((deadline - now.toDate()) / (1000 * 60 * 60 * 24));
      
      console.log(`📅 Reminder: Manuscript "${data.title}" has ${daysLeft} days until deadline`);
      // In a real app, you would send an email or push notification here
      reminders.push({
        manuscriptId: doc.id,
        title: data.title,
        deadline,
        daysLeft,
        status: data.status
      });
    });

    return { 
      sentCount: reminders.length, 
      reminders,
      error: null 
    };
  } catch (error) {
    console.error("❌ Error sending deadline reminders:", error);
    return { 
      sentCount: 0, 
      reminders: [],
      error 
    };
  }
};

/**
 * Gets the remaining days until a deadline
 * @param {Date|Timestamp} deadline - The deadline date
 * @returns {number} Number of days remaining (negative if overdue)
 */
export const getRemainingDays = (deadline) => {
  if (!deadline) return null;
  const now = new Date();
  const end = deadline?.toDate ? deadline.toDate() : new Date(deadline);
  const diff = (end - now) / (1000 * 60 * 60 * 24);
  return Math.ceil(diff);
};

/**
 * Gets the deadline color based on remaining time
 * @param {Date|Timestamp} start - Start date
 * @param {Date|Timestamp} end - End date
 * @returns {string} Tailwind CSS classes for the deadline badge
 */
export const getDeadlineColor = (start, end) => {
  if (!end) return "bg-gray-200 text-gray-800";

  const now = new Date();
  const endDate = end?.toDate ? end.toDate() : new Date(end);
  const startDate = start ? (start.toDate ? start.toDate() : new Date(start)) : now;

  const totalDays = (endDate - startDate) / (1000 * 60 * 60 * 24);
  const elapsedDays = (now - startDate) / (1000 * 60 * 60 * 24);
  const remainingDays = totalDays - elapsedDays;

  // Overdue
  if (remainingDays <= 0) return "bg-red-700 text-white";
  
  // Critical (less than 25% time remaining)
  if ((remainingDays / totalDays) < 0.25) return "bg-red-100 text-red-800";
  
  // Warning (less than 50% time remaining)
  if ((remainingDays / totalDays) < 0.5) return "bg-orange-100 text-orange-800";
  
  // Good (more than 50% time remaining)
  return "bg-green-100 text-green-800";
};
