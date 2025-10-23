import React from 'react';

const StatusButton = ({ status, statusOption, statusColors, onClick }) => {
  const handleClick = (e) => {
    if (window.confirm(`Are you sure you want to change the status to "${statusOption}"?`)) {
      onClick(e);
    }
  };

  return (
    <button
      onClick={statusOption !== status ? handleClick : undefined}
      disabled={statusOption === status}
      className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
        statusColors[statusOption] || 'bg-gray-100'
      } ${
        statusOption === status
          ? 'ring-2 ring-offset-1 ring-blue-500 cursor-not-allowed opacity-70'
          : 'hover:opacity-90 hover:shadow-md transform hover:-translate-y-0.5'
      }`}
      title={statusOption === status ? 'Current status' : `Change to ${statusOption}`}
    >
      {statusOption}
    </button>
  );
};

const StatusActionButtons = ({ 
  id, 
  status, 
  assignReviewer, 
  statusToDeadlineField,
  handleStatusChange,
  hasReviewer,
  unassignReviewer
}) => {
  // All possible statuses
  const statusOptions = [
    'Assigning Peer Reviewer',
    'Peer Reviewer Assigned',
    'Peer Reviewer Reviewing',
    'Back to Admin',
    'For Revision (Minor)',
    'For Revision (Major)',
    'For Publication',
    'Rejected'
  ];


  // Common button styles
  const buttonBase = "px-3 py-1.5 rounded font-medium text-xs sm:text-sm transition";
  
  // Status button colors
  const statusColors = {
    'Assigning Peer Reviewer': 'bg-blue-100 text-blue-800',
    'Peer Reviewer Assigned': 'bg-blue-200 text-blue-900',
    'Peer Reviewer Reviewing': 'bg-blue-300 text-blue-900',
    'Back to Admin': 'bg-purple-100 text-purple-800',
    'For Revision (Minor)': 'bg-yellow-100 text-yellow-800',
    'For Revision (Major)': 'bg-orange-100 text-orange-800',
    'For Publication': 'bg-green-100 text-green-800',
    'Rejected': 'bg-red-200 text-red-900'
  };

  return (
    <div className="space-y-4">
      {/* Assign/Unassign Buttons */}
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2 items-center">
          {['Assigning Peer Reviewer', 'Peer Reviewer Assigned', 'Peer Reviewer Reviewing', 'Back to Admin'].includes(status) && (
            <button
              onClick={async (e) => {
                e.preventDefault();
                const action = hasReviewer ? "assign more reviewers to" : "assign a reviewer to";
                if (window.confirm(`Are you sure you want to ${action} this manuscript?`)) {
                  await assignReviewer(id, status, statusToDeadlineField);
                }
              }}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition font-medium text-sm sm:text-base flex items-center gap-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path d="M8 9a3 3 0 100-6 3 3 0 000 6zM8 11a6 6 0 016 6H2a6 6 0 016-6z" />
              </svg>
              {hasReviewer ? "Assign More Reviewers" : "Assign Reviewer"}
            </button>
          )}

        </div>
      </div>

      {/* Status Buttons */}
      <div className="space-y-3">
        <h4 className="text-sm font-medium text-gray-700">Change Status:</h4>
        
        {/* Peer Review Statuses */}
        <div className="space-y-2">
          <h5 className="text-xs font-medium text-gray-500 uppercase tracking-wider">Review Status</h5>
          <div className="flex flex-wrap gap-2">
            {['Assigning Peer Reviewer', 'Peer Reviewer Assigned', 'Peer Reviewer Reviewing', 'Back to Admin']
              .filter(option => statusOptions.includes(option))
              .map((statusOption) => (
                <StatusButton
                  key={statusOption}
                  status={status}
                  statusOption={statusOption}
                  statusColors={statusColors}
                  onClick={() => handleStatusChange(id, statusOption)}
                />
              ))}
          </div>
        </div>

        {/* Revision Statuses */}
        <div className="space-y-2">
          <h5 className="text-xs font-medium text-gray-500 uppercase tracking-wider">Revision Status</h5>
          <div className="flex flex-wrap gap-2">
            {['For Revision (Minor)', 'For Revision (Major)']
              .filter(option => statusOptions.includes(option))
              .map((statusOption) => (
                <StatusButton
                  key={statusOption}
                  status={status}
                  statusOption={statusOption}
                  statusColors={statusColors}
                  onClick={() => handleStatusChange(id, statusOption)}
                />
              ))}
          </div>
        </div>

        {/* Final Statuses */}
        <div className="space-y-2">
          <h5 className="text-xs font-medium text-gray-500 uppercase tracking-wider">Final Status</h5>
          <div className="flex flex-wrap gap-2">
            {['For Publication', 'Rejected']
              .filter(option => statusOptions.includes(option))
              .map((statusOption) => (
                <StatusButton
                  key={statusOption}
                  status={status}
                  statusOption={statusOption}
                  statusColors={statusColors}
                  onClick={() => handleStatusChange(id, statusOption)}
                />
              ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default StatusActionButtons;
