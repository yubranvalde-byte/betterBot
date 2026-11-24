import type { HighlighterCore, LanguageRegistration } from 'shiki/core';

type LangLoader = () => Promise<{ default: LanguageRegistration[] }>;

const LANG_LOADERS: Record<string, LangLoader> = {
  markdown: () => import('shiki/langs/markdown.mjs'),
  xml: () => import('shiki/langs/xml.mjs'),
  yaml: () => import('shiki/langs/yaml.mjs'),
  json: () => import('shiki/langs/json.mjs'),
  python: () => import('shiki/langs/python.mjs'),
  typescript: () => import('shiki/langs/typescript.mjs'),
  javascript: () => import('shiki/langs/javascript.mjs'),
  bash: () => import('shiki/langs/bash.mjs'),
  css: () => import('shiki/langs/css.mjs'),
  html: () => import('shiki/langs/html.mjs'),
};

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
const loadedLangs = new Set<string>();
const pendingLangLoads = new Map<string, Promise<void>>();

function getHighlighter(): Promise<HighlighterCore> {
  if (!highlighterPromise) {
    highlighterPromise = Promise.all([
      import('shiki/core'),
      import('shiki/engine/javascript'),
      import('shiki/themes/github-light.mjs'),
    ]).then(([core, engine, githubLight]) =>
      core.createHighlighterCore({
        themes: [githubLight.default],
        langs: [],
        engine: engine.createJavaScriptRegexEngine(),
      }),
    );
  }
  return highlighterPromise;
}

async function ensureLanguageLoaded(highlighter: HighlighterCore, lang: string): Promise<void> {
  if (lang === 'text' || loadedLangs.has(lang)) return;
  const loader = LANG_LOADERS[lang];
  if (!loader) return;

  let pending = pendingLangLoads.get(lang);
  if (!pending) {
    pending = loader()
      .then((mod) => highlighter.loadLanguage(mod.default))
      .then(() => {
        loadedLangs.add(lang);
      })
      .finally(() => {
        pendingLangLoads.delete(lang);
      });
    pendingLangLoads.set(lang, pending);
  }
  await pending;
}

export function normalizeShikiLang(rawLang?: string): string {
  const cleaned = (rawLang || '').trim().toLowerCase();
  if (!cleaned) return 'text';
  const mapped = LANG_ALIASES[cleaned] || cleaned;
  return mapped in LANG_LOADERS ? mapped : 'text';
}

export async function highlightCode(code: string, rawLang?: string): Promise<string> {
  const highlighter = await getHighlighter();
  const lang = normalizeShikiLang(rawLang);
  await ensureLanguageLoaded(highlighter, lang);
  return highlighter.codeToHtml(code, {
    lang,
    theme: 'github-light',
  });
}
