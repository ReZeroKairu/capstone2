// src/pages/PeerReviewer/ReviewModal.jsx
import { useState } from "react";
import {
  downloadFileCandidate,
  resolveStoragePathToUrl,
} from "./helpers/fileHelpers";
import DeadlineBadge from "./DeadlineBadge";
import { parseDateSafe } from "../../utils/dateUtils";

/**
 * Props expected (mirror your original usage):
 * - manuscript
 * - reviewerId
 * - users
 * - activeDecision, setActiveDecision
 * - reviews, handleReviewChange
 * - reviewFiles, setReviewFiles
 * - handleDecisionSubmit
 * - closeModal
 * - manuscriptFileUrls
 * - versionNumber (optional)
 */
export default function ReviewModal({
  manuscript,
  reviewerId,
  users,
  activeDecision,
  setActiveDecision,
  reviews,
  handleReviewChange,
  reviewFiles,
  setReviewFiles,
  handleDecisionSubmit,
  closeModal,
  manuscriptFileUrls,
  versionNumber: providedVersionNumber,
}) {
  const [submitting, setSubmitting] = useState(false);
  const myMeta = manuscript.reviewerDecisionMeta?.[reviewerId];
  const myDecision = myMeta?.decision || "pending";
  const hasSubmittedReview = manuscript.reviewerSubmissions?.some(
    (r) => r.reviewerId === reviewerId
  );

  // Debug logs retained (as in original)
  // console.log("manuscriptFileUrls:", JSON.stringify(manuscriptFileUrls, null, 2));
  // console.log("Current manuscript ID:", manuscript.id);

  const handleFileDownload = (file, fileName, fileIndex) => {
    // Resolve file URL using the same priority in your original
    const fileUrl =
      manuscriptFileUrls?.[manuscript.id]?.[fileIndex] ||
      manuscriptFileUrls?.[fileIndex] ||
      file?.url ||
      file?.downloadURL ||
      manuscript.submissionHistory?.[fileIndex]?.fileUrl ||
      manuscript.submissionHistory?.[fileIndex]?.file?.url ||
      file;

    if (!fileUrl) {
      alert(
        "Could not find the file to download. The file may have been moved or deleted."
      );
      return;
    }

    const downloadName =
      fileName ||
      file?.name ||
      `manuscript-file-${fileIndex + 1}.${fileUrl.split(".").pop()}`;
    downloadFileCandidate(fileUrl, downloadName);
  };

  const versionNum =
    providedVersionNumber || manuscript.submissionHistory?.length || 1;

  const handleDecisionSubmitWrapper = async (manuscriptId, versionNumber) => {
    if (submitting) return;
    setSubmitting(true);
    try {
      await handleDecisionSubmit(manuscriptId, versionNumber);
    } catch (err) {
      console.error("Submission failed:", err);
      alert("Submission failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const invitedMeta = manuscript.assignedReviewersMeta?.[reviewerId] || {};
  const invitedById = invitedMeta?.assignedBy || invitedMeta?.invitedBy || null;
  
  // Safely parse dates with proper Firestore timestamp handling
  const parseFirestoreDate = (date) => {
    if (!date) return null;
    // If it's a Firestore timestamp
    if (date.toDate) return date.toDate();
    // If it's a timestamp object with seconds
    if (date.seconds) return new Date(date.seconds * 1000);
    // If it's already a Date
    if (date instanceof Date) return date;
    // If it's a string that can be parsed to a date
    const parsed = new Date(date);
    return isNaN(parsed.getTime()) ? null : parsed;
  };

  const invitedAt = parseFirestoreDate(invitedMeta?.assignedAt || invitedMeta?.invitedAt);
  const acceptedAt = parseFirestoreDate(invitedMeta?.respondedAt);
  const invitationStatus = invitedMeta?.invitationStatus || "pending";
  const hasAccepted = invitationStatus === "accepted" || invitedMeta?.decision === "accepted";
  const deadline = parseFirestoreDate(invitedMeta?.deadline);

  const inviter =
    invitedById && users[invitedById]
      ? `${users[invitedById].firstName || ""} ${
          users[invitedById].lastName || ""
        }`.trim()
      : invitedMeta?.assignedByName || invitedMeta?.invitedByName || "Unknown";

  const abstract =
    manuscript.answeredQuestions?.find((q) =>
      q.question?.toLowerCase().includes("abstract")
    )?.answer ||
    manuscript.abstract ||
    "—";

  const startDate = hasAccepted ? (acceptedAt || invitedAt || new Date()) : new Date();
  const endDate = deadline;

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      closeModal();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 overflow-y-auto py-4"
      onClick={handleOverlayClick}
    >
      <div
        className="bg-white rounded-2xl p-6 w-[95%] max-w-4xl shadow-xl overflow-y-auto max-h-[95vh] my-4 relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-xl font-bold">
              {manuscript.manuscriptTitle || manuscript.title || "Untitled"}
            </h2>
            <div className="text-sm text-gray-600">
              Invited by {inviter} • Invited at:{" "}
              {invitedAt ? invitedAt.toLocaleString() : "—"}
            </div>
            <div className="text-sm text-gray-600 mt-1">
              Status: <span className="font-medium">{manuscript.status}</span>
            </div>
          </div>
          <button
            onClick={closeModal}
            className="px-3 py-1 rounded bg-gray-200 hover:bg-gray-300"
          >
            Close
          </button>
        </div>

        <div className="mt-4 space-y-4">
          {!hasAccepted ? (
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-800 font-medium mb-2">
                ⚠️ Invitation Pending
              </p>
              <p className="text-sm text-gray-700">
                You need to accept this invitation before you can view the
                manuscript details and files. Please go to your{" "}
                <a
                  href="/reviewer-invitations"
                  className="text-blue-600 underline hover:text-blue-800"
                >
                  Reviewer Invitations
                </a>{" "}
                page to respond.
              </p>
            </div>
          ) : (
            <>
              {/* Abstract */}
              <div>
                <p className="font-medium mb-2">Abstract</p>
                <div className="text-sm text-gray-800 whitespace-pre-wrap">
                  {abstract}
                </div>
              </div>

              {/* Submission History */}
              <div>
                <p className="font-medium mb-2">
                  Manuscript Submission History
                </p>
                {(manuscript.submissionHistory || []).length > 0 ? (
                  <div className="space-y-2">
                    {(manuscript.submissionHistory || []).map(
                      (submission, idx) => (
                        <div
                          key={idx}
                          className="bg-gray-50 p-3 rounded border border-gray-200"
                        >
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <p className="text-sm font-medium text-gray-800">
                                Version {submission.versionNumber || idx + 1}
                                {idx ===
                                  (manuscript.submissionHistory || []).length -
                                    1 && (
                                  <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded">
                                    Current
                                  </span>
                                )}
                                {idx === 0 && (
                                  <span className="ml-2 px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded">
                                    Original
                                  </span>
                                )}
                              </p>
                              <p className="text-xs text-gray-600 mt-1">
                                {submission.fileName || "Manuscript file"}
                              </p>
                              <p className="text-xs text-gray-500 mt-1">
                                Submitted:{" "}
                                {submission.submittedAt?.toDate
                                  ? submission.submittedAt
                                      .toDate()
                                      .toLocaleString()
                                  : new Date(
                                      submission.submittedAt
                                    ).toLocaleString()}
                              </p>
                              {submission.revisionNotes &&
                                submission.revisionNotes !==
                                  "Initial submission" && (
                                  <p className="text-xs text-gray-700 italic mt-2 bg-yellow-50 p-2 rounded border border-yellow-200">
                                    <span className="font-medium">
                                      Revision Notes:
                                    </span>{" "}
                                    {submission.revisionNotes}
                                  </p>
                                )}
                            </div>
                            <button
                              onClick={() =>
                                handleFileDownload(
                                  submission.file,
                                  submission.fileName || `File ${idx + 1}`,
                                  idx
                                )
                              }
                              className="ml-3 px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 flex items-center"
                            >
                              <svg
                                className="w-4 h-4 mr-1"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                                />
                              </svg>
                              Download
                            </button>
                          </div>
                        </div>
                      )
                    )}
                  </div>
                ) : (
                  <div>
                    {(manuscript.answeredQuestions || [])
                      .filter((q) => q?.type === "file" && q?.answer)
                      .flatMap((q) =>
                        Array.isArray(q.answer) ? q.answer : [q.answer]
                      )
                      .map((file, idx) => {
                        const url = manuscriptFileUrls?.[manuscript.id]?.[idx];
                        if (!url) return null;
                        const fileName =
                          file?.fileName || file?.name || `File ${idx + 1}`;

                        return (
                          <button
                            key={idx}
                            onClick={() => downloadFileCandidate(url, fileName)}
                            className="text-blue-600 hover:text-blue-800 underline flex items-center mb-1"
                          >
                            <svg
                              className="w-4 h-4 mr-1"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                              />
                            </svg>
                            {fileName}
                          </button>
                        );
                      })}
                  </div>
                )}
              </div>
            </>
          )}

          {/* Deadline */}
          {hasAccepted &&
            startDate &&
            endDate &&
            !["For Publication", "Rejected", "Peer Reviewer Rejected"].includes(
              manuscript.status
            ) && <DeadlineBadge startDate={startDate} endDate={endDate} />}

          {/* Reviewer Actions */}
          {hasAccepted && myDecision === "pending" && !hasSubmittedReview && (
            <div className="border-t pt-4">
              <p className="font-medium mb-2">Reviewer Actions</p>
              <div className="flex gap-2 mb-3">
                {["minor", "major", "publication", "reject"].map((d) => {
                  const selected = activeDecision[manuscript.id] === d;
                  const colors = {
                    minor: ["bg-blue-500 hover:bg-blue-600", "bg-blue-700"],
                    major: [
                      "bg-indigo-500 hover:bg-indigo-600",
                      "bg-indigo-700",
                    ],
                    publication: [
                      "bg-green-500 hover:bg-green-600",
                      "bg-green-700",
                    ],
                    reject: ["bg-red-500 hover:bg-red-600", "bg-red-700"],
                  };
                  return (
                    <button
                      key={d}
                      onClick={() =>
                        setActiveDecision((prev) => ({
                          ...prev,
                          [manuscript.id]: d,
                        }))
                      }
                      className={`px-3 py-1 rounded text-white text-sm ${
                        selected ? colors[d][1] : colors[d][0]
                      }`}
                    >
                      {d.charAt(0).toUpperCase() + d.slice(1)}
                    </button>
                  );
                })}
              </div>

              {activeDecision[manuscript.id] && (
                <div className="flex flex-col gap-2">
                  <textarea
                    placeholder="Add your review comments"
                    className="border p-2 rounded w-full"
                    value={reviews[manuscript.id]?.comment || ""}
                    onChange={(e) =>
                      handleReviewChange(
                        manuscript.id,
                        "comment",
                        e.target.value
                      )
                    }
                  />
                  <input
                    type="file"
                    accept=".doc,.docx"
                    onChange={(e) =>
                      setReviewFiles((prev) => ({
                        ...prev,
                        [manuscript.id]: e.target.files[0],
                      }))
                    }
                    className="border p-2 rounded"
                  />
                  {reviewFiles[manuscript.id] && (
                    <p className="text-sm text-gray-600">
                      Selected File: {reviewFiles[manuscript.id].name}
                    </p>
                  )}
                  <div className="flex gap-2">
                    <button
                      onClick={() =>
                        handleDecisionSubmitWrapper(manuscript.id, versionNum)
                      }
                      disabled={submitting}
                      className={`px-3 py-1 rounded text-white text-sm ${
                        submitting
                          ? "bg-green-300 cursor-not-allowed"
                          : "bg-green-600 hover:bg-green-700"
                      }`}
                    >
                      {submitting ? "Submitting..." : "Submit Review"}
                    </button>

                    <button
                      onClick={() =>
                        setActiveDecision((prev) => ({
                          ...prev,
                          [manuscript.id]: null,
                        }))
                      }
                      className="px-3 py-1 bg-gray-300 text-gray-800 rounded hover:bg-gray-400 text-sm"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Submitted reviews display */}
          {(manuscript.reviewerSubmissions || [])
            .filter(
              (s) => s.reviewerId === reviewerId && s.status === "Completed"
            )
            .sort((a, b) => new Date(a.completedAt) - new Date(b.completedAt))
            .map((submission, idx) => (
              <div
                key={idx}
                className="border-t pt-2 mt-2 first:mt-0 first:pt-0 first:border-0"
              >
                <div className="flex justify-between items-center">
                  <span className="text-xs font-semibold text-gray-800">
                    Reviewer:{" "}
                    {users[submission.reviewerId]?.firstName || "Unknown"}{" "}
                    {users[submission.reviewerId]?.lastName || ""} • Version{" "}
                    {idx + 1}{" "}
                    {idx ===
                      manuscript.reviewerSubmissions.filter(
                        (s) => s.reviewerId === reviewerId
                      ).length -
                        1 && "(Latest)"}
                    <span className="ml-2 text-indigo-700 font-normal">
                      For Manuscript Version{" "}
                      {submission.manuscriptVersionNumber || idx + 1}
                    </span>
                  </span>

                  <span className="text-xs text-gray-500">
                    {submission.completedAt ? (
                      parseFirestoreDate(submission.completedAt)?.toLocaleString() || '—'
                    ) : '—'}
                  </span>
                </div>

                {submission.comment && (
                  <div className="mb-2">
                    <p className="text-xs text-gray-700 italic mt-1">
                      "{submission.comment}"
                    </p>
                  </div>
                )}

                {(submission.reviewFileUrl ||
                  submission.reviewFile ||
                  submission.reviewFilePath) && (
                  <p className="mt-1">
                    <button
                      onClick={() =>
                        downloadFileCandidate(
                          submission.reviewFileUrl ||
                            submission.reviewFile ||
                            submission.reviewFilePath,
                          submission.reviewFileName ||
                            submission.fileName ||
                            `File ${idx + 1}`
                        )
                      }
                      className="text-blue-600 underline text-xs"
                    >
                      Download Review File
                    </button>
                  </p>
                )}
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
