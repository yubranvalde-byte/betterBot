import { useEffect, useMemo, useRef } from 'react';
import { renderSanitizedMarkdownHtml } from '../../utils/markdown';
import { highlightCode } from '../../utils/shiki';

interface MarkdownRendererProps {
  content: string;
  className?: string;
  stripEmojis?: boolean;
}

export function MarkdownRenderer({
  content,
  className = '',
  stripEmojis = false,
}: MarkdownRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const html = useMemo(
    () => renderSanitizedMarkdownHtml(content, { stripEmojis }),
    [content, stripEmojis],
  );

  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;
    let cancelled = false;

    const pres = Array.from(root.querySelectorAll('pre'));
    pres.forEach((pre) => {
      const codeEl = pre.querySelector('code');
      if (!codeEl) return;
      const rawCode = codeEl.textContent || '';
      const lang = pre.getAttribute('data-lang') || 'text';
      if (!rawCode.trim()) return;

      highlightCode(rawCode, lang)
        .then((shikiHtml) => {
          if (cancelled || !pre.isConnected) return;
          const wrapper = document.createElement('div');
          wrapper.innerHTML = shikiHtml;
          const highlightedPre = wrapper.querySelector('pre');
          if (highlightedPre) {
            highlightedPre.setAttribute('dir', 'ltr');
            pre.replaceWith(highlightedPre);
          }
        })
        .catch(() => {
          // Keep clean fallback <pre>
        });
    });

    return () => {
      cancelled = true;
    };
  }, [html]);

  return (
    <div
      ref={containerRef}
      dir="auto"
      className={`editorial-prose ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
