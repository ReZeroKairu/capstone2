import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { db, auth } from "../../firebase/firebase";
import {
  doc,
  getDoc,
  updateDoc,
  serverTimestamp,
  addDoc,
  collection,
} from "firebase/firestore";
import { useNotifications } from "../../hooks/useNotifications";
import { useUserLogs } from "../../hooks/useUserLogs";
import FileUpload from "../../components/FileUpload";

export default function ResubmitManuscript() {
  const { manuscriptId } = useParams();
  const navigate = useNavigate();
  const [manuscript, setManuscript] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [newFile, setNewFile] = useState(null);
  const [revisionNotes, setRevisionNotes] = useState("");
  const [message, setMessage] = useState("");
  const [messageVisible, setMessageVisible] = useState(false);

  const { notifyManuscriptSubmission } = useNotifications();
  const { logManuscriptSubmission } = useUserLogs();

  const showMessage = (msg) => {
    setMessage(msg);
    setMessageVisible(true);
    setTimeout(() => setMessageVisible(false), 4000);
  };

  useEffect(() => {
    const fetchManuscript = async () => {
      try {
        const currentUser = auth.currentUser;
        if (!currentUser) {
          showMessage("You must be signed in.");
          navigate("/");
          return;
        }

        const msRef = doc(db, "manuscripts", manuscriptId);
        const msSnap = await getDoc(msRef);

        if (!msSnap.exists()) {
          showMessage("Manuscript not found.");
          navigate("/manuscripts");
          return;
        }

        const msData = msSnap.data();

        // Verify user is the author
        if (msData.submitterId !== currentUser.uid && msData.userId !== currentUser.uid) {
          showMessage("You are not authorized to resubmit this manuscript.");
          navigate("/manuscripts");
          return;
        }

        // Verify status is revision
        if (!["For Revision (Minor)", "For Revision (Major)"].includes(msData.status)) {
          showMessage("This manuscript is not in revision status.");
          navigate("/manuscripts");
          return;
        }

        setManuscript({ id: msSnap.id, ...msData });
        setLoading(false);
      } catch (err) {
        console.error("Error fetching manuscript:", err);
        showMessage("Failed to load manuscript.");
        setLoading(false);
      }
    };

    fetchManuscript();
  }, [manuscriptId, navigate]);

  const handleResubmit = async (e) => {
    e.preventDefault();

    if (!newFile) {
      showMessage("Please upload a revised manuscript file.");
      return;
    }

    if (!["application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"].includes(newFile.type)) {
      showMessage("Only Word documents (.doc or .docx) are allowed.");
      return;
    }

    if (!revisionNotes.trim()) {
      showMessage("Please provide revision notes explaining your changes.");
      return;
    }

    try {
      setSubmitting(true);

      const msRef = doc(db, "manuscripts", manuscriptId);
      const currentUser = auth.currentUser;

      // Get current version number
      const currentVersion = manuscript.versionNumber || 1;
      const newVersion = currentVersion + 1;

      // Update the file in answeredQuestions
      const updatedAnsweredQuestions = (manuscript.answeredQuestions || []).map((q) => {
        if (q.type === "file") {
          return {
            ...q,
            answer: newFile.url || null,
            fileName: newFile.name || null,
            fileType: newFile.type || null,
            fileSize: newFile.size || null,
            storagePath: newFile.storagePath,
          };
        }
        return q;
      });

      // Determine new status based on revision type
      const newStatus = "Back to Admin";
      let updateFields = {};
      
      // Store previous reviewers for potential re-invitation
      const previousReviewers = manuscript.assignedReviewers || [];
      const previousReviewersMeta = { ...(manuscript.assignedReviewersMeta || {}) };
      
      // Clear current reviewers but keep them in history
      updateFields.assignedReviewers = [];
      updateFields.assignedReviewersMeta = {};
      updateFields.previousReviewers = [...new Set([
        ...(manuscript.previousReviewers || []),
        ...previousReviewers
      ])];
      updateFields.previousReviewersMeta = {
        ...(manuscript.previousReviewersMeta || {}),
        ...previousReviewersMeta
      };
      updateFields.versionReviewed = currentVersion; // Track which version was reviewed
      updateFields.status = newStatus;
      
      // The revision deadline is already set when the status was changed to 'For Revision'
      // We don't need to update it here as it would reset the deadline

      // Get all reviewers who have submitted reviews for this version
      const reviewersWithSubmissions = Array.from(
        new Set([
          ...(manuscript.assignedReviewers || []),
          ...(manuscript.reviewerSubmissions?.map(s => s.reviewerId) || [])
        ])
      );

      // Create submission history entry with reviewer info
      const now = serverTimestamp();
      const submissionHistoryEntry = {
        versionNumber: newVersion,
        fileUrl: newFile?.url || '',
        fileName: newFile?.name || '',
        fileType: newFile?.type || '',
        fileSize: newFile?.size || 0,
        storagePath: newFile?.storagePath || '',
        submittedAt: now,
        submittedBy: currentUser.uid,
        revisionNotes: revisionNotes || 'Resubmitted manuscript',
        revisionType: manuscript.status || 'Resubmission',
        // Store reviewer information at this version
        reviewers: Array.isArray(reviewersWithSubmissions) ? reviewersWithSubmissions : [],
        reviewerSubmissions: Array.isArray(manuscript.reviewerSubmissions) ? manuscript.reviewerSubmissions : [],
        reviewerDecisionMeta: manuscript.reviewerDecisionMeta || {},
        // Ensure we have all required fields
        completedAt: now,
        status: 'Completed',
        submitted: true,
        // Add timestamps for tracking
        createdAt: now,
        updatedAt: now
      };

      // Create or update submission history
      let submissionHistory = [];
      
      // Add previous submission history if it exists
      if (Array.isArray(manuscript.submissionHistory) && manuscript.submissionHistory.length > 0) {
        submissionHistory = [...manuscript.submissionHistory];
      } else {
        // Create initial submission history if none exists
        submissionHistory = [{
          versionNumber: 1,
          fileUrl: manuscript.fileUrl || '',
          fileName: manuscript.fileName || '',
          fileType: manuscript.fileType || '',
          fileSize: manuscript.fileSize || 0,
          storagePath: manuscript.storagePath || '',
          submittedAt: manuscript.submittedAt || manuscript.resubmittedAt || serverTimestamp(),
          submittedBy: manuscript.submitterId || manuscript.userId || currentUser.uid,
          revisionNotes: "Initial submission",
          submitted: true,
          completedAt: manuscript.submittedAt || manuscript.resubmittedAt || serverTimestamp(),
          status: 'Completed'
        }];
      }

      // Add the new submission to the history
      submissionHistory.push({
        ...submissionHistoryEntry,
        submittedAt: serverTimestamp(),
        completedAt: serverTimestamp(),
        submitted: true,
        status: 'Completed'
      });

      // Archive current reviews before clearing them
      const previousReviews = (manuscript.reviewerSubmissions || []).map(review => {
        const reviewCopy = { ...review };
        // Ensure we don't modify the original review object
        delete reviewCopy.id;
        delete reviewCopy.isArchived;
        
        return {
          ...reviewCopy,
          versionReviewed: manuscript.versionNumber || 1,
          isArchived: true,
          archivedAt: serverTimestamp(),
          // Ensure we capture all relevant review data
          decision: manuscript.reviewerDecisionMeta?.[review.reviewerId]?.decision || review.decision,
          recommendation: manuscript.reviewerDecisionMeta?.[review.reviewerId]?.recommendation || review.recommendation,
          completedAt: review.completedAt || serverTimestamp(),
          manuscriptVersionNumber: manuscript.versionNumber || 1,
          // Mark as from previous version
          isFromPreviousVersion: true,
          // Store the version this review was for
          forManuscriptVersion: manuscript.versionNumber || 1,
          // Add timestamps
          createdAt: review.createdAt || serverTimestamp(),
          updatedAt: serverTimestamp()
        };
      });

      // Update the submission history entry to include the review information
      const submissionWithReviews = {
        ...submissionHistoryEntry,
        // Include the reviews that were part of this version
        reviews: [...previousReviews],
        // Include the decision that led to this resubmission
        decision: {
          status: manuscript.status,
          decision: manuscript.status.includes('Minor') ? 'minorRevision' : 'majorRevision',
          decidedAt: new Date()
        }
      };

      // Update the last entry in submission history
      submissionHistory[submissionHistory.length - 1] = submissionWithReviews;

      // Prepare the update data object with all fields and proper default values
      const updateData = {
        answeredQuestions: Array.isArray(updatedAnsweredQuestions) ? updatedAnsweredQuestions : [],
        fileUrl: newFile?.url || null,
        fileName: newFile?.name || null,
        fileType: newFile?.type || null,
        fileSize: newFile?.size || 0,
        storagePath: newFile?.storagePath || null,
        versionNumber: newVersion,
        status: newStatus || 'Assigning Peer Reviewer',
        resubmittedAt: serverTimestamp(),
        revisionNotes: revisionNotes || "Resubmitted manuscript",
        previousVersion: currentVersion || 1,
        submissionHistory: Array.isArray(submissionHistory) ? submissionHistory : [],
        // Preserve the current reviewer submissions in previousReviewSubmissions
        previousReviewSubmissions: [
          ...(Array.isArray(manuscript.previousReviewSubmissions) ? manuscript.previousReviewSubmissions : []),
          ...(Array.isArray(previousReviews) ? previousReviews.filter(Boolean) : [])
        ],
        // Clear current submissions but keep the reviewer assignments
        reviewerSubmissions: [],
        // Preserve the previous reviews, filtering out any null/undefined
        previousReviews: [
          ...(Array.isArray(manuscript.previousReviews) ? manuscript.previousReviews.filter(Boolean) : []),
          ...(Array.isArray(previousReviews) ? previousReviews.filter(Boolean) : [])
        ],
        // Preserve the decision meta but reset for the new version
        previousReviewerDecisionMeta: {
          ...(manuscript.previousReviewerDecisionMeta || {}),
          ...(currentVersion ? { [`v${currentVersion}`]: manuscript.reviewerDecisionMeta || {} } : {})
        },
        reviewerDecisionMeta: {},
        lastUpdated: serverTimestamp()
      };
      
      // Clean up any undefined or null values that might have slipped through
      Object.keys(updateData).forEach(key => {
        if (updateData[key] === undefined || updateData[key] === null) {
          delete updateData[key];
        }
      });

      // Only include updateFields if it has values to avoid undefined errors
      if (updateFields && Object.keys(updateFields).length > 0) {
        Object.assign(updateData, updateFields);
      }

      // Deep clean the updateData object to remove any undefined or null values
      const cleanData = (obj) => {
        if (Array.isArray(obj)) {
          return obj
            .map(value => (value && typeof value === 'object' ? cleanData(value) : value))
            .filter(value => value !== undefined && value !== null);
        } else if (obj && typeof obj === 'object') {
          return Object.entries(obj).reduce((acc, [key, value]) => {
            if (value === undefined || value === null) {
              return acc; // Skip undefined/null values
            }
            const cleanedValue = value && typeof value === 'object' ? cleanData(value) : value;
            if (cleanedValue !== undefined && cleanedValue !== null) {
              acc[key] = cleanedValue;
            }
            return acc;
          }, {});
        }
        return obj;
      };

      const cleanedUpdateData = cleanData(updateData);

      // Log the data being sent to Firestore for debugging
      console.log('Updating document with:', JSON.parse(JSON.stringify(cleanedUpdateData)));

      // Update the manuscript document with the cleaned data
      await updateDoc(msRef, cleanedUpdateData);

      // Create a revision history entry
      await addDoc(collection(db, "manuscripts", manuscriptId, "revisionHistory"), {
        versionNumber: newVersion,
        previousVersion: currentVersion,
        resubmittedAt: serverTimestamp(),
        resubmittedBy: currentUser.uid,
        revisionNotes: revisionNotes,
        fileName: newFile.name,
        fileUrl: newFile.url,
        storagePath: newFile.storagePath,
        revisionType: manuscript.status,
      });

      // Notify admins
      await notifyManuscriptSubmission(
        manuscriptId,
        manuscript.manuscriptTitle || manuscript.title || "Untitled Manuscript",
        currentUser.uid
      );

      // Notify reviewers for major revisions (they need to re-review)
      if (manuscript.status === "For Revision (Major)" && manuscript.assignedReviewers?.length > 0) {
        const NotificationService = (await import("../../utils/notificationService")).default;
        await NotificationService.notifyReviewerResubmission(
          manuscriptId,
          manuscript.manuscriptTitle || manuscript.title || "Untitled Manuscript",
          manuscript.assignedReviewers,
          newVersion
        );
      }

      // First update the manuscript with the new version and status
      await updateDoc(msRef, updateFields);
      
      // Then update reviewer deadlines using the new utility function
      try {
        const { updateReviewerDeadlines } = await import('../../utils/deadlineUtils');
        await updateReviewerDeadlines(manuscriptId, 'Back to Admin');
      } catch (error) {
        console.error('Error updating reviewer deadlines:', error);
        // Don't fail the entire submission if deadline update fails
      }
      
      // Log the submission
      await logManuscriptSubmission(manuscriptId, newVersion, 'resubmitted');
      
      // Notify admins about the resubmission
      await notifyManuscriptSubmission(manuscriptId, 'resubmitted');

      showMessage("Manuscript resubmitted successfully!");
      setTimeout(() => navigate("/manuscripts"), 2000);
    } catch (err) {
      console.error("Error resubmitting manuscript:", err);
      showMessage("Failed to resubmit manuscript. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <p className="text-center py-10">Loading manuscript...</p>;
  if (!manuscript) return <p className="text-center py-10">Manuscript not found.</p>;

  return (
    <div className="min-h-screen px-4 md:py-12 lg:py-16 mx-auto max-w-3xl mt-12 bg-white text-[#222]">
      <h1 className="text-2xl font-semibold mb-6 text-[#111] text-center">
        Resubmit Revised Manuscript
      </h1>

      <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
        <h2 className="text-lg font-semibold mb-2">{manuscript.manuscriptTitle || manuscript.title}</h2>
        <p className="text-sm text-gray-600">
          <strong>Status:</strong> {manuscript.status}
        </p>
        <p className="text-sm text-gray-600">
          <strong>Current Version:</strong> {manuscript.versionNumber || 1}
        </p>
        <p className="text-sm text-gray-600">
          <strong>Total Submissions:</strong> {(manuscript.submissionHistory?.length || 1)}
        </p>
      </div>

      {/* Submission History */}
      {manuscript.submissionHistory && manuscript.submissionHistory.length > 0 ? (
        <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <h3 className="text-base font-semibold mb-3">Submission History</h3>
          <div className="space-y-2">
            {manuscript.submissionHistory.map((submission, idx) => (
              <div key={idx} className="bg-white p-3 rounded border flex justify-between items-center">
                <div>
                  <p className="text-sm font-medium text-gray-800">
                    Version {submission.versionNumber || idx + 1}
                    {idx === manuscript.submissionHistory.length - 1 && (
                      <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded">Current</span>
                    )}
                  </p>
                  <p className="text-xs text-gray-600">
                    {submission.fileName || "Manuscript file"}
                  </p>
                  <p className="text-xs text-gray-500">
                    Submitted: {submission.submittedAt?.toDate ? submission.submittedAt.toDate().toLocaleString() : new Date(submission.submittedAt).toLocaleString()}
                  </p>
                  {submission.revisionNotes && submission.revisionNotes !== "Initial submission" && (
                    <p className="text-xs text-gray-600 italic mt-1">"{submission.revisionNotes}"</p>
                  )}
                </div>
                <a
                  href={submission.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                >
                  Download
                </a>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <h3 className="text-base font-semibold mb-3">Current Submission</h3>
          <div className="bg-white p-3 rounded border flex justify-between items-center">
            <div>
              <p className="text-sm font-medium text-gray-800">Version 1 (Initial Submission)</p>
              <p className="text-xs text-gray-600">{manuscript.fileName || "Manuscript file"}</p>
              <p className="text-xs text-gray-500">
                Submitted: {manuscript.submittedAt?.toDate ? manuscript.submittedAt.toDate().toLocaleString() : "N/A"}
              </p>
            </div>
            {manuscript.fileUrl && (
              <a
                href={manuscript.fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
              >
                Download
              </a>
            )}
          </div>
        </div>
      )}

      {/* Display review feedback */}
      {manuscript.reviewerSubmissions && manuscript.reviewerSubmissions.length > 0 && (
        <div className="mb-6 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
          <h3 className="text-base font-semibold mb-3">📝 Reviewer Feedback</h3>
          <div className="space-y-3">
            {manuscript.reviewerSubmissions.map((submission, idx) => (
              <div key={idx} className="bg-white p-3 rounded border">
                <p className="text-sm font-medium text-gray-700 mb-1">Reviewer {idx + 1}</p>
                {submission.comment && (
                  <p className="text-sm text-gray-800 italic mb-2">"{submission.comment}"</p>
                )}
                {submission.reviewFileUrl && (
                  <a
                    href={submission.reviewFileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 underline text-sm hover:text-blue-800"
                  >
                    📄 Download Review File
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <form onSubmit={handleResubmit} className="space-y-6">
        {/* Upload revised file */}
        <div className="bg-[#e0e0e0] rounded-xl p-4">
          <label className="block font-semibold mb-2">
            Upload Revised Manuscript (Version {(manuscript.versionNumber || 1) + 1}) <span className="text-red-500">*</span>
          </label>
          <FileUpload
            id="revised-manuscript"
            name="revised-manuscript"
            onUploadSuccess={(file) => setNewFile(file)}
            onUploadError={(error) => {
              console.error("Upload failed:", error);
              setNewFile(null);
              showMessage(error.message || "Failed to upload file.");
            }}
            accept=".doc,.docx"
            buttonText="Upload Revised File"
            uploadingText="Uploading..."
            className="mb-2"
          />
          {newFile && (
            <p className="text-sm text-green-600 mt-2">✓ File uploaded: {newFile.name}</p>
          )}
        </div>

        {/* Revision notes */}
        <div className="bg-[#e0e0e0] rounded-xl p-4">
          <label htmlFor="revision-notes" className="block font-semibold mb-2">
            Revision Notes (Version {(manuscript.versionNumber || 1) + 1}) <span className="text-red-500">*</span>
          </label>
          <p className="text-sm text-gray-600 mb-2">
            Explain the changes you made in response to the reviewers' feedback. This will be visible to reviewers and administrators.
          </p>
          <textarea
            id="revision-notes"
            value={revisionNotes}
            onChange={(e) => setRevisionNotes(e.target.value)}
            className="border p-2 w-full rounded focus:outline-none focus:ring-2 focus:ring-green-400"
            rows={6}
            required
            placeholder="Describe the revisions you made..."
          />
        </div>

        {/* Submit button */}
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={() => navigate("/manuscripts")}
            className="px-6 py-2 rounded-lg font-medium text-base bg-gray-300 hover:bg-gray-400 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting || !newFile}
            className={`px-6 py-2 rounded-lg font-medium text-base transition-colors duration-200 ${
              submitting || !newFile
                ? "bg-gray-400 cursor-not-allowed"
                : "bg-green-600 hover:bg-green-700 text-white focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
            }`}
          >
            {submitting ? "Resubmitting..." : "Resubmit Manuscript"}
          </button>
        </div>
      </form>

      {message && messageVisible && (
        <div
          className={`fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 px-6 py-4 rounded-lg shadow-lg z-50 transition-opacity duration-500 ${
            message.toLowerCase().includes("success")
              ? "bg-green-100 text-green-700"
              : "bg-red-100 text-red-700"
          }`}
        >
          {message}
        </div>
      )}
    </div>
  );
}
