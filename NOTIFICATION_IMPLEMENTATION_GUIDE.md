# Notification System Implementation Guide

## Overview

This guide explains how to use the comprehensive notification system implemented for your manuscript management platform. The system automatically sends notifications for various manuscript lifecycle events.

## Architecture

### 1. **NotificationService** (`src/utils/notificationService.js`)
- Centralized service for creating and managing notifications
- Handles different notification types with appropriate messaging
- Supports both single and bulk notifications

### 2. **Manuscript Helpers** (`src/utils/manuscriptHelpers.js`)
- Integration functions that connect manuscript events to notifications
- Handles status changes, reviewer assignments, and submissions

### 3. **useNotifications Hook** (`src/hooks/useNotifications.js`)
- React hook for easy integration in components
- Provides callback functions for common notification scenarios

### 4. **Enhanced Notifications Component** (`src/components/Notifications.jsx`)
- Improved UI with categorization and icons
- Better navigation based on notification types
- Visual indicators for different notification categories

## Notification Types

### 📄 **Manuscript Status Updates**
- **Trigger**: When manuscript status changes
- **Recipients**: Manuscript author
- **Examples**: 
  - "Your manuscript is being assigned to peer reviewers"
  - "Your manuscript has been accepted for publication"
  - "Your manuscript requires revisions"

### 📝 **New Submissions**
- **Trigger**: When researcher submits a manuscript
- **Recipients**: All admin users
- **Example**: "New manuscript 'AI in Healthcare' has been submitted by John Doe"

### 👥 **Reviewer Assignments**
- **Trigger**: When admin assigns peer reviewers
- **Recipients**: Assigned peer reviewers
- **Example**: "You have been assigned to review the manuscript 'AI in Healthcare' by Admin Smith"

### ⚖️ **Reviewer Decisions**
- **Trigger**: When peer reviewer accepts/rejects/backs out
- **Recipients**: All admin users
- **Examples**:
  - "Dr. Johnson has accepted the manuscript 'AI in Healthcare'"
  - "Dr. Smith has rejected the manuscript 'AI in Healthcare'"

### ✔️ **Review Completions**
- **Trigger**: When peer reviewer submits their review
- **Recipients**: All admin users
- **Example**: "Dr. Johnson has completed their review for 'AI in Healthcare'"

### ✅ **Final Decisions**
- **Trigger**: When admin makes final decision (Publication/Rejection)
- **Recipients**: Admin users (for tracking)
- **Example**: "Manuscript 'AI in Healthcare' has been finalized with status: For Publication"

## Implementation Examples

### 1. **In Manuscript Submission Component**

```javascript
import { useNotifications } from "../../hooks/useNotifications";

export default function SubmitManuscript() {
  const { notifyManuscriptSubmission } = useNotifications();
  
  const submitAnswers = async () => {
    // ... submission logic ...
    
    const manuscriptRef = await addDoc(collection(db, "manuscripts"), {
      // ... manuscript data ...
    });

    // Send notification to admins
    await notifyManuscriptSubmission(
      manuscriptRef.id,
      manuscriptTitle,
      currentUser.uid
    );
    
    // ... rest of submission logic ...
  };
}
```

### 2. **In Admin Components (Status Changes)**

```javascript
import { handleManuscriptStatusChange } from "../utils/manuscriptHelpers";

const handleStatusChange = async (manuscriptId, newStatus) => {
  // ... status update logic ...
  
  // Send notification about status change
  await handleManuscriptStatusChange(
    manuscriptId, 
    manuscriptTitle, 
    oldStatus, 
    newStatus, 
    authorId, 
    adminId
  );
};
```

### 3. **In Peer Reviewer Components**

```javascript
import { handlePeerReviewerDecision, handleReviewCompletion } from "../../utils/manuscriptHelpers";

const handleDecision = async (manuscriptId, decision) => {
  // ... decision logic ...
  
  // Send notification about reviewer decision
  await handlePeerReviewerDecision(manuscriptId, manuscriptTitle, reviewerId, decision);
};

const submitReview = async (manuscriptId) => {
  // ... review submission logic ...
  
  // Send notification about review completion
  await handleReviewCompletion(manuscriptId, manuscriptTitle, reviewerId);
};
```

