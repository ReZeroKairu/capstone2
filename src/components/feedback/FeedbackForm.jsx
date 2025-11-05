import React, { useState } from 'react';
import FileUpload from '../FileUpload';

export const FeedbackForm = ({
  feedback,
  setFeedback,
  file,
  setFile,
  filePreview,
  setFilePreview,
  uploading,
  submitting,
  editingFeedback,
  onSubmit,
  onCancel,
  fileInputKey,
}) => {
  const [localFile, setLocalFile] = useState(file);
  const [localFilePreview, setLocalFilePreview] = useState(filePreview);
  const [isRemovingFile, setIsRemovingFile] = useState(false);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    
    // Clear any previous file
    if (localFile) {
      URL.revokeObjectURL(localFilePreview);
      setLocalFile(null);
      setLocalFilePreview(null);
    }
    
    if (selectedFile) {
      const validTypes = [
        'application/msword', 
    'application/pdf',
       
      ];
      
      const fileExtension = selectedFile.name.split('.').pop().toLowerCase();
      const maxFileSize = 10 * 1024 * 1024; // 10MB
      
      if (selectedFile.size > maxFileSize) {
        alert('File size must be less than 10MB');
        e.target.value = '';
        return;
      }
      
      if (!validTypes.includes(selectedFile.type) && !['doc', 'docx', 'pdf', 'txt'].includes(fileExtension)) {
        alert('Please upload a valid document file (DOC, DOCX, PDF, TXT, XLS, XLSX) or archive (ZIP, RAR, 7Z)');
        e.target.value = '';
        return;
      }
      
      setLocalFile(selectedFile);
      setLocalFilePreview(URL.createObjectURL(selectedFile));
      setFile(selectedFile);
      setFilePreview(URL.createObjectURL(selectedFile));
    }
  };

  const handleRemoveFile = () => {
    if (localFilePreview && localFilePreview.startsWith('blob:')) {
      URL.revokeObjectURL(localFilePreview);
    }
    setLocalFile(null);
    setLocalFilePreview(null);
    setFile(null);
    setFilePreview(null);
    setIsRemovingFile(true);
    const fileInput = document.getElementById('file-upload');
    if (fileInput) fileInput.value = '';
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit();
  };

  return (
    <form onSubmit={handleSubmit} className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
      <div className="mb-4">
       
        <textarea
          id="feedback"
          rows="3"
          className="shadow-sm focus:ring-blue-500 focus:border-blue-500 mt-1 block w-full sm:text-sm border border-gray-300 rounded-md p-2"
          placeholder="Enter your feedback here..."
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
        />
      </div>

      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Attach File (Optional)
        </label>
        <input
          key={fileInputKey}
          id="file-upload"
          type="file"
          onChange={handleFileChange}
          className="block w-full text-sm text-gray-500
            file:mr-4 file:py-2 file:px-4
            file:rounded-md file:border-0
            file:text-sm file:font-semibold
            file:bg-blue-50 file:text-blue-700
            hover:file:bg-blue-100"
          accept="*"
        />
        {(localFile || localFilePreview || (editingFeedback?.fileUrl && !isRemovingFile)) && (
          <div className="mt-2 text-sm text-gray-600">
            Selected file: {localFile?.name || editingFeedback?.fileName || 'File'}
            <button
              type="button"
              onClick={handleRemoveFile}
              className="ml-2 text-red-600 hover:text-red-800 text-xs"
            >
              Remove
            </button>
            {editingFeedback?.fileUrl && !localFile && !isRemovingFile && (
              <div className="text-xs text-blue-600 mt-1">
                Note: Removing this file will delete it when you save your changes.
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex justify-end space-x-2">
        {editingFeedback && (
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={(!feedback.trim() && !localFile) || uploading}
          className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 flex items-center"
        >
          {uploading ? (
            <>
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              {editingFeedback ? 'Updating...' : 'Submitting...'}
            </>
          ) : editingFeedback ? 'Update Feedback' : 'Submit Feedback'}
        </button>
      </div>
    </form>
  );
};

export default FeedbackForm;
