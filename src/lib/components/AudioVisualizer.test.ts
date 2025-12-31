import { test, expect, describe } from 'bun:test';

/**
 * Tests for AudioVisualizer component logic
 *
 * This component handles:
 * - Displaying audio level as vertical bars
 * - Calculating bar heights based on audio level
 * - Normalizing audio levels to 0-1 range
 * - Smooth transitions between levels
 */

// Constants from the component
const BARS = 5;
const BASE_HEIGHT = 4;
const MAX_HEIGHT = 16;

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

	describe('getBarHeight function', () => {
		const getBarHeight = (index: number, audioLevel: number): number => {
			const normalized = Math.min(1, Math.max(0, audioLevel));
			const baseHeight = BASE_HEIGHT;
			const maxHeight = MAX_HEIGHT;
			const threshold = (index + 1) / BARS;
			return normalized >= threshold
				? maxHeight
				: baseHeight + (normalized / threshold) * (maxHeight - baseHeight);
		};

		test('should return base height when level is zero', () => {
			for (let i = 0; i < BARS; i++) {
				expect(getBarHeight(i, 0)).toBe(BASE_HEIGHT);
			}
		});

		test('should return max height when level is 1', () => {
			for (let i = 0; i < BARS; i++) {
				expect(getBarHeight(i, 1)).toBe(MAX_HEIGHT);
			}
		});

		test('should calculate height for first bar (index 0)', () => {
			// First bar threshold is 1/5 = 0.2
			expect(getBarHeight(0, 0)).toBe(BASE_HEIGHT);
			expect(getBarHeight(0, 0.2)).toBe(MAX_HEIGHT);
			expect(getBarHeight(0, 0.5)).toBe(MAX_HEIGHT);
			expect(getBarHeight(0, 1.0)).toBe(MAX_HEIGHT);
		});

		test('should calculate height for last bar (index 4)', () => {
			// Last bar threshold is 5/5 = 1.0
			expect(getBarHeight(4, 0)).toBe(BASE_HEIGHT);
			expect(getBarHeight(4, 0.5)).toBe(BASE_HEIGHT + 0.5 * (MAX_HEIGHT - BASE_HEIGHT));
			expect(getBarHeight(4, 1.0)).toBe(MAX_HEIGHT);
		});

		test('should calculate progressive heights', () => {
			const level = 0.6;
			const heights = [];

			for (let i = 0; i < BARS; i++) {
				heights.push(getBarHeight(i, level));
			}

			// First few bars should be at max, later bars should be lower
			expect(heights[0]).toBe(MAX_HEIGHT); // threshold 0.2
			expect(heights[1]).toBe(MAX_HEIGHT); // threshold 0.4
			expect(heights[2]).toBe(MAX_HEIGHT); // threshold 0.6
			expect(heights[3]).toBeLessThan(MAX_HEIGHT); // threshold 0.8
			expect(heights[4]).toBeLessThan(MAX_HEIGHT); // threshold 1.0
		});

		test('should return heights between base and max', () => {
			const testLevels = [0.1, 0.3, 0.5, 0.7, 0.9];

			for (const level of testLevels) {
				for (let i = 0; i < BARS; i++) {
					const height = getBarHeight(i, level);
					expect(height).toBeGreaterThanOrEqual(BASE_HEIGHT);
					expect(height).toBeLessThanOrEqual(MAX_HEIGHT);
				}
			}
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

	describe('Bar count configuration', () => {
		test('should have 5 bars', () => {
			expect(BARS).toBe(5);
		});

		test('should create correct number of bar indices', () => {
			const barIndices = Array.from({ length: BARS }, (_, i) => i);
			expect(barIndices).toEqual([0, 1, 2, 3, 4]);
			expect(barIndices.length).toBe(5);
		});
	});

	describe('Height constants', () => {
		test('should have correct base height', () => {
			expect(BASE_HEIGHT).toBe(4);
		});

		test('should have correct max height', () => {
			expect(MAX_HEIGHT).toBe(16);
		});

		test('should have base height less than max height', () => {
			expect(BASE_HEIGHT).toBeLessThan(MAX_HEIGHT);
		});
	});

	describe('Threshold calculations', () => {
		test('should calculate thresholds correctly', () => {
			const thresholds = [];
			for (let i = 0; i < BARS; i++) {
				thresholds.push((i + 1) / BARS);
			}

			expect(thresholds).toEqual([0.2, 0.4, 0.6, 0.8, 1.0]);
		});

		test('should have evenly spaced thresholds', () => {
			const thresholds = [];
			for (let i = 0; i < BARS; i++) {
				thresholds.push((i + 1) / BARS);
			}

			for (let i = 1; i < thresholds.length; i++) {
				const diff = thresholds[i] - thresholds[i - 1];
				expect(diff).toBeCloseTo(0.2);
			}
		});
	});

	describe('Visual state patterns', () => {
		const getBarHeight = (index: number, audioLevel: number): number => {
			const normalized = Math.min(1, Math.max(0, audioLevel));
			const baseHeight = BASE_HEIGHT;
			const maxHeight = MAX_HEIGHT;
			const threshold = (index + 1) / BARS;
			return normalized >= threshold
				? maxHeight
				: baseHeight + (normalized / threshold) * (maxHeight - baseHeight);
		};

		test('should show all bars at minimum when silent', () => {
			const heights = [];
			for (let i = 0; i < BARS; i++) {
				heights.push(getBarHeight(i, 0));
			}

			const allMin = heights.every((h) => h === BASE_HEIGHT);
			expect(allMin).toBe(true);
		});

		test('should show all bars at maximum when at full volume', () => {
			const heights = [];
			for (let i = 0; i < BARS; i++) {
				heights.push(getBarHeight(i, 1));
			}

			const allMax = heights.every((h) => h === MAX_HEIGHT);
			expect(allMax).toBe(true);
		});

		test('should show graduated pattern at medium levels', () => {
			const level = 0.5;
			const heights = [];
			for (let i = 0; i < BARS; i++) {
				heights.push(getBarHeight(i, level));
			}

			// First two bars (thresholds 0.2, 0.4) should be at max
			expect(heights[0]).toBe(MAX_HEIGHT);
			expect(heights[1]).toBe(MAX_HEIGHT);
			// Third bar (threshold 0.6) should be less than max
			expect(heights[2]).toBeLessThan(MAX_HEIGHT);
		});
	});

	describe('Edge cases', () => {
		const getBarHeight = (index: number, audioLevel: number): number => {
			const normalized = Math.min(1, Math.max(0, audioLevel));
			const baseHeight = BASE_HEIGHT;
			const maxHeight = MAX_HEIGHT;
			const threshold = (index + 1) / BARS;
			return normalized >= threshold
				? maxHeight
				: baseHeight + (normalized / threshold) * (maxHeight - baseHeight);
		};

		test('should handle level exactly at threshold', () => {
			// Bar 0 has threshold 0.2
			expect(getBarHeight(0, 0.2)).toBe(MAX_HEIGHT);
			// Bar 2 has threshold 0.6
			expect(getBarHeight(2, 0.6)).toBe(MAX_HEIGHT);
		});

		test('should handle level just below threshold', () => {
			// Bar 0 has threshold 0.2
			const height = getBarHeight(0, 0.19);
			expect(height).toBeLessThan(MAX_HEIGHT);
			expect(height).toBeGreaterThan(BASE_HEIGHT);
		});

		test('should handle very small levels', () => {
			const height = getBarHeight(0, 0.001);
			expect(height).toBeGreaterThan(BASE_HEIGHT);
			expect(height).toBeLessThan(MAX_HEIGHT);
		});

		test('should handle level of exactly 0', () => {
			for (let i = 0; i < BARS; i++) {
				expect(getBarHeight(i, 0)).toBe(BASE_HEIGHT);
			}
		});

		test('should handle level of exactly 1', () => {
			for (let i = 0; i < BARS; i++) {
				expect(getBarHeight(i, 1)).toBe(MAX_HEIGHT);
			}
		});
	});

	describe('Height interpolation', () => {
		const getBarHeight = (index: number, audioLevel: number): number => {
			const normalized = Math.min(1, Math.max(0, audioLevel));
			const baseHeight = BASE_HEIGHT;
			const maxHeight = MAX_HEIGHT;
			const threshold = (index + 1) / BARS;
			return normalized >= threshold
				? maxHeight
				: baseHeight + (normalized / threshold) * (maxHeight - baseHeight);
		};

		test('should interpolate linearly between base and max', () => {
			// For bar index 4, threshold is 1.0
			// At level 0.5, the formula gives:
			// baseHeight + (0.5 / 1.0) * (maxHeight - baseHeight)
			// = 4 + 0.5 * (16 - 4) = 4 + 6 = 10
			const height = getBarHeight(4, 0.5);
			expect(height).toBe(10);
		});

		test('should show monotonically decreasing heights for later bars', () => {
			const level = 0.5;
			const heights = [];
			for (let i = 0; i < BARS; i++) {
				heights.push(getBarHeight(i, level));
			}

			// Heights should not increase as we go to later bars (higher thresholds)
			for (let i = 1; i < heights.length; i++) {
				expect(heights[i]).toBeLessThanOrEqual(heights[i - 1]);
			}
		});
	});

	describe('Multiple level simulations', () => {
		const getBarHeight = (index: number, audioLevel: number): number => {
			const normalized = Math.min(1, Math.max(0, audioLevel));
			const baseHeight = BASE_HEIGHT;
			const maxHeight = MAX_HEIGHT;
			const threshold = (index + 1) / BARS;
			return normalized >= threshold
				? maxHeight
				: baseHeight + (normalized / threshold) * (maxHeight - baseHeight);
		};

		test('should handle increasing audio levels', () => {
			const levels = [0, 0.2, 0.4, 0.6, 0.8, 1.0];
			let previousTotalHeight = 0;

			for (const level of levels) {
				let totalHeight = 0;
				for (let i = 0; i < BARS; i++) {
					totalHeight += getBarHeight(i, level);
				}

				expect(totalHeight).toBeGreaterThanOrEqual(previousTotalHeight);
				previousTotalHeight = totalHeight;
			}
		});

		test('should handle decreasing audio levels', () => {
			const levels = [1.0, 0.8, 0.6, 0.4, 0.2, 0];
			let previousTotalHeight = BARS * MAX_HEIGHT + 1; // Start high

			for (const level of levels) {
				let totalHeight = 0;
				for (let i = 0; i < BARS; i++) {
					totalHeight += getBarHeight(i, level);
				}

				expect(totalHeight).toBeLessThanOrEqual(previousTotalHeight);
				previousTotalHeight = totalHeight;
			}
		});
	});

	describe('Style generation', () => {
		const getBarHeight = (index: number, audioLevel: number): number => {
			const normalized = Math.min(1, Math.max(0, audioLevel));
			const baseHeight = BASE_HEIGHT;
			const maxHeight = MAX_HEIGHT;
			const threshold = (index + 1) / BARS;
			return normalized >= threshold
				? maxHeight
				: baseHeight + (normalized / threshold) * (maxHeight - baseHeight);
		};

		test('should generate valid CSS height values', () => {
			for (let i = 0; i < BARS; i++) {
				const height = getBarHeight(i, 0.5);
				const cssValue = `height: ${height}px`;

				expect(cssValue).toMatch(/^height: \d+(\.\d+)?px$/);
			}
		});

		test('should generate pixel values in valid range', () => {
			const levels = [0, 0.25, 0.5, 0.75, 1.0];

			for (const level of levels) {
				for (let i = 0; i < BARS; i++) {
					const height = getBarHeight(i, level);
					expect(height).toBeGreaterThanOrEqual(BASE_HEIGHT);
					expect(height).toBeLessThanOrEqual(MAX_HEIGHT);
				}
			}
		});
	});
});