## Notification UI Features

### Visual Indicators
- 📄 Manuscript status updates (blue)
- ✅ Final decisions (green)
- 📝 New submissions (purple)
- 👥 Reviewer assignments (orange)
- ⚖️ Reviewer decisions (indigo)
- ✔️ Review completions (green)
- ⏰ Deadline reminders (red)

### Smart Navigation
- Clicking notifications automatically navigates to relevant pages
- Manuscript-related notifications → `/manuscripts`
- Reviewer assignments → `/review-manuscript`
- Default → `/profile`

### Enhanced UX
- Unread notification count in navbar
- Mark as read/unread functionality
- Delete notifications
- Categorized tabs (All, Unread, Read)
- Timestamps for all notifications

## Database Structure

### Notification Document Structure
```javascript
{
  type: "manuscript_status", // notification type
  title: "Manuscript Status Update: AI in Healthcare", // notification title
  message: "Your manuscript has been accepted for publication.", // notification message
  seen: false, // read status
  timestamp: serverTimestamp(), // creation time
  metadata: {
    manuscriptId: "doc_id",
    manuscriptTitle: "AI in Healthcare",
    oldStatus: "Peer Reviewer Reviewing",
    newStatus: "For Publication",
    actionUrl: "/manuscripts", // navigation target
    createdAt: "2024-01-15T10:30:00Z"
  }
}
```

### Storage Location
- Path: `Users/{userId}/Notifications/{notificationId}`
- Each user has their own notifications subcollection
- Automatic cleanup can be implemented based on timestamp

## Integration Checklist

### ✅ **Completed Integrations**
- [x] Manuscript submission notifications
- [x] Peer reviewer assignment notifications
- [x] Peer reviewer decision notifications
- [x] Review completion notifications
- [x] Manuscript status change notifications
- [x] Enhanced notification UI with categorization

### 🔄 **Recommended Additional Integrations**
- [ ] Deadline reminder notifications
- [ ] Co-author notifications
- [ ] Email notification integration
- [ ] Push notifications (for mobile)
- [ ] Notification preferences/settings

## Usage Best Practices

### 1. **Error Handling**
Always wrap notification calls in try-catch blocks:
```javascript
try {
  await notifyManuscriptSubmission(manuscriptId, title, authorId);
} catch (error) {
  console.error('Notification failed:', error);
  // Don't let notification failures break the main flow
}
```

### 2. **Performance Considerations**
- Notifications are sent asynchronously
- Bulk notifications are batched for efficiency
- User display names are cached when possible

### 3. **Testing**
- Test notification creation in development
- Verify navigation works correctly
- Check notification appearance for different types

## Troubleshooting

### Common Issues

1. **Notifications not appearing**
   - Check user authentication
   - Verify Firestore permissions
   - Check console for errors

2. **Navigation not working**
   - Verify actionUrl in metadata
   - Check route definitions
   - Ensure user has access to target page

3. **Performance issues**
   - Monitor Firestore read/write operations
   - Consider implementing notification cleanup
   - Use pagination for large notification lists

## Future Enhancements

### Email Integration
```javascript
// Example email notification integration
await NotificationService.createNotification(userId, type, title, message, {
  ...metadata,
  sendEmail: true, // Flag for email notification
  emailTemplate: 'manuscript_status_change'
});
```

### Push Notifications
```javascript
// Example push notification integration
await NotificationService.createNotification(userId, type, title, message, {
  ...metadata,
  sendPush: true, // Flag for push notification
  pushPayload: { action: 'view_manuscript', manuscriptId }
});
```

### Notification Preferences
```javascript
// User notification preferences
const userPreferences = {
  emailNotifications: true,
  pushNotifications: false,
  notificationTypes: {
    manuscript_status: true,
    reviewer_assignment: true,
    deadline_reminder: false
  }
};
```

This comprehensive notification system provides a solid foundation for keeping all users informed about manuscript lifecycle events while maintaining a clean, user-friendly interface.
