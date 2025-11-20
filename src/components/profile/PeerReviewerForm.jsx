import React, { useState, useEffect, useRef, useMemo } from 'react';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { getAuth } from 'firebase/auth';
import { doc, updateDoc, getFirestore } from 'firebase/firestore';

const PeerReviewerForm = ({ profile, isEditing, formData, onChange }) => {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [educationEntries, setEducationEntries] = useState([{ school: '', degree: '', year: '' }]);
  const hasChanges = useRef(false);
  const storage = getStorage();
  const auth = getAuth();
  const db = getFirestore();

  // Initialize education entries when profile or formData changes
  useEffect(() => {
    if (!profile && !formData) return;
    
    const dataSource = formData || profile;
    
    if (dataSource.educations?.length > 0) {
      setEducationEntries(Array.isArray(dataSource.educations) ? 
        dataSource.educations : 
        [{ school: dataSource.educations || '', degree: '', year: '' }]);
    } else if (dataSource.education) {
      setEducationEntries([{ school: dataSource.education, degree: '', year: '' }]);
    } else if (isEditing) {
      setEducationEntries([{ school: '', degree: '', year: '' }]);
    } else {
      setEducationEntries([]);
    }
  }, [profile, formData, isEditing]);

  const handleEducationChange = (index, field, value) => {
    hasChanges.current = true;
    setEducationEntries(prev => {
      const updatedEntries = [...prev];
      updatedEntries[index] = { ...updatedEntries[index], [field]: value };
      
      // Update the parent form data
      onChange({
        target: {
          name: 'educations',
          value: updatedEntries
        }
      });
      
      return updatedEntries;
    });
  };

  const renderEducationSection = () => (
    <div className="mt-6">
      <h4 className="text-md font-medium text-gray-900 mb-4 border-b pb-2">Education</h4>
      {isEditing ? (
        <div className="space-y-4">
          {educationEntries.map((entry, index) => (
            <div key={index} className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <input
                  type="text"
                  name="school"
                  value={entry.school || ''}
                  onChange={(e) => handleEducationChange(index, 'school', e.target.value)}
                  placeholder="School/University"
                  className="w-full border border-gray-300 p-2 rounded"
                />
              </div>
              <div>
                <input
                  type="text"
                  name="degree"
                  value={entry.degree || ''}
                  onChange={(e) => handleEducationChange(index, 'degree', e.target.value)}
                  placeholder="Degree/Certificate"
                  className="w-full border border-gray-300 p-2 rounded"
                />
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  name="year"
                  value={entry.year || ''}
                  onChange={(e) => handleEducationChange(index, 'year', e.target.value)}
                  placeholder="Year Graduated"
                  className="w-full border border-gray-300 p-2 rounded"
                />
                {index === educationEntries.length - 1 && (
                  <button
                    type="button"
                    onClick={() => {
                      const newEntries = [...educationEntries, { school: '', degree: '', year: '' }];
                      setEducationEntries(newEntries);
                      onChange({
                        target: {
                          name: 'educations',
                          value: newEntries
                        }
                      });
                    }}
                    className="text-green-600 hover:text-green-800 text-xl"
                  >
                    +
                  </button>
                )}
                {educationEntries.length > 1 && (
                  <button
                    type="button"
                    onClick={() => {
                      const filteredEntries = educationEntries.filter((_, i) => i !== index);
                      setEducationEntries(filteredEntries);
                      onChange({
                        target: {
                          name: 'educations',
                          value: filteredEntries
                        }
                      });
                    }}
                    className="text-red-600 hover:text-red-800 text-xl"
                  >
                    −
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {profile.educations?.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-medium mb-2">
              <div>School/University</div>
              <div>Degree/Certificate</div>
              <div>Year Graduated</div>
            </div>
          ) : (
            <div className="text-gray-500">No education information available</div>
          )}
          {profile.educations?.map((edu, index) => (
            <div key={index} className="grid grid-cols-1 md:grid-cols-3 gap-4 border-b pb-2">
              <div>{edu.school || '—'}</div>
              <div>{edu.degree || '—'}</div>
              <div>{edu.year || '—'}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

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
  if (!isEditing && !profile.affiliation && !profile.expertise) {
    return null;
  }
  
  return (
    <div className="space-y-6">
      <h3 className="text-lg font-medium text-gray-900 mb-4">Peer Reviewer Information</h3>
      
      {renderEducationSection()}
      
      <div className="space-y-2">
        <label htmlFor="affiliation" className="block text-sm font-medium text-gray-700">
          Organization Affiliation <span className="text-red-500">*</span>
        </label>
        {isEditing ? (
          <input
            type="text"
            id="affiliation"
            name="affiliation"
            value={formData.affiliation || ''}
            onChange={onChange}
            className="mt-1 block w-full border border-gray-300 p-3 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 sm:text-base"
            placeholder="Your institution or organization"
            required
          />
        ) : (
          <p className="text-gray-900">{profile.affiliation || 'Not specified'}</p>
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
          <div className="mt-1 text-gray-900">
            {profile.expertise ? (
              <div>{profile.expertise}</div>
            ) : (
              '—'
            )}
          </div>
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
