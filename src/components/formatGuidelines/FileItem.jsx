import React from 'react';
import { FaDownload, FaTrash, FaFileUpload } from 'react-icons/fa';

const FileItem = ({ 
  file, 
  isAdmin,
  isEditMode,
  deletingId, 
  onDelete, 
  dragHandleProps 
}) => {
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div 
      className="flex items-center justify-between p-4 border-b border-gray-100 last:border-b-0 hover:bg-gray-50 transition-colors duration-150"
      {...(isAdmin ? {
        ...dragHandleProps,
        style: {
          cursor: 'move',
          userSelect: 'none',
          WebkitUserSelect: 'none',
          msUserSelect: 'none',
          MozUserSelect: 'none',
        }
      } : {})}
    >
      <div className="flex items-center flex-1 min-w-0">
        <div className="flex-shrink-0 bg-blue-50 p-3 rounded-md border border-blue-100">
          <FaFileUpload className="h-5 w-5 text-blue-600" />
        </div>
        <div className="ml-4 min-w-0">
          <h3 className="text-lg font-medium text-gray-900 truncate">{file.name}</h3>
          <div className="flex items-center text-sm text-gray-500 mt-1">
            <span>{formatFileSize(file.size)}</span>
            <span className="mx-2">•</span>
            <span>{file.uploadedAt?.toDate ? new Date(file.uploadedAt.toDate()).toLocaleDateString() : 'N/A'}</span>
          </div>
        </div>
      </div>
      <div className="flex flex-shrink-0 space-x-2 ml-4">
        <a
          href={file.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs sm:text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-150"
          download
        >
          <FaDownload className="h-4 w-4 mr-1" />
          Download
        </a>
        {isAdmin && isEditMode && (
          <button
            type="button"
            className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs sm:text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 transition-colors duration-150"
            onClick={() => onDelete(file.id, file.name)}
            disabled={deletingId === file.id}
          >
            <FaTrash className="h-4 w-4 mr-1" />
            {deletingId === file.id ? 'Deleting...' : 'Delete'}
          </button>
        )}
      </div>
    </div>
  );
};

export default React.memo(FileItem);
