import type { SessionData } from '../types/api';

export const PRIMARY_FILE_KEY = '__primary__';

export interface ArtifactSkillGroup {
  slug: string;
  files: string[];
}

export interface ArtifactTreeData {
  hasNestedSuite: boolean;
  showPrimary: boolean;
  primaryLabel: string;
  rootExtraKeys: string[];
  skillGroups: ArtifactSkillGroup[];
}

export function getBestPrompt(session: SessionData | null | undefined): string {
  if (!session) return '';
  return session.clean_champion_prompt || session.clean_challenger_prompt || '';
}

export function getFirstSuiteSkillPath(refFiles: Record<string, string> | undefined): string {
  const keys = Object.keys(refFiles || {});
  if (keys.length === 0) return PRIMARY_FILE_KEY;
  const nestedSkill = keys.find((k) => /^skills\/[^/]+\/SKILL\.md$/i.test(k));
  if (nestedSkill) return nestedSkill;
  const anySkill = keys.find((k) => /(^|\/)SKILL\.md$/i.test(k));
  return anySkill || keys[0];
}

export function resolveActiveArtifactFile(
  session: SessionData | null | undefined,
  currentFile: string,
): string {
  if (!session) return PRIMARY_FILE_KEY;
  const st = session.state || {};
  const targetType = String(session.target_type || st.target_type || 'SYSTEM_PROMPT')
    .trim()
    .toUpperCase();
  const refFiles = session.reference_files || st.reference_files || {};
  const refKeys = Object.keys(refFiles);
  const primaryText = getBestPrompt(session).trim();

  let next = currentFile;
  if (next !== PRIMARY_FILE_KEY && refFiles[next] === undefined) {
    next = PRIMARY_FILE_KEY;
  }

  if (next === PRIMARY_FILE_KEY && refKeys.length > 0) {
    const isMinimalOrEmptySuite = targetType === 'SKILL_SUITE' && primaryText.length < 80;
    if (!primaryText || isMinimalOrEmptySuite) {
      next = getFirstSuiteSkillPath(refFiles);
    }
  }
  return next;
}

export function getActiveArtifactContent(
  session: SessionData | null | undefined,
  activeFile: string,
): string {
  if (!session) return '';
  const resolved = resolveActiveArtifactFile(session, activeFile);
  const refFiles = session.reference_files || session.state?.reference_files || {};
  if (resolved !== PRIMARY_FILE_KEY && refFiles[resolved] !== undefined) {
    return refFiles[resolved];
  }
  return getBestPrompt(session);
}

export function getRawArtifactContent(
  session: SessionData | null | undefined,
  activeFile: string,
): string {
  if (!session) return '';
  const resolved = resolveActiveArtifactFile(session, activeFile);
  const displayed = getActiveArtifactContent(session, activeFile);
  if (resolved === PRIMARY_FILE_KEY) {
    return session.state?.champion_prompt || session.state?.challenger_prompt || displayed;
  }
  return displayed;
}

export function getDownloadMdFilename(
  session: SessionData | null | undefined,
  activeFile: string,
): string {
  const resolvedFile = resolveActiveArtifactFile(session, activeFile);
  const targetType = String(session?.target_type || 'SYSTEM_PROMPT').trim().toUpperCase();
  const isRepoContext = Boolean(session?.is_repo_context || session?.state?.is_repo_context);
  const defaultName =
    targetType === 'SKILL_PACKAGE'
      ? 'SKILL.md'
      : isRepoContext
      ? 'AGENTS.md'
      : `system_prompt_${session?.session_id || 'gem'}.md`;
  const suiteSkillMatch = resolvedFile.match(/^skills\/([^/]+)\/SKILL\.md$/i);
  if (resolvedFile !== PRIMARY_FILE_KEY) {
    if (suiteSkillMatch) return `${suiteSkillMatch[1]}-SKILL.md`;
    return resolvedFile.split('/').pop() || defaultName;
  }
  return defaultName;
}

function getArtifactPathBucket(path: string): number {
  if (path === 'SYSTEM_PROMPT.md' || path === 'AGENTS.md') return 0;
  if (path === 'SKILL.md' || path.endsWith('/SKILL.md')) return 1;
  if (path.startsWith('references/') || path.includes('/references/')) return 2;
  if (path.startsWith('scripts/') || path.includes('/scripts/') || path.endsWith('.py')) return 3;
  return 4;
}

function compareArtifactPaths(a: string, b: string): number {
  const bucketDiff = getArtifactPathBucket(a) - getArtifactPathBucket(b);
  if (bucketDiff !== 0) return bucketDiff;
  return a.localeCompare(b);
}

export function buildArtifactTree(session: SessionData | null | undefined): ArtifactTreeData {
  const promptText = getBestPrompt(session);
  const targetType = String(session?.target_type || session?.state?.target_type || 'SYSTEM_PROMPT')
    .trim()
    .toUpperCase();
  const refFiles = session?.reference_files || session?.state?.reference_files || {};
  const refKeys = Object.keys(refFiles);
  const hasPrimaryText = Boolean(promptText.trim());
  const hasNestedSuite = refKeys.some((k) => /^skills\/[^/]+\/.+/.test(k));
  const isRepoContext = Boolean(
    session?.is_repo_context || session?.state?.is_repo_context || 'AGENTS.md' in refFiles,
  );

  const primaryLabel = hasNestedSuite
    ? targetType === 'HYBRID_BUNDLE'
      ? 'Primary Bundle'
      : 'Overview'
    : targetType === 'SKILL_PACKAGE'
    ? 'SKILL.md'
    : targetType === 'HYBRID_BUNDLE'
    ? 'Primary Bundle'
    : isRepoContext
    ? 'AGENTS.md'
    : 'SYSTEM_PROMPT.md';

  if (!hasNestedSuite) {
    return {
      hasNestedSuite: false,
      showPrimary: hasPrimaryText || targetType !== 'SKILL_SUITE',
      primaryLabel,
      rootExtraKeys: refKeys.slice().sort(compareArtifactPaths),
      skillGroups: [],
    };
  }

  const groupMap = new Map<string, string[]>();
  const rootExtraKeys: string[] = [];

  for (const relPath of refKeys) {
    const match = relPath.match(/^skills\/([^/]+)\/(.+)$/);
    if (match) {
      const subSlug = match[1];
      const existing = groupMap.get(subSlug) || [];
      existing.push(relPath);
      groupMap.set(subSlug, existing);
    } else {
      rootExtraKeys.push(relPath);
    }
  }

  const skillGroups: ArtifactSkillGroup[] = Array.from(groupMap.entries()).map(
    ([slug, files]) => ({
      slug,
      files: files.slice().sort(compareArtifactPaths),
    }),
  );

  const showPrimary =
    hasPrimaryText && (targetType !== 'SKILL_SUITE' || promptText.trim().length >= 80);

  return {
    hasNestedSuite: true,
    showPrimary,
    primaryLabel,
    rootExtraKeys: rootExtraKeys.sort(compareArtifactPaths),
    skillGroups,
  };
}
