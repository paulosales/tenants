import React, { useEffect, useRef, useState } from 'react';
import {
  Bold,
  Eraser,
  Heading3,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Quote,
  Underline,
} from 'lucide-react';
import { sanitizeRichHtml } from '../../utils/htmlSanitizer';

interface RichTextEditorProps {
  value: string;
  onChange: (sanitizedHtml: string) => void;
  placeholder?: string;
}

/**
 * Dependency-free, XSS-safe WYSIWYG HTML rich-text editor powered by DOMPurify sanitization.
 */
export const RichTextEditor: React.FC<RichTextEditorProps> = ({
  value,
  onChange,
  placeholder = 'Write a rich community overview highlighting floorplans, neighborhood perks, and building features...',
}) => {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [linkUrl, setLinkUrl] = useState('https://');
  const [linkError, setLinkError] = useState<string | null>(null);

  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    const sanitized = sanitizeRichHtml(value);
    if (el.innerHTML !== sanitized) {
      el.innerHTML = sanitized;
    }
  }, [value]);

  const emitCleaned = () => {
    if (!editorRef.current) return;
    const sanitized = sanitizeRichHtml(editorRef.current.innerHTML);
    onChange(sanitized);
  };

  const runCommand = (cmd: string, arg?: string) => {
    if (!editorRef.current) return;
    editorRef.current.focus();
    document.execCommand(cmd, false, arg);
    emitCleaned();
  };

  const applySafeLink = () => {
    const trimmed = linkUrl.trim();
    if (!/^https?:\/\/.+/i.test(trimmed)) {
      setLinkError('URL must start with https:// or http://');
      return;
    }
    setLinkError(null);
    runCommand('createLink', trimmed);
    setShowLinkInput(false);
    setLinkUrl('https://');
  };

  const toolbarButtons: Array<{ label: string; icon: React.ReactNode; action: () => void }> = [
    { label: 'Bold', icon: <Bold className="w-3.5 h-3.5" />, action: () => runCommand('bold') },
    { label: 'Italic', icon: <Italic className="w-3.5 h-3.5" />, action: () => runCommand('italic') },
    {
      label: 'Underline',
      icon: <Underline className="w-3.5 h-3.5" />,
      action: () => runCommand('underline'),
    },
    {
      label: 'Section Heading',
      icon: <Heading3 className="w-3.5 h-3.5" />,
      action: () => runCommand('formatBlock', 'H3'),
    },
    {
      label: 'Bullet List',
      icon: <List className="w-3.5 h-3.5" />,
      action: () => runCommand('insertUnorderedList'),
    },
    {
      label: 'Numbered List',
      icon: <ListOrdered className="w-3.5 h-3.5" />,
      action: () => runCommand('insertOrderedList'),
    },
    {
      label: 'Quote',
      icon: <Quote className="w-3.5 h-3.5" />,
      action: () => runCommand('formatBlock', 'BLOCKQUOTE'),
    },
    {
      label: 'Clear Formatting',
      icon: <Eraser className="w-3.5 h-3.5" />,
      action: () => runCommand('removeFormat'),
    },
  ];

  return (
    <div className="border border-slate-300 rounded-2xl overflow-hidden bg-white">
      <div className="bg-slate-50 border-b border-slate-200 px-3 py-2 flex flex-wrap items-center gap-1">
        {toolbarButtons.map((btn) => (
          <button
            key={btn.label}
            type="button"
            title={btn.label}
            aria-label={btn.label}
            onClick={btn.action}
            className="p-1.5 rounded-lg text-slate-600 hover:text-indigo-700 hover:bg-indigo-50 transition-colors cursor-pointer"
          >
            {btn.icon}
          </button>
        ))}

        <button
          type="button"
          title="Insert HTTPS Link"
          aria-label="Insert HTTPS Link"
          onClick={() => {
            setShowLinkInput((v) => !v);
            setLinkError(null);
          }}
          className="p-1.5 rounded-lg text-slate-600 hover:text-indigo-700 hover:bg-indigo-50 transition-colors cursor-pointer"
        >
          <LinkIcon className="w-3.5 h-3.5" />
        </button>
      </div>

      {showLinkInput && (
        <div className="px-3 py-2 bg-indigo-50/70 border-b border-indigo-100 flex flex-wrap items-center gap-2">
          <input
            type="url"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            placeholder="https://example.com"
            className="flex-1 min-w-44 px-2.5 py-1.5 text-xs border border-indigo-200 rounded-lg bg-white text-slate-900"
          />
          <button
            type="button"
            onClick={applySafeLink}
            className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 cursor-pointer"
          >
            Apply Link
          </button>
          <button
            type="button"
            onClick={() => setShowLinkInput(false)}
            className="px-2.5 py-1.5 rounded-lg text-slate-600 text-xs font-medium hover:bg-slate-200 cursor-pointer"
          >
            Cancel
          </button>
          {linkError && <p className="w-full text-[11px] text-rose-600">{linkError}</p>}
        </div>
      )}

      <div className="relative">
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          onInput={emitCleaned}
          onBlur={emitCleaned}
          aria-label="Property rich description editor"
          data-placeholder={placeholder}
          className="min-h-40 max-h-72 overflow-y-auto px-4 py-3 text-sm text-slate-800 focus:outline-none [&_h3]:text-base [&_h3]:font-bold [&_h3]:mt-3 [&_h3]:mb-1 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_blockquote]:border-l-2 [&_blockquote]:border-indigo-400 [&_blockquote]:pl-3 [&_blockquote]:italic [&_a]:text-indigo-600 [&_a]:underline"
        />
      </div>
    </div>
  );
};

