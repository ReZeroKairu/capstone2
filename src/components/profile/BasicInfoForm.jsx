import React, { useRef, useEffect, useState } from 'react';
import { getCountryCallingCode } from 'libphonenumber-js';
import 'react-phone-number-input/style.css';
import PhoneInput from 'react-phone-number-input';
import { parsePhoneNumberFromString } from 'libphonenumber-js';

const BasicInfoForm = ({ profile, isEditing, formData, onChange }) => {
  const firstNameRef = useRef(null);
  
  useEffect(() => {
    if (isEditing && firstNameRef.current) {
      firstNameRef.current.focus();
    }
  }, [isEditing]);
  
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <label htmlFor="firstName" className="block text-sm font-medium text-gray-700">
          First Name <span className="text-red-500">*</span>
        </label>
        {isEditing ? (
          <input
            ref={firstNameRef}
            type="text"
            id="firstName"
            name="firstName"
            value={formData.firstName || ''}
            onChange={onChange}
            className="block w-full border border-gray-300 p-3 shadow-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 sm:text-base"
            required
          />
        ) : (
          <div className="mt-1 text-gray-900">{profile.firstName}</div>
        )}
      </div>
      
      <div className="mb-5">
        <label htmlFor="middleName" className="block text-sm font-medium text-gray-700 mb-1">
          Middle Name
        </label>
        {isEditing ? (
          <input
            type="text"
            id="middleName"
            name="middleName"
            value={formData.middleName || ''}
            onChange={onChange}
            className="block w-full border border-gray-300 p-3 shadow-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 sm:text-base"
          />
        ) : (
          <div className="mt-1 text-gray-900">{profile.middleName || '—'}</div>
        )}
      </div>
      
      <div className="mb-5">
        <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-1">
          Last Name <span className="text-red-500">*</span>
        </label>
        {isEditing ? (
          <input
            type="text"
            id="lastName"
            name="lastName"
            value={formData.lastName || ''}
            onChange={onChange}
            className="block w-full border border-gray-300 p-3 shadow-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 sm:text-base"
            required
          />
        ) : (
          <div className="mt-1 text-gray-900">{profile.lastName}</div>
        )}
      </div>
      
      <div className="space-y-2">
        <label htmlFor="birthDate" className="block text-sm font-medium text-gray-700">
          Birth Date <span className="text-red-500">*</span>
        </label>
        {isEditing ? (
          <input
            type="date"
            id="birthDate"
            name="birthDate"
            value={formData.birthDate || ''}
            onChange={onChange}
            className="block w-full max-w-xs border border-gray-300 p-3 shadow-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 sm:text-base"
            required
            max={new Date().toISOString().split('T')[0]} // Prevent future dates
          />
        ) : (
          <div className="mt-1 text-gray-900">
            {profile.birthDate ? new Date(profile.birthDate).toLocaleDateString() : '—'}
          </div>
        )}
      </div>
      
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">
          Email <span className="text-red-500">*</span>
        </label>
        <div className="mt-1 text-gray-900">{profile.email}</div>
      </div>
      
    <div className="space-y-2">
  <label className="block text-sm font-medium text-gray-700">
    Phone Number <span className="text-red-500">*</span>
  </label>
  {isEditing ? (
    <div className="relative">
      <PhoneInput
        international
        defaultCountry="PH"
        placeholder="Enter phone number"
        value={formData.phone || ''}
        onChange={(value) => {
          onChange({
            target: {
              name: 'phone',
              value: value || ''
            }
          });
        }}
        className="[&>div]:flex border-2 [&>div]:items-center [&_select]:w-20 [&_input]:flex-1 [&_input]:w-full"
        style={{
          '--PhoneInputInput': 'block w-full border border-gray-300 rounded-r-md shadow-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 sm:text-base',
          '--PhoneInputCountrySelect': '!w-24 border-r-0 rounded-l-md'
        }}
      />
      {formData.phone && !parsePhoneNumberFromString(formData.phone)?.isValid() && (
        <p className="mt-1 text-sm text-red-600">Please enter a valid phone number</p>
      )}
    </div>
  ) : (
    <div className="mt-1 text-gray-900">
      {profile.phone ? (
        parsePhoneNumberFromString(profile.phone)?.formatInternational() || profile.phone
      ) : '—'}
    </div>
  )}

      </div>
    </div>
  );
};

export default BasicInfoForm;
