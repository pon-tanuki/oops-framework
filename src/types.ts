export type Phase = 'NONE' | 'RED' | 'GREEN' | 'REFACTOR';

// --- Hook types (shared between pre-tool-use and post-tool-use) ---

export interface HookInput {
  tool_name: string;
  tool_input: {
    file_path?: string;
    command?: string;
    [key: string]: unknown;
  };
}

export interface HookOutput {
  hookSpecificOutput: {
    hookEventName: string;
    permissionDecision: 'allow' | 'deny' | 'ask';
    permissionDecisionReason?: string;
  };
}

export const WRITE_TOOLS = new Set(['Edit', 'Write', 'NotebookEdit']);
export const TEST_FILE_PATTERN = /\.test\.|\.spec\.|\/test\/|\/tests\/|\/spec\/|\/__tests__\//;

export function isTestFile(filePath: string): boolean {
  const normalized = filePath.replace(/^\.\//, '');
  return TEST_FILE_PATTERN.test(normalized);
}

export interface OopsState {
  $schema?: string;
  phase: Phase;
  sessionId: string;
  orchestratorId?: string;
  locked?: boolean;
  oopsCount: number;
  lastOops: string | null;
  testResults: {
    passed: number;
    failed: number;
    total: number;
  };
  featureName?: string;
  startedAt?: string;
  metadata: {
    created: string;
    phase0Start: string | null;
    lastUpdate: string;
  };
}

export interface OopsConfig {
  version: string;
  testCommand: string;
  testFilePattern: string;
  debug: boolean;
  features: {
    autoGateCheck: boolean;
    postToolUseTestRunner: boolean;
  };
}

export interface GateResult {
  passed: boolean;
  reason: string;
  details?: string[];
  testOutput?: string;
}

export interface TestResult {
  exitCode: number;
  passed: boolean;
  output: string;
}

export const VALID_TRANSITIONS: Record<Phase, Phase[]> = {
  NONE: ['RED'],
  RED: ['GREEN', 'NONE'],
  GREEN: ['REFACTOR', 'NONE'],
  REFACTOR: ['RED', 'NONE'],
};

export const DEFAULT_STATE: OopsState = {
  phase: 'NONE',
  sessionId: '',
  oopsCount: 0,
  lastOops: null,
  testResults: { passed: 0, failed: 0, total: 0 },
  metadata: {
    created: new Date().toISOString(),
    phase0Start: null,
    lastUpdate: new Date().toISOString(),
  },
};

export const DEFAULT_CONFIG: OopsConfig = {
  version: '1.0.0',
  testCommand: 'npm test',
  testFilePattern: '\\.test\\.|.spec\\.|/test/|/tests/|/spec/|/__tests__/',
  debug: false,
  features: {
    autoGateCheck: true,
    postToolUseTestRunner: false,
  },
};

// --- Plan types ---

export type SubtaskStatus = 'pending' | 'in_progress' | 'completed' | 'skipped';
export type PlanStatus = 'planning' | 'in_progress' | 'completed';

export interface Subtask {
  id: number;
  name: string;
  description: string;
  status: SubtaskStatus;
  oopsCount: number;
  cycles: number;
}

export interface OopsPlan {
  goal: string;
  createdAt: string;
  status: PlanStatus;
  currentSubtask: number | null;
  subtasks: Subtask[];
}

export const DEFAULT_PLAN: OopsPlan = {
  goal: '',
  createdAt: '',
  status: 'planning',
  currentSubtask: null,
  subtasks: [],
};
