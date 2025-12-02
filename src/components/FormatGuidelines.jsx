import React, { useState, useEffect, useCallback } from 'react';
import { 
  collection, 
  doc, 
  getDocs, 
  addDoc, 
  deleteDoc, 
  query, 
  orderBy, 
  serverTimestamp,
  getDoc,
  writeBatch
} from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, storage } from '../firebase/firebase';
import { getAuth } from 'firebase/auth';
import { FaUpload } from 'react-icons/fa';
import { toast } from 'react-toastify';
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import FileItem from './formatGuidelines/FileItem';
import UploadStatus from './formatGuidelines/UploadStatus';

// Draggable item type
const ITEM_TYPE = 'FILE';

// Draggable component
const DraggableFile = ({ file, index, moveFile, isAdmin, isEditMode, deletingId, onDelete }) => {
  const ref = React.useRef(null);
  const canDrag = isAdmin && isEditMode;

  const [{ isDragging }, drag] = useDrag({
    type: ITEM_TYPE,
    item: { index },
    canDrag: canDrag,
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  const [, drop] = useDrop({
    accept: ITEM_TYPE,
    canDrop: () => canDrag,
    hover(item, monitor) {
      if (!ref.current || !canDrag) {
        return;
      }
      const dragIndex = item.index;
      const hoverIndex = index;

      // Don't replace items with themselves
      if (dragIndex === hoverIndex) {
        return;
      }

      // Determine rectangle on screen
      const hoverBoundingRect = ref.current.getBoundingClientRect();
      // Get vertical middle
      const hoverMiddleY = (hoverBoundingRect.bottom - hoverBoundingRect.top) / 2;
      // Determine mouse position
      const clientOffset = monitor.getClientOffset();
      // Get pixels to the top
      const hoverClientY = clientOffset.y - hoverBoundingRect.top;

      // Only perform the move when the mouse has crossed half of the items height
      if (dragIndex < hoverIndex && hoverClientY < hoverMiddleY) {
        return;
      }
      if (dragIndex > hoverIndex && hoverClientY > hoverMiddleY) {
        return;
      }

      // Time to actually perform the action
      moveFile(dragIndex, hoverIndex);
      item.index = hoverIndex;
    },
  });

  // Set up the ref for drag and drop
  const setupRef = (node) => {
    ref.current = node;
    if (canDrag) {
      drag(drop(node));
    }
  };

  return (
    <div
      ref={setupRef}
      style={{
        opacity: isDragging ? 0.5 : 1,
        cursor: canDrag ? 'move' : 'default',
      }}
      className="relative"
    >
      <FileItem 
        file={file}
        isAdmin={isAdmin}
        isEditMode={isEditMode}
        deletingId={deletingId}
        onDelete={onDelete}
      />
    </div>
  );
};

// Main component

const FormatGuidelines = () => {
  const [files, setFiles] = useState([]);
  const [reorderedFiles, setReorderedFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({});
  const [uploadStatus, setUploadStatus] = useState({});
  const [deletingId, setDeletingId] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [filesBackup, setFilesBackup] = useState([]);
  
  const auth = getAuth();

  // Check if current user is admin
  const checkAdminStatus = useCallback(async () => {
    if (auth.currentUser) {
      try {
        const userDoc = await getDoc(doc(db, 'Users', auth.currentUser.uid));
        setIsAdmin(userDoc.data()?.role === 'Admin');
      } catch (error) {
        console.error('Error checking admin status:', error);
      }
    }
  }, [auth.currentUser]);

  useEffect(() => {
    checkAdminStatus();
  }, [checkAdminStatus]);

  // Fetch files from Firestore
  const fetchFiles = useCallback(async () => {
    try {
      const q = query(
        collection(db, 'formatGuidelines'),
        orderBy('order', 'asc')
      );
      const querySnapshot = await getDocs(q);
      const filesData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        order: doc.data().order || 0,
        ...doc.data()
      }));
      
      // Sort files by order to ensure consistent display
      const sortedFiles = [...filesData].sort((a, b) => a.order - b.order);
      setFiles(sortedFiles);
    } catch (error) {
      console.error('Error fetching files:', error);
      toast.error('Failed to load format guidelines');
    }
  }, []);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  // Handle file reordering (local only until saved)
  const moveFile = useCallback((dragIndex, hoverIndex) => {
    setReorderedFiles(prevFiles => {
      const newFiles = [...prevFiles];
      const [movedFile] = newFiles.splice(dragIndex, 1);
      newFiles.splice(hoverIndex, 0, movedFile);
      return newFiles;
    });
  }, []);

  const handleSaveChanges = useCallback(async () => {
    try {
      setUploading(true);
      const batch = writeBatch(db);
      const filesToSave = reorderedFiles.length > 0 ? reorderedFiles : files;
      
      // First, fetch the current documents to get their actual IDs
      const q = query(collection(db, 'formatGuidelines'));
      const querySnapshot = await getDocs(q);
      const docsMap = new Map();
      querySnapshot.forEach(doc => {
        docsMap.set(doc.data().name, { id: doc.id, ...doc.data() });
      });

      // Update order in Firestore
      const updates = [];
      filesToSave.forEach((file, index) => {
        const docData = docsMap.get(file.name);
        if (docData) {
          const fileRef = doc(db, 'formatGuidelines', docData.id);
          batch.update(fileRef, {
            order: index,
            updatedAt: serverTimestamp()
          });
          updates.push({ ...file, id: docData.id, order: index });
        }
      });
      
      if (updates.length > 0) {
        await batch.commit();
        setFiles(updates);
        setReorderedFiles([]);
        setIsEditMode(false);
        toast.success('Changes saved successfully');
      } else {
        toast.warning('No changes to save');
      }
    } catch (error) {
      console.error('Error saving changes:', error);
      toast.error('Failed to save changes');
    } finally {
      setUploading(false);
    }
  }, [files, reorderedFiles]);

  const handleCancelEdit = () => {
    setFiles(filesBackup);
    setReorderedFiles([]);
    setIsEditMode(false);
    setFilesBackup([]);
  };

  const handleEditClick = () => {
    setFilesBackup([...files]);
    setReorderedFiles([...files]); // Initialize reorderedFiles with current files
    setIsEditMode(true);
  };

  const handleFileUpload = useCallback(async (e) => {
    if (!isAdmin) return; // Only allow upload for admin users
    
    const newFiles = Array.from(e.target.files || []);
    if (newFiles.length === 0) return;

    // File validation - check against both files and reorderedFiles if in edit mode
    const currentFiles = isEditMode && reorderedFiles.length > 0 ? reorderedFiles : files;
    const { validFiles, invalidFiles, duplicateFiles, invalidTypeFiles } = validateFiles(newFiles, currentFiles);
    
    // Show validation messages
    showValidationMessages(invalidFiles, invalidTypeFiles, duplicateFiles);
    if (validFiles.length === 0) return;

    setUploading(true);
    
    // Initialize upload tracking
    const { initialStatus, initialProgress, uploadTimestamp } = initializeUploadTracking(validFiles);
    setUploadStatus(initialStatus);
    setUploadProgress(initialProgress);

    try {
      await processFileUploads(validFiles, uploadTimestamp);
      // If in edit mode, update reorderedFiles with the new files
      if (isEditMode) {
        const updatedFiles = [...reorderedFiles];
        // Add new files to the end of the list
        const newFileItems = validFiles.map(file => ({
          id: `${file.name}-${Date.now()}`,
          name: file.name,
          url: '', // This will be updated after upload
          size: file.size,
          uploadedAt: new Date(),
          order: reorderedFiles.length
        }));
        updatedFiles.push(...newFileItems);
        setReorderedFiles(updatedFiles);
      }
      await fetchFiles(); // Refresh the files list
      showUploadSummary(validFiles.length, Object.values(initialStatus).filter(s => s.status === 'completed').length);
    } catch (error) {
      console.error('Error in upload process:', error);
      toast.error('An error occurred during upload');
    } finally {
      cleanupUpload(e);
    }
  }, [files, fetchFiles, isAdmin, isEditMode, reorderedFiles]);

  const validateFiles = (newFiles, existingFiles) => {
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    ];

    const validFiles = [];
    const invalidFiles = [];
    const duplicateFiles = [];
    const invalidTypeFiles = [];

    newFiles.forEach(file => {
      if (file.size > 10 * 1024 * 1024) {
        invalidFiles.push(file.name);
      } else if (!allowedTypes.includes(file.type)) {
        invalidTypeFiles.push(file.name);
      } else if (files.some(f => f.name.toLowerCase() === file.name.toLowerCase())) {
        duplicateFiles.push(file.name);
      } else {
        validFiles.push(file);
      }
    });

    return { validFiles, invalidFiles, duplicateFiles, invalidTypeFiles };
  };

  const showValidationMessages = (invalidFiles, invalidTypeFiles, duplicateFiles) => {
    if (invalidFiles.length > 0) {
      toast.error(`Skipped ${invalidFiles.length} file(s) exceeding 10MB limit`);
    }
    
    if (invalidTypeFiles.length > 0) {
      toast.error(`Skipped ${invalidTypeFiles.length} invalid file type(s). Only PDF, Word, Excel, and PowerPoint files are allowed.`);
    }
    
    if (duplicateFiles.length > 0) {
      const displayNames = duplicateFiles.length > 3 
        ? `${duplicateFiles.slice(0, 3).join(', ')} and ${duplicateFiles.length - 3} more...`
        : duplicateFiles.join(', ');
      toast.warning(`Skipped ${duplicateFiles.length} duplicate file(s): ${displayNames}`);
    }
  };

  const initializeUploadTracking = (validFiles) => {
    const initialStatus = {};
    const initialProgress = {};
    const uploadTimestamp = Date.now();
    
    validFiles.forEach((file, index) => {
      const fileId = `upload-${uploadTimestamp}-${index}-${file.name}`;
      initialStatus[fileId] = { 
        name: file.name, 
        status: 'pending', 
        error: null 
      };
      initialProgress[fileId] = 0;
    });

    return { initialStatus, initialProgress, uploadTimestamp };
  };

  const processFileUploads = async (validFiles, uploadTimestamp) => {
    for (let i = 0; i < validFiles.length; i++) {
      const file = validFiles[i];
      const fileId = `upload-${uploadTimestamp}-${i}-${file.name}`;
      const storageFileName = `format-guidelines/${Date.now()}-${file.name}`;
      const storageRef = ref(storage, storageFileName);
      
      try {
        await uploadFile(file, fileId, storageRef, storageFileName);
      } catch (error) {
        console.error(`Error uploading ${file.name}:`, error);
        updateUploadStatus(fileId, 'error', error.message || 'Upload failed');
        await cleanupFailedUpload(storageRef);
      }
    }
  };

  const uploadFile = async (file, fileId, storageRef, storageFileName) => {
    updateUploadStatus(fileId, 'uploading');
    
    const uploadTask = uploadBytesResumable(storageRef, file);
    
    // Track upload progress
    uploadTask.on('state_changed',
      (snapshot) => {
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        setUploadProgress(prev => ({
          ...prev,
          [fileId]: progress
        }));
      },
      (error) => {
        console.error('Upload error:', error);
        updateUploadStatus(fileId, 'error', error.message);
        throw error;
      }
    );

    // Wait for upload to complete
    await uploadTask;
    const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);

    // Save file info to Firestore and get the document reference
    const docRef = await addDoc(collection(db, 'formatGuidelines'), {
      name: file.name,
      url: downloadURL,
      storagePath: storageFileName,
      size: file.size,
      type: file.type,
      order: files.length,
      uploadedAt: serverTimestamp(),
      uploadedBy: auth.currentUser?.uid || 'system',
    });

    // Create the new file object with the Firestore-generated ID
    const newFile = {
      id: docRef.id,
      name: file.name,
      url: downloadURL,
      storagePath: storageFileName,
      size: file.size,
      type: file.type,
      order: files.length,
      uploadedAt: new Date(),
      uploadedBy: auth.currentUser?.uid || 'system',
    };

    // Update the local state with the new file including the Firestore-generated ID
    setFiles(prevFiles => [...prevFiles, newFile]);
    
    // If in edit mode, also update the reorderedFiles
    if (isEditMode) {
      setReorderedFiles(prev => [...prev, newFile]);
    }

    updateUploadStatus(fileId, 'completed');
  };

  const updateUploadStatus = (fileId, status, error = null) => {
    setUploadStatus(prev => ({
      ...prev,
      [fileId]: { 
        ...prev[fileId], 
        status,
        ...(error && { error }),
        ...(status === 'completed' && { progress: 100 })
      }
    }));
  };

  const cleanupFailedUpload = async (storageRef) => {
    try {
      await deleteObject(storageRef);
    } catch (cleanupError) {
      console.warn('Could not clean up failed upload:', cleanupError);
    }
  };

  const showUploadSummary = (totalFiles, successCount) => {
    if (successCount > 0) {
      toast.success(`Successfully uploaded ${successCount} file(s)`);
    }
    
    if (successCount < totalFiles) {
      toast.warning(`Some files failed to upload. Please check the upload status.`);
    }
  };

  const cleanupUpload = (e) => {
    setUploading(false);
    if (e?.target) e.target.value = ''; // Reset file input
    
    // Clear upload status after a delay
    setTimeout(() => {
      setUploadStatus({});
      setUploadProgress({});
    }, 5000);
  };

  const handleDeleteFile = useCallback(async (fileId, fileName) => {
    if (!isEditMode || !isAdmin) return; // Only allow deletion in edit mode and for admins
    
    if (!window.confirm(`Are you sure you want to delete "${fileName}"?`)) return;

    setDeletingId(fileId);
    try {
      const fileToDelete = files.find(file => file.id === fileId);
      if (!fileToDelete) {
        throw new Error('File not found');
      }

      await deleteFileFromStorage(fileToDelete);
      await deleteDoc(doc(db, 'formatGuidelines', fileId));
      
      // Update both files and reorderedFiles states
      setFiles(prev => prev.filter(file => file.id !== fileId));
      setReorderedFiles(prev => prev.filter(file => file.id !== fileId));
      
      toast.success(`"${fileName}" deleted successfully`);
    } catch (error) {
      console.error('Error deleting file:', error);
      const errorMessage = error.code === 'storage/object-not-found' 
        ? 'File was already removed from storage' 
        : 'Failed to delete file';
      toast.error(errorMessage);
    } finally {
      setDeletingId(null);
    }
  }, [files, isEditMode, isAdmin]);

  const deleteFileFromStorage = async (file) => {
    if (!file?.url) return;
    
    try {
      const fileRef = ref(storage, file.storagePath || file.url);
      await deleteObject(fileRef);
    } catch (error) {
      if (error.code !== 'storage/object-not-found') {
        console.warn('Error deleting from storage:', error);
        // Re-throw to be handled by the caller
        throw error;
      }
      // If file not found in storage, we can continue with Firestore deletion
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="container mx-auto py-36 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">Manuscript Format Guidelines</h1>
              <p className="text-gray-600 mt-1 sm:mt-2 text-sm sm:text-base">
                Download the required format templates and guidelines for manuscript submission.
              </p>
            </div>
            
            {isAdmin && (
              <div className="flex gap-2">
                {!isEditMode ? (
                  <button
                    type="button"
                    onClick={handleEditClick}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    Edit Guidelines
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={handleSaveChanges}
                      disabled={uploading || deletingId}
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
                    >
                      Save Changes
                    </button>
                    <button
                      type="button"
                      onClick={handleCancelEdit}
                      disabled={uploading || deletingId}
                      className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  </>
                )}
                {isEditMode && (
                  <div className="relative">
                    <label
                      className={`inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${
                        uploading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                      }`}
                    >
                      <FaUpload className="mr-2" />
                      {uploading ? 'Uploading...' : 'Upload File'}
                      <input
                        type="file"
                        className="hidden"
                        onChange={handleFileUpload}
                        disabled={uploading}
                        multiple
                        accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
                      />
                    </label>
                  </div>
                )}
              </div>
            )}
          </div>

          <UploadStatus uploadStatus={uploadStatus} uploadProgress={uploadProgress} />

          <div className="bg-white rounded-lg shadow overflow-hidden border border-gray-200">
            <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
              <h3 className="text-lg font-medium leading-6 text-gray-900">Available Guidelines</h3>
              <p className="mt-1 text-sm text-gray-500">
                {isEditMode 
                  ? 'Drag to reorder files. Click the upload button to add new files.'
                  : isAdmin
                    ? 'Click "Edit Guidelines" to modify the files.'
                    : 'Click to download the guideline files.'}
              </p>
            </div>
            
            {files.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500">No format guidelines available yet.</p>
                {isAdmin && (
                  <p className="mt-2 text-sm text-gray-500">
                    Click the "Upload File" button to add a new format guideline.
                  </p>
                )}
              </div>
            ) : (
              <ul className="divide-y divide-gray-200">
                {(isEditMode && reorderedFiles.length > 0 ? reorderedFiles : files).map((file, index) => (
                  <li key={file.id} className="relative">
                    <DraggableFile 
                      file={file}
                      index={index}
                      moveFile={moveFile}
                      isAdmin={isAdmin}
                      isEditMode={isEditMode}
                      deletingId={deletingId}
                      onDelete={handleDeleteFile}
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </DndProvider>
  );
};

export default FormatGuidelines;
