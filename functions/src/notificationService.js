// src/notificationService.js
const { onCall } = require('firebase-functions/v2/https');
const { onDocumentUpdated } = require('firebase-functions/v2/firestore');
const { logger } = require('firebase-functions');
const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();

/**
 * Helper: shallow-serialize notification result to a safe JSON object
 * Do NOT include any FieldValue / DocumentReference / Timestamp objects.
 */
function serializeNotificationResult({ id, userId, type, title, createdAtClient }) {
  return {
    id,
    userId,
    type,
    title,
    createdAtClient
  };
}


/**
 * Callable: createBulkNotifications
 * Expected request.data:
 *   { userIds: string[], type: string, title: string, message: string, metadata: object }
 *
 * Returns:
 *  { success: true, created: [{ id, userId, type, title, createdAt }], skipped: [userId...], errors: [...] }
 */
const createBulkNotifications = onCall(
  {
    region: 'asia-east2',
    enforceAppCheck: false,
    cors: true
  },
  async (request) => {
    try {
      const context = request.auth;
      if (!context || !context.uid) {
        logger.warn('createBulkNotifications: unauthenticated request');
        throw new Error('unauthenticated');
      }

      const { userIds, type, title, message, metadata = {} } = request.data || {};

      // Basic validation
      if (!Array.isArray(userIds) || userIds.length === 0) {
        logger.warn('createBulkNotifications: invalid userIds', { userIds });
        throw new Error('userIds must be a non-empty array');
      }
      if (!type || !title || !message) {
        logger.warn('createBulkNotifications: missing required fields', { type, title, message });
        throw new Error('type, title and message are required');
      }

      // Ensure userIds are unique
      const uniqueUserIds = Array.from(new Set(userIds));

      // Validate users exist - getAll will return docs in the same order as refs
      const userRefs = uniqueUserIds.map(id => db.collection('Users').doc(id));
      const userDocs = await db.getAll(...userRefs);

      // Partition valid and invalid
      const validUserIds = [];
      const skippedUserIds = [];
      userDocs.forEach((docSnap, idx) => {
        if (docSnap && docSnap.exists) validUserIds.push(uniqueUserIds[idx]);
        else skippedUserIds.push(uniqueUserIds[idx]);
      });

      if (validUserIds.length === 0) {
        logger.warn('createBulkNotifications: no valid userIds provided', { skippedUserIds });
        return { success: true, created: [], skipped: skippedUserIds, errors: [] };
      }

      // Prepare batch write and safe client timestamp to return
      const batch = db.batch();
      const createdResults = [];
      const errors = [];
      const clientTimestamp = new Date().toISOString();

      // Compose notificationData: keep serverTimestamp for createdAt in Firestore,
      // but also write a client timestamp field (createdAtClient) we can safely return.
      for (const userId of validUserIds) {
        try {
          const notificationRef = db
            .collection('Users')
            .doc(userId)
            .collection('Notifications')
            .doc();

          const notificationData = {
            type,
            title,
            message,
            recipientId: userId,
            seen: false,
            // store server timestamp in Firestore for canonical ordering
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            // store client timestamp (serializable) for immediate return
            createdAtClient: clientTimestamp,
            // put metadata as-is (be careful: avoid FieldValue in metadata from client)
            ...metadata
          };

          batch.set(notificationRef, notificationData);

          // push a sanitized result (DO NOT include FieldValue serverTimestamp)
 createdResults.push(
  serializeNotificationResult({
    id: notificationRef.id,
    userId,
    type,
    title,
    createdAtClient: clientTimestamp
  })
);


        } catch (err) {
          logger.error('createBulkNotifications: prepare failed for user', { userId, err: err.message });
          errors.push({ userId, error: String(err.message || err) });
        }
      }

      // Commit the batch
      await batch.commit();

      logger.info(`createBulkNotifications: created ${createdResults.length} notifications`, {
        createdCount: createdResults.length,
        skipped: skippedUserIds.length,
        errorsCount: errors.length
      });

      return {
        success: true,
        created: createdResults,
        skipped: skippedUserIds,
        errors
      };
    } catch (error) {
      // Log full error and return an HTTPS-friendly error (avoid returning complex non-serializable objects)
      logger.error('createBulkNotifications: fatal error', {
        message: error?.message,
        stack: error?.stack
      });

      // Throw to client as an HTTP error code (v2 onCall will map this to an error)
      // Keep the message simple — client-side code can fallback to Firestore writes if needed.
      throw new Error(error?.message || 'internal');
    }
  }
);

/**
 * Firestore trigger: notifyAdmins when manuscript status changes to 'Back to Admin'
 * (Similar to your previous code; this function uses the NotificationService above for writes)
 */
const notifyAdmins = onDocumentUpdated(
  {
    document: 'manuscripts/{manuscriptId}',
    region: 'asia-east2'
  },
  async (event) => {
    try {
      const newData = event.data.after.data() || {};
      const oldData = event.data.before.data() || {};

      if (newData.status === oldData.status || newData.status !== 'Back to Admin') {
        logger.log('notifyAdmins: no relevant status change, skipping');
        return null;
      }

      const manuscriptId = event.params.manuscriptId;
      const adminQuery = await db.collection('Users').where('role', '==', 'Admin').get();
      const adminIds = adminQuery.docs.map(d => d.id);

      if (adminIds.length === 0) {
        logger.warn('notifyAdmins: no admin users found');
        return null;
      }

      const title = `Action Required: Manuscript Ready for Admin Review - ${newData.title || 'Untitled'}`;
      const message = `The manuscript "${newData.title || 'Untitled'}" has completed peer review and is ready for your attention.`;

      const metadata = {
        manuscriptId,
        manuscriptTitle: newData.title || 'Untitled',
        oldStatus: oldData.status,
        newStatus: newData.status,
        actionUrl: `/manuscripts?manuscriptId=${manuscriptId}`,
        priority: 'high',
        // Do not set FieldValue here if you will return metadata; we won't return it to the caller.
      };

      // Use the same createBulkNotifications logic but call the function's internals:
      // Instead of calling the callable, directly perform the write logic to avoid recursion.
      const batch = db.batch();
      const clientTimestamp = new Date().toISOString();
      for (const userId of adminIds) {
        const notificationRef = db.collection('Users').doc(userId).collection('Notifications').doc();
        const notificationData = {
          type: 'manuscript_status_update',
          title,
          message,
          recipientId: userId,
          seen: false,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          createdAtClient: clientTimestamp,
          ...metadata
        };
        batch.set(notificationRef, notificationData);
      }
      await batch.commit();
      logger.info(`notifyAdmins: notifications created for ${adminIds.length} admins`);
      return null;
    } catch (err) {
      logger.error('notifyAdmins: error', { message: err?.message, stack: err?.stack });
      return null;
    }
  }
);

module.exports = {
  createBulkNotifications,
  notifyAdmins
};
