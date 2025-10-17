import React from 'react';
import { getRemainingDays } from '../services/deadlineService';

const statusColors = {
  'Pending': 'bg-gray-100 text-gray-800',
  'Assigning Peer Reviewer': 'bg-blue-100 text-blue-800',
  'Peer Reviewer Assigned': 'bg-indigo-100 text-indigo-800',
  'Peer Reviewer Reviewing': 'bg-purple-100 text-purple-800',
  'Back to Admin': 'bg-yellow-100 text-yellow-800',
  'For Revision (Minor)': 'bg-orange-100 text-orange-800',
  'For Revision (Major)': 'bg-orange-200 text-orange-900',
  'In Finalization': 'bg-blue-100 text-blue-800',
  'For Publication': 'bg-green-100 text-green-800',
  'Rejected': 'bg-red-100 text-red-800',
  'Revision Overdue': 'bg-red-700 text-white',
  'Finalized': 'bg-green-100 text-green-800',
  default: 'bg-gray-100 text-gray-800'
};

const ManuscriptStatusBadge = ({ status, revisionDeadline, finalizationDeadline, className = '' }) => {
  const getStatusText = () => {
    if (status === 'For Revision (Minor)' || status === 'For Revision (Major)') {
      const daysLeft = getRemainingDays(revisionDeadline);
      const isOverdue = daysLeft < 0;
      return (
        <>
          <span>{status}</span>
          {revisionDeadline && (
            <span className="ml-2 text-xs font-normal">
              {isOverdue 
                ? `Overdue by ${Math.abs(daysLeft)} day${Math.abs(daysLeft) !== 1 ? 's' : ''}`
                : `Due in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}`}
            </span>
          )}
        </>
      );
    }
    
    if (status === 'In Finalization' && finalizationDeadline) {
      const daysLeft = getRemainingDays(finalizationDeadline);
      const isOverdue = daysLeft < 0;
      return (
        <>
          <span>{status}</span>
          <span className="ml-2 text-xs font-normal">
            {isOverdue 
              ? `Ended ${Math.abs(daysLeft)} day${Math.abs(daysLeft) !== 1 ? 's' : ''} ago`
              : `Ends in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}`}
          </span>
        </>
      );
    }
    
    return status;
  };

  return (
    <span 
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
        statusColors[status] || statusColors.default
      } ${className}`}
    >
      {getStatusText()}
    </span>
  );
};

export default ManuscriptStatusBadge;
