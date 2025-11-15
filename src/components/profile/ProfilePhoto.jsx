import React, { useState, useRef, useEffect } from 'react';
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faUser, faEdit } from "@fortawesome/free-solid-svg-icons";

const ProfilePhoto = ({ photoUrl, isEditing, onPhotoChange }) => {
  const fileInputRef = useRef(null);
  const [previewUrl, setPreviewUrl] = useState(photoUrl);
  
  useEffect(() => {
    setPreviewUrl(photoUrl);
  }, [photoUrl]);
  
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file.');
      return;
    }
    
    if (file.size > 1024 * 1024) { // 1MB limit
      alert('Image size must be less than 1MB.');
      return;
    }
    
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreviewUrl(reader.result);
      onPhotoChange(file);
    };
    reader.readAsDataURL(file);
  };
  
  const handleEditClick = () => {
    fileInputRef.current.click();
  };
  
  const getInitials = (name) => {
    if (!name) return '';
    return name
      .split(' ')
      .map(part => part[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  return (
    <div className="flex justify-center mb-8">
      <div className="relative w-[150px] h-[150px] rounded-full overflow-hidden bg-gray-100 border-4 border-white shadow-md">
        {previewUrl ? (
          <img 
            src={previewUrl} 
            alt="Profile" 
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-5xl text-gray-500 bg-gray-200">
            {getInitials(photoUrl?.displayName || '') || (
              <FontAwesomeIcon icon={faUser} className="text-4xl" />
            )}
          </div>
        )}
        
        {isEditing && (
          <div 
            className="absolute inset-0 bg-black bg-opacity-50 text-white flex flex-col items-center justify-center opacity-0 hover:opacity-100 transition-opacity duration-200 cursor-pointer"
            onClick={handleEditClick}
          >
            <FontAwesomeIcon icon={faEdit} className="mb-1 text-xl" />
            <span className="text-sm">Change Photo</span>
          </div>
        )}
        
        <input
          type="file"
          ref={fileInputRef}
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>
    </div>
  );
};

export default ProfilePhoto;
