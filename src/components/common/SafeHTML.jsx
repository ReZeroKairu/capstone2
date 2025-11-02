import React from 'react';
import DOMPurify from 'dompurify';

/**
 * SafeHTML component to safely render HTML content
 * @param {Object} props - Component props
 * @param {string} props.content - The HTML content to render
 * @param {string} [props.className] - Additional CSS classes
 * @returns {JSX.Element} - Rendered component
 */
const SafeHTML = ({ content, className = '' }) => {
  const sanitizedContent = DOMPurify.sanitize(content || '', {
    ALLOWED_TAGS: [
      'p', 'strong', 'em', 'u', 's', 'ul', 'ol', 'li', 'a', 'br',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'code', 'pre',
      'span', 'div', 'table', 'thead', 'tbody', 'tr', 'th', 'td'
    ],
    ALLOWED_ATTR: ['class', 'href', 'target', 'rel', 'style'],
    ADD_ATTR: ['style']  // Explicitly allow style attributes
  });
  
  // Debug: Log the sanitized content
  console.log('Sanitized content:', sanitizedContent);

  const styles = {
    '--tw-prose-bullets': '#ffffff',
    '--tw-prose-counters': '#ffffff',
    '--tw-prose-li-marker': 'var(--tw-prose-bullets)',
    // Add explicit list styling
    'ul': {
      listStyleType: 'disc',
      paddingLeft: '1.5rem',
      margin: '1rem 0'
    },
    'ol': {
      listStyleType: 'decimal',
      paddingLeft: '1.5rem',
      margin: '1rem 0'
    },
    'li': {
      margin: '0.5rem 0',
      color: '#ffffff'
    }
  };

  // Add a style tag for list styling
  const listStyles = `
    .prose ul {
      list-style-type: disc;
      padding-left: 1.5rem;
      margin: 1rem 0;
    }
    .prose ol {
      list-style-type: decimal;
      padding-left: 1.5rem;
      margin: 1rem 0;
    }
    .prose li {
      margin: 0.5rem 0;
    }
  `;

  return (
    <>
      <style>{listStyles}</style>
      <div 
        className={`prose max-w-none ${className}`}
        style={styles}
        dangerouslySetInnerHTML={{ 
          __html: sanitizedContent 
        }}
      />
    </>
  );
};

export default SafeHTML;
