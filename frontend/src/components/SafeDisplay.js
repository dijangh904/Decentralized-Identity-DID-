/**
 * SafeDisplay Component
 * Provides safe rendering of user-generated content to prevent XSS attacks
 */

import React from 'react';
import { sanitizeHtml, sanitizeText, sanitizeJsonForDisplay } from '../utils/inputSanitization';

/**
 * Props:
 * - content: The content to display (string, object, or array)
 * - type: The type of content ('text', 'html', 'json', 'url')
 * - className: Additional CSS classes
 * - component: The HTML element to render ('div', 'span', 'pre', 'p')
 */
const SafeDisplay = ({ 
  content, 
  type = 'text', 
  className = '', 
  component: Component = 'div',
  ...props 
}) => {
  const getSafeContent = () => {
    if (content === null || content === undefined) {
      return '';
    }

    switch (type) {
      case 'text':
        return sanitizeText(String(content));
      
      case 'html':
        return { __html: sanitizeHtml(String(content)) };
      
      case 'json':
        return { __html: sanitizeJsonForDisplay(content) };
      
      case 'url':
        const sanitizedUrl = sanitizeText(String(content));
        // Basic URL validation
        if (sanitizedUrl && (sanitizedUrl.startsWith('http://') || sanitizedUrl.startsWith('https://'))) {
          return sanitizedUrl;
        }
        return '';
      
      default:
        return sanitizeText(String(content));
    }
  };

  const renderContent = () => {
    const safeContent = getSafeContent();
    
    switch (type) {
      case 'html':
      case 'json':
        return <Component dangerouslySetInnerHTML={safeContent} className={className} {...props} />;
      
      case 'url':
        if (safeContent) {
          return (
            <a 
              href={safeContent} 
              target="_blank" 
              rel="noopener noreferrer"
              className={className}
              {...props}
            >
              {safeContent}
            </a>
          );
        }
        return <Component className={className} {...props}>Invalid URL</Component>;
      
      default:
        return <Component className={className} {...props}>{safeContent}</Component>;
    }
  };

  return renderContent();
};

/**
 * SafeText - Specialized component for text content
 */
export const SafeText = ({ content, ...props }) => (
  <SafeDisplay content={content} type="text" component="span" {...props} />
);

/**
 * SafeHtml - Specialized component for HTML content (sanitized)
 */
export const SafeHtml = ({ content, ...props }) => (
  <SafeDisplay content={content} type="html" component="div" {...props} />
);

/**
 * SafeJson - Specialized component for JSON display
 */
export const SafeJson = ({ content, ...props }) => (
  <SafeDisplay content={content} type="json" component="pre" {...props} />
);

/**
 * SafeUrl - Specialized component for URL display
 */
export const SafeUrl = ({ content, ...props }) => (
  <SafeDisplay content={content} type="url" component="a" {...props} />
);

/**
 * SafeParagraph - Specialized component for paragraph text
 */
export const SafeParagraph = ({ content, ...props }) => (
  <SafeDisplay content={content} type="text" component="p" {...props} />
);

export default SafeDisplay;
