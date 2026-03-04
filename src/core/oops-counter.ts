import { readState } from './state-manager.js';

export function getOopsCount(): number {
  return readState().oopsCount;
}

export function getLastOops(): string | null {
  return readState().lastOops;
}
