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
    ALLOWED_ATTR: ['class', 'href', 'target', 'rel', 'style']
  });

  return (
    <div 
      className={`prose max-w-none ${className}`}
      dangerouslySetInnerHTML={{ __html: sanitizedContent }}
    />
  );
};

export default SafeHTML;
