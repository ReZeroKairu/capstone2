import React from 'react';
import DOMPurify from 'dompurify';

/**
 * SafeHTML component to safely render HTML content
 * @param {Object} props - Component props
 * @param {string} props.content - The HTML content to render
 * @param {string} [props.className] - Additional CSS classes
 * @param {string} [props.textColor] - Text color for the content
 * @returns {JSX.Element} - Rendered component
 */
const SafeHTML = ({ content, className = '', textColor = 'text-white' }) => {
  const sanitizedContent = DOMPurify.sanitize(content || '', {
    ALLOWED_TAGS: [
      'p', 'strong', 'em', 'u', 's', 'ul', 'ol', 'li', 'a', 'br',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'code', 'pre',
      'span', 'div', 'table', 'thead', 'tbody', 'tr', 'th', 'td',
      'img'  // Allow img tags
    ],
    ALLOWED_ATTR: [
      'class', 'href', 'target', 'rel', 'style',
      'src', 'alt', 'width', 'height'  // Allow image attributes
    ],
    ADD_ATTR: ['style'],  // Explicitly allow style attributes
    ADD_TAGS: ['img'],    // Ensure img tags are allowed
    ADD_URI_SAFE_ATTR: [  // Allow data URIs for base64 images
      'src'
    ]
  });
  
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

  // Add styles directly to the document head to avoid the jsx warning
  React.useEffect(() => {
    const styleId = 'safe-html-styles';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = `
        .prose img {
          max-width: 100%;
          height: auto;
          border-radius: 0.5rem;
          margin: 1rem 0;
          display: block;
        }
        .prose img[src*="firebasestorage"] {
          max-height: 400px;
          object-fit: contain;
          cursor: pointer;
          transition: transform 0.2s;
        }
        .prose img[src*="firebasestorage"]:hover {
          transform: scale(1.02);
        }
        /* Ensure list styles are visible */
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
          color: inherit;
        }
        .prose a {
          color: #3b82f6;
          text-decoration: none;
        }
        .prose a:hover {
          text-decoration: underline;
        }
      `;
      document.head.appendChild(style);
      
      return () => {
        // Clean up the style element when the component unmounts
        const existingStyle = document.getElementById(styleId);
        if (existingStyle) {
          document.head.removeChild(existingStyle);
        }
      };
    }
  }, []);

  // Determine text color - prioritize textColor prop, then check className for text-* classes
  let finalTextColor = textColor;
  if (className.includes('text-')) {
    // Extract the first text color class from className
    const textColorMatch = className.match(/text-\S+/);
    if (textColorMatch) {
      finalTextColor = textColorMatch[0];
    }
  }

  // Remove text color classes from className to avoid conflicts
  const cleanClassName = className.replace(/text-\S+/g, '').trim();

  return (
    <div className={`prose max-w-none ${cleanClassName}`}>
      <div 
        className={finalTextColor}
        style={{ color: finalTextColor === 'text-black' ? '#000000' : finalTextColor === 'text-white' ? '#ffffff' : 'inherit' }}
        dangerouslySetInnerHTML={{ __html: sanitizedContent }} 
      />
    </div>
  );
};

export default SafeHTML;
