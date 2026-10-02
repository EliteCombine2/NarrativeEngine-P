import { describe, expect, it } from 'vitest';
import { ratingToIndexImportance } from '../importanceRater';

// The index's readers threshold on the server heuristic's 1–10 scale. These pin the
// two thresholds a Max-tier (AI-rated) scene could never reach before the mapping.
const KNOWLEDGE_LIMIT_MIN = 6; // npcBehaviorDirective.ts buildKnowledgeBoundary
const LOD_BONUS_MIN = 8;       // lodRenderer.ts effectiveAge

describe('ratingToIndexImportance', () => {
    it('maps the 1–5 rating to 1, 3, 5, 7, 9', () => {
        expect([1, 2, 3, 4, 5].map(ratingToIndexImportance)).toEqual([1, 3, 5, 7, 9]);
    });

    it('Significant and Critical scenes reach the NPC knowledge-limit threshold', () => {
        expect(ratingToIndexImportance(3)).toBeLessThan(KNOWLEDGE_LIMIT_MIN);
        expect(ratingToIndexImportance(4)).toBeGreaterThanOrEqual(KNOWLEDGE_LIMIT_MIN);
        expect(ratingToIndexImportance(5)).toBeGreaterThanOrEqual(KNOWLEDGE_LIMIT_MIN);
    });

    it('only Critical scenes reach the LOD importance bonus', () => {
        expect(ratingToIndexImportance(4)).toBeLessThan(LOD_BONUS_MIN);
        expect(ratingToIndexImportance(5)).toBeGreaterThanOrEqual(LOD_BONUS_MIN);
    });

    it('stays inside 1–10', () => {
        expect(ratingToIndexImportance(0)).toBe(1);
        expect(ratingToIndexImportance(9)).toBe(10);
    });
});
