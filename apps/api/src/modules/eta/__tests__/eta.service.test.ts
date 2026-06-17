import { EtaConfidence } from '@line-queue/shared';

import { DEFAULT_ETA_CONFIG } from '../eta.service';
import { etaService } from '../eta.service';
import { EtaConfig, EtaInput } from '../eta.types';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Fixed "now" injected into every test for deterministic timestamps. */
const FIXED_NOW = new Date('2025-01-15T10:00:00.000Z');

/**
 * Build an EtaInput with sensible defaults; individual tests only override
 * the fields relevant to the behaviour under test.
 */
function makeInput(overrides: Partial<EtaInput> = {}): EtaInput {
  return {
    aheadCount: 0,
    avgServiceSeconds: 60,
    now: FIXED_NOW,
    ...overrides,
  };
}

// ── Test suite ─────────────────────────────────────────────────────────────────

describe('etaService.calculate', () => {
  // ── Core formula ───────────────────────────────────────────────────────────

  describe('core formula', () => {
    it('returns 0 wait seconds when aheadCount is 0', () => {
      const result = etaService.calculate(makeInput({ aheadCount: 0, avgServiceSeconds: 60 }));
      expect(result.estimatedWaitSeconds).toBe(0);
    });

    it('computes wait as aheadCount × avgServiceSeconds', () => {
      const result = etaService.calculate(makeInput({ aheadCount: 3, avgServiceSeconds: 90 }));
      expect(result.estimatedWaitSeconds).toBe(270); // 3 × 90
    });

    it('converts seconds to minutes rounded up', () => {
      // 3 × 70 = 210 s → 210/60 = 3.5 → ceil = 4
      const result = etaService.calculate(makeInput({ aheadCount: 3, avgServiceSeconds: 70 }));
      expect(result.estimatedWaitMinutes).toBe(4);
    });

    it('rounds exactly-divisible minutes without adding a minute', () => {
      // 3 × 60 = 180 s → 180/60 = 3.0 → ceil = 3
      const result = etaService.calculate(makeInput({ aheadCount: 3, avgServiceSeconds: 60 }));
      expect(result.estimatedWaitMinutes).toBe(3);
    });

    it('calculates expectedCallAt from now + estimatedWaitSeconds', () => {
      // 5 × 60 = 300 s = 5 min after FIXED_NOW
      const result = etaService.calculate(makeInput({ aheadCount: 5, avgServiceSeconds: 60 }));
      const expected = new Date(FIXED_NOW.getTime() + 300 * 1_000);
      expect(result.expectedCallAt).toEqual(expected);
    });

    it('uses current time when now is not provided', () => {
      const before = new Date();
      const result = etaService.calculate({ aheadCount: 0, avgServiceSeconds: 60 });
      const after = new Date();
      // expectedCallAt should be within the window [before, after]
      expect(result.expectedCallAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(result.expectedCallAt.getTime()).toBeLessThanOrEqual(after.getTime());
    });
  });

  // ── Fallback behaviour ─────────────────────────────────────────────────────

  describe('fallback when avgServiceSeconds is invalid', () => {
    it('uses DEFAULT_AVG_SERVICE_SECONDS (120 s) when avgServiceSeconds is 0', () => {
      const result = etaService.calculate(makeInput({ aheadCount: 2, avgServiceSeconds: 0 }));
      expect(result.estimatedWaitSeconds).toBe(2 * 120);
      expect(result.isFallback).toBe(true);
    });

    it('uses fallback when avgServiceSeconds is negative', () => {
      const result = etaService.calculate(makeInput({ aheadCount: 1, avgServiceSeconds: -30 }));
      expect(result.estimatedWaitSeconds).toBe(120);
      expect(result.isFallback).toBe(true);
    });

    it('sets isFallback to false when avgServiceSeconds > 0', () => {
      const result = etaService.calculate(makeInput({ aheadCount: 1, avgServiceSeconds: 45 }));
      expect(result.isFallback).toBe(false);
    });

    it('uses custom defaultAvgServiceSeconds from config', () => {
      const config: EtaConfig = { ...DEFAULT_ETA_CONFIG, defaultAvgServiceSeconds: 180 };
      const result = etaService.calculate(
        makeInput({ aheadCount: 2, avgServiceSeconds: 0 }),
        config
      );
      expect(result.estimatedWaitSeconds).toBe(2 * 180);
    });
  });

  // ── Confidence levels ──────────────────────────────────────────────────────

  describe('confidence derivation', () => {
    it('returns HIGH when aheadCount < highConfidenceMaxAhead (default 5) and no fallback', () => {
      const result = etaService.calculate(makeInput({ aheadCount: 4, avgServiceSeconds: 60 }));
      expect(result.confidence).toBe(EtaConfidence.HIGH);
    });

    it('returns HIGH when aheadCount is 0 and no fallback', () => {
      const result = etaService.calculate(makeInput({ aheadCount: 0, avgServiceSeconds: 60 }));
      expect(result.confidence).toBe(EtaConfidence.HIGH);
    });

    it('returns MEDIUM when aheadCount is in [highConfidenceMaxAhead, lowConfidenceMinAhead)', () => {
      // Default thresholds: high=5, low=20 — so 10 should be MEDIUM
      const result = etaService.calculate(makeInput({ aheadCount: 10, avgServiceSeconds: 60 }));
      expect(result.confidence).toBe(EtaConfidence.MEDIUM);
    });

    it('returns MEDIUM at the exact highConfidenceMaxAhead boundary', () => {
      const result = etaService.calculate(makeInput({ aheadCount: 5, avgServiceSeconds: 60 }));
      expect(result.confidence).toBe(EtaConfidence.MEDIUM);
    });

    it('returns LOW when aheadCount >= lowConfidenceMinAhead (default 20)', () => {
      const result = etaService.calculate(makeInput({ aheadCount: 20, avgServiceSeconds: 60 }));
      expect(result.confidence).toBe(EtaConfidence.LOW);
    });

    it('returns LOW when aheadCount is well above lowConfidenceMinAhead', () => {
      const result = etaService.calculate(makeInput({ aheadCount: 50, avgServiceSeconds: 60 }));
      expect(result.confidence).toBe(EtaConfidence.LOW);
    });

    it('returns LOW when fallback is applied, even with small aheadCount', () => {
      const result = etaService.calculate(makeInput({ aheadCount: 1, avgServiceSeconds: 0 }));
      expect(result.confidence).toBe(EtaConfidence.LOW);
    });

    it('honours custom confidence thresholds from config', () => {
      const config: EtaConfig = {
        defaultAvgServiceSeconds: 120,
        highConfidenceMaxAhead: 3,
        lowConfidenceMinAhead: 10,
      };
      expect(
        etaService.calculate(makeInput({ aheadCount: 2, avgServiceSeconds: 60 }), config).confidence
      ).toBe(EtaConfidence.HIGH);

      expect(
        etaService.calculate(makeInput({ aheadCount: 3, avgServiceSeconds: 60 }), config).confidence
      ).toBe(EtaConfidence.MEDIUM);

      expect(
        etaService.calculate(makeInput({ aheadCount: 10, avgServiceSeconds: 60 }), config)
          .confidence
      ).toBe(EtaConfidence.LOW);
    });
  });

  // ── Edge cases ─────────────────────────────────────────────────────────────

  describe('edge cases', () => {
    it('handles fractional avgServiceSeconds correctly', () => {
      // 2 × 30.5 = 61 s → ceil(61/60) = 2 min
      const result = etaService.calculate(makeInput({ aheadCount: 2, avgServiceSeconds: 30.5 }));
      expect(result.estimatedWaitSeconds).toBeCloseTo(61);
      expect(result.estimatedWaitMinutes).toBe(2);
    });

    it('returns estimatedWaitMinutes of 0 when aheadCount is 0 (ceil(0) = 0)', () => {
      const result = etaService.calculate(makeInput({ aheadCount: 0, avgServiceSeconds: 60 }));
      expect(result.estimatedWaitMinutes).toBe(0);
    });

    it('produces a consistent EtaResult shape on every call', () => {
      const result = etaService.calculate(makeInput());
      expect(result).toHaveProperty('estimatedWaitSeconds');
      expect(result).toHaveProperty('estimatedWaitMinutes');
      expect(result).toHaveProperty('expectedCallAt');
      expect(result).toHaveProperty('isFallback');
      expect(result).toHaveProperty('confidence');
    });

    it('expectedCallAt equals now when aheadCount is 0', () => {
      const result = etaService.calculate(makeInput({ aheadCount: 0, avgServiceSeconds: 60 }));
      expect(result.expectedCallAt).toEqual(FIXED_NOW);
    });

    it('large queue produces correct seconds before confidence degrades', () => {
      // 100 × 120 = 12 000 s
      const result = etaService.calculate(makeInput({ aheadCount: 100, avgServiceSeconds: 120 }));
      expect(result.estimatedWaitSeconds).toBe(12_000);
      expect(result.confidence).toBe(EtaConfidence.LOW);
    });
  });

  // ── Workload-based ETA (totalWorkloadMinutes) ──────────────────────────────

  describe('workload-based ETA when totalWorkloadMinutes is provided', () => {
    it('uses totalWorkloadMinutes × 60 as estimatedWaitSeconds when > 0', () => {
      // haircut 30 min + dyeing 120 min = 150 min = 9 000 s
      const result = etaService.calculate(
        makeInput({ aheadCount: 2, avgServiceSeconds: 300, totalWorkloadMinutes: 150 })
      );
      expect(result.estimatedWaitSeconds).toBe(9_000);
      expect(result.isFallback).toBe(false);
    });

    it('ignores avgServiceSeconds when totalWorkloadMinutes is provided', () => {
      // If both are present, workload wins
      const workloadResult = etaService.calculate(
        makeInput({ aheadCount: 5, avgServiceSeconds: 300, totalWorkloadMinutes: 60 })
      );
      const avgResult = etaService.calculate(makeInput({ aheadCount: 5, avgServiceSeconds: 300 }));
      expect(workloadResult.estimatedWaitSeconds).toBe(3_600); // 60 × 60
      expect(avgResult.estimatedWaitSeconds).toBe(1_500); // 5 × 300
      expect(workloadResult.estimatedWaitSeconds).not.toBe(avgResult.estimatedWaitSeconds);
    });

    it('falls back to avgServiceSeconds when totalWorkloadMinutes is 0', () => {
      const result = etaService.calculate(
        makeInput({ aheadCount: 3, avgServiceSeconds: 60, totalWorkloadMinutes: 0 })
      );
      expect(result.estimatedWaitSeconds).toBe(180); // 3 × 60 (fallback)
    });

    it('falls back to avgServiceSeconds when totalWorkloadMinutes is undefined', () => {
      const result = etaService.calculate(
        makeInput({ aheadCount: 3, avgServiceSeconds: 60, totalWorkloadMinutes: undefined })
      );
      expect(result.estimatedWaitSeconds).toBe(180); // 3 × 60 (fallback)
    });

    it('converts workload-based wait to minutes correctly', () => {
      // 90 min workload → 5 400 s → ceil(5400/60) = 90 min
      const result = etaService.calculate(
        makeInput({ aheadCount: 1, avgServiceSeconds: 60, totalWorkloadMinutes: 90 })
      );
      expect(result.estimatedWaitMinutes).toBe(90);
    });

    it('computes correct expectedCallAt using workload minutes', () => {
      // 30 min = 1 800 s after FIXED_NOW
      const result = etaService.calculate(
        makeInput({ aheadCount: 1, avgServiceSeconds: 60, totalWorkloadMinutes: 30 })
      );
      const expected = new Date(FIXED_NOW.getTime() + 1_800 * 1_000);
      expect(result.expectedCallAt).toEqual(expected);
    });

    it('derives confidence from aheadCount even when using workload-based ETA', () => {
      // aheadCount=2 with workload → still HIGH (2 < 5 threshold)
      const highResult = etaService.calculate(
        makeInput({ aheadCount: 2, avgServiceSeconds: 300, totalWorkloadMinutes: 90 })
      );
      expect(highResult.confidence).toBe(EtaConfidence.HIGH);

      // aheadCount=25 with workload → still LOW (25 >= 20 threshold)
      const lowResult = etaService.calculate(
        makeInput({ aheadCount: 25, avgServiceSeconds: 300, totalWorkloadMinutes: 90 })
      );
      expect(lowResult.confidence).toBe(EtaConfidence.LOW);
    });

    it('heterogeneous services: haircut (30 min) + dyeing (120 min) yields 150 min', () => {
      // Real-world scenario: 2 customers ahead, one getting haircut, one getting dyeing
      const totalWorkloadMinutes = 30 + 120; // 150 minutes
      const result = etaService.calculate(
        makeInput({ aheadCount: 2, avgServiceSeconds: 300, totalWorkloadMinutes })
      );
      expect(result.estimatedWaitSeconds).toBe(9_000); // 150 min × 60
      expect(result.estimatedWaitMinutes).toBe(150);
      expect(result.isFallback).toBe(false);
    });
  });

  // ── Performance characteristics ────────────────────────────────────────────

  describe('performance characteristics', () => {
    it('calculate is synchronous and handles 10 000 calls in < 100 ms', () => {
      const start = Date.now();
      for (let i = 0; i < 10_000; i++) {
        etaService.calculate(makeInput({ aheadCount: i % 50, avgServiceSeconds: 120 }));
      }
      const elapsed = Date.now() - start;
      // Budget is generous — on a slow CI agent 10k pure-CPU operations should
      // complete well within 100 ms with no I/O.
      expect(elapsed).toBeLessThan(100);
    });

    it('produces deterministic output for identical inputs', () => {
      const input = makeInput({ aheadCount: 7, avgServiceSeconds: 90 });
      const r1 = etaService.calculate(input);
      const r2 = etaService.calculate(input);
      expect(r1.estimatedWaitSeconds).toBe(r2.estimatedWaitSeconds);
      expect(r1.confidence).toBe(r2.confidence);
      expect(r1.isFallback).toBe(r2.isFallback);
    });

    it('does not throw for extreme aheadCount values', () => {
      expect(() =>
        etaService.calculate(makeInput({ aheadCount: 1_000_000, avgServiceSeconds: 60 }))
      ).not.toThrow();
    });
  });
});
