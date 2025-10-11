# Manuscript Revision Flow Documentation

## Overview
This document explains the complete revision workflow for manuscripts in the PubTrack system.

## Revision Types

### 1. **For Revision (Minor)**
- **Flow**: Manuscript goes back to **Admin only**
- **Reviewers**: All reviewers are **cleared/unassigned**
- **Next Step**: Admin can reassign new reviewers or the same reviewers
- **Researcher Action**: Must resubmit revised manuscript
- **After Resubmission**: Status changes to **"Assigning Peer Reviewer"** for admin to assign reviewers

### 2. **For Revision (Major)**
- **Flow**: Manuscript goes back to **the same peer reviewers who accepted**
- **Reviewers**: Only reviewers who **accepted** (not rejected) are kept
- **Next Step**: Same reviewers re-review the revised manuscript
- **Researcher Action**: Must resubmit revised manuscript
- **After Resubmission**: Status changes to "Peer Reviewer Assigned" for re-review

## Researcher Workflow

### When Manuscript is in Revision Status:

1. **View Feedback**
   - Researchers can see all reviewer comments
   - Researchers can **download review files** from reviewers
   - Feedback is displayed in the "Review Details" section

2. **Resubmit Button**
   - A green "Resubmit Revised Manuscript" button appears
   - Clicking navigates to `/researcher/resubmit/:manuscriptId`

3. **Resubmission Page** (`ResubmitManuscript.jsx`)
   - Shows manuscript title and current status
   - Displays all reviewer feedback and review files
   - Requires:
     - Upload of revised manuscript file (.doc or .docx)
     - Revision notes explaining changes made
   - Creates a new version (increments version number)
   - Stores revision history in Firestore subcollection

4. **After Resubmission**
   - **Minor Revision**: Status → "Assigning Peer Reviewer" (Admin reassigns)
   - **Major Revision**: Status → "Peer Reviewer Assigned" (Same reviewers)
   - Admin and reviewers are notified
   - Previous review data is preserved in `originalAssignedReviewers`
   - **Submission history is tracked** with version numbers
   - All previous versions remain accessible with download links

## Admin Workflow

### Setting Revision Status:

1. **From "Back to Admin" Status**
   - Admin sees buttons: "For Revision (Minor)", "For Revision (Major)", "For Publication", "Peer Reviewer Rejected"
   - Clicking "For Revision (Minor)" or "For Revision (Major)" triggers the flow

2. **After Setting Revision Status**
   - **Minor**: All reviewers cleared, admin can reassign
   - **Major**: Only accepted reviewers kept, ready for re-review
   - Researcher receives notification
   - Original reviewer data preserved in `originalAssignedReviewers` and `originalAssignedReviewersMeta`

3. **After Researcher Resubmits**
   - **Minor**: Manuscript appears in "Assigning Peer Reviewer" - admin assigns reviewers
   - **Major**: Manuscript appears in "Peer Reviewer Assigned" - reviewers can review
   - **Submission History**: Admin can see all versions with download links and revision notes

## Peer Reviewer Workflow

### For Major Revisions:

1. **Notification**
   - Reviewers who accepted the original manuscript are notified
   - They see the manuscript in their "Assigned Manuscripts" list

2. **Review Revised Manuscript**
   - Can see previous review comments (their own)
   - Can download the new revised manuscript
   - Can see researcher's revision notes
   - Submit new review with updated decision

### For Minor Revisions:

- Original reviewers are **not** automatically reassigned
- Admin may choose to reassign them or assign new reviewers

## Technical Implementation

### Files Modified:

1. **`ManuscriptItem.jsx`**
   - Added revision flow logic (lines 239-287)
   - Added "Resubmit" button for researchers (lines 757-766)
   - Researchers can see review files (already implemented)

2. **`Manuscripts.jsx`**
   - Added revision flow logic (lines 279-359)
   - Handles status changes for both revision types

3. **`ResubmitManuscript.jsx`** (NEW)
   - Complete resubmission page for researchers
   - Handles file upload, revision notes, version tracking
   - Creates revision history in Firestore

4. **`App.jsx`**
   - Added route: `/researcher/resubmit/:manuscriptId`
   - Protected route for Researchers only

### Firestore Structure:

```javascript
manuscripts/{manuscriptId}
  - status: "For Revision (Minor)" | "For Revision (Major)"
  - versionNumber: 2 (incremented on resubmission)
  - assignedReviewers: [] (empty for minor) | [reviewerId1, reviewerId2] (for major)
  - originalAssignedReviewers: [all original reviewer IDs]
  - reviewerSubmissions: [previous review data]
  - revisionNotes: "Researcher's explanation of changes"
  - resubmittedAt: Timestamp
  - submissionHistory: [
      {
        versionNumber: 1,
        fileUrl: "...",
        fileName: "original.docx",
        submittedAt: Timestamp,
        submittedBy: "userId",
        revisionNotes: "Initial submission"
      },
      {
        versionNumber: 2,
        fileUrl: "...",
        fileName: "revised.docx",
        submittedAt: Timestamp,
        submittedBy: "userId",
        revisionNotes: "Fixed methodology section...",
        revisionType: "For Revision (Minor)"
      }
    ]
  
  /revisionHistory (subcollection)
    /{revisionId}
      - versionNumber: 2
      - previousVersion: 1
      - resubmittedAt: Timestamp
      - revisionNotes: "..."
      - fileName: "revised_manuscript.docx"
      - fileUrl: "..."
```

## Key Features

✅ **Minor Revision**: Admin can reassign any reviewers (status → "Assigning Peer Reviewer")
✅ **Major Revision**: Same reviewers (who accepted) re-review
✅ **Researchers see review files**: Can download reviewer feedback files
✅ **Version tracking**: Each resubmission increments version number
✅ **Submission history**: Array in Firestore with all versions, files, and notes
✅ **Version display**: Shows all submissions with download links for each version
✅ **Revision notes**: Researchers explain their changes (visible to all)
✅ **Notifications**: All parties notified at each step
✅ **Original data preserved**: `originalAssignedReviewers` keeps history
✅ **File accessibility**: Old and new files remain downloadable

## Status Flow Diagram

```
Back to Admin
    ↓
Admin chooses revision type
    ↓
┌─────────────────────────┬─────────────────────────┐
│   For Revision (Minor)  │   For Revision (Major)  │
├─────────────────────────┼─────────────────────────┤
│ Clear all reviewers     │ Keep accepted reviewers │
│ Status: "For Revision   │ Status: "For Revision   │
│         (Minor)"        │         (Major)"        │
└─────────────────────────┴─────────────────────────┘
              ↓                         ↓
    Researcher sees feedback & resubmits
    (Version number increments, history saved)
              ↓                         ↓
┌─────────────────────────┬─────────────────────────┐
│ Status: "Assigning Peer │ Status: "Peer Reviewer  │
│         Reviewer"       │         Assigned"       │
│ Admin reassigns         │ Same reviewers review   │
│ reviewers               │ revised version         │
└─────────────────────────┴─────────────────────────┘
```

## Submission History Display

### For Researchers (Resubmission Page):
- Shows complete submission history with all versions
- Each version displays:
  - Version number
  - File name
  - Submission date
  - Revision notes (if not initial submission)
  - Download link for that version
- Current version is highlighted

### For Admins & Researchers (Manuscript List):
- Submission History section appears below manuscript details
- Shows version count: "Submission History (X versions)"
- Lists all versions chronologically
- Each entry shows version number, file name, date, notes
- Download button for each version
- Current version marked with green badge
```
