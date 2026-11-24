export type TargetType =
  | 'SYSTEM_PROMPT'
  | 'SKILL_PACKAGE'
  | 'HYBRID_BUNDLE'
  | 'SKILL_SUITE';

export type SessionStatus =
  | 'idle'
  | 'interviewing'
  | 'compiling'
  | 'passed'
  | 'escalated';

export type NodeId =
  | 'node_1_helper'
  | 'node_2_construct'
  | 'gate_1_5_linter'
  | 'node_3_upgrader'
  | 'node_4_adjudicator';

export type ViewId =
  | 'view-interview'
  | 'view-artifacts'
  | 'view-qa'
  | 'view-pipeline';

export type BettyMode = 'tech_support' | 'prompt_advisor';

export type ArtifactTab = 'prompt' | 'blueprint';
export type DiffMode = 'unified' | 'split';

export interface ReadinessScores {
  used_decision_model?: boolean;
  target_type?: TargetType | string;
  has_core_objective?: number;
  has_trigger_or_context?: number;
  has_output_contract?: number;
  needs_auxiliary_files?: number | boolean | string;
  needs_scripts?: number | boolean | string;
  is_repo_context?: number | boolean | string;
  ready_to_compile?: number;
  latency_ms?: number;
  error?: string;
}

export interface RubricScores {
  used_decision_model?: boolean;
  intent_alignment?: number;
  token_density_no_bloat?: number;
  trigger_precision?: number;
  progressive_disclosure?: number;
  actionable_clarity?: number;
  output_contract_strength?: number;
  trigger_deconfliction?: number | null;
  challenger_beats_champion?: number;
  weighted_average?: number;
}

export interface ModelTelemetryEntry {
  role?: string;
  configured_model?: string;
  model?: string;
  thinking_level?: string;
  fallback_used?: boolean;
  fallback_from?: string | null;
  fast_path?: string;
  latency_ms?: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  agent?: string;
  text: string;
  thought?: string;
  timestamp: string;
  is_override?: boolean;
  has_blueprint?: boolean;
  is_system_verdict?: boolean;
  verdict?: 'PASS' | 'ESCALATE';
}

export interface TimelineItem {
  id: string;
  timestamp: string;
  node: string;
  title: string;
  detail: string;
  status: 'info' | 'success' | 'warning' | 'danger';
  model?: string;
  thinking_level?: string;
  fallback_used?: boolean;
  latency_ms?: number;
}

export interface FactoryState {
  user_input: string;
  champion_xml: string;
  champion_prompt: string;
  challenger_xml: string;
  challenger_prompt: string;
  error_log: string[];
  iteration_count: number;
  target_type: TargetType | string;
  slug_name: string;
  needs_scripts?: boolean;
  is_repo_context?: boolean;
  reference_files: Record<string, string>;
  rubric_scores: RubricScores;
  readiness_scores: ReadinessScores;
  model_telemetry: Record<string, ModelTelemetryEntry>;
  model_overrides?: Record<string, string>;
}

export interface SessionData {
  session_id: string;
  title: string;
  title_manually_set?: boolean;
  created_at: string;
  updated_at: string;
  created_at_iso?: string;
  updated_at_iso?: string;
  status: SessionStatus;
  active_node: NodeId | null;
  target_type: TargetType | string;
  slug_name: string;
  needs_scripts?: boolean;
  is_repo_context?: boolean;
  reference_files: Record<string, string>;
  rubric_scores: RubricScores;
  readiness_scores: ReadinessScores;
  model_telemetry: Record<string, ModelTelemetryEntry>;
  state: FactoryState;
  parsed_blueprint: Record<string, string>;
  raw_blueprint?: string;
  clean_champion_prompt: string;
  clean_challenger_prompt: string;
  diff_champion?: string;
  diff_challenger?: string;
  compilation_check: string;
  chat_history: ChatMessage[];
  timeline: TimelineItem[];
}

export interface SessionSummary {
  session_id: string;
  title: string;
  target_type: TargetType | string;
  slug_name?: string;
  status: SessionStatus | string;
  created_at?: string;
  updated_at?: string;
  created_at_iso?: string;
  updated_at_iso?: string;
  iteration_count?: number;
  rubric_scores?: RubricScores;
}

export interface HealthRoutingNode {
  model: string;
  thinking_level: string;
  fallback_model?: string;
  construct_light_thinking_level?: string;
  decision_model?: string;
}

export interface HealthResponse {
  status: string;
  model?: string;
  fast_model?: string;
  compiler_model?: string;
  fallback_model?: string;
  decision_model?: string;
  routing?: Record<string, HealthRoutingNode>;
  active_sessions?: number;
}

export interface BettyMessage {
  id: string;
  role: 'user' | 'assistant';
  mode: BettyMode;
  text: string;
  thought?: string;
  raw_text?: string;
  model?: string;
  thinking_level?: string;
  fallback_used?: boolean;
  timestamp: string;
}

export interface BettyHistoryResponse {
  tech_support: BettyMessage[];
  prompt_advisor: BettyMessage[];
}

export interface BettyChatResponse {
  mode: BettyMode;
  reply: BettyMessage;
  history: BettyMessage[];
}

export interface ImportSummary {
  imported: number;
  created: number;
  updated: number;
  remapped: number;
  skipped: number;
}

export interface NodeStartPayload {
  node: NodeId;
  title: string;
  description: string;
  iteration: number;
  model?: string;
  thinking_level?: string;
}

export interface NodeCompletePayload {
  node: NodeId;
  next_node: NodeId | null;
  telemetry: ModelTelemetryEntry;
  session: SessionData;
}

export interface StreamErrorPayload {
  error: string;
  session?: SessionData;
}

export type ToastTone = 'info' | 'check' | 'alert' | 'download' | 'trash' | 'edit';

export interface ToastState {
  id: number;
  message: string;
  tone: ToastTone;
}
