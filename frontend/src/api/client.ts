import type {
  BettyChatResponse,
  BettyHistoryResponse,
  BettyMode,
  ContextAttachment,
  EffortTier,
  HealthResponse,
  ImportSummary,
  NodeCompletePayload,
  NodeStartPayload,
  RedTeamReport,
  SessionData,
  SessionSummary,
  StreamErrorPayload,
} from '../types/api';

export const STORAGE_KEYS = {
  ACTIVE_SESSION_ID: 'betterbot_active_session_id',
  ACTIVE_VIEW: 'betterbot_active_view',
  WORKSPACE_ID: 'betterbot_workspace_id',
  MASTER_KEY: 'betterbot_master_key',
  BETTY_DOCKED_WIDTH: 'betterbot_betty_docked_width',
} as const;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function getOrCreateWorkspaceId(): string {
  let wid = (localStorage.getItem(STORAGE_KEYS.WORKSPACE_ID) || '').trim();
  if (!wid || !UUID_PATTERN.test(wid)) {
    wid = generateUUID();
    localStorage.setItem(STORAGE_KEYS.WORKSPACE_ID, wid);
  }
  return wid;
}

export function getStoredMasterKey(): string {
  return (localStorage.getItem(STORAGE_KEYS.MASTER_KEY) || '').trim();
}

export function setStoredMasterKey(key: string): void {
  localStorage.setItem(STORAGE_KEYS.MASTER_KEY, key.trim());
}

export function clearStoredMasterKey(): void {
  localStorage.removeItem(STORAGE_KEYS.MASTER_KEY);
}

export function buildWorkspaceHeaders(extraHeaders: Record<string, string> = {}): Record<string, string> {
  const headers: Record<string, string> = { ...extraHeaders };
  headers['X-Workspace-ID'] = getOrCreateWorkspaceId();
  const masterKey = getStoredMasterKey();
  if (masterKey) {
    headers['X-Master-Key'] = masterKey;
  }
  return headers;
}

export async function apiFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const extra: Record<string, string> = {};
  if (options.headers) {
    if (options.headers instanceof Headers) {
      options.headers.forEach((v, k) => {
        extra[k] = v;
      });
    } else if (Array.isArray(options.headers)) {
      for (const [k, v] of options.headers) {
        extra[k] = v;
      }
    } else {
      Object.assign(extra, options.headers);
    }
  }
  return fetch(url, {
    ...options,
    headers: buildWorkspaceHeaders(extra),
  });
}

export async function fetchHealth(): Promise<HealthResponse> {
  const res = await fetch('/api/health');
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function verifyMasterKey(
  key: string,
): Promise<{ authorized: boolean; configured: boolean }> {
  const res = await fetch('/api/workspace/verify-master', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function exportWorkspace(
  isMasterMode: boolean,
): Promise<{ blob: Blob; filename: string }> {
  const res = await apiFetch('/api/workspace/export');
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const blob = await res.blob();
  let filename = `betterbot-history-${isMasterMode ? 'master' : 'workspace'}.json`;
  const disp = res.headers.get('Content-Disposition') || '';
  const match = disp.match(/filename="?([^";]+)"?/i);
  if (match && match[1]) filename = match[1];
  return { blob, filename };
}

export async function importWorkspace(payload: unknown): Promise<ImportSummary> {
  const res = await apiFetch('/api/workspace/import', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error((errBody as { detail?: string }).detail || `HTTP ${res.status}`);
  }
  return res.json();
}

export async function listSessions(): Promise<SessionSummary[]> {
  const res = await apiFetch('/api/sessions');
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = (await res.json()) as { sessions?: SessionSummary[] };
  return data.sessions || [];
}

export async function createSession(effortTier?: EffortTier): Promise<SessionData> {
  const res = await apiFetch(
    '/api/sessions',
    effortTier
      ? {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ effort_tier: effortTier }),
        }
      : { method: 'POST' },
  );
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error((errBody as { detail?: string }).detail || `HTTP ${res.status}`);
  }
  return res.json();
}

