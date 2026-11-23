import { html as diff2htmlRender } from 'diff2html';
import DOMPurify from 'dompurify';
import type { DiffMode } from '../types/api';

export interface DiffOp {
  type: 'ctx' | 'add' | 'del';
  text: string;
}

export interface DiffBundleResult {
  unifiedDiff: string;
  addCount: number;
  delCount: number;
  isSame: boolean;
  isMissingOne: boolean;
}

export function computeLineDiff(oldText: string, newText: string): DiffOp[] {
  const oldLines = (oldText || '').split('\n');
  const newLines = (newText || '').split('\n');
  const n = oldLines.length;
  const m = newLines.length;

  if (n * m > 250000) {
    const out: DiffOp[] = [];
    const maxLen = Math.max(n, m);
    for (let i = 0; i < maxLen; i++) {
      if (i < n && i < m && oldLines[i] === newLines[i]) {
        out.push({ type: 'ctx', text: oldLines[i] });
      } else {
        if (i < n) out.push({ type: 'del', text: oldLines[i] });
        if (i < m) out.push({ type: 'add', text: newLines[i] });
      }
    }
    return out;
  }

  const dp = Array.from({ length: n + 1 }, () => new Int32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      if (oldLines[i] === newLines[j]) {
        dp[i][j] = 1 + dp[i + 1][j + 1];
      } else {
        dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
  }

  const result: DiffOp[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (oldLines[i] === newLines[j]) {
      result.push({ type: 'ctx', text: oldLines[i] });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      result.push({ type: 'del', text: oldLines[i] });
      i++;
    } else {
      result.push({ type: 'add', text: newLines[j] });
      j++;
    }
  }
  while (i < n) {
    result.push({ type: 'del', text: oldLines[i++] });
  }
  while (j < m) {
    result.push({ type: 'add', text: newLines[j++] });
  }
  return result;
}

export function buildUnifiedDiff(
  oldText: string,
  newText: string,
  oldLabel = 'Champion',
  newLabel = 'Challenger',
): DiffBundleResult {
  const champ = oldText || '';
  const chall = newText || '';
  const isSame = Boolean(champ && chall && champ.trim() === chall.trim());
  const isMissingOne = !champ || !chall;

  if (isSame || isMissingOne) {
    return {
      unifiedDiff: '',
      addCount: 0,
      delCount: 0,
      isSame,
      isMissingOne,
    };
  }

  const ops = computeLineDiff(champ, chall);
  let addCount = 0;
  let delCount = 0;
  let oldCount = 0;
  let newCount = 0;

  const bodyLines: string[] = [];
  for (const op of ops) {
    if (op.type === 'add') {
      addCount++;
      newCount++;
      bodyLines.push(`+${op.text}`);
    } else if (op.type === 'del') {
      delCount++;
      oldCount++;
      bodyLines.push(`-${op.text}`);
    } else {
      oldCount++;
      newCount++;
      bodyLines.push(` ${op.text}`);
    }
  }

  const header = [
    `--- a/${oldLabel}`,
    `+++ b/${newLabel}`,
    `@@ -1,${oldCount} +1,${newCount} @@`,
  ];

  return {
    unifiedDiff: [...header, ...bodyLines].join('\n'),
    addCount,
    delCount,
    isSame: false,
    isMissingOne: false,
  };
}

export function renderDiffHtml(unifiedDiff: string, mode: DiffMode): string {
  if (!unifiedDiff) return '';
  const raw = diff2htmlRender(unifiedDiff, {
    drawFileList: false,
    matching: 'lines',
    outputFormat: mode === 'split' ? 'side-by-side' : 'line-by-line',
  });
  return DOMPurify.sanitize(raw, {
    USE_PROFILES: { html: true },
  });
}
