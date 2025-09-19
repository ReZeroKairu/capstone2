/**
 * Notification Cost Optimization Utilities
 * Reduces Firestore operations and improves performance
 */

// Cache for user roles to avoid repeated Firestore reads
const userRoleCache = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Get user role with caching to reduce Firestore reads
 */
export const getCachedUserRole = async (userId) => {
  const cached = userRoleCache.get(userId);
  
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.role;
  }
  
  try {
    const { getAuth } = await import('firebase/auth');
    const { doc, getDoc } = await import('firebase/firestore');
    const { db } = await import('../firebase/firebase');
    
    const userDoc = await getDoc(doc(db, "Users", userId));
    const role = userDoc.exists() ? userDoc.data().role : "Researcher";
    
    // Cache the result
    userRoleCache.set(userId, {
      role,
      timestamp: Date.now()
    });
    
    return role;
  } catch (error) {
    console.error("Error fetching user role:", error);
    return "Researcher";
  }
};

/**
 * Clear expired cache entries
 */
export const clearExpiredCache = () => {
  const now = Date.now();
  for (const [userId, cached] of userRoleCache.entries()) {
    if (now - cached.timestamp >= CACHE_DURATION) {
      userRoleCache.delete(userId);
    }
  }
};

/**
 * Batch notification operations to reduce Firestore writes
 */
export const batchNotificationOperations = async (operations) => {
  const { writeBatch, doc } = await import('firebase/firestore');
  const { db } = await import('../firebase/firebase');
  
  const batch = writeBatch(db);
  const BATCH_SIZE = 500; // Firestore batch limit
  
  for (let i = 0; i < operations.length; i += BATCH_SIZE) {
    const batchOperations = operations.slice(i, i + BATCH_SIZE);
    
    batchOperations.forEach(({ type, path, data }) => {
      const docRef = doc(db, ...path);
      
      switch (type) {
        case 'set':
          batch.set(docRef, data);
          break;
        case 'update':
          batch.update(docRef, data);
          break;
        case 'delete':
          batch.delete(docRef);
          break;
      }
    });
    
    await batch.commit();
  }
};

/**
 * Auto-cleanup old notifications to reduce storage costs
 */
export const cleanupOldNotifications = async (userId, daysToKeep = 30) => {
  try {
    const { collection, query, where, getDocs, deleteDoc, doc, Timestamp } = await import('firebase/firestore');
    const { db } = await import('../firebase/firebase');
    
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    
    const notificationsRef = collection(db, "Users", userId, "Notifications");
    const oldNotificationsQuery = query(
      notificationsRef,
      where("timestamp", "<", Timestamp.fromDate(cutoffDate))
    );
    
    const querySnapshot = await getDocs(oldNotificationsQuery);
    const deletePromises = querySnapshot.docs.map(docSnapshot => 
      deleteDoc(doc(db, "Users", userId, "Notifications", docSnapshot.id))
    );
    
    await Promise.all(deletePromises);
    console.log(`Cleaned up ${deletePromises.length} old notifications for user ${userId}`);
    
    return deletePromises.length;
  } catch (error) {
    console.error("Error cleaning up old notifications:", error);
    return 0;
  }
};

/**
 * Notification priority system to reduce unnecessary notifications
 */
export const NotificationPriority = {
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  CRITICAL: 4
};

/**
 * Check if notification should be sent based on user preferences and priority
 */
export const shouldSendNotification = async (userId, notificationType, priority = NotificationPriority.MEDIUM) => {
  try {
    // Check user notification preferences (if implemented)
    const preferences = await getUserNotificationPreferences(userId);
    
    if (!preferences.enabled) return false;
    if (preferences.types && !preferences.types.includes(notificationType)) return false;
    if (priority < (preferences.minimumPriority || NotificationPriority.LOW)) return false;
    
    return true;
  } catch (error) {
    console.error("Error checking notification preferences:", error);
    return true; // Default to sending if preferences can't be checked
  }
};

/**
 * Get user notification preferences (placeholder for future implementation)
 */
const getUserNotificationPreferences = async (userId) => {
  // This would fetch from user preferences in the future
  return {
    enabled: true,
    types: null, // null means all types allowed
    minimumPriority: NotificationPriority.LOW
  };
};

/**
 * Cost-effective notification fetching with pagination
 */
export const fetchNotificationsPaginated = async (userId, limit = 20, lastDoc = null) => {
  try {
    const { collection, query, orderBy, limit: firestoreLimit, startAfter, getDocs } = await import('firebase/firestore');
    const { db } = await import('../firebase/firebase');
    
    const notificationsRef = collection(db, "Users", userId, "Notifications");
    let q = query(
      notificationsRef,
      orderBy("timestamp", "desc"),
      firestoreLimit(limit)
    );
    
    if (lastDoc) {
      q = query(
        notificationsRef,
        orderBy("timestamp", "desc"),
        startAfter(lastDoc),
        firestoreLimit(limit)
      );
    }
    
    const querySnapshot = await getDocs(q);
    const notifications = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    const lastVisible = querySnapshot.docs[querySnapshot.docs.length - 1];
    
    return {
      notifications,
      lastDoc: lastVisible,
      hasMore: querySnapshot.docs.length === limit
    };
  } catch (error) {
    console.error("Error fetching paginated notifications:", error);
    return { notifications: [], lastDoc: null, hasMore: false };
  }
};

// Initialize cleanup interval (run every hour)
if (typeof window !== 'undefined') {
  setInterval(clearExpiredCache, 60 * 60 * 1000);
}
