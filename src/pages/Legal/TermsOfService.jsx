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

const TermsOfService = () => {
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

  // Fetch terms of service content
  useEffect(() => {
    const fetchContent = async () => {
      try {
        const docRef = doc(db, 'legalPages', 'termsOfService');
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
        console.error('Error fetching terms of service:', error);
        setContent(getDefaultContent());
        toast.error('Failed to load terms of service');
      } finally {
        setIsLoading(false);
      }
    };

    fetchContent();
  }, []);

  const getDefaultContent = () => {
    return `<h2>Acceptance of Terms</h2>
<p>By accessing and using PubTrack, you accept and agree to be bound by the terms and provision of this agreement.</p>

<h2>Description of Service</h2>
<p>PubTrack is an academic manuscript tracking and peer review system designed to streamline the publication process for academic institutions.</p>

<h2>User Accounts</h2>

<h3>Registration</h3>
<ul>
  <li>You must provide accurate and complete information</li>
  <li>You are responsible for maintaining the confidentiality of your account</li>
  <li>You must notify us immediately of any unauthorized use</li>
</ul>

<h3>Account Responsibilities</h3>
<ul>
  <li>You are responsible for all activities under your account</li>
  <li>You must not share your login credentials</li>
  <li>You must keep your contact information up to date</li>
</ul>

<h2>Acceptable Use</h2>
<p>You agree to use PubTrack only for lawful purposes, including:</p>
<ul>
  <li>Submitting original academic work</li>
  <li>Providing constructive peer reviews</li>
  <li>Collaborating with other academic professionals</li>
</ul>

<h3>Prohibited Activities:</h3>
<ul>
  <li>Submitting plagiarized or fraudulent content</li>
  <li>Harassing other users</li>
  <li>Attempting to gain unauthorized access</li>
  <li>Violating academic integrity</li>
</ul>

<h2>Intellectual Property</h2>

<h3>User Content</h3>
<ul>
  <li>You retain ownership of content you submit</li>
  <li>You grant us license to use, modify, and display your content</li>
  <li>You represent that you have the right to submit such content</li>
</ul>

<h3>Platform Content</h3>
<ul>
  <li>The platform and its original content are owned by Liceo de Cagayan University</li>
  <li>You may not use our content without permission</li>
</ul>

<h2>Privacy</h2>
<p>Your privacy is important to us. Please review our Privacy Policy, which also governs your use of the Service.</p>

<h2>Peer Review Process</h2>

<h3>Reviewer Responsibilities</h3>
<ul>
  <li>Provide timely, constructive feedback</li>
  <li>Maintain confidentiality of submitted manuscripts</li>
  <li>Decline reviews if conflicts of interest exist</li>
</ul>

<h3>Author Responsibilities</h3>
<ul>
  <li>Respond to reviewer feedback professionally</li>
  <li>Make requested revisions in a timely manner</li>
  <li>Follow submission guidelines</li>
</ul>

<h2>Service Availability</h2>
<p>We strive to maintain high availability but do not guarantee uninterrupted service. We may suspend or terminate service for:</p>
<ul>
  <li>Scheduled maintenance</li>
  <li>Security breaches</li>
  <li>Violation of terms</li>
</ul>

<h2>Limitation of Liability</h2>
<p>To the maximum extent permitted by law, PubTrack shall not be liable for any indirect, incidental, or consequential damages.</p>

<h2>Termination</h2>
<p>We may terminate or suspend your account immediately for:</p>
<ul>
  <li>Breach of these terms</li>
  <li>Violation of academic integrity</li>
  <li>Illegal activities</li>
</ul>

<h2>Changes to Terms</h2>
<p>We reserve the right to modify these terms at any time. Changes will be effective immediately upon posting.</p>

<h2>Governing Law</h2>
<p>These terms are governed by the laws of the Philippines.</p>

<h2>Contact Information</h2>
<p>For questions about these terms, contact us at:</p>
<ul>
  <li>Email: legal@pubtrack.edu</li>
  <li>Phone: +63-XXX-XXX-XXXX</li>
  <li>Address: Liceo de Cagayan University, Cagayan de Oro City, Philippines</li>
</ul>

<h2>Dispute Resolution</h2>
<p>Any disputes will be resolved through:</p>
<ol>
  <li>Good faith negotiation</li>
  <li>Mediation</li>
  <li>Arbitration under Philippine law</li>
</ol>

<p><em>This agreement is effective as of ${new Date().toLocaleDateString()}.</em></p>`;
  };

  const handleSave = async () => {
    if (!isAdmin) return;
    
    setIsSaving(true);
    try {
      const docRef = doc(db, 'legalPages', 'termsOfService');
      
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
      toast.success('Terms of service updated successfully');
    } catch (error) {
      console.error('Error saving terms of service:', error);
      toast.error('Failed to save terms of service');
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
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Terms of Service</h1>
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
                    Edit Terms
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
                Terms of Service Content
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

export default TermsOfService;
