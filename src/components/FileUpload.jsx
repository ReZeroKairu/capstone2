// src/components/FileUpload.jsx
import React, { useState, useEffect } from 'react';
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from '../firebase/firebase';
import { getFileTypeIcon, formatFileSize, isImage } from '../utils/fileUtils';

const FileUpload = ({ 
    onUploadSuccess, 
    onUploadError, 
    accept = '*', 
    className = '',
    buttonText = 'Choose File',
    uploadingText = 'Uploading...',
    id = 'file-upload',
    name = 'file-upload',
    initialFile = null,
    scanFunctionUrl = null // 🔹 Optional server-side virus scan endpoint
}) => {
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState(null);
  const [fileInfo, setFileInfo] = useState(initialFile);
  const [previewUrl, setPreviewUrl] = useState(null);

  useEffect(() => {
    if (initialFile) {
      setFileInfo(initialFile);
      if (initialFile.url && isImage(initialFile.name)) {
        setPreviewUrl(initialFile.url);
      }
    }
  }, [initialFile]);

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      setIsUploading(true);
      setUploadProgress(0);
      setError(null);

      // Validate file size (10MB max)
      const maxSize = 10 * 1024 * 1024; // 10MB
      if (file.size > maxSize) throw new Error('File size should be less than 10MB');

      // Generate preview for images
      if (isImage(file.name)) {
        const reader = new FileReader();
        reader.onload = (e) => setPreviewUrl(e.target.result);
        reader.readAsDataURL(file);
      } else {
        setPreviewUrl(null);
      }

      // --- Unique timestamped storage path ---
      const timestamp = Date.now();
      const safeFileName = file.name.replace(/[^\w\d.-]/g, '_');
      const storagePath = `manuscripts/${timestamp}_${safeFileName}`;
      const storageRef = ref(storage, storagePath);
      const uploadTask = uploadBytesResumable(storageRef, file);

      uploadTask.on(
        'state_changed',
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          setUploadProgress(progress);
        },
        (uploadError) => {
          console.error('Upload failed:', uploadError);
          const errorMsg = uploadError.message || 'Failed to upload file';
          setError(errorMsg);
          onUploadError?.({ message: errorMsg });
          setIsUploading(false);
          setPreviewUrl(null);
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
              lastModified: new Date().toISOString()
            };

            // --- Virus scan check ---
            if (scanFunctionUrl) {
              const response = await fetch(scanFunctionUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ storagePath })
              });
              const scanResult = await response.json();
              if (scanResult.infected) {
                // Remove infected file
                await deleteObject(storageRef);
                throw new Error(`Upload rejected: file contains virus${scanResult.viruses?.length ? ` (${scanResult.viruses.join(', ')})` : ''}`);
              }
            }

            // ✅ File is clean
            setFileInfo(fileData);
            onUploadSuccess?.(fileData);
          } catch (err) {
            console.error('Error after upload:', err);
            const errorMsg = err.message || 'Failed to process file';
            setError(errorMsg);
            onUploadError?.({ message: errorMsg });
            setPreviewUrl(null);
          } finally {
            setIsUploading(false);
          }
        }
      );
    } catch (error) {
      console.error('Error uploading file:', error);
      const errorMsg = error.message || 'Failed to upload file';
      setError(errorMsg);
      onUploadError?.({ message: errorMsg });
      setIsUploading(false);
      setPreviewUrl(null);
    }
  };

  const handleRemoveFile = async () => {
    if (fileInfo?.storagePath) {
      try {
        const storageRef = ref(storage, fileInfo.storagePath);
        await deleteObject(storageRef);
      } catch (err) {
        console.warn('Error removing file from storage:', err);
      }
    }
    setFileInfo(null);
    setPreviewUrl(null);
    onUploadSuccess?.(null);
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
          className={`
            inline-flex items-center px-4 py-2 border border-transparent 
            text-sm font-medium rounded-md shadow-sm text-white 
            bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 
            focus:ring-offset-2 focus:ring-blue-500
            ${isUploading || fileInfo ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer'}
          `}
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
          aria-label={buttonText}
          aria-describedby={`${id}-help`}
        />

        {fileInfo && (
          <div className="flex-1">
            <div className="flex items-center justify-between bg-gray-50 p-3 rounded-lg border border-gray-200">
              <div className="flex items-center space-x-3 min-w-0">
                <span className="text-2xl" role="img" aria-hidden="true">
                  {getFileTypeIcon(fileInfo.name)}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{fileInfo.name}</p>
                  <p className="text-xs text-gray-500">{formatFileSize(fileInfo.size)}</p>
                </div>
              </div>
              <div className="flex space-x-2">
                <button
                  type="button"
                  onClick={handleViewFile}
                  className="p-1.5 text-gray-500 hover:text-blue-600 focus:outline-none"
                  title="View file"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={handleRemoveFile}
                  className="p-1.5 text-gray-500 hover:text-red-600 focus:outline-none"
                  title="Remove file"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {previewUrl && isImage(fileInfo?.name) && (
        <div className="mt-2">
          <div className="relative pt-[56.25%] bg-gray-100 rounded-lg overflow-hidden">
            <img src={previewUrl} alt="Preview" className="absolute inset-0 w-full h-full object-contain" />
          </div>
        </div>
      )}

      {isUploading && (
        <div className="w-full bg-gray-200 rounded-full h-2.5">
          <div 
            className="bg-blue-600 h-2.5 rounded-full transition-all duration-300" 
            style={{ width: `${uploadProgress}%` }}
            role="progressbar"
            aria-valuenow={uploadProgress}
            aria-valuemin="0"
            aria-valuemax="100"
            aria-valuetext={`${Math.round(uploadProgress)}%`}
          ></div>
        </div>
      )}

      <p id={`${id}-help`} className="mt-1 text-sm text-gray-500">
        Accepted formats: {accept.replace(/\./g, ' ').replace(/,/g, ', ')} (Max 10MB)
      </p>

      {error && (
        <p className="mt-1 text-sm text-red-600" role="alert">{error}</p>
      )}
    </div>
  );
};

export default FileUpload;
