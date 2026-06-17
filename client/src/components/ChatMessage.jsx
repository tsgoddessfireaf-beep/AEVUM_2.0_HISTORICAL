// Copyright (c) 2026 Dolores Puckett / Dolores Aeonic Arts. All rights reserved.
// Aevum — proprietary software. Unauthorized use or distribution is prohibited.

/**
 * Converts **bold** and *italic* markdown to safe HTML, escaping other HTML entities first.
 * Intentionally minimal to avoid pulling in a markdown library.
 * @param {string} text
 * @returns {string} HTML string.
 */
function renderInline(text) {
  // Escape HTML to be safe
  let s = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  // **bold**
  s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  // *italic*  (single asterisks not preceded/followed by another asterisk)
  s = s.replace(/(^|[^*])\*([^*\n]+?)\*(?!\*)/g, '$1<em>$2</em>');
  return s;
}

/**
 * Converts a plain-text block into a sequence of HTML paragraphs.
 * Blank lines become paragraph breaks; single newlines become <br>.
 * @param {string} text
 * @returns {string} Inner HTML for wrapping in a <p> tag.
 */
function renderMarkdown(text) {
  // Split into paragraphs on blank lines; convert single newlines to <br>
  const paragraphs = text.split(/\n{2,}/).map(p => p.trim()).filter(Boolean);
  return paragraphs.map(p => renderInline(p).replace(/\n/g, '<br>')).join('</p><p>');
}

/**
 * Renders a single chat bubble for either the user or the assistant.
 * Strips <house_significations> XML from display, renders inline markdown,
 * and shows an animated cursor while the message is still streaming.
 * @param {{ role: 'user'|'assistant', content: string, streaming?: boolean }} props
 */
export default function ChatMessage({ role, content, streaming }) {
  const isAssistant = role === 'assistant';

  // Strip the house_significations XML block from display (interview phase)
  const display = content.replace(/<house_significations>[\s\S]*?<\/house_significations>/g, '').trim();
  const html = display ? `<p>${renderMarkdown(display)}</p>` : '';

  return (
    <div className={`flex gap-3 ${isAssistant ? '' : 'flex-row-reverse'}`}>
      <div
        className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-sm
          ${isAssistant ? 'bg-teal-900 border border-copper-400/30 text-copper-400' : 'bg-teal-700 text-bone/75'}`}
      >
        {isAssistant ? '☽' : '◯'}
      </div>
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed chat-prose
          ${isAssistant
            ? 'bg-teal-900/80 border border-teal-600/50 text-bone/90 rounded-tl-sm'
            : 'bg-teal-700/60 text-bone/90 rounded-tr-sm'
          }`}
      >
        {html ? (
          <span dangerouslySetInnerHTML={{ __html: html }} />
        ) : (
          streaming ? '' : '…'
        )}
        {streaming && (
          <span className="inline-block w-1 h-4 bg-copper-400 ml-0.5 animate-pulse align-middle" />
        )}
      </div>
    </div>
  );
}
