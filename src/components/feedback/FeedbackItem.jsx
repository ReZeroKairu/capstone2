import React from 'react';
import { FileText, Image as ImageIcon } from 'lucide-react';
import { format } from 'date-fns';

export const FeedbackItem = ({ 
  item, 
  isAdmin, 
  onEdit, 
  onDelete,
  formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}) => {
  const getFileIcon = (fileType) => {
    if (!fileType) return <FileText className="w-4 h-4" />;

    const type = fileType.split('/')[0];
    switch (type) {
      case 'image':
        return <ImageIcon className="w-4 h-4" />;
      case 'application':
        if (fileType.includes('pdf')) {
          return <FileText className="w-4 h-4 text-red-500" />;
        } else if (fileType.includes('word') || fileType.includes('document')) {
          return <FileText className="w-4 h-4 text-blue-600" />;
        } else if (fileType.includes('excel') || fileType.includes('spreadsheet')) {
          return <FileText className="w-4 h-4 text-green-600" />;
        } else {
          return <FileText className="w-4 h-4" />;
        }
      default:
        return <FileText className="w-4 h-4" />;
    }
  };

  const formatDate = (date) => {
    try {
      if (!date) return 'Unknown date';
      // Handle Firestore Timestamp
      if (date.toDate) {
        return format(date.toDate(), 'MMM d, yyyy h:mm a');
      }
      // Handle JavaScript Date
      if (date instanceof Date) {
        return format(date, 'MMM d, yyyy h:mm a');
      }
      // Handle Firestore timestamp object
      if (date.seconds) {
        return format(new Date(date.seconds * 1000), 'MMM d, yyyy h:mm a');
      }
      return 'Invalid date';
    } catch (error) {
      console.error('Error formatting date:', { date, error });
      return 'Invalid date';
    }
  };

  return (
    <div className="p-4 bg-white rounded-lg border border-gray-200 mb-3 hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start">
        <div className="flex-1">
          {item.message && (
            <div className="prose prose-sm max-w-none mb-3">
              <p className="text-gray-800">{item.message}</p>
            </div>
          )}

          {item.fileUrl && (
            <div className="mt-2">
              <p className="text-xs font-medium text-gray-700 mb-1">Attached File:</p>
              <a
                href={item.fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center px-3 py-1.5 border border-gray-200 rounded-md bg-gray-50 hover:bg-gray-100 text-sm text-gray-800"
                download
              >
                {getFileIcon(item.fileType)}
                <span className="ml-2 max-w-xs truncate">
                  {item.fileName || 'Download File'}
                </span>
                <span className="ml-2 text-xs text-gray-500">
                  ({formatFileSize(item.fileSize || 0)})
                </span>
                <svg className="w-4 h-4 ml-2 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </a>
            </div>
          )}

          <p className="text-xs text-gray-500 mt-3">
            <span className="font-medium">{item.createdByName}</span>
            <span className="mx-1">•</span>
            <span>{formatDate(item.createdAt)}</span>
            {item.updatedAt && (
              <span className="text-gray-400 italic ml-1">(edited)</span>
            )}
          </p>
        </div>

        {isAdmin && (
          <div className="flex space-x-2 ml-2">
            <button
              onClick={() => onEdit(item)}
              className="text-blue-600 hover:text-blue-800 p-1 hover:bg-blue-50 rounded"
              title="Edit feedback"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
            <button
              onClick={() => onDelete(item.id, item.storagePath)}
              className="text-red-600 hover:text-red-800 p-1 hover:bg-red-50 rounded"
              title="Delete feedback"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default FeedbackItem;
