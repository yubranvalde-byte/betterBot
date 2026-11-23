import DOMPurify from 'dompurify';
import { marked } from 'marked';
import { stripDecorativeEmojis } from './text';

marked.setOptions({
  gfm: true,
  breaks: true,
});

const BIDI_ELEMENTS_SELECTOR = 'p, li, h1, h2, h3, h4, h5, h6, blockquote, td, th';

export function renderSanitizedMarkdownHtml(
  rawMarkdown: string,
  options: { stripEmojis?: boolean } = {},
): string {
  if (!rawMarkdown) return '';
  const source = options.stripEmojis ? stripDecorativeEmojis(rawMarkdown) : rawMarkdown;
  const rawHtml = marked.parse(source, { async: false }) as string;
  const sanitized = DOMPurify.sanitize(rawHtml, {
    USE_PROFILES: { html: true },
  });

  if (typeof DOMParser === 'undefined') {
    return sanitized;
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(sanitized, 'text/html');

  doc.body.querySelectorAll(BIDI_ELEMENTS_SELECTOR).forEach((el) => {
    el.setAttribute('dir', 'auto');
  });

  doc.body.querySelectorAll('pre').forEach((pre) => {
    pre.setAttribute('dir', 'ltr');
    const code = pre.querySelector('code');
    if (code) {
      const langClass = Array.from(code.classList).find((c) => c.startsWith('language-'));
      if (langClass) {
        pre.setAttribute('data-lang', langClass.slice('language-'.length));
      }
    }
  });

  doc.body.querySelectorAll(':not(pre) > code').forEach((code) => {
    code.setAttribute('dir', 'ltr');
  });

  doc.body.querySelectorAll('a').forEach((a) => {
    a.setAttribute('target', '_blank');
    a.setAttribute('rel', 'noopener noreferrer');
  });

  return doc.body.innerHTML;
}
