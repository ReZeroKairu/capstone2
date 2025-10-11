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
      let newStatus;
      let updateFields = {};
      
      if (manuscript.status === "For Revision (Minor)") {
        newStatus = "Assigning Peer Reviewer"; // Goes back to admin for reassignment
      } else if (manuscript.status === "For Revision (Major)") {
        newStatus = "Peer Reviewer Assigned"; // Goes back to same reviewers
        
        // Reset reviewer invitation status for re-review (major revision)
        const updatedReviewerMeta = { ...(manuscript.assignedReviewersMeta || {}) };
        const previousReviewers = manuscript.assignedReviewers || [];
        
        // Reset each reviewer's invitation status to pending for re-review
        previousReviewers.forEach(reviewerId => {
          if (updatedReviewerMeta[reviewerId]) {
            updatedReviewerMeta[reviewerId] = {
              ...updatedReviewerMeta[reviewerId],
              invitationStatus: "pending", // Reset to pending for re-review
              isReReview: true,
              reReviewInvitedAt: new Date(),
              previousReviewVersion: currentVersion,
            };
          }
        });
        
        updateFields.assignedReviewersMeta = updatedReviewerMeta;
      }

      // Create submission history entry with reviewer info
      const submissionHistoryEntry = {
        versionNumber: newVersion,
        fileUrl: newFile.url,
        fileName: newFile.name,
        fileType: newFile.type,
        fileSize: newFile.size,
        storagePath: newFile.storagePath,
        submittedAt: new Date(),
        submittedBy: currentUser.uid,
        revisionNotes: revisionNotes,
        revisionType: manuscript.status,
        // Store reviewer information at this version
        reviewers: manuscript.assignedReviewers || [],
        reviewerSubmissions: manuscript.reviewerSubmissions || [],
        reviewerDecisionMeta: manuscript.reviewerDecisionMeta || {},
      };

      // Get existing submission history or create new array
      const submissionHistory = manuscript.submissionHistory || [
        {
          versionNumber: 1,
          fileUrl: manuscript.fileUrl,
          fileName: manuscript.fileName,
          fileType: manuscript.fileType,
          fileSize: manuscript.fileSize,
          storagePath: manuscript.storagePath,
          submittedAt: manuscript.submittedAt || manuscript.resubmittedAt || new Date(),
          submittedBy: manuscript.submitterId || manuscript.userId,
          revisionNotes: "Initial submission",
        },
      ];

      submissionHistory.push(submissionHistoryEntry);

      // Update manuscript
      await updateDoc(msRef, {
        answeredQuestions: updatedAnsweredQuestions,
        fileUrl: newFile.url,
        fileName: newFile.name,
        fileType: newFile.type,
        fileSize: newFile.size,
        storagePath: newFile.storagePath,
        versionNumber: newVersion,
        status: newStatus,
        resubmittedAt: serverTimestamp(),
        revisionNotes: revisionNotes,
        previousVersion: currentVersion,
        submissionHistory: submissionHistory,
        // Clear previous review data for minor revisions
        ...(manuscript.status === "For Revision (Minor)" && {
          reviewerDecisionMeta: {},
          reviewerSubmissions: [],
        }),
        // Apply reviewer meta updates for major revisions
        ...updateFields,
      });

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

      // Log the resubmission
      await logManuscriptSubmission(
        currentUser.uid,
        manuscriptId,
        manuscript.manuscriptTitle || manuscript.title || "Untitled Manuscript"
      );

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
