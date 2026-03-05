import { type Phase, type OopsState, VALID_TRANSITIONS } from '../types.js';
import { readState, updateState } from './state-manager.js';
import { checkGate } from './gate-checker.js';

// Transitions that require gate checks
const GATED_TRANSITIONS: [Phase, Phase][] = [
  ['RED', 'GREEN'],
  ['GREEN', 'REFACTOR'],
  ['REFACTOR', 'RED'],
];

export function getCurrentPhase(): Phase {
  return readState().phase;
}

export function isValidTransition(from: Phase, to: Phase): boolean {
  if (to === 'NONE') return true; // Can always reset
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

function requiresGate(from: Phase, to: Phase): boolean {
  return GATED_TRANSITIONS.some(([f, t]) => f === from && t === to);
}

export function transitionPhase(to: Phase, options: { force?: boolean; skipGate?: boolean } = {}): OopsState {
  const current = readState();

  if (current.phase === to) {
    throw new Error(`Already in ${to} phase`);
  }

  if (!options.force && !isValidTransition(current.phase, to)) {
    const allowed = VALID_TRANSITIONS[current.phase].join(', ');
    throw new Error(
      `Invalid transition: ${current.phase} -> ${to}. Allowed: ${allowed}`
    );
  }

  // Gate check for gated transitions
  if (!options.force && !options.skipGate && requiresGate(current.phase, to)) {
    const result = checkGate(current.phase, to);
    if (!result.passed) {
      throw new Error(`Gate check failed: ${result.reason}`);
    }
  }

  return updateState((state) => ({
    ...state,
    phase: to,
    ...(to === 'NONE' ? { featureName: undefined, sessionId: '' } : {}),
  }));
}

export function parsePhase(input: string): Phase {
  const normalized = input.toUpperCase();
  const valid: Phase[] = ['NONE', 'RED', 'GREEN', 'REFACTOR'];
  if (!valid.includes(normalized as Phase)) {
    throw new Error(`Invalid phase: ${input}. Valid: ${valid.join(', ').toLowerCase()}`);
  }
  return normalized as Phase;
}
