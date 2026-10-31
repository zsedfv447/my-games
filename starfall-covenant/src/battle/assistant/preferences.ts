import { ORB_TYPES, type OrbType, type StageDef } from '../../core/types';
import type { BattleState } from '../runtime';
import { ASSISTANT_GOALS } from './goals';
import type { AssistantConstraints, AssistantRequest } from './types';

const STORAGE_KEY = 'starfall-covenant.orb-assistant.request.v1';
const goals = new Set<string>(ASSISTANT_GOALS.filter(g => g.id !== 'puzzle').map(g => g.id));
let memory: AssistantRequest = { goal: 'auto' };
let unsavedMemory = false;
const object = (value: unknown): Record<string, unknown> | undefined =>
  value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
const integer = (value: unknown, min = 1, max = 30): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;
const orb = (value: unknown): value is OrbType => typeof value === 'string' && (ORB_TYPES as readonly string[]).includes(value);
const index = (value: unknown): value is number => integer(value, 0, Number.MAX_SAFE_INTEGER);

/** Only named preference fields survive. Board, path, IDs and arbitrary payloads never persist. */
export function normalizeAssistantRequest(raw: unknown): AssistantRequest {
  const source = object(raw);
  if (!source || typeof source.goal !== 'string' || !goals.has(source.goal)) return { goal: 'auto' };
  const request: AssistantRequest = { goal: source.goal as AssistantRequest['goal'] };
  if (orb(source.color)) request.color = source.color;
  if (index(source.targetEnemy)) request.targetEnemy = source.targetEnemy;
  if (index(source.starIndex)) request.starIndex = source.starIndex;
  const rawConstraints = object(source.constraints);
  if (!rawConstraints) return request;
  const constraints: AssistantConstraints = {};
  const numberKeys = ['minCombo', 'exactCombo', 'minGroup', 'minHeartGroups', 'minEnhanced', 'minRingBreaks'] as const;
  for (const key of numberKeys) if (integer(rawConstraints[key])) constraints[key] = rawConstraints[key];
  for (const key of ['enhanced', 'avoidAbsorb'] as const) {
    if (typeof rawConstraints[key] === 'boolean') constraints[key] = rawConstraints[key];
  }
  for (const key of ['requiredColors', 'avoidColors', 'clearColors'] as const) {
    const values = rawConstraints[key];
    if (Array.isArray(values) && values.every(orb)) constraints[key] = [...new Set(values)];
  }
  if (orb(rawConstraints.groupColor)) constraints.groupColor = rawConstraints.groupColor;
  const colorCount = object(rawConstraints.minColorOrbs);
  if (colorCount && orb(colorCount.color) && integer(colorCount.count)) {
    constraints.minColorOrbs = { color: colorCount.color, count: colorCount.count };
  }
  if (Object.keys(constraints).length) request.constraints = constraints;
  return request;
}

export function loadAssistantRequest(): AssistantRequest {
  if (unsavedMemory) return normalizeAssistantRequest(memory);
  try {
    const saved = globalThis.localStorage.getItem(STORAGE_KEY);
    if (saved === null) return normalizeAssistantRequest(memory);
    try { memory = normalizeAssistantRequest(JSON.parse(saved)); }
    catch { memory = { goal: 'auto' }; }
  } catch { /* Storage can be disabled; the current session still remembers preferences. */ }
  return normalizeAssistantRequest(memory);
}

export function saveAssistantRequest(request: AssistantRequest): void {
  memory = normalizeAssistantRequest(request);
  try {
    globalThis.localStorage.setItem(STORAGE_KEY, JSON.stringify(memory));
    unsavedMemory = false;
  } catch { unsavedMemory = true; }
}

/** Reconcile positional targets with the new battle without silently changing the chosen goal. */
export function resolveAssistantRequest(saved: AssistantRequest, state: BattleState, stage?: Pick<StageDef, 'stars'>): AssistantRequest {
  const request = normalizeAssistantRequest(saved);
  if (request.targetEnemy !== undefined || request.goal === 'target') {
    const alive = (value: number | undefined): value is number => value !== undefined && !!state.enemies[value] && state.enemies[value].hp > 0;
    if (!alive(request.targetEnemy)) {
      const fallback = alive(state.target) ? state.target : state.enemies.findIndex(e => e.hp > 0);
      if (fallback >= 0) request.targetEnemy = fallback;
      else delete request.targetEnemy;
    }
  }
  if (request.starIndex !== undefined && !stage?.stars?.[request.starIndex]) delete request.starIndex;
  return request;
}
