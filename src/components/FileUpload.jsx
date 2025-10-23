// src/components/FileUpload.jsx
import React, { useState, useEffect } from 'react';
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from '../firebase/firebase';
import { getFileTypeIcon, formatFileSize, isImage } from '../utils/fileUtils';

const FileUpload = ({
  onUploadSuccess,
  onUploadError,
  accept = ".doc,.docx",
  className = '',
  buttonText = 'Choose File',
  uploadingText = 'Uploading...',
  id = 'file-upload',
  name = 'file-upload',
  initialFile = null
}) => {
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState(null);
  const [fileInfo, setFileInfo] = useState(initialFile);
  const [previewUrl, setPreviewUrl] = useState(null);

  useEffect(() => {
    if (initialFile) {
      setFileInfo(initialFile);
      if (initialFile.url && isImage(initialFile.name)) setPreviewUrl(initialFile.url);
    }
  }, [initialFile]);

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      setIsUploading(true);
      setUploadProgress(0);
      setError(null);

      // Validate file type and size
      const allowedTypes = [
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      ];
      const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
      if (!allowedTypes.includes(file.type) && ![".doc", ".docx"].includes(ext)) {
        throw new Error("Only .doc and .docx files are allowed");
      }
      if (file.size > 15 * 1024 * 1024) throw new Error("File size should be less than 15MB");

      setPreviewUrl(null);

      const timestamp = Date.now();
      const safeFileName = file.name.replace(/[^\w\d.-]/g, "_");
      const storagePath = `manuscripts/${timestamp}_${safeFileName}`;
      const storageRef = ref(storage, storagePath);
      const uploadTask = uploadBytesResumable(storageRef, file);

      uploadTask.on(
        "state_changed",
        (snapshot) => setUploadProgress((snapshot.bytesTransferred / snapshot.totalBytes) * 100),
        (uploadError) => {
          console.error("Upload failed:", uploadError);
          setError(uploadError.message || "Failed to upload file");
          onUploadError?.({ message: uploadError.message });
          setIsUploading(false);
        },
        async () => {
          try {
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
            const fileData = {
              url: downloadURL,
              name: file.name,
              type: file.type,
              size: file.size,
              storagePath,
              lastModified: new Date().toISOString(),
            };
            setFileInfo(fileData);
            onUploadSuccess?.(fileData);
          } catch (err) {
            console.error("Error after upload:", err);
            setError(err.message || "Failed to process file");
            onUploadError?.({ message: err.message });
          } finally {
            setIsUploading(false);
          }
        }
      );
    } catch (err) {
      console.error("Error uploading file:", err);
      setError(err.message || "Failed to upload file");
      onUploadError?.({ message: err.message });
      setIsUploading(false);
    }
  };

  const handleRemoveFile = async () => {
    if (fileInfo?.storagePath) {
      try { await deleteObject(ref(storage, fileInfo.storagePath)); } 
      catch (err) { console.warn("Error removing file from storage:", err); }
    }
    setFileInfo(null);
    setPreviewUrl(null);
    onUploadSuccess?.(null);
    const input = document.getElementById(id);
    if (input) input.value = "";
  };

  const handleViewFile = (e) => {
    e.preventDefault();
    if (fileInfo?.url) window.open(fileInfo.url, '_blank');
  };

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="flex items-center gap-3">
        <label 
          htmlFor={id}
          className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${isUploading || fileInfo ? 'opacity-70 cursor-not-allowed pointer-events-none' : 'cursor-pointer'}`}
          aria-disabled={isUploading || !!fileInfo}
        >
          {isUploading ? uploadingText : buttonText}
        </label>
        <input
          id={id}
          name={name}
          type="file"
          className="sr-only"
          onChange={handleFileChange}
          disabled={isUploading || !!fileInfo}
          accept={accept}
        />
        {fileInfo && (
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between bg-gray-50 p-3 rounded-lg border border-gray-200">
              <div className="flex items-center space-x-3 min-w-0 flex-1">
                <span className="flex-shrink-0 text-2xl">{getFileTypeIcon(fileInfo.name)}</span>
                <div className="min-w-0 overflow-hidden">
                  <p className="text-sm font-medium text-gray-900 truncate" title={fileInfo.name}>
                    {fileInfo.name}
                  </p>
                  <p className="text-xs text-gray-500">{formatFileSize(fileInfo.size)}</p>
                </div>
              </div>
              <div className="flex space-x-2">
                <button type="button" onClick={handleViewFile} className="p-1.5 text-gray-500 hover:text-blue-600 focus:outline-none" title="View file">View</button>
                <button type="button" onClick={handleRemoveFile} className="p-1.5 text-gray-500 hover:text-red-600 focus:outline-none" title="Remove file">Remove</button>
              </div>
            </div>
          </div>  
        )}
      </div>

      {isUploading && (
        <div className="w-full bg-gray-200 rounded-full h-2.5">
          <div className="bg-blue-600 h-2.5 rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%` }} role="progressbar" aria-valuenow={uploadProgress} aria-valuemin="0" aria-valuemax="100" aria-valuetext={`${Math.round(uploadProgress)}%`}></div>
        </div>
      )}

      <p className="mt-1 text-sm text-gray-500">Accepted formats: {accept.replace(/\./g, ' ').replace(/,/g, ', ')} (Max 15MB)</p>
      {error && <p className="mt-1 text-sm text-red-600" role="alert">{error}</p>}
    </div>
  );
};

export default FileUpload;
