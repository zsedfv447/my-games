import type { LeaderSkillDef, OrbType, StageDef } from '../../core/types';
import type { BattleState } from '../runtime';
import type { BattleConfig } from '../damage';
import type { MatchGroup, Pos } from '../board';
import type { PuzzleGoal } from '../../progression/puzzle';
import type { AssistantGoalId } from './goals';
export interface AssistantConstraints { minCombo?: number; exactCombo?: number; requiredColors?: OrbType[]; avoidColors?: OrbType[]; minGroup?: number; enhanced?: boolean; minHeartGroups?: number; minEnhanced?: number; minColorOrbs?: { color: OrbType; count: number }; groupColor?: OrbType; clearColors?: OrbType[]; minRingBreaks?: number; avoidAbsorb?: boolean }
export interface AssistantRequest { goal: AssistantGoalId; constraints?: AssistantConstraints; color?: OrbType; targetEnemy?: number; starIndex?: number }
export interface AssistantInput { state: BattleState; leaders: (LeaderSkillDef | undefined)[]; config: BattleConfig; stage?: Pick<StageDef, 'stars'>; skillUsedThisTurn?: boolean; request: AssistantRequest; takenThisTurn?: number[]; puzzle?: { goal: PuzzleGoal; maxSteps: number } }
export interface AssistantForecast { combo: number; damage: number; heal: number; incomingDamage: number; poisonDamage: number; hpAfter: number; enemyHp: number[]; colors: OrbType[]; goalAchieved: boolean; constraintsMet: boolean; warnings: string[]; groups: MatchGroup[]; ringBroken: OrbType[][]; absorbedDamage: number }
export interface PlannerOptions { stepsPerSecond?: number; beamWidth?: number; maxSteps?: number; timeBudgetMs?: number }
export interface AssistantPlan { path: Pos[]; forecast: AssistantForecast; score: number; examined: number; timedOut: boolean }
