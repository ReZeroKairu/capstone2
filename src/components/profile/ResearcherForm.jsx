import React from 'react';

const ResearcherForm = ({ profile, isEditing, formData, onChange }) => {
  if (!isEditing && !profile.institution && !profile.fieldOfStudy && !profile.researchInterests && !profile.department) {
    return null;
  }
  
  return (
    <div className="space-y-6">
      <h3 className="text-lg font-medium text-gray-900 mb-4">Researcher Information</h3>
      
      <div className="mb-5">
        <label htmlFor="institution" className="block text-sm font-medium text-gray-700 mb-1">
          Institution/Organization <span className="text-red-500">*</span>
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
          <div className="mt-1 text-gray-900">{profile.institution || '—'}</div>
        )}
      </div>
      
      <div className="mb-5">
        <label htmlFor="fieldOfStudy" className="block text-sm font-medium text-gray-700 mb-1">
          Field of Study <span className="text-red-500">*</span>
        </label>
        {isEditing ? (
          <input
            type="text"
            id="fieldOfStudy"
            name="fieldOfStudy"
            value={formData.fieldOfStudy || ''}
            onChange={onChange}
            className="block w-full border border-gray-300 p-3 shadow-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 sm:text-base"
          />
        ) : (
          <div className="mt-1 text-gray-900">{profile.fieldOfStudy || '—'}</div>
        )}
      </div>
      
      <div className="space-y-2">
        <label htmlFor="education" className="block text-sm font-medium text-gray-700">Education</label>
        {isEditing ? (
          <textarea
            id="education"
            name="education"
            value={formData.education || ''}
            onChange={onChange}
            rows="3"
            className="block w-full border border-gray-300 p-3 shadow-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 sm:text-base"
          />
        ) : (
          <div className="mt-1 text-gray-900">
            {profile.education ? (
              <div className="whitespace-pre-line">{profile.education}</div>
            ) : (
              '—'
            )}
          </div>
        )}
      </div>
      
      <div className="mb-5">
        <label htmlFor="department" className="block text-sm font-medium text-gray-700 mb-1">
          Department <span className="text-red-500">*</span>
        </label>
        {isEditing ? (
          <input
            type="text"
            id="department"
            name="department"
            value={formData.department || ''}
            onChange={onChange}
            className="block w-full border border-gray-300 p-3 shadow-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 sm:text-base"
            required
          />
        ) : (
          <div className="mt-1 text-gray-900">{profile.department || '—'}</div>
        )}
      </div>
      
      <div className="space-y-2">
        <label htmlFor="researchInterests" className="block text-sm font-medium text-gray-700">
          Research Interests <span className="text-red-500">*</span>
        </label>
        {isEditing ? (
          <textarea
            id="researchInterests"
            name="researchInterests"
            value={formData.researchInterests || ''}
            onChange={onChange}
            rows="3"
            className="block w-full border border-gray-300 p-3 shadow-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 sm:text-base"
          />
        ) : (
          <div className="mt-1 text-gray-900">
            {profile.researchInterests ? (
              <div className="whitespace-pre-line">{profile.researchInterests}</div>
            ) : (
              '—'
            )}
          </div>
        )}
      </div>
      
    </div>
  );
};

export default ResearcherForm;
