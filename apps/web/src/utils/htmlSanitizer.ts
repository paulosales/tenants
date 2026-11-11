import DOMPurify from 'dompurify';

const ALLOWED_TAGS = [
  'p',
  'br',
  'strong',
  'b',
  'em',
  'i',
  'u',
  'ul',
  'ol',
  'li',
  'h2',
  'h3',
  'h4',
  'blockquote',
  'a',
];

const ALLOWED_ATTR = ['href', 'target', 'rel'];

/**
 * Sanitizes rich-text HTML markup on the client using DOMPurify allow-listing (OWASP XSS).
 */
export function sanitizeRichHtml(rawHtml: string): string {
  if (!rawHtml) return '';
  const cleaned = DOMPurify.sanitize(rawHtml, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOWED_URI_REGEXP: /^https?:\/\//i,
  });
  return cleaned;
}

