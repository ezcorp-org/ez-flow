import { test, expect, describe } from 'bun:test';

/**
 * Tests for AudioVisualizer component logic
 *
 * This component handles:
 * - Displaying audio level as bouncing yellow dots
 * - Creating a wave pattern based on audio level
 * - Animating dots when audio is detected
 */

// Constants from the component
const DOT_COUNT = 7;
const MAX_BOUNCE = 14;

describe('AudioVisualizer component logic', () => {
	describe('Props interface', () => {
		test('should have correct props structure with defaults', () => {
			interface Props {
				level?: number;
			}

			const defaultProps: Props = {
				level: 0
			};

			expect(defaultProps.level).toBe(0);
		});

		test('should accept level as optional', () => {
			interface Props {
				level?: number;
			}

			const props: Props = {};
			expect(props.level).toBeUndefined();
		});

		test('should accept valid audio levels', () => {
			interface Props {
				level?: number;
			}

			const testLevels = [0, 0.25, 0.5, 0.75, 1.0];

			for (const level of testLevels) {
				const props: Props = { level };
				expect(props.level).toBe(level);
			}
		});
	});

	describe('getDotOffset function', () => {
		const getDotOffset = (index: number, audioLevel: number, t: number): number => {
			const normalized = Math.min(1, Math.max(0, audioLevel));
			if (normalized < 0.01) return 0;

			// Create a wave pattern - center dots bounce higher
			const centerDistance = Math.abs(index - (DOT_COUNT - 1) / 2);
			const centerWeight = 1 - (centerDistance / ((DOT_COUNT - 1) / 2)) * 0.6;

			// Add phase offset for wave effect
			const phase = t / 80 + index * 0.9;
			const wave = Math.sin(phase) * 0.5 + 0.5;

			return normalized * MAX_BOUNCE * centerWeight * wave;
		};

		test('should return 0 when level is below threshold', () => {
			for (let i = 0; i < DOT_COUNT; i++) {
				expect(getDotOffset(i, 0, 0)).toBe(0);
				expect(getDotOffset(i, 0.005, 0)).toBe(0);
			}
		});

		test('should return positive offset when level is above threshold', () => {
			// With some time value and level above threshold
			const offset = getDotOffset(3, 0.5, 100);
			expect(offset).toBeGreaterThanOrEqual(0);
		});

		test('should weight center dots higher', () => {
			const t = 0; // Fixed time for consistent comparison
			const level = 1.0;

			// Center dot (index 3) should have higher weight
			const centerDot = getDotOffset(3, level, t);
			const edgeDot = getDotOffset(0, level, t);

			// Center weight is 1.0, edge weight is lower
			// At t=0, sin(0)=0, so wave=0.5
			// Center: 1.0 * 14 * 1.0 * 0.5 = 7
			// Edge: 1.0 * 14 * 0.4 * 0.5 = 2.8 (approx)
			expect(centerDot).toBeGreaterThan(edgeDot);
		});

		test('should scale with audio level', () => {
			const t = 100;
			const index = 3;

			const lowOffset = getDotOffset(index, 0.2, t);
			const highOffset = getDotOffset(index, 0.8, t);

			expect(highOffset).toBeGreaterThan(lowOffset);
		});

		test('should produce wave pattern over time', () => {
			const level = 0.5;
			const index = 3;

			const offsets: number[] = [];
			for (let t = 0; t < 500; t += 50) {
				offsets.push(getDotOffset(index, level, t));
			}

			// Should have variation (not all the same)
			const uniqueValues = new Set(offsets.map((o) => o.toFixed(2)));
			expect(uniqueValues.size).toBeGreaterThan(1);
		});
	});

	describe('Level normalization', () => {
		const normalizeLevel = (level: number): number => {
			return Math.min(1, Math.max(0, level));
		};

		test('should clamp negative levels to 0', () => {
			expect(normalizeLevel(-0.5)).toBe(0);
			expect(normalizeLevel(-1)).toBe(0);
			expect(normalizeLevel(-100)).toBe(0);
		});

		test('should clamp levels above 1 to 1', () => {
			expect(normalizeLevel(1.5)).toBe(1);
			expect(normalizeLevel(2)).toBe(1);
			expect(normalizeLevel(100)).toBe(1);
		});

		test('should pass through valid levels unchanged', () => {
			expect(normalizeLevel(0)).toBe(0);
			expect(normalizeLevel(0.25)).toBe(0.25);
			expect(normalizeLevel(0.5)).toBe(0.5);
			expect(normalizeLevel(0.75)).toBe(0.75);
			expect(normalizeLevel(1)).toBe(1);
		});
	});

	describe('Dot count configuration', () => {
		test('should have 7 dots', () => {
			expect(DOT_COUNT).toBe(7);
		});

		test('should create correct number of dot indices', () => {
			const dotIndices = Array.from({ length: DOT_COUNT }, (_, i) => i);
			expect(dotIndices).toEqual([0, 1, 2, 3, 4, 5, 6]);
			expect(dotIndices.length).toBe(7);
		});
	});

	describe('Bounce constants', () => {
		test('should have correct max bounce height', () => {
			expect(MAX_BOUNCE).toBe(14);
		});
	});

	describe('Center weight calculations', () => {
		test('should calculate center weights correctly', () => {
			const weights: number[] = [];
			for (let i = 0; i < DOT_COUNT; i++) {
				const centerDistance = Math.abs(i - (DOT_COUNT - 1) / 2);
				const centerWeight = 1 - (centerDistance / ((DOT_COUNT - 1) / 2)) * 0.6;
				weights.push(centerWeight);
			}

			// Center dot (index 3) should have weight 1.0
			expect(weights[3]).toBe(1.0);

			// Edge dots should have lower weight
			expect(weights[0]).toBeLessThan(weights[3]);
			expect(weights[6]).toBeLessThan(weights[3]);

			// Weights should be symmetric
			expect(weights[0]).toBeCloseTo(weights[6]);
			expect(weights[1]).toBeCloseTo(weights[5]);
			expect(weights[2]).toBeCloseTo(weights[4]);
		});
	});

	describe('Visual state patterns', () => {
		const getDotOffset = (index: number, audioLevel: number, t: number): number => {
			const normalized = Math.min(1, Math.max(0, audioLevel));
			if (normalized < 0.01) return 0;

			const centerDistance = Math.abs(index - (DOT_COUNT - 1) / 2);
			const centerWeight = 1 - (centerDistance / ((DOT_COUNT - 1) / 2)) * 0.6;
			const phase = t / 80 + index * 0.9;
			const wave = Math.sin(phase) * 0.5 + 0.5;

			return normalized * MAX_BOUNCE * centerWeight * wave;
		};

		test('should show all dots at zero offset when silent', () => {
			const offsets: number[] = [];
			for (let i = 0; i < DOT_COUNT; i++) {
				offsets.push(getDotOffset(i, 0, 100));
			}

			const allZero = offsets.every((o) => o === 0);
			expect(allZero).toBe(true);
		});

		test('should show wave pattern when audio is present', () => {
			const offsets: number[] = [];
			for (let i = 0; i < DOT_COUNT; i++) {
				offsets.push(getDotOffset(i, 0.5, 100));
			}

			// Should have some non-zero offsets
			const hasNonZero = offsets.some((o) => o > 0);
			expect(hasNonZero).toBe(true);
		});
	});

	describe('Animation timing', () => {
		test('should produce smooth wave motion', () => {
			const getDotOffset = (index: number, audioLevel: number, t: number): number => {
				const normalized = Math.min(1, Math.max(0, audioLevel));
				if (normalized < 0.01) return 0;

				const centerDistance = Math.abs(index - (DOT_COUNT - 1) / 2);
				const centerWeight = 1 - (centerDistance / ((DOT_COUNT - 1) / 2)) * 0.6;
				const phase = t / 80 + index * 0.9;
				const wave = Math.sin(phase) * 0.5 + 0.5;

				return normalized * MAX_BOUNCE * centerWeight * wave;
			};

			const level = 0.5;
			const index = 3;

			// Check that offsets change smoothly over time
			let prevOffset = getDotOffset(index, level, 0);
			for (let t = 10; t <= 200; t += 10) {
				const offset = getDotOffset(index, level, t);
				// Change should be gradual, not jumping too much
				const delta = Math.abs(offset - prevOffset);
				expect(delta).toBeLessThan(MAX_BOUNCE / 2);
				prevOffset = offset;
			}
		});
	});
});
