import { createHighlighterCore, type HighlighterCore } from 'shiki/core';
import { createJavaScriptRegexEngine } from 'shiki/engine/javascript';
import githubLight from 'shiki/themes/github-light.mjs';
import langBash from 'shiki/langs/bash.mjs';
import langCss from 'shiki/langs/css.mjs';
import langHtml from 'shiki/langs/html.mjs';
import langJavascript from 'shiki/langs/javascript.mjs';
import langJson from 'shiki/langs/json.mjs';
import langMarkdown from 'shiki/langs/markdown.mjs';
import langPython from 'shiki/langs/python.mjs';
import langTypescript from 'shiki/langs/typescript.mjs';
import langXml from 'shiki/langs/xml.mjs';
import langYaml from 'shiki/langs/yaml.mjs';

const SUPPORTED_LANGS = new Set([
  'markdown',
  'xml',
  'yaml',
  'json',
  'python',
  'typescript',
  'javascript',
  'bash',
  'css',
  'html',
]);

const LANG_ALIASES: Record<string, string> = {
  md: 'markdown',
  yml: 'yaml',
  py: 'python',
  ts: 'typescript',
  tsx: 'typescript',
  js: 'javascript',
  jsx: 'javascript',
  sh: 'bash',
  shell: 'bash',
  zsh: 'bash',
  svg: 'xml',
};

let highlighterPromise: Promise<HighlighterCore> | null = null;

function getHighlighter(): Promise<HighlighterCore> {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighterCore({
      themes: [githubLight],
      langs: [
        langMarkdown,
        langXml,
        langYaml,
        langJson,
        langPython,
        langTypescript,
        langJavascript,
        langBash,
        langCss,
        langHtml,
      ],
      engine: createJavaScriptRegexEngine(),
    });
  }
  return highlighterPromise;
}

export function normalizeShikiLang(rawLang?: string): string {
  const cleaned = (rawLang || '').trim().toLowerCase();
  if (!cleaned) return 'text';
  const mapped = LANG_ALIASES[cleaned] || cleaned;
  return SUPPORTED_LANGS.has(mapped) ? mapped : 'text';
}

export async function highlightCode(code: string, rawLang?: string): Promise<string> {
  const highlighter = await getHighlighter();
  const lang = normalizeShikiLang(rawLang);
  return highlighter.codeToHtml(code, {
    lang,
    theme: 'github-light',
  });
}
