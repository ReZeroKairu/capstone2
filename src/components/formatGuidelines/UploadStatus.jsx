import React from 'react';

const UploadStatus = ({ uploadStatus, uploadProgress }) => {
  if (Object.keys(uploadStatus).length === 0) return null;

  return (
    <div className="mb-6 bg-gray-50 p-4 rounded-lg border border-gray-200">
      <h3 className="font-medium text-gray-700 mb-3">Upload Status</h3>
      <div className="space-y-2">
        {Object.entries(uploadStatus).map(([fileId, status]) => (
          <div key={fileId} className="text-sm">
            <div className="flex justify-between mb-1">
              <span className="truncate max-w-xs" title={status.name}>
                {status.name}
              </span>
              <span 
                className={`font-medium ${
                  status.status === 'completed' ? 'text-green-600' : 
                  status.status === 'error' ? 'text-red-600' : 'text-blue-600'
                }`}
              >
                {status.status === 'completed' ? '✓ ' : 
                 status.status === 'error' ? '✗ ' : '⏳ '}
                {status.status.charAt(0).toUpperCase() + status.status.slice(1)}
              </span>
            </div>
            {status.status === 'uploading' && (
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress[fileId] || 0}%` }}
                />
              </div>
            )}
            {status.error && (
              <p className="text-red-500 text-xs mt-1">{status.error}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default React.memo(UploadStatus);
