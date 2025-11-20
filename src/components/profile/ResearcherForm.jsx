import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';

const ResearcherForm = ({ profile, isEditing, formData, onChange }) => {
  // Use refs to track previous values and prevent unnecessary updates
  const prevProfileRef = useRef(profile);
  const prevIsEditingRef = useRef(isEditing);
  
  // Initialize state with empty values
  const [educationEntries, setEducationEntries] = useState([{ school: '', degree: '', year: '' }]);
  const [publicationEntries, setPublicationEntries] = useState([{ title: '', year: '', journal: '' }]);
  const [presentationEntries, setPresentationEntries] = useState([{ title: '', year: '', conference: '' }]);
  const [awards, setAwards] = useState(['']);
  
  // Memoize derived state to prevent unnecessary re-renders
  const hasChanges = useRef(false);

  // Memoize the profile data to prevent unnecessary effect triggers
  const profileData = useMemo(() => ({
    // Basic info
    institution: formData?.institution || profile?.institution || '',
    university: formData?.university || profile?.university || '',
    universityAddress: formData?.universityAddress || profile?.universityAddress || '',
    country: formData?.country || profile?.country || '',
    continent: formData?.continent || profile?.continent || '',
    citizenship: formData?.citizenship || profile?.citizenship || '',
    residentialAddress: formData?.residentialAddress || profile?.residentialAddress || '',
    zipCode: formData?.zipCode || profile?.zipCode || '',
    currentPosition: formData?.currentPosition || profile?.currentPosition || '',
    affiliation: formData?.affiliation || profile?.affiliation || '',
    department: formData?.department || profile?.department || '',
    fieldOfStudy: formData?.fieldOfStudy || profile?.fieldOfStudy || '',
    researchInterests: formData?.researchInterests || profile?.researchInterests || '',
    
    // Array fields
    educations: formData?.educations || profile?.educations || [],
    education: formData?.education || profile?.education || '',
    publications: formData?.publications || profile?.publications || [],
    presentations: formData?.presentations || profile?.presentations || [],
    awards: formData?.awards || profile?.awards || []
  }), [profile, formData]);

  // Initialize form data when profile or formData changes or when toggling to edit mode
  useEffect(() => {
    if (!profile && !formData) return;
    
    // Only update state if there are actual changes to prevent unnecessary re-renders
    const updateState = () => {
      // Use formData from props if available, otherwise use profile data
      const dataSource = formData || profileData;
      
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
  }, [profile, formData, isEditing]);

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
      institution: formData?.institution || '',
      university: formData?.university || '',
      universityAddress: formData?.universityAddress || '',
      country: formData?.country || '',
      continent: formData?.continent || '',
      citizenship: formData?.citizenship || '',
      residentialAddress: formData?.residentialAddress || '',
      zipCode: formData?.zipCode || '',
      currentPosition: formData?.currentPosition || '',
      affiliation: formData?.affiliation || '',
      department: formData?.department || '',
      fieldOfStudy: formData?.fieldOfStudy || '',
      researchInterests: formData?.researchInterests || '',
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
      const currentValue = formData?.[key];
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
  }, [isEditing, educationEntries, publicationEntries, presentationEntries, awards, formData, onChange]);
  
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
  const hasData = profile?.institution || profile?.fieldOfStudy || profile?.researchInterests || 
                 profile?.department || profile?.university || profile?.universityAddress || 
                 profile?.country || profile?.continent || profile?.citizenship || 
                 profile?.residentialAddress || profile?.zipCode || profile?.currentPosition || 
                 profile?.affiliation || profile?.publications?.length > 0 || 
                 profile?.presentations?.length > 0 || profile?.awards?.length > 0 || 
                 profile?.educations?.length > 0 || profile?.education;

  if (!isEditing && !hasData) {
    return null;
  }

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
          value={formData[id] || ''}
          onChange={onChange}
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
          value={formData[id] || ''}
          onChange={onChange}
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
    hasChanges.current = true;
    setEducationEntries(prev => {
      const updatedEntries = [...prev];
      updatedEntries[index] = { ...updatedEntries[index], [field]: value };
      return updatedEntries;
    });
  };

  const renderEducationSection = () => (
    <div className="mt-8">
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
                    onClick={() => setEducationEntries([...educationEntries, { school: '', degree: '', year: '' }])}
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
    hasChanges.current = true;
    setPublicationEntries(prev => {
      const updatedEntries = [...prev];
      updatedEntries[index] = { ...updatedEntries[index], [field]: value };
      return updatedEntries;
    });
  };

  const renderPublicationsSection = () => (
    <div className="mt-8">
      <h4 className="text-md font-medium text-gray-900 mb-4 border-b pb-2">List of Publications (Last 5 Years)</h4>
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
                    onClick={() => setPublicationEntries([...publicationEntries, { title: '', year: '', journal: '' }])}
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
    hasChanges.current = true;
    setPresentationEntries(prev => {
      const updatedEntries = [...prev];
      updatedEntries[index] = { ...updatedEntries[index], [field]: value };
      return updatedEntries;
    });
  };

  const renderPresentationsSection = () => (
    <div className="mt-8">
      <h4 className="text-md font-medium text-gray-900 mb-4 border-b pb-2">List of Paper Presentations (Last 5 Years)</h4>
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
                    onClick={() => setPresentationEntries([...presentationEntries, { title: '', year: '', conference: '' }])}
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
    hasChanges.current = true;
    setAwards(prev => {
      const newAwards = [...prev];
      newAwards[index] = value;
      return newAwards;
    });
  };

  const renderAwardsSection = () => (
    <div className="mt-8">
      <h4 className="text-md font-medium text-gray-900 mb-4 border-b pb-2">List of Research Related Awards</h4>
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
                  onClick={() => setAwards([...awards, ''])}
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
        {renderInputField('institution', 'Institution/Organization', true)}
        {renderInputField('university', 'University', true)}
        {renderTextArea('universityAddress', 'University Address', true)}
        {renderInputField('country', 'Country', true)}
        {renderInputField('continent', 'Continent', true)}
        {renderInputField('citizenship', 'Citizenship', true)}
        {renderTextArea('residentialAddress', 'Current Residential Address', true)}
        {renderInputField('zipCode', 'Zip Code', true)}
        {renderInputField('currentPosition', 'Current Position', true)}
        {renderInputField('affiliation', 'HEI/Organization Affiliation', true)}
        {renderInputField('department', 'College/Deprtment', true)}
        {renderInputField('fieldOfStudy', 'Field of Study', true)}
      </div>

      {renderEducationSection()}
      {renderPublicationsSection()}
      {renderPresentationsSection()}
      {renderAwardsSection()}

      <div className="mt-6">
        {renderTextArea('researchInterests', 'Research Interests/Expertise', true, 4)}
      </div>
    </div>
  );
};

export default ResearcherForm;
