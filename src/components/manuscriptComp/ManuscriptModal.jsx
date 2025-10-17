// src/components/Manuscripts/ManuscriptModal.jsx
import React, { useContext } from "react";
import { AuthContext } from "../../authcontext/AuthContext";
import ManuscriptStatusBadge from "../ManuscriptStatusBadge";
const ManuscriptModal = ({
  manuscript,
  onClose,
  downloadFileCandidate,
  formatDate,
  manuscriptFileUrls = {}, // Add this line
}) => {
  const { currentUser } = useContext(AuthContext);
  const {
    firstName,
    middleName = "",
    lastName,
    email,
    userRole,
    submittedAt,
    answeredQuestions = [],
    status,
    assignedReviewersMeta = {},
    revisionDeadline,
    finalizationDeadline,
    revisionRequestedAt,
    finalizationStartedAt
  } = manuscript;

  // Format date for display
  const formatDateString = (date) => {
    if (!date) return 'N/A';
    try {
      const d = date.toDate ? date.toDate() : new Date(date);
      return d.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (e) {
      return 'Invalid date';
    }
  };

  // Move handleFileDownload inside the component
  const handleFileDownload = (file, fileName, fileIndex) => {
    // If we have a URL map, use it; otherwise fall back to the original file
    const fileUrl = manuscriptFileUrls?.[fileIndex] || file;
    downloadFileCandidate(fileUrl, fileName);
  };

  // Check if current user is a reviewer who hasn't accepted yet
  const isReviewer = currentUser?.role === 'Peer Reviewer';
  const hasAccepted = assignedReviewersMeta[currentUser?.uid]?.acceptedAt;
  
  // If user is a reviewer who hasn't accepted, show access denied message
  if (isReviewer && !hasAccepted) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
        <div 
          className="bg-white rounded-md p-6 max-w-md w-full shadow-lg border text-center"
          onClick={(e) => e.stopPropagation()}
        >
          <h3 className="text-lg font-medium mb-4">Access Restricted</h3>
          <p className="mb-4">Please accept the review invitation to view this manuscript.</p>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-md p-6 max-w-2xl w-full shadow-lg border overflow-y-auto max-h-[80vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-sm text-gray-600 mb-4">
          <strong>User:</strong> {firstName} {middleName} {lastName} |{" "}
          <strong>Email:</strong> {email} | <strong>Role:</strong>{" "}
          {userRole || "N/A"} | <strong>Submitted at:</strong>{" "}
          {formatDate(submittedAt)}
        </div>

        <div className="space-y-4 mb-4">
          {answeredQuestions
            .filter(
              (q) =>
                !q.question?.toLowerCase().trim().startsWith("manuscript title")
            )
            .map((q, idx) => {
              if (q.type === "file" && q.answer) {
                const files = Array.isArray(q.answer) ? q.answer : [q.answer];
                return (
                  <div
                    key={idx}
                    className="bg-gray-50 p-3 rounded-md border border-gray-200"
                  >
                    <div className="font-semibold mb-1">{q.question}</div>
                    <div className="space-y-2">
                      {files.map((file, fileIdx) => {
                        const fileName =
                          typeof file === "string"
                            ? file.split("/").pop()
                            : file.name ||
                              file.fileName ||
                              `File-${fileIdx + 1}`;
                        return (
                   <button
  key={fileIdx}
  onClick={() => handleFileDownload(file, fileName, fileIdx)}  // Changed idx to fileIdx
  className="text-blue-600 hover:text-blue-800 underline flex items-center"
>
  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
  </svg>
  {fileName}
</button>
                        );
                      })}
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={idx}
                  className="bg-gray-50 p-3 rounded-md border border-gray-200"
                >
                  <div className="font-semibold mb-1">{q.question}</div>
                  <div className="text-gray-800 text-sm">
                    {Array.isArray(q.answer)
                      ? q.answer
                          .map((a) =>
                            a?.name
                              ? `${a.name}${a.email ? ` (${a.email})` : ""}`
                              : a
                          )
                          .join(", ")
                      : q.answer || "—"}
                  </div>
                </div>
              );
            })}
        </div>

        <div className="mb-4 space-y-3">
          <div className="flex items-center">
            <span className="text-sm font-semibold mr-2">Status:</span>
            <ManuscriptStatusBadge 
              status={status} 
              revisionDeadline={revisionDeadline}
              finalizationDeadline={finalizationDeadline}
            />
          </div>

          {/* Revision Deadline */}
          {(status === 'For Revision (Minor)' || status === 'For Revision (Major)') && revisionDeadline && (
            <div className="pl-2 border-l-4 border-blue-200">
              <div className="text-sm font-medium text-gray-600">Revision Deadline</div>
              <div className="text-sm text-gray-800">
                {formatDateString(revisionDeadline)}
                {revisionRequestedAt && (
                  <div className="text-xs text-gray-500">
                    Requested on: {formatDateString(revisionRequestedAt)}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Finalization Deadline */}
          {status === 'In Finalization' && finalizationDeadline && (
            <div className="pl-2 border-l-4 border-green-200">
              <div className="text-sm font-medium text-gray-600">Finalization Deadline</div>
              <div className="text-sm text-gray-800">
                {formatDateString(finalizationDeadline)}
                {finalizationStartedAt && (
                  <div className="text-xs text-gray-500">
                    Started on: {formatDateString(finalizationStartedAt)}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-300 text-gray-800 rounded-md font-semibold hover:bg-gray-400 transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default ManuscriptModal;
