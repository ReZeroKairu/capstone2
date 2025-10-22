import { useEffect, useState } from "react";
import { getAuth } from "firebase/auth";
import { db } from "../../firebase/firebase";
import { collection, getDocs, doc, getDoc } from "firebase/firestore";
import PaginationControls from "../../components/PaginationControls";

const ITEMS_PER_PAGE = 5;

export default function CompletedReviews() {
  const [completed, setCompleted] = useState([]);
  const [users, setUsers] = useState({});
  const [loading, setLoading] = useState(true);
  const [reviewerId, setReviewerId] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");

  // Rest of your component code...
  // The totalPages will be calculated inside the component based on filteredReviews.length
  useEffect(() => {
    const fetchCompleted = async () => {
      const auth = getAuth();
      const user = auth.currentUser;
      if (!user) {
        setLoading(false);
        return;
      }

      const uid = user.uid;
      setReviewerId(uid);

      const usersSnap = await getDocs(collection(db, "Users"));
      const allUsers = usersSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setUsers(Object.fromEntries(allUsers.map((u) => [u.id, u])));

      // Get all manuscripts with their data, including assignedReviewersMeta
      const msSnap = await getDocs(collection(db, "manuscripts"));
      const allMss = [];
      
      // Process each document to ensure we get all fields including subcollections
      for (const doc of msSnap.docs) {
        const data = { id: doc.id, ...doc.data() };
        
        // Get the assignedReviewersMeta subcollection if it exists
        const metaSnap = await getDocs(collection(db, "manuscripts", doc.id, "assignedReviewersMeta"));
        if (!metaSnap.empty) {
          data.assignedReviewersMeta = {};
          metaSnap.forEach(metaDoc => {
            data.assignedReviewersMeta[metaDoc.id] = metaDoc.data();
          });
        }
        
        allMss.push(data);
      }

      const done = allMss.filter((m) =>
        (m.reviewerSubmissions || []).some(
          (r) => r.reviewerId === uid && r.status === "Completed"
        )
      );

      setCompleted(done);
      setLoading(false);
    };

    fetchCompleted();
  }, []);

  const filteredReviews = completed.filter(ms => {
    const title = (ms.manuscriptTitle || ms.title || "").toLowerCase();
    const searchLower = searchTerm.toLowerCase();
    return title.includes(searchLower);
  });

  // Calculate pagination
  const totalItems = filteredReviews.length;
  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedReviews = filteredReviews.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  const [manuscriptsPerPage, setManuscriptsPerPage] = useState(ITEMS_PER_PAGE);

  const getVersionNumber = (manuscript, submission) => {
    if (!manuscript.submissionHistory?.length) return '1';
    const submissionDate = submission?.completedAt?.toDate ? 
      submission.completedAt.toDate() : 
      new Date(submission.completedAt.seconds * 1000);
    
    const version = manuscript.submissionHistory.findIndex(s => {
      const subDate = s.submittedAt?.toDate ? 
        s.submittedAt.toDate() : 
        new Date(s.submittedAt.seconds * 1000);
      return subDate > submissionDate;
    });
    
    return version === -1 ? manuscript.submissionHistory.length + 1 : version + 1;
  };

  if (loading) return <p className="pt-28 px-6 text-gray-600">Loading...</p>;

  return (
    <div className="px-6 py-28 max-w-5xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <h1 className="text-2xl font-bold">Completed Reviews</h1>
        <div className="w-full md:w-64">
          <input
            type="text"
            placeholder="Search manuscripts..."
            className="w-full px-3 py-2 border rounded-md text-sm"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
          />
        </div>
      </div>

      {!filteredReviews.length ? (
        <div className="pt-10 text-center text-gray-600">
          <p className="text-lg font-semibold mb-2">No completed reviews found</p>
          <p>Try adjusting your search or check back later.</p>
        </div>
      ) : (
        <>
          <div className="bg-white shadow overflow-hidden sm:rounded-md">
            <ul className="divide-y divide-gray-200">
              {paginatedReviews.map((m) => {
                const myReview = m.reviewerSubmissions?.find(
                  (r) => r.reviewerId === reviewerId
                );
                // Get the inviter's ID from the reviewer's metadata
                const reviewerMeta = m.assignedReviewersMeta?.[reviewerId] || {};
                const inviterId = reviewerMeta.assignedBy || reviewerMeta.invitedBy;
                
                // Format the inviter's name
                const formatName = (user) => {
                  if (!user) return 'System';
                  const name = `${user.firstName || ''} ${
                    user.middleName ? user.middleName.charAt(0) + '.' : ''
                  } ${user.lastName || ''}`.trim();
                  return name || user.email || 'System';
                };
                
                const inviter = users[inviterId];
                const inviterName = inviter ? formatName(inviter) : 'System';
                
                const versionNumber = myReview ? getVersionNumber(m, myReview) : 'N/A';
                const reviewDate = myReview?.completedAt?.seconds 
                  ? new Date(myReview.completedAt.seconds * 1000) 
                  : null;

                return (
                  <li key={m.id} className="hover:bg-gray-50">
                    <div className="px-4 py-4 sm:px-6">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-indigo-600 truncate">
                          {m.manuscriptTitle || m.title || "Untitled Manuscript"}
                        </p>
                        <div className="ml-2 flex-shrink-0 flex">
                          <p className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                            Version {versionNumber}
                          </p>
                        </div>
                      </div>
                      <div className="mt-2 sm:flex sm:justify-between">
                        <div className="sm:flex">
                          <p className="flex items-center text-sm text-gray-500">
                            <span>Reviewed on: {reviewDate?.toLocaleDateString() || 'N/A'}</span>
                          </p>
                          <p className="mt-2 flex items-center text-sm text-gray-500 sm:mt-0 sm:ml-6">
                            <span>Status: {m.status}</span>
                          </p>
                        </div>
                        <div className="mt-2 flex items-center text-sm text-gray-500 sm:mt-0">
                          <span>Invited by: {inviterName}</span>
                        </div>
                      </div>
                      {myReview?.decision && (
                        <div className="mt-2">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            myReview.decision === 'publication' ? 'bg-green-100 text-green-800' :
                            myReview.decision === 'minor' ? 'bg-blue-100 text-blue-800' :
                            myReview.decision === 'major' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {myReview.decision === 'publication' ? 'Recommended for Publication' :
                             myReview.decision === 'minor' ? 'Minor Revisions' :
                             myReview.decision === 'major' ? 'Major Revisions' : 'Reviewed'}
                          </span>
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Pagination */}
          <PaginationControls
            currentPage={currentPage}
            setCurrentPage={setCurrentPage}
            totalPages={totalPages}
            manuscriptsPerPage={manuscriptsPerPage}
            setManuscriptsPerPage={setManuscriptsPerPage}
          />
          
        </>
      )}
</div>
  );
}
