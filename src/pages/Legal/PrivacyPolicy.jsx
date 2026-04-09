import React, { useState, useEffect } from 'react';
import { getAuth } from 'firebase/auth';
import { 
  doc, 
  getDoc, 
  setDoc, 
  serverTimestamp
} from 'firebase/firestore';
import { db } from '../../firebase/firebase';
import { toast } from 'react-toastify';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { quillModules, quillFormats } from '../../utils/quillConfig';
import SafeHTML from '../../components/common/SafeHTML';

const PrivacyPolicy = () => {
  const [content, setContent] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);

  const auth = getAuth();

  // Check if user is admin
  useEffect(() => {
    const checkAdminRole = async () => {
      if (auth.currentUser) {
        try {
          const userDoc = await getDoc(doc(db, 'Users', auth.currentUser.uid));
          if (userDoc.exists()) {
            setIsAdmin(userDoc.data().role === 'Admin');
          }
        } catch (error) {
          console.error('Error checking admin role:', error);
        }
      }
    };

    checkAdminRole();
  }, [auth.currentUser]);

  // Fetch privacy policy content
  useEffect(() => {
    const fetchContent = async () => {
      try {
        const docRef = doc(db, 'legalPages', 'privacyPolicy');
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          const data = docSnap.data();
          setContent(data.content || getDefaultContent());
          setLastUpdated(data.updatedAt?.toDate());
        } else {
          // Create default content if it doesn't exist
          const defaultContent = getDefaultContent();
          setContent(defaultContent);
          await setDoc(docRef, {
            content: defaultContent,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });
        }
      } catch (error) {
        console.error('Error fetching privacy policy:', error);
        setContent(getDefaultContent());
        toast.error('Failed to load privacy policy');
      } finally {
        setIsLoading(false);
      }
    };

    fetchContent();
  }, []);

  const getDefaultContent = () => {
    return `<h2>Information We Collect</h2>
<p>We collect information to provide better services to all our users. The types of information we collect include:</p>
<ul>
  <li><strong>Personal Information</strong>: Name, email address, institutional affiliation</li>
  <li><strong>Account Information</strong>: User credentials, profile data</li>
  <li><strong>Usage Data</strong>: How you interact with our platform</li>
  <li><strong>Content</strong>: Manuscripts, reviews, and academic materials you submit</li>
</ul>

<h2>How We Use Your Information</h2>
<p>We use the information we collect to:</p>
<ul>
  <li>Provide, maintain, and improve our services</li>
  <li>Process transactions and send related information</li>
  <li>Send technical notices and support messages</li>
  <li>Respond to your comments and questions</li>
</ul>

<h2>Information Sharing</h2>
<p>We do not sell, trade, or otherwise transfer your personal information to third parties without your consent, except:</p>
<ul>
  <li>To comply with legal obligations</li>
  <li>To protect and defend our rights</li>
  <li>With your explicit consent</li>
</ul>

<h2>Data Security</h2>
<p>We implement appropriate technical and organizational measures to protect your personal data against unauthorized access, alteration, disclosure, or destruction.</p>

<h2>Your Rights</h2>
<p>You have the right to:</p>
<ul>
  <li>Access your personal data</li>
  <li>Correct inaccurate data</li>
  <li>Request deletion of your data</li>
  <li>Object to processing of your data</li>
</ul>

<h2>Cookies</h2>
<p>We use cookies to enhance your experience. You can control cookie settings through your browser.</p>

<h2>Contact Us</h2>
<p>If you have questions about this Privacy Policy, please contact us at:</p>
<ul>
  <li>Email: privacy@pubtrack.edu</li>
  <li>Phone: +63-XXX-XXX-XXXX</li>
</ul>

<h2>Policy Changes</h2>
<p>We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new policy on this page.</p>

<p><em>This policy is effective as of ${new Date().toLocaleDateString()}.</em></p>`;
  };

  const handleSave = async () => {
    if (!isAdmin) return;
    
    setIsSaving(true);
    try {
      const docRef = doc(db, 'legalPages', 'privacyPolicy');
      
      // Check if document exists first
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        // Update existing document
        await setDoc(docRef, {
          content: content,
          updatedAt: serverTimestamp(),
          updatedBy: auth.currentUser.uid
        }, { merge: true });
      } else {
        // Create new document
        await setDoc(docRef, {
          content: content,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          updatedBy: auth.currentUser.uid
        });
      }
      
      const updatedDoc = await getDoc(docRef);
      setLastUpdated(updatedDoc.data()?.updatedAt?.toDate());
      
      setIsEditing(false);
      toast.success('Privacy policy updated successfully');
    } catch (error) {
      console.error('Error saving privacy policy:', error);
      toast.error('Failed to save privacy policy');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pt-20 pb-8 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-sm p-6">
          {/* Header */}
          <div className="text-center mb-6">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Privacy Policy</h1>
            {lastUpdated && (
              <p className="text-sm text-gray-500">
                Last updated: {lastUpdated.toLocaleDateString()}
              </p>
            )}
            {isAdmin && (
              <div className="flex justify-center gap-2 mt-4">
                {!isEditing ? (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                  >
                    Edit Policy
                  </button>
                ) : (
                  <>
                    <button
                      onClick={handleSave}
                      disabled={isSaving}
                      className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 transition-colors mr-2"
                    >
                      {isSaving ? 'Saving...' : 'Save'}
                    </button>
                    <button
                      onClick={() => setIsEditing(false)}
                      className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
                    >
                      Cancel
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Content */}
          {isEditing ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Privacy Policy Content
              </label>
              <ReactQuill
                value={content}
                onChange={setContent}
                modules={quillModules}
                formats={quillFormats}
                theme="snow"
                className="bg-white text-black rounded mb-2"
                style={{ minHeight: '400px' }}
              />
              <div className="mt-2 text-sm text-gray-500">
                <p>Tips:</p>
                <ul className="list-disc list-inside">
                  <li>Use the toolbar to format text (bold, italic, etc.)</li>
                  <li>Change font size and style from the dropdown menus</li>
                  <li>Add lists, links, and other formatting as needed</li>
                </ul>
              </div>
            </div>
          ) : (
            <div className="mb-6 leading-relaxed">
              <SafeHTML content={content} textColor="text-black" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicy;
