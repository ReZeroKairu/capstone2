import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { getAuth } from "firebase/auth";
import { doc, updateDoc, getFirestore } from "firebase/firestore";

const ResearcherForm = ({ profile, formData: initialFormData, onChange, isEditing }) => {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const storage = getStorage();
  const auth = getAuth();
  const db = getFirestore();
  // Local state for form data
  const [localFormData, setLocalFormData] = useState(initialFormData);
  
  // Update local form data when initialFormData changes
  useEffect(() => {
    setLocalFormData(initialFormData);
  }, [initialFormData]);

  // Handle input changes and update both local and parent state
  const handleChange = (e) => {
    const { name, value } = e.target;
    const updatedFormData = {
      ...localFormData,
      [name]: value
    };
    setLocalFormData(updatedFormData);
    onChange(e); // Still notify parent of changes
  };

  // Handle array field changes
  const handleArrayChange = (field, index, value) => {
    const updatedArray = [...(localFormData[field] || [])];
    updatedArray[index] = value;
    const updatedFormData = {
      ...localFormData,
      [field]: updatedArray
    };
    setLocalFormData(updatedFormData);
    // Create a synthetic event to notify parent
    const e = {
      target: {
        name: field,
        value: updatedArray
      }
    };
    onChange(e);
  };

  // Use refs to track previous values and prevent unnecessary updates
  const prevProfileRef = useRef(profile);
  const prevIsEditingRef = useRef(isEditing);
  
  // Initialize state with empty values
  // Initialize arrays from form data with fallback to profile data
  const [educationEntries, setEducationEntries] = useState(
    localFormData.educations?.length > 0 
      ? localFormData.educations 
      : profile?.educations || [{ school: '', degree: '', year: '' }]
  );
  
  const [publicationEntries, setPublicationEntries] = useState(
    localFormData.publications?.length > 0 
      ? localFormData.publications 
      : profile?.publications || [{ title: '', year: '', journal: '' }]
  );
  
  const [presentationEntries, setPresentationEntries] = useState(
    localFormData.presentations?.length > 0 
      ? localFormData.presentations 
      : profile?.presentations || [{ title: '', year: '', conference: '' }]
  );
  
  const [awards, setAwards] = useState(
    localFormData.awards?.length > 0 
      ? localFormData.awards 
      : profile?.awards || ['']
  );
  
  // Sync local array states with form data
  useEffect(() => {
    if (localFormData.educations) {
      setEducationEntries(localFormData.educations);
    }
    if (localFormData.publications) {
      setPublicationEntries(localFormData.publications);
    }
    if (localFormData.presentations) {
      setPresentationEntries(localFormData.presentations);
    }
    if (localFormData.awards) {
      setAwards(localFormData.awards);
    }
  }, [localFormData]);

  // Memoize derived state to prevent unnecessary re-renders
  const hasChanges = useRef(false);

  // Memoize the profile data to prevent unnecessary effect triggers
  const profileData = useMemo(() => ({
    // Basic info
    university: localFormData?.university || profile?.university || '',
    universityAddress: localFormData?.universityAddress || profile?.universityAddress || '',
    country: localFormData?.country || profile?.country || '',
    continent: localFormData?.continent || profile?.continent || '',
    citizenship: localFormData?.citizenship || profile?.citizenship || '',
    residentialAddress: localFormData?.residentialAddress || profile?.residentialAddress || '',
    zipCode: localFormData?.zipCode || profile?.zipCode || '',
    currentPosition: localFormData?.currentPosition || profile?.currentPosition || '',
    affiliation: localFormData?.affiliation || profile?.affiliation || '',
    department: localFormData?.department || profile?.department || '',
    researchInterests: localFormData?.researchInterests || profile?.researchInterests || '',
    
    // Array fields
    educations: localFormData?.educations || profile?.educations || [],
    education: localFormData?.education || profile?.education || '',
    publications: localFormData?.publications || profile?.publications || [],
    presentations: localFormData?.presentations || profile?.presentations || [],
    awards: localFormData?.awards || profile?.awards || []
  }), [profile, localFormData]);

  // Initialize form data when profile or formData changes or when toggling to edit mode
  useEffect(() => {
    if (!profile && !localFormData) return;
    
    // Only update state if there are actual changes to prevent unnecessary re-renders
    const updateState = () => {
      // Use formData from props if available, otherwise use profile data
      const dataSource = localFormData || profileData;
      
      // Set education entries
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

      // Set publication entries
      if (dataSource.publications?.length > 0) {
        setPublicationEntries(Array.isArray(dataSource.publications) ? 
          dataSource.publications : 
          [{ title: dataSource.publications || '', year: '', journal: '' }]);
      } else if (isEditing) {
        setPublicationEntries([{ title: '', year: '', journal: '' }]);
      } else {
        setPublicationEntries([]);
      }

      // Set presentation entries
      if (dataSource.presentations?.length > 0) {
        setPresentationEntries(Array.isArray(dataSource.presentations) ? 
          dataSource.presentations : 
          [{ title: dataSource.presentations || '', year: '', conference: '' }]);
      } else if (isEditing) {
        setPresentationEntries([{ title: '', year: '', conference: '' }]);
      } else {
        setPresentationEntries([]);
      }

      // Set awards
      if (dataSource.awards?.length > 0) {
        setAwards(Array.isArray(dataSource.awards) ? 
          dataSource.awards : 
          [String(dataSource.awards || '')]);
      } else if (isEditing) {
        setAwards(['']);
      } else {
        setAwards([]);
      }
    };

    updateState();
    hasChanges.current = false;
  }, [profile, localFormData, isEditing]);

  // Memoize the form data to prevent unnecessary effect triggers
  const formState = useMemo(() => ({
    educationEntries,
    publicationEntries,
    presentationEntries,
    awards,
    isEditing
  }), [educationEntries, publicationEntries, presentationEntries, awards, isEditing]);

  // Update parent form data when our state changes and we're in edit mode
  const updateParentFormData = useCallback(() => {
    if (!isEditing) return;
    
    // Create updates object with current state
    const updates = {
      // Basic info fields  
      university: localFormData?.university || '',
      universityAddress: localFormData?.universityAddress || '',
      country: localFormData?.country || '',
      continent: localFormData?.continent || '',
      citizenship: localFormData?.citizenship || '',
      residentialAddress: localFormData?.residentialAddress || '',
      zipCode: localFormData?.zipCode || '',
      currentPosition: localFormData?.currentPosition || '',
      affiliation: localFormData?.affiliation || '',
      department: localFormData?.department || '',
      researchInterests: localFormData?.researchInterests || '',
      // Update education field for backward compatibility
      education: educationEntries[0]?.school || '',
      // Update array fields
      educations: educationEntries,
      publications: publicationEntries,
      presentations: presentationEntries,
      awards: awards
    };
    
    // Only update if there are actual changes
    const hasUpdates = Object.entries(updates).some(([key, value]) => {
      const currentValue = localFormData?.[key];
      return JSON.stringify(currentValue) !== JSON.stringify(value);
    });
    
    if (hasUpdates) {
      // Update all fields at once to prevent multiple re-renders
      onChange({ 
        target: { 
          name: 'researcherForm', 
          value: updates 
        } 
      });
    }
    
    hasChanges.current = false;
  }, [isEditing, educationEntries, publicationEntries, presentationEntries, awards, localFormData, onChange]);
  
  // Update parent form data when any of the arrays change in edit mode
  useEffect(() => {
    if (!isEditing) return;
    
    const timer = setTimeout(() => {
      updateParentFormData();
    }, 100);
    
    return () => clearTimeout(timer);
  }, [educationEntries, publicationEntries, presentationEntries, awards, isEditing, updateParentFormData]);
  
  // Initial data load
  useEffect(() => {
    if (profile && Object.keys(profile).length > 0) {
      hasChanges.current = true;
      // Use a small timeout to ensure all state is initialized
      const timer = setTimeout(() => {
        updateParentFormData();
      }, 100);
      
      return () => clearTimeout(timer);
    }
  }, [profile, updateParentFormData]);

  // Remove the duplicate useEffect hooks since we're now using updateParentFormData

  // Check if there's any data to show in view mode
  const hasData =  profile?.researchInterests || 
                 profile?.department || profile?.university || profile?.universityAddress || 
                 profile?.country || profile?.continent || profile?.citizenship || 
                 profile?.residentialAddress || profile?.zipCode || profile?.currentPosition || 
                 profile?.affiliation || profile?.publications?.length > 0 || 
                 profile?.presentations?.length > 0 || profile?.awards?.length > 0 || 
                 profile?.educations?.length > 0 || profile?.education;

  if (!isEditing && !hasData) {
    return null;
  }

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Check file type (only allow PDF, DOC, DOCX)
    const validTypes = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];
    if (!validTypes.includes(file.type)) {
      alert("Please upload a valid document (PDF or Word)");
      return;
    }

    // Check file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert("File size should be less than 5MB");
      return;
    }

    try {
      setUploading(true);
      setUploadProgress(0);

      // Create a reference to the file in Firebase Storage with user ID as folder
      const fileRef = ref(
        storage,
        `researcher-cvs/${auth.currentUser.uid}/${Date.now()}_${file.name}`
      );

      // Upload the file
      const uploadTask = uploadBytes(fileRef, file);

      // Get the download URL
      const snapshot = await uploadTask;
      const downloadURL = await getDownloadURL(snapshot.ref);

      // Update the form data with CV information
      const updatedFormData = {
        ...localFormData,
        cvUrl: downloadURL,
        cvFileName: file.name,
        cvLastUpdated: new Date().toISOString()
      };
      
      setLocalFormData(updatedFormData);

      // Notify parent component of the change
      onChange({
        target: {
          name: 'researcherForm',
          value: updatedFormData
        }
      });

      // Also update the user's profile in Firestore
      const userRef = doc(db, "Users", auth.currentUser.uid);
      await updateDoc(userRef, {
        cvUrl: downloadURL,
        cvFileName: file.name,
        cvLastUpdated: new Date().toISOString(),
      });

      setUploadProgress(100);
      alert("CV uploaded successfully!");
    } catch (error) {
      console.error("Error uploading CV:", error);
      alert("Error uploading CV. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const handleDownloadCV = (e) => {
    e.preventDefault();
    const cvUrl = localFormData.cvUrl || profile?.cvUrl;
    if (cvUrl) {
      window.open(cvUrl, "_blank");
    }
  };

  const renderInputField = (id, label, required = false, type = 'text', placeholder = '') => (
    <div className="mb-4">
      <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {isEditing ? (
        <input
          type={type}
          id={id}
          name={id}
          value={localFormData[id] || ''}
          onChange={handleChange}
          placeholder={placeholder}
          className="block w-full border border-gray-300 p-2 shadow-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 sm:text-base"
          required={required}
        />
      ) : (
        <div className="mt-1 text-gray-900">{profile[id] || '—'}</div>
      )}
    </div>
  );

  const renderTextArea = (id, label, required = false, rows = 3) => (
    <div className="mb-4">
      <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {isEditing ? (
        <textarea
          id={id}
          name={id}
          value={localFormData[id] || ''}
          onChange={handleChange}
          rows={rows}
          className="block w-full border border-gray-300 p-2 shadow-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 sm:text-base"
          required={required}
        />
      ) : (
        <div className="mt-1 text-gray-900">
          {profile[id] ? <div className="whitespace-pre-line">{profile[id]}</div> : '—'}
        </div>
      )}
    </div>
  );

  const handleEducationChange = (index, field, value) => {
    const updatedEntries = [...educationEntries];
    updatedEntries[index] = { ...updatedEntries[index], [field]: value };
    setEducationEntries(updatedEntries);
    // Update form data
    handleArrayChange('educations', index, updatedEntries[index]);
  };

  const renderEducationSection = () => (
    <div className="mt-8">
     <h4 className="text-md font-medium text-gray-900 mb-4 border-b pb-2">
  Education <span className="text-red-500">*</span>
</h4>     {isEditing ? (
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
                  const newEntry = { school: '', degree: '', year: '' };
                  setEducationEntries([...educationEntries, newEntry]);
                  handleArrayChange('educations', educationEntries.length, newEntry);
                }}
                    className="text-green-600 hover:text-green-800 text-xl"
                  >
                    +
                  </button>
                )}
                {educationEntries.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setEducationEntries(educationEntries.filter((_, i) => i !== index))}
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
            <div className="text-gray-500">No education entries</div>
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

  const handlePublicationChange = (index, field, value) => {
    const updatedEntries = [...publicationEntries];
    updatedEntries[index] = { ...updatedEntries[index], [field]: value };
    setPublicationEntries(updatedEntries);
    // Update form data
    handleArrayChange('publications', index, updatedEntries[index]);
  };

  const renderPublicationsSection = () => (
    <div className="mt-8">
      <h4 className="text-md font-medium text-gray-900 mb-4 border-b pb-2">List of Publications (Last 5 Years) <span className="text-red-500">*</span></h4>
      {isEditing ? (
        <div className="space-y-4">
          {publicationEntries.map((entry, index) => (
            <div key={index} className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <input
                  type="text"
                  name="title"
                  value={entry.title || ''}
                  onChange={(e) => handlePublicationChange(index, 'title', e.target.value)}
                  placeholder="Full Title"
                  className="w-full border border-gray-300 p-2 rounded"
                />
              </div>
              <div>
                <input
                  type="text"
                  name="year"
                  value={entry.year || ''}
                  onChange={(e) => handlePublicationChange(index, 'year', e.target.value)}
                  placeholder="Year Published"
                  className="w-full border border-gray-300 p-2 rounded"
                />
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  name="journal"
                  value={entry.journal || ''}
                  onChange={(e) => handlePublicationChange(index, 'journal', e.target.value)}
                  placeholder="Journal/Publisher"
                  className="w-full border border-gray-300 p-2 rounded"
                />
                {index === publicationEntries.length - 1 && (
                  <button
                    type="button"
                    onClick={() => {
                  const newEntry = { title: '', year: '', journal: '' };
                  setPublicationEntries([...publicationEntries, newEntry]);
                  handleArrayChange('publications', publicationEntries.length, newEntry);
                }}
                    className="text-green-600 hover:text-green-800 text-xl"
                  >
                    +
                  </button>
                )}
                {publicationEntries.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setPublicationEntries(publicationEntries.filter((_, i) => i !== index))}
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
          {profile.publications?.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-medium mb-2">
              <div>Full Title</div>
              <div>Year Published</div>
              <div>Journal/Publisher</div>
            </div>
          ) : (
            <div className="text-gray-500">No publications listed</div>
          )}
          {profile.publications?.map((pub, index) => (
            <div key={index} className="grid grid-cols-1 md:grid-cols-3 gap-4 border-b pb-2">
              <div>{pub.title || '—'}</div>
              <div>{pub.year || '—'}</div>
              <div>{pub.journal || '—'}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const handlePresentationChange = (index, field, value) => {
    const updatedEntries = [...presentationEntries];
    updatedEntries[index] = { ...updatedEntries[index], [field]: value };
    setPresentationEntries(updatedEntries);
    // Update form data
    handleArrayChange('presentations', index, updatedEntries[index]);
  };

  const renderPresentationsSection = () => (
    <div className="mt-8">
      <h4 className="text-md font-medium text-gray-900 mb-4 border-b pb-2">List of Paper Presentations (Last 5 Years) <span className="text-red-500">*</span></h4>
      {isEditing ? (
        <div className="space-y-4">
          {presentationEntries.map((entry, index) => (
            <div key={index} className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <input
                  type="text"
                  name="title"
                  value={entry.title || ''}
                  onChange={(e) => handlePresentationChange(index, 'title', e.target.value)}
                  placeholder="Paper Title"
                  className="w-full border border-gray-300 p-2 rounded"
                />
              </div>
              <div>
                <input
                  type="text"
                  name="year"
                  value={entry.year || ''}
                  onChange={(e) => handlePresentationChange(index, 'year', e.target.value)}
                  placeholder="Year Presented"
                  className="w-full border border-gray-300 p-2 rounded"
                />
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  name="conference"
                  value={entry.conference || ''}
                  onChange={(e) => handlePresentationChange(index, 'conference', e.target.value)}
                  placeholder="Conference/Fora"
                  className="w-full border border-gray-300 p-2 rounded"
                />
                {index === presentationEntries.length - 1 && (
                  <button
                    type="button"
                    onClick={() => {
                  const newEntry = { title: '', year: '', conference: '' };
                  setPresentationEntries([...presentationEntries, newEntry]);
                  handleArrayChange('presentations', presentationEntries.length, newEntry);
                }}
                    className="text-green-600 hover:text-green-800 text-xl"
                  >
                    +
                  </button>
                )}
                {presentationEntries.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setPresentationEntries(presentationEntries.filter((_, i) => i !== index))}
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
          {profile.presentations?.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-medium mb-2">
              <div>Paper Title</div>
              <div>Year Presented</div>
              <div>Conference/Fora</div>
            </div>
          ) : (
            <div className="text-gray-500">No presentations listed</div>
          )}
          {profile.presentations?.map((pres, index) => (
            <div key={index} className="grid grid-cols-1 md:grid-cols-3 gap-4 border-b pb-2">
              <div>{pres.title || '—'}</div>
              <div>{pres.year || '—'}</div>
              <div>{pres.conference || '—'}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const handleAwardChange = (index, value) => {
    const newAwards = [...awards];
    newAwards[index] = value;
    setAwards(newAwards);
    // Update form data
    handleArrayChange('awards', index, value);
  };

  const renderAwardsSection = () => (
    <div className="mt-8">
      <h4 className="text-md font-medium text-gray-900 mb-4 border-b pb-2">List of Research Related Awards <span className="text-red-500">*</span></h4>
      {isEditing ? (
        <div className="space-y-2">
          {awards.map((award, index) => (
            <div key={index} className="flex items-center space-x-2">
              <input
                type="text"
                value={award}
                onChange={(e) => handleAwardChange(index, e.target.value)}
                className="flex-1 border border-gray-300 p-2 rounded"
                placeholder="Enter award details"
              />
              {index === awards.length - 1 && (
                <button
                  type="button"
                  onClick={() => {
                  setAwards([...awards, '']);
                  handleArrayChange('awards', awards.length, '');
                }}
                  className="text-green-600 hover:text-green-800 text-xl"
                >
                  +
                </button>
              )}
              {awards.length > 1 && (
                <button
                  type="button"
                  onClick={() => setAwards(awards.filter((_, i) => i !== index))}
                  className="text-red-600 hover:text-red-800 text-xl"
                >
                  −
                </button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {profile.awards?.length > 0 ? (
            <ul className="list-disc pl-5">
              {profile.awards.map((award, index) => (
                <li key={index} className="mb-1">
                  {award}
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-gray-500">No awards listed</div>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-6">      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {renderInputField('university', 'University', true)}
        {renderTextArea('universityAddress', 'University Address', true)}
        {renderInputField('country', 'Country', true)}
        {renderInputField('continent', 'Continent', true)}
        {renderInputField('citizenship', 'Citizenship', true)}
        {renderTextArea('residentialAddress', 'Current Residential Address', true)}
        {renderInputField('zipCode', 'Zip Code', true)}
        {renderInputField('currentPosition', 'Current Position', true)}
        {renderInputField('affiliation', 'HEI/Organization Affiliation', true)}
        {renderInputField('department', 'College/Department', true)}
      </div>

      {renderEducationSection()}
      {renderPublicationsSection()}
      {renderPresentationsSection()}
      {renderAwardsSection()}

      <div className="mt-6">
        <div className="mb-4">
          <label htmlFor="researchInterests" className="block text-sm font-medium text-gray-700">
            Research Interests/Expertise <span className="text-red-500">*</span>
          </label>
          {isEditing ? (
            <select
              id="researchInterests"
              name="researchInterests"
              value={localFormData.researchInterests || ''}
              onChange={handleChange}
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
              {profile.researchInterests || '—'}
            </div>
          )}
        </div>
      </div>

      {/* CV Section - Moved to bottom */}
      {isEditing ? (
        <div className="mt-6">
          <h4 className="text-md font-medium text-gray-900 mb-4 border-b pb-2">
            Curriculum Vitae
          </h4>
          <div className="space-y-4">
            <div className="flex items-center space-x-4">
              <label className="cursor-pointer bg-white py-2 px-3 border border-gray-300 rounded-md shadow-sm text-sm leading-4 font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
                {uploading ? "Uploading..." : "Choose File"}
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
            {localFormData.cvFileName && (
              <p className="mt-1 text-sm text-gray-600">
                Current CV: {localFormData.cvFileName}
              </p>
            )}
          </div>
        </div>
      ) : (profile.cvUrl || localFormData.cvUrl) ? (
        <div className="mt-6">
          <h4 className="text-md font-medium text-gray-900 mb-4 border-b pb-2">
            Curriculum Vitae
          </h4>
          <div className="flex items-center space-x-4">
            <button
              onClick={handleDownloadCV}
              className="text-blue-600 hover:text-blue-800 flex items-center"
            >
              <svg className="h-5 w-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              {localFormData.cvFileName || profile.cvFileName || 'Download CV'}
            </button>
            {(localFormData.cvLastUpdated || profile.cvLastUpdated) && (
              <span className="text-sm text-gray-500">
                Last updated: {new Date(localFormData.cvLastUpdated || profile.cvLastUpdated).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default ResearcherForm;
