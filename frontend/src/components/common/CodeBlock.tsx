import { useEffect, useState } from 'react';
import { highlightCode } from '../../utils/shiki';

interface CodeBlockProps {
  code: string;
  lang?: string;
  className?: string;
}

export function CodeBlock({ code, lang = 'text', className = '' }: CodeBlockProps) {
  const [highlightedHtml, setHighlightedHtml] = useState<string>('');

  useEffect(() => {
    let cancelled = false;
    setHighlightedHtml('');
    highlightCode(code, lang)
      .then((html) => {
        if (!cancelled) setHighlightedHtml(html);
      })
      .catch(() => {
        if (!cancelled) setHighlightedHtml('');
      });
    return () => {
      cancelled = true;
    };
  }, [code, lang]);

  if (highlightedHtml) {
    return (
      <div
        dir="ltr"
        className={`canon-codeblock border border-hairline rounded-md overflow-x-auto bg-[#F4F6FA] ${className}`}
        dangerouslySetInnerHTML={{ __html: highlightedHtml }}
      />
    );
  }

  return (
    <div
      dir="ltr"
      className={`canon-codeblock border border-hairline rounded-md overflow-x-auto bg-[#F4F6FA] ${className}`}
    >
      <pre className="font-mono text-[12.5px] leading-[1.6] text-ink p-4 whitespace-pre">
        <code>{code}</code>
      </pre>
    </div>
  );
}
