import React, { useState, useRef, useEffect } from 'react';
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronUp, faChevronDown } from "@fortawesome/free-solid-svg-icons";
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { db } from '../firebase/firebase';

const ContactDropdown = () => {
  const contactButtonRef = useRef(null);
  const contactDropdownRef = useRef(null);
  const [contactDropdownOpen, setContactDropdownOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [contactInfo, setContactInfo] = useState({
    publicationOfficer: 'Ms. Leilani G. Pimentel',
    office: 'Office of the University Research and Coordination',
    email: 'ourc@liceo.edu.ph',
    phone: '+63 088 880-2047 / +63 08822 722244 local 135',
    fax: '+63 088 880-2047',
    address: 'Rodolfo Neri Pelaez Boulevard, Kauswagan\nCagayan de Oro, Misamis Oriental, Philippines'
  });

  // Check if user is admin
  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (user) {
        try {
          const userDoc = await getDoc(doc(db, 'Users', user.uid));
          if (userDoc.exists()) {
            setIsAdmin(userDoc.data().role === 'Admin');
          }
        } catch (error) {
          console.error('Error checking admin status:', error);
        }
      } else {
        setIsAdmin(false);
      }
    });

    loadContactInfo();
    
    // Cleanup subscription
    return () => unsubscribe();
  }, []);

  // Load contact info from Firestore
  const loadContactInfo = async () => {
    try {
      const docRef = doc(db, 'Content', 'ContactInfo');
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setContactInfo(docSnap.data());
      }
    } catch (error) {
      console.error('Error loading contact info:', error);
    }
  };

  // Save contact info to Firestore
  const saveContactInfo = async () => {
    try {
      const docRef = doc(db, 'Content', 'ContactInfo');
      // Use setDoc with merge: true to create the document if it doesn't exist
      await setDoc(docRef, contactInfo, { merge: true });
      setIsEditing(false);
    } catch (error) {
      console.error('Error saving contact info:', error);
    }
  };

  const toggleContactDropdown = (e) => {
    if (e) e.stopPropagation();
    setContactDropdownOpen(prev => !prev);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setContactInfo(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (contactDropdownRef.current && 
          !contactDropdownRef.current.contains(event.target) &&
          contactButtonRef.current && 
          !contactButtonRef.current.contains(event.target)) {
        setContactDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <div className="bg-red-800 text-white py-1 fixed top-14 left-0 w-full z-40" ref={contactDropdownRef}>
      <div className="flex justify-between items-center px-4">
        <div className="flex-1"></div> {/* Spacer for centering */}
        <div className="flex items-center">
          {isAdmin && (
            <div className="relative">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (isEditing) {
                    saveContactInfo();
                  } else {
                    setIsEditing(true);
                  }
                }}
                className="text-white text-sm bg-blue-600 hover:bg-blue-700 px-3 py-1 rounded mr-2 flex items-center"
                title={isEditing ? 'Save changes' : 'Edit contact information'}
              >
                {isEditing ? (
                  <>
                    <span className="mr-1">💾</span> Save
                  </>
                ) : (
                  <>
                    <span className="mr-1">✏️</span> Edit
                  </>
                )}
              </button>
              {isEditing && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsEditing(false);
                    loadContactInfo(); // Reload original data
                  }}
                  className="text-white text-sm bg-gray-600 hover:bg-gray-700 px-3 py-1 rounded mr-2"
                  title="Cancel editing"
                >
                  ✕ Cancel
                </button>
              )}
            </div>
          )}
          <button
            ref={contactButtonRef}
            onClick={toggleContactDropdown}
            className="text-white text-sm flex items-center"
          >
            Contact Us
            <FontAwesomeIcon
              icon={contactDropdownOpen ? faChevronUp : faChevronDown}
              className="ml-1 transition-transform duration-300"
            />
          </button>
        </div>
      </div>

      <div
        ref={contactDropdownRef}
        className={`overflow-hidden transition-all duration-500 ease-in-out ${
          contactDropdownOpen
            ? 'max-h-screen opacity-100'
            : 'max-h-0 opacity-0'
        }`}
      >
        <div className="w-full bg-red-800 !shadow-none min-h-full py-4">
          <div className="container mx-auto px-4">
            <div className="flex flex-col md:flex-row justify-between gap-8">
              {/* Left Side Contact Information */}
              <div className="flex-1 space-y-4">
                <div className="bg-red-700 p-4 rounded">
                  <label className="block text-yellow-200 font-bold mb-1">
                    Publication Officer
                  </label>
                  {isEditing ? (
                    <input
                      type="text"
                      name="publicationOfficer"
                      value={contactInfo.publicationOfficer}
                      onChange={handleInputChange}
                      className="bg-white text-black p-2 rounded w-full"
                    />
                  ) : (
                    <p className="text-gray-200">
                      {contactInfo.publicationOfficer}
                    </p>
                  )}
                </div>

                <div className="bg-red-700 p-4 rounded">
                  <label className="block text-yellow-200 font-bold mb-1">
                    Office
                  </label>
                  {isEditing ? (
                    <input
                      type="text"
                      name="office"
                      value={contactInfo.office}
                      onChange={handleInputChange}
                      className="bg-white text-black p-2 rounded w-full"
                    />
                  ) : (
                    <p className="text-gray-200">
                      {contactInfo.office}
                    </p>
                  )}
                </div>

                <div className="bg-red-700 p-4 rounded">
                  <label className="block text-yellow-200 font-bold mb-1">
                    Contact Information
                  </label>
                  {isEditing ? (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-yellow-200 text-sm mb-1">Email:</label>
                        <input
                          type="email"
                          name="email"
                          value={contactInfo.email}
                          onChange={handleInputChange}
                          className="bg-white text-black p-2 rounded w-full"
                        />
                      </div>
                      <div>
                        <label className="block text-yellow-200 text-sm mb-1">Phone:</label>
                        <input
                          type="text"
                          name="phone"
                          value={contactInfo.phone}
                          onChange={handleInputChange}
                          className="bg-white text-black p-2 rounded w-full"
                        />
                      </div>
                      <div>
                        <label className="block text-yellow-200 text-sm mb-1">Fax:</label>
                        <input
                          type="text"
                          name="fax"
                          value={contactInfo.fax}
                          onChange={handleInputChange}
                          className="bg-white text-black p-2 rounded w-full"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-gray-200">
                        <span className="text-yellow-200">Email: </span>
                        {contactInfo.email}
                      </p>
                      <p className="text-gray-200">
                        <span className="text-yellow-200">Phone: </span>
                        {contactInfo.phone}
                      </p>
                      <p className="text-gray-200">
                        <span className="text-yellow-200">Fax: </span>
                        {contactInfo.fax}
                      </p>
                    </div>
                  )}
                </div>

              </div>

              {/* Right Side Address */}
              <div className="flex-1 text-gray-200">
                {isEditing ? (
                  <div className="w-full">
                    <div className="bg-red-700 p-4 rounded">
                      <label className="text-yellow-200 font-bold block mb-2">Address:</label>
                      <textarea
                        name="address"
                        value={contactInfo.address}
                        onChange={handleInputChange}
                        className="bg-white text-black p-2 rounded w-full min-h-[100px]"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="bg-red-700 p-4 rounded">
                    <p className="text-yellow-200 font-bold mb-2">Address:</p>
                    <div className="whitespace-pre-line">
                      {contactInfo.address}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ContactDropdown;
