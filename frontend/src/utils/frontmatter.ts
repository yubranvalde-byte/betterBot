export interface FrontmatterEntry {
  key: string;
  value: string;
}

export interface ParsedFrontmatterResult {
  frontmatter: FrontmatterEntry[] | null;
  body: string;
}

function unquoteYamlValue(raw: string): string {
  const trimmed = raw.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

export function parseYamlFrontmatter(markdown: string): ParsedFrontmatterResult {
  if (!markdown) return { frontmatter: null, body: '' };
  const normalized = markdown.replace(/\r\n/g, '\n');
  const match = normalized.match(/^---\n([\s\S]*?)\n---\s*(?:\n([\s\S]*))?$/);
  if (!match) {
    return { frontmatter: null, body: markdown };
  }

  const yamlBlock = match[1];
  const body = match[2] ?? '';
  const lines = yamlBlock.split('\n');
  const entries: FrontmatterEntry[] = [];

  let currentKey = '';
  let currentLines: string[] = [];

  const flush = () => {
    if (!currentKey) return;
    const combined = currentLines
      .map((l) => l.trim())
      .filter((l) => l && l !== '|' && l !== '>')
      .join(' ');
    entries.push({
      key: currentKey,
      value: unquoteYamlValue(combined),
    });
    currentKey = '';
    currentLines = [];
  };

  for (const line of lines) {
    const keyMatch = line.match(/^([A-Za-z0-9_-]+)\s*:\s*(.*)$/);
    if (keyMatch && !line.startsWith(' ') && !line.startsWith('\t')) {
      flush();
      currentKey = keyMatch[1];
      const rest = keyMatch[2] ?? '';
      if (rest && rest !== '|' && rest !== '>') {
        currentLines.push(rest);
      }
    } else if (currentKey && (line.startsWith(' ') || line.startsWith('\t') || !line.trim())) {
      currentLines.push(line);
    }
  }
  flush();

  if (entries.length === 0) {
    return { frontmatter: null, body: markdown };
  }

  return { frontmatter: entries, body };
}
