export type Phase = 'NONE' | 'RED' | 'GREEN' | 'REFACTOR';

export interface OopsState {
  $schema?: string;
  phase: Phase;
  sessionId: string;
  orchestratorId: string;
  locked: boolean;
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
  orchestratorId: '',
  locked: false,
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
