import React, { useState } from 'react';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { getAuth } from 'firebase/auth';
import { doc, updateDoc, getFirestore } from 'firebase/firestore';

const PeerReviewerForm = ({ profile, isEditing, formData, onChange }) => {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [educationEntries, setEducationEntries] = useState([{ school: '', degree: '', year: '' }]);
  const storage = getStorage();
  const auth = getAuth();
  const db = getFirestore();

  // Handle education entries changes
  const handleEducationChange = (index, field, value) => {
    const newEntries = [...educationEntries];
    newEntries[index] = { ...newEntries[index], [field]: value };
    setEducationEntries(newEntries);
    
    // Update parent form data
    onChange({
      target: {
        name: 'educations',
        value: newEntries
      }
    });
  };

  const addEducationEntry = () => {
    setEducationEntries([...educationEntries, { school: '', degree: '', year: '' }]);
  };

  const removeEducationEntry = (index) => {
    if (educationEntries.length > 1) {
      const newEntries = educationEntries.filter((_, i) => i !== index);
      setEducationEntries(newEntries);
      onChange({
        target: {
          name: 'educations',
          value: newEntries
        }
      });
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Check file type (only allow PDF, DOC, DOCX)
    const validTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (!validTypes.includes(file.type)) {
      alert('Please upload a valid document (PDF or Word)');
      return;
    }

    // Check file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('File size should be less than 5MB');
      return;
    }

    try {
      setUploading(true);
      setUploadProgress(0);
      
      // Create a reference to the file in Firebase Storage
      const fileRef = ref(storage, `cvs/${auth.currentUser.uid}_${Date.now()}_${file.name}`);
      
      // Upload the file
      const uploadTask = uploadBytes(fileRef, file);
      
      // Get the download URL
      const snapshot = await uploadTask;
      const downloadURL = await getDownloadURL(snapshot.ref);
      
      // Update the user's profile with the CV URL
      const userRef = doc(db, 'Users', auth.currentUser.uid);
      await updateDoc(userRef, {
        cvUrl: downloadURL,
        cvFileName: file.name,
        cvLastUpdated: new Date().toISOString()
      });
      
      // Update the form data
      onChange({
        target: {
          name: 'cvUrl',
          value: downloadURL
        }
      });
      
      setUploadProgress(100);
      alert('CV uploaded successfully!');
    } catch (error) {
      console.error('Error uploading CV:', error);
      alert('Error uploading CV. Please try again.');
    } finally {
      setUploading(false);
    }
  };
  
  const handleDownloadCV = (e) => {
    e.preventDefault();
    if (profile.cvUrl) {
      window.open(profile.cvUrl, '_blank');
    }
  };
  if (!isEditing && !profile.affiliation && !profile.expertise && !profile.specialty) {
    return null;
  }
  
  // Initialize education entries when profile or form data changes
  React.useEffect(() => {
    if (formData?.educations?.length > 0) {
      setEducationEntries(formData.educations);
    } else if (profile?.educations?.length > 0) {
      setEducationEntries(profile.educations);
    } else if (profile?.education) {
      setEducationEntries([{ school: profile.education, degree: '', year: '' }]);
    } else if (isEditing) {
      setEducationEntries([{ school: '', degree: '', year: '' }]);
    }
  }, [profile, formData, isEditing]);

  const renderInputField = (name, label, type = 'text', required = false, placeholder = '') => (
    <div className="space-y-2">
      <label htmlFor={name} className="block text-sm font-medium text-gray-700">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {isEditing ? (
        <input
          type={type}
          id={name}
          name={name}
          value={formData?.[name] || ''}
          onChange={onChange}
          className="mt-1 block w-full border border-gray-300 p-3 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 sm:text-base"
          placeholder={placeholder}
          required={required}
        />
      ) : (
        <p className="text-gray-900">{profile?.[name] || 'Not specified'}</p>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-medium text-gray-900 mb-4">Peer Reviewer Information</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {renderInputField('institution', 'Institution/Organization', 'text', true, 'Your institution or organization')}
        {renderInputField('university', 'University', 'text', true, 'Your university')}
        {renderInputField('universityAddress', 'University Address', 'text', true, 'Full university address')}
        {renderInputField('country', 'Country', 'text', true, 'Your country')}
        {renderInputField('continent', 'Continent', 'text', true, 'Your continent')}
        {renderInputField('citizenship', 'Citizenship', 'text', true, 'Your citizenship')}
        {renderInputField('residentialAddress', 'Current Residential Address', 'text', true, 'Your current address')}
        {renderInputField('zipCode', 'Zip Code', 'text', true, 'Your zip/postal code')}
        {renderInputField('currentPosition', 'Current Position', 'text', true, 'Your current job position')}
        {renderInputField('affiliation', 'HEI/Organization Affiliation', 'text', true, 'Your HEI/Organization')}
        {renderInputField('department', 'College/Department', 'text', true, 'Your department')}
        {renderInputField('fieldOfStudy', 'Field of Study', 'text', true, 'Your field of study')}
      </div>
      
      {/* Education Section */}
      <div className="mt-8">
        <h4 className="text-md font-medium text-gray-900 mb-4">Education</h4>
        {isEditing ? (
          <div className="space-y-4">
            {educationEntries.map((entry, index) => (
              <div key={index} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    School/University {index === 0 && <span className="text-red-500">*</span>}
                  </label>
                  <input
                    type="text"
                    value={entry.school || ''}
                    onChange={(e) => handleEducationChange(index, 'school', e.target.value)}
                    className="mt-1 block w-full border border-gray-300 p-2 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 sm:text-base"
                    required={index === 0}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Degree/Certificate
                  </label>
                  <input
                    type="text"
                    value={entry.degree || ''}
                    onChange={(e) => handleEducationChange(index, 'degree', e.target.value)}
                    className="mt-1 block w-full border border-gray-300 p-2 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 sm:text-base"
                  />
                </div>
                <div className="flex items-end space-x-2">
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700">
                      Year Graduated
                    </label>
                    <input
                      type="text"
                      value={entry.year || ''}
                      onChange={(e) => handleEducationChange(index, 'year', e.target.value)}
                      className="mt-1 block w-full border border-gray-300 p-2 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 sm:text-base"
                      placeholder="YYYY"
                    />
                  </div>
                  {educationEntries.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeEducationEntry(index)}
                      className="px-3 py-2 bg-red-100 text-red-700 rounded-md hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-red-500"
                    >
                      -
                    </button>
                  )}
                </div>
              </div>
            ))}
            <button
              type="button"
              onClick={addEducationEntry}
              className="mt-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              + Add Education
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {educationEntries.length > 0 ? (
              educationEntries.map((entry, index) => (
                <div key={index} className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <p className="text-gray-900">{entry.school || 'Not specified'}</p>
                  <p className="text-gray-900">{entry.degree || 'Not specified'}</p>
                  <p className="text-gray-900">{entry.year || 'Not specified'}</p>
                </div>
              ))
            ) : (
              <p className="text-gray-500">No education information available</p>
            )}
          </div>
        )}
      </div>
      
      <div className="space-y-2">
        <label htmlFor="specialty" className="block text-sm font-medium text-gray-700">
          Specialty <span className="text-red-500">*</span>
        </label>
        {isEditing ? (
          <input
            type="text"
            id="specialty"
            name="specialty"
            value={formData.specialty || ''}
            onChange={onChange}
            className="mt-1 block w-full border border-gray-300 p-3 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 sm:text-base"
            placeholder="Your area of expertise"
            required
          />
        ) : (
          <p className="text-gray-900">{profile.specialty || 'Not specified'}</p>
        )}
      </div>
      
      <div className="mb-5">
        <label htmlFor="department" className="block text-sm font-medium text-gray-700 mb-1">
          Department
        </label>
        {isEditing ? (
          <input
            type="text"
            id="department"
            name="department"
            value={formData.department || ''}
            onChange={onChange}
            className="block w-full border border-gray-300 p-3 shadow-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 sm:text-base"
          />
        ) : (
          <p className="text-gray-900">{profile.department || 'Not specified'}</p>
        )}
      </div>
      
      <div className="mb-5">
        <label htmlFor="institution" className="block text-sm font-medium text-gray-700 mb-1">
          Institution/Organization *
        </label>
        {isEditing ? (
          <input
            type="text"
            id="institution"
            name="institution"
            value={formData.institution || ''}
            onChange={onChange}
            className="block w-full border border-gray-300 p-3 shadow-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 sm:text-base"
            required
          />
        ) : (
          <p className="text-gray-900">{profile.institution || 'Not specified'}</p>
        )}
      </div>
      
      <div className="mb-5">
        <label htmlFor="expertise" className="block text-sm font-medium text-gray-700">
          Area of Expertise <span className="text-red-500">*</span>
        </label>
        {isEditing ? (
          <select
            id="expertise"
            name="expertise"
            value={formData.expertise || ''}
            onChange={onChange}
            className="mt-1 block w-full border border-gray-300 p-3 shadow-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 sm:text-base"
            required
          >
            <option value="">Select your area of expertise</option>
            <option value="Higher Education">Higher Education</option>
            <option value="Graduate Studies">Graduate Studies</option>
            <option value="Biodiversity">Biodiversity</option>
            <option value="Health">Health</option>
            <option value="IT">IT</option>
            <option value="Advancing Pharmacy">Advancing Pharmacy</option>
            <option value="Business and Governance">Business and Governance</option>
          </select>
        ) : (
          <p className="text-gray-900">{profile.expertise || 'Not specified'}</p>
        )}
      </div>
      
      <div className="space-y-2">
        <label htmlFor="interests" className="block text-sm font-medium text-gray-700">
          Research Interests
        </label>
        {isEditing ? (
          <input
            type="text"
            id="interests"
            name="interests"
            value={formData.interests || ''}
            onChange={onChange}
            className="mt-1 block w-full border border-gray-300 p-3 shadow-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 sm:text-base"
            placeholder="Your research interests"
          />
        ) : (
          <p className="text-gray-900">{profile.interests || 'Not specified'}</p>
        )}
      </div>
      
      {/* CV Upload/View Section */}
      <div className="space-y-2 pt-4 border-t border-gray-200">
        <label className="block text-sm font-medium text-gray-700">
          Curriculum Vitae (CV)
        </label>
        
        {isEditing ? (
          <div className="mt-1">
            <div className="flex items-center">
              <label className="cursor-pointer bg-white py-2 px-3 border border-gray-300 rounded-md shadow-sm text-sm leading-4 font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
                {uploading ? 'Uploading...' : 'Choose File'}
                <input
                  type="file"
                  className="sr-only"
                  onChange={handleFileUpload}
                  accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  disabled={uploading}
                />
              </label>
              {uploading && (
                <div className="ml-4 w-full max-w-xs">
                  <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <div 
                      className="bg-blue-600 h-2.5 rounded-full" 
                      style={{ width: `${uploadProgress}%` }}
                    ></div>
                  </div>
                </div>
              )}
            </div>
            <p className="mt-1 text-xs text-gray-500">
              Upload your CV (PDF or Word, max 5MB)
            </p>
            {formData.cvUrl && (
              <p className="mt-2 text-sm text-green-600">
                ✓ CV uploaded successfully
              </p>
            )}
          </div>
        ) : (
          <div>
            {profile.cvUrl ? (
              <div className="flex items-center">
                <button
                  onClick={handleDownloadCV}
                  className="text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center"
                >
                  <svg className="h-5 w-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path>
                  </svg>
                  {profile.cvFileName || 'Download CV'}
                </button>
                {profile.cvLastUpdated && (
                  <span className="ml-2 text-xs text-gray-500">
                    Last updated: {new Date(profile.cvLastUpdated).toLocaleDateString()}
                  </span>
                )}
              </div>
            ) : (
              <p className="text-sm text-gray-500">No CV uploaded</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default PeerReviewerForm;
