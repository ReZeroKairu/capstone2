# Smart Notification Routing System

## Overview

The notification system now includes intelligent, role-based routing that automatically navigates users to the most relevant page when they click on notifications.

## How It Works

### 🎯 **Smart Routing Logic**

When a user clicks a notification, the system:
1. **Marks the notification as read**
2. **Checks for explicit actionUrl** in notification metadata
3. **Falls back to role-based routing** based on notification type and user role
4. **Navigates to the most contextually relevant page**

### 🔀 **Routing Matrix**

| Notification Type | Researcher | Peer Reviewer | Admin |
|-------------------|------------|---------------|-------|
| **📄 Manuscript Status** | `/manuscripts` | `/dashboard` | `/manuscripts` |
| **✅ Manuscript Final** | `/dashboard` | `/dashboard` | `/manuscripts` |
| **📝 New Submission** | `/dashboard` | `/dashboard` | `/formresponses` |
| **👥 Reviewer Assignment** | `/dashboard` | `/review-manuscript` | `/dashboard` |
| **⚖️ Reviewer Decision** | `/manuscripts` | `/review-manuscript` | `/manuscripts` |
| **✔️ Review Completed** | `/dashboard` | `/review-manuscript` | `/manuscripts` |
| **⏰ Deadline Reminder** | `/manuscripts` | `/review-manuscript` | `/admin/deadlines` |
| **👤 User Management** | `/profile` | `/profile` | `/user-management` |
| **📋 Peer Reviewer List** | `/profile` | `/profile` | `/peer-reviewers` |

## 📍 **Available Routes**

Based on your `App.jsx`, here are the available routes:

### **Public Routes**
- `/home` - Home page
- `/journals` - Journals listing
- `/call-for-papers` - Call for papers
- `/pub-ethics` - Publication ethics
- `/guidelines` - Submission guidelines

### **Protected Routes (All Users)**
- `/profile` - User profile
- `/dashboard` - User dashboard
- `/manuscripts` - Manuscripts listing

### **Researcher Routes**
- `/submit-manuscript` - Submit new manuscript

### **Peer Reviewer Routes**
- `/review-manuscript` - Review assigned manuscripts

### **Admin Routes**
- `/user-management` - Manage users
- `/user-log` - User activity logs
- `/admin/deadlines` - Manage deadlines
- `/admin/reviewer-list` - Peer reviewer management
- `/peer-reviewers` - Peer reviewer list

## 🎯 **Notification Examples with Routing**

### 1. **Manuscript Status Update (Researcher)**
```
📄 Manuscript Status Update: "AI in Healthcare"
Your manuscript has been accepted for publication.
Click → Navigates to /dashboard (celebration page)
```

### 2. **New Submission (Admin)**
```
📝 New Manuscript Submitted
New manuscript "Machine Learning" has been submitted by John Doe
Click → Navigates to /formresponses (to review submission)
```

### 3. **Reviewer Assignment (Peer Reviewer)**
```
👥 New Manuscript Assignment
You have been assigned to review "AI in Healthcare" by Admin Smith
Click → Navigates to /review-manuscript (to start review)
```

### 4. **Reviewer Decision (Admin)**
```
⚖️ Peer Reviewer Acceptance
Dr. Johnson has accepted the manuscript "AI in Healthcare"
Click → Navigates to /manuscripts (to see updated status)
```

### 5. **Deadline Reminder (Admin)**
```
⏰ Deadline Reminder
Review deadline approaching for 3 manuscripts
Click → Navigates to /admin/deadlines (to manage deadlines)
```

## 🔧 **Implementation Details**

### **Role Detection**
```javascript
const getUserRole = async () => {
  try {
    const auth = getAuth();
    const currentUser = auth.currentUser;
    if (currentUser) {
      const userDoc = await getDoc(doc(db, "Users", currentUser.uid));
      return userDoc.exists() ? userDoc.data().role : "Researcher";
    }
  } catch (error) {
    console.error("Error fetching user role:", error);
  }
  return "Researcher";
};
```

### **Smart Navigation**
```javascript
const handleNotificationClick = async (notification) => {
  markAsRead(notification.id);
  
  const userRole = await getUserRole();
  const actionUrl = notification.metadata?.actionUrl;
  
  if (actionUrl) {
    navigate(actionUrl); // Use explicit URL if provided
    return;
  }
  
  // Role-based routing logic
  switch (notification.type) {
    case "manuscript_status":
      if (userRole === "Researcher") {
        navigate("/manuscripts");
      } else if (userRole === "Admin") {
        navigate("/manuscripts");
      } else {
        navigate("/dashboard");
      }
      break;
    // ... more cases
  }
};
```

### **Metadata Enhancement**
Each notification now includes routing hints:
```javascript
{
  type: "manuscript_status",
  title: "Manuscript Status Update",
  message: "Your manuscript has been accepted",
  metadata: {
    manuscriptId: "doc123",
    manuscriptTitle: "AI in Healthcare",
    actionUrl: "/dashboard", // Explicit routing
    userRole: "Researcher", // Role hint
    oldStatus: "Reviewing",
    newStatus: "For Publication"
  }
}
```

## 🎨 **User Experience**

### **Visual Feedback**
- Notifications automatically mark as read when clicked
- Smooth navigation transitions
- Context-aware destinations

### **Contextual Navigation**
- **Researchers** see their submissions and status updates
- **Peer Reviewers** go directly to review tasks
- **Admins** access management and oversight tools

### **Fallback Logic**
- If specific route fails, falls back to role-appropriate default
- Graceful error handling prevents broken navigation
- Always provides a meaningful destination

## 🚀 **Benefits**

1. **Improved User Experience**: Users land exactly where they need to be
2. **Role-Aware**: Different users see different destinations for the same notification type
3. **Context Preservation**: Maintains workflow context across navigation
4. **Flexible**: Can override with explicit URLs when needed
5. **Robust**: Fallback logic ensures navigation always works

## 🔮 **Future Enhancements**

### **Query Parameters**
```javascript
// Navigate with specific manuscript highlighted
navigate(`/manuscripts?highlight=${manuscriptId}`);
```

### **Deep Linking**
```javascript
// Direct links to specific manuscript details
navigate(`/manuscripts/${manuscriptId}`);
```

### **State Preservation**
```javascript
// Preserve filters and search when navigating
navigate("/manuscripts", { 
  state: { 
    filter: "in-review", 
    search: manuscriptTitle 
  } 
});
```

This smart routing system ensures that every notification click provides maximum value by taking users exactly where they need to go based on their role and the notification context.
