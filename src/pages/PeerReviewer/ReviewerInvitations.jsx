import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { 
  collection, 
  query, 
  where, 
  updateDoc, 
  doc, 
  serverTimestamp,
  onSnapshot 
} from "firebase/firestore";
import { db } from "../../firebase/firebase";
import { getAuth } from "firebase/auth";

const ReviewerInvitations = () => {
  const [invitations, setInvitations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [processingId, setProcessingId] = useState(null);
  const [viewingInvitation, setViewingInvitation] = useState(null);
  const auth = getAuth();
  const currentUser = auth.currentUser;
  const navigate = useNavigate();

  useEffect(() => {
    if (!currentUser) {
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, "manuscripts"),
      where("assignedReviewers", "array-contains", currentUser.uid)
    );

    // Real-time listener
    const unsubscribe = onSnapshot(
      q,
      async (querySnapshot) => {
        const invitationsList = [];

        const processPromises = querySnapshot.docs.map(async (docRef) => {
          try {
            const data = docRef.data();
            const meta = data.assignedReviewersMeta?.[currentUser.uid] || {};

            if (meta.invitationStatus !== "responded") {
              const abstractAnswer =
                data.answeredQuestions?.find(q => q.question === "Abstract")
                  ?.answer || "No abstract available";

              const invitedAt = meta.invitedAt;

              let displayDate;
              if (invitedAt) {
                if (typeof invitedAt.toDate === "function") {
                  displayDate = invitedAt.toDate();
                } else if (invitedAt.seconds) {
                  displayDate = new Date(invitedAt.seconds * 1000);
                } else {
                  displayDate = new Date();
                }
              } else {
                displayDate = new Date();
              }

              return {
                id: docRef.id,
                title: data.title || "Untitled Manuscript",
                abstract: abstractAnswer,
                keywords: data.keywords || [],
                invitedAt: displayDate,
                originalInvitedAt: invitedAt,
                status: meta.invitationStatus || "pending",
                meta: meta
              };
            }
          } catch (err) {
            console.error("Error processing document:", err);
            return null;
          }
        });

        const processedInvitations = (await Promise.all(processPromises)).filter(Boolean);
        processedInvitations.sort((a, b) => b.invitedAt - a.invitedAt);

        setInvitations(processedInvitations);
        setError(null);
      },
      (err) => {
        console.error("Error in snapshot listener:", err);
        setError("Failed to load invitations. Please refresh the page.");
      }
    );

    setLoading(false);

    // Cleanup
    return () => unsubscribe();
  }, [currentUser]);

  const handleDecision = async (manuscriptId, decision) => {
    if (!currentUser || !manuscriptId) return;

    setProcessingId(manuscriptId);
    setError(null);

    try {
      const msRef = doc(db, "manuscripts", manuscriptId);
      const invitation = invitations.find(inv => inv.id === manuscriptId);

      const safeInvitedAt =
        invitation?.originalInvitedAt ||
        invitation?.meta?.invitedAt ||
        serverTimestamp();

      const updateData = {
        [`assignedReviewersMeta.${currentUser.uid}`]: {
          ...(invitation?.meta || {}),
          invitationStatus: "responded",
          respondedAt: serverTimestamp(),
          decision: decision ? "accepted" : "rejected",
          invitedAt: safeInvitedAt
        }
      };

      // If accepting, update the manuscript status
      if (decision) {
        updateData.status = "Peer Reviewer Assigned";
      }

      await updateDoc(msRef, updateData);

      // Remove the invitation from the list
      setInvitations(prev => prev.filter(inv => inv.id !== manuscriptId));

      // Navigate to review page if accepted
      if (decision) {
        navigate(`/review-manuscript?manuscriptId=${manuscriptId}`);
      }
    } catch (err) {
      console.error("Error updating decision:", err);
      setError("Failed to process your decision. Please try again.");
    } finally {
      setProcessingId(null);
    }
  };

  const handleViewDetails = (invitation) => {
    setViewingInvitation(invitation);
  };

  const handleCloseModal = () => {
    setViewingInvitation(null);
  };

  const AbstractModal = ({ isOpen, onClose, invitation }) => {
    if (!isOpen || !invitation) return null;

    return (
      <div className="fixed z-10 inset-0 overflow-y-auto">
        <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
          <div className="fixed inset-0 transition-opacity" aria-hidden="true">
            <div 
              className="absolute inset-0 bg-gray-500 opacity-75"
              onClick={onClose}
            ></div>
          </div>
          
          <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
          
          <div className="inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full sm:p-6">
            <div>
              <div className="mt-3 text-center sm:mt-0 sm:text-left">
                <h3 className="text-lg leading-6 font-medium text-gray-900">
                  {invitation.title}
                </h3>
                <div className="mt-2">
                  <div className="mt-4 text-sm text-gray-500">
                    <span className="font-medium">Invited: </span>
                    {invitation.invitedAt.toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                      hour12: true
                    })}
                  </div>
                  <div className="mt-4">
                    <h4 className="text-sm font-medium text-gray-700">Abstract</h4>
                    <p className="mt-1 text-sm text-gray-600 whitespace-pre-line">
                      {invitation.abstract}
                    </p>
                  </div>
                  {invitation.keywords && invitation.keywords.length > 0 && (
                    <div className="mt-4">
                      <h4 className="text-sm font-medium text-gray-700">Keywords</h4>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {invitation.keywords.map((keyword, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                          >
                            {keyword}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
              <button
                type="button"
                className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:ml-3 sm:w-auto sm:text-sm"
                onClick={onClose}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 pt-20 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 rounded w-1/3 mb-6"></div>
            {[1, 2, 3].map((i) => (
              <div key={i} className="p-6 bg-white rounded-lg shadow mb-4">
                <div className="h-6 bg-gray-200 rounded w-3/4 mb-4"></div>
                <div className="h-4 bg-gray-100 rounded w-1/2"></div>
                <div className="mt-4 flex space-x-4">
                  <div className="h-10 bg-gray-200 rounded w-24"></div>
                  <div className="h-10 bg-gray-200 rounded w-24"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 pt-20 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="bg-red-50 border-l-4 border-red-400 p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pt-20 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Reviewer Invitations</h1>
          <p className="mt-1 text-gray-600">
            {invitations.length === 0 
              ? "You don't have any pending review invitations." 
              : `You have ${invitations.length} pending invitation${invitations.length !== 1 ? 's' : ''}:`}
          </p>
        </div>
        
        {error && (
          <div className="mb-4 p-4 bg-red-50 text-red-700 rounded-md">
            {error}
          </div>
        )}

        {invitations.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm p-12 text-center">
            <svg
              className="mx-auto h-12 w-12 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No pending invitations</h3>
            <p className="mt-1 text-sm text-gray-500">
              You'll see new review requests here when they're assigned to you.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {invitations.map((invitation) => (
              <div key={invitation.id} className="bg-white shadow overflow-hidden rounded-lg">
                <div className="px-6 py-5">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-medium text-gray-900">{invitation.title}</h3>
                    <span className="px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800">
                      Pending Response
                    </span>
                  </div>
                  <div className="mt-2">
                    <p className="text-sm text-gray-600 line-clamp-2">
                      {invitation.abstract}
                    </p>
                  </div>
                  <div className="mt-4 text-sm text-gray-500">
                    <span className="font-medium">Invited: </span>
                    {invitation.invitedAt.toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {invitation.keywords.slice(0, 3).map((keyword, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                      >
                        {keyword}
                      </span>
                    ))}
                    {invitation.keywords.length > 3 && (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                        +{invitation.keywords.length - 3} more
                      </span>
                    )}
                  </div>
                </div>
                <div className="bg-gray-50 px-6 py-3 flex justify-between items-center">
                  <button
                    type="button"
                    onClick={() => handleViewDetails(invitation)}
                    className="text-sm font-medium text-blue-600 hover:text-blue-500 focus:outline-none"
                  >
                    View Details
                  </button>
                  <div className="space-x-3">
                    <button
                      type="button"
                      onClick={() => handleDecision(invitation.id, true)}
                      disabled={processingId === invitation.id}
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
                    >
                      {processingId === invitation.id ? 'Processing...' : 'Accept'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDecision(invitation.id, false)}
                      disabled={processingId === invitation.id}
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50"
                    >
                      {processingId === invitation.id ? 'Processing...' : 'Decline'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <AbstractModal 
        isOpen={!!viewingInvitation} 
        onClose={handleCloseModal} 
        invitation={viewingInvitation} 
      />
    </div>
  );
};

export default ReviewerInvitations;