export async function getSession(sessionId: string): Promise<SessionData | null> {
  const res = await apiFetch(`/api/sessions/${sessionId}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function renameSession(sessionId: string, title: string): Promise<SessionData> {
  const res = await apiFetch(`/api/sessions/${sessionId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function deleteSession(sessionId: string): Promise<{ deleted: boolean }> {
  const res = await apiFetch(`/api/sessions/${sessionId}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function downloadSessionZip(
  sessionId: string,
  fallbackSlug?: string,
): Promise<{ blob: Blob; filename: string }> {
  const res = await apiFetch(`/api/sessions/${sessionId}/download`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const blob = await res.blob();
  let filename = `${fallbackSlug || sessionId}.zip`;
  const disp = res.headers.get('Content-Disposition') || '';
  const match = disp.match(/filename="?([^";]+)"?/i);
  if (match && match[1]) filename = match[1];
  return { blob, filename };
}

export async function runRedTeam(
  sessionId: string,
): Promise<{ report: RedTeamReport; session: SessionData }> {
  const res = await apiFetch(`/api/sessions/${sessionId}/red-team`, {
    method: 'POST',
  });
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error((errBody as { detail?: string }).detail || `HTTP ${res.status}`);
  }
  return res.json();
}

export async function uploadAttachment(
  sessionId: string,
  file: File,
): Promise<{ attachment: ContextAttachment; session: SessionData }> {
  const formData = new FormData();
  formData.append('file', file);
  const res = await apiFetch(`/api/sessions/${sessionId}/attachments`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error((errBody as { detail?: string }).detail || `HTTP ${res.status}`);
  }
  return res.json();
}

export async function deleteAttachment(
  sessionId: string,
  attachmentId: string,
): Promise<{ deleted: boolean; session: SessionData }> {
  const res = await apiFetch(`/api/sessions/${sessionId}/attachments/${attachmentId}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error((errBody as { detail?: string }).detail || `HTTP ${res.status}`);
  }
  return res.json();
}

export async function getBettyHistory(): Promise<BettyHistoryResponse> {
  const res = await apiFetch('/api/betty/history');
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function sendBettyChat(
  message: string,
  mode: BettyMode,
  sessionId: string | null,
  effortTier?: EffortTier,
): Promise<BettyChatResponse> {
  const res = await apiFetch('/api/betty/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message,
      mode,
      session_id: sessionId,
      ...(effortTier ? { effort_tier: effortTier } : {}),
    }),
  });
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error((errBody as { detail?: string }).detail || `HTTP ${res.status}`);
  }
  return res.json();
}

export async function clearBettyHistory(
  mode: BettyMode,
): Promise<{ mode: BettyMode; history: BettyHistoryResponse['tech_support'] }> {
  const res = await apiFetch('/api/betty/clear', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export interface StreamExecutionCallbacks {
  onRecoveredSession?: (session: SessionData) => void;
  onSessionUpdate?: (session: SessionData) => void;
  onNodeStart?: (payload: NodeStartPayload) => void;
  onNodeComplete?: (payload: NodeCompletePayload) => void;
  onDone?: (session: SessionData) => void;
  onError?: (payload: StreamErrorPayload) => void;
}

function dispatchSseBlock(block: string, callbacks: StreamExecutionCallbacks): void {
  const lines = block.split('\n');
  let eventType = 'message';
  const dataLines: string[] = [];

  for (const line of lines) {
    if (line.startsWith('event:')) {
      eventType = line.slice(6).trim();
    } else if (line.startsWith('data:')) {
      dataLines.push(line.slice(5).trimStart());
    }
  }

  const dataStr = dataLines.join('\n').trim();
  if (!dataStr) return;

  let payload: unknown;
  try {
    payload = JSON.parse(dataStr);
  } catch {
    return;
  }

  if (eventType === 'session_update' || eventType === 'state_update') {
    callbacks.onSessionUpdate?.(payload as SessionData);
  } else if (eventType === 'node_start') {
    callbacks.onNodeStart?.(payload as NodeStartPayload);
  } else if (eventType === 'node_complete') {
    callbacks.onNodeComplete?.(payload as NodeCompletePayload);
  } else if (eventType === 'done') {
    callbacks.onDone?.(payload as SessionData);
  } else if (eventType === 'error') {
    callbacks.onError?.(payload as StreamErrorPayload);
  }
}

export async function streamSessionExecution(
  sessionId: string,
  messageText: string,
  callbacks: StreamExecutionCallbacks,
  signal: AbortSignal,
  effortTier?: EffortTier,
): Promise<void> {
  let targetSessionId = sessionId;
  const payloadBody = JSON.stringify({
    message: messageText,
    mode: 'auto',
    ...(effortTier ? { effort_tier: effortTier } : {}),
  });
  let response = await apiFetch(`/api/sessions/${targetSessionId}/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: payloadBody,
    signal,
  });

  if (response.status === 404) {
    const recovered = await apiFetch(
      '/api/sessions',
      effortTier
        ? {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ effort_tier: effortTier }),
            signal,
          }
        : {
            method: 'POST',
            signal,
          },
    );
    if (!recovered.ok) {
      const errBody = await recovered.json().catch(() => ({}));
      throw new Error((errBody as { detail?: string }).detail || `HTTP ${recovered.status}`);
    }
    const newSession = (await recovered.json()) as SessionData;
    targetSessionId = newSession.session_id;
    callbacks.onRecoveredSession?.(newSession);

    response = await apiFetch(`/api/sessions/${targetSessionId}/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payloadBody,
      signal,
    });
  }

  if (!response.ok) {
    const errBody = await response.json().catch(() => ({}));
    throw new Error((errBody as { detail?: string }).detail || `HTTP ${response.status}`);
  }
  if (!response.body) {
    throw new Error('ReadableStream not supported by response');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n');

    const parts = buffer.split('\n\n');
    buffer = parts.pop() || '';
    for (const block of parts) {
      dispatchSseBlock(block, callbacks);
    }
  }

  buffer += decoder.decode().replace(/\r\n/g, '\n');
  if (buffer.trim()) {
    for (const block of buffer.split('\n\n')) {
      if (block.trim()) dispatchSseBlock(block, callbacks);
    }
  }
}
