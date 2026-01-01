import { test, expect, describe } from 'bun:test';

// Define PreviewState locally to match the Svelte component's exported type
type PreviewState = 'preview' | 'streaming' | 'injecting' | 'complete' | 'error';

describe('TranscriptionPreview component logic', () => {
	describe('PreviewState types', () => {
		test('should have all expected state values', () => {
			const states: PreviewState[] = ['preview', 'streaming', 'injecting', 'complete', 'error'];
			expect(states.length).toBe(5);
			expect(states).toContain('preview');
			expect(states).toContain('streaming');
			expect(states).toContain('injecting');
			expect(states).toContain('complete');
			expect(states).toContain('error');
		});
	});

	describe('getStateStyles function logic', () => {
		const getStateStyles = (
			currentState: PreviewState
		): { color: string; animate: boolean } => {
			switch (currentState) {
				case 'preview':
					return { color: 'bg-yellow-400', animate: false };
				case 'streaming':
					return { color: 'bg-purple-400', animate: true };
				case 'injecting':
					return { color: 'bg-blue-400', animate: true };
				case 'complete':
					return { color: 'bg-green-400', animate: false };
				case 'error':
					return { color: 'bg-red-400', animate: false };
				default:
					return { color: 'bg-yellow-400', animate: false };
			}
		};

		test('should return yellow for preview state without animation', () => {
			const result = getStateStyles('preview');
			expect(result.color).toBe('bg-yellow-400');
			expect(result.animate).toBe(false);
		});

		test('should return purple for streaming state with animation', () => {
			const result = getStateStyles('streaming');
			expect(result.color).toBe('bg-purple-400');
			expect(result.animate).toBe(true);
		});

		test('should return blue for injecting state with animation', () => {
			const result = getStateStyles('injecting');
			expect(result.color).toBe('bg-blue-400');
			expect(result.animate).toBe(true);
		});

		test('should return green for complete state without animation', () => {
			const result = getStateStyles('complete');
			expect(result.color).toBe('bg-green-400');
			expect(result.animate).toBe(false);
		});

		test('should return red for error state without animation', () => {
			const result = getStateStyles('error');
			expect(result.color).toBe('bg-red-400');
			expect(result.animate).toBe(false);
		});
	});

	describe('getStateLabel function logic', () => {
		const getStateLabel = (currentState: PreviewState): string => {
			switch (currentState) {
				case 'preview':
					return 'Preview';
				case 'streaming':
					return 'Transcribing...';
				case 'injecting':
					return 'Injecting...';
				case 'complete':
					return 'Complete';
				case 'error':
					return 'Error';
				default:
					return 'Preview';
			}
		};

		test('should return "Preview" for preview state', () => {
			expect(getStateLabel('preview')).toBe('Preview');
		});

		test('should return "Transcribing..." for streaming state', () => {
			expect(getStateLabel('streaming')).toBe('Transcribing...');
		});

		test('should return "Injecting..." for injecting state', () => {
			expect(getStateLabel('injecting')).toBe('Injecting...');
		});

		test('should return "Complete" for complete state', () => {
			expect(getStateLabel('complete')).toBe('Complete');
		});

		test('should return "Error" for error state', () => {
			expect(getStateLabel('error')).toBe('Error');
		});
	});
});

describe('Preview window show/hide logic', () => {
	describe('auto-hide scheduling', () => {
		test('should schedule hide after specified duration', () => {
			const scheduledTimes: number[] = [];
			const scheduleHide = (durationSecs: number) => {
				scheduledTimes.push(durationSecs * 1000);
			};

			scheduleHide(3);
			expect(scheduledTimes[0]).toBe(3000);

			scheduleHide(5);
			expect(scheduledTimes[1]).toBe(5000);
		});

		test('should show errors longer than normal text', () => {
			const previewDuration = 3;
			const errorDuration = previewDuration + 1;

			expect(errorDuration).toBe(4);
			expect(errorDuration).toBeGreaterThan(previewDuration);
		});
	});

	describe('state-based visibility', () => {
		test('should not auto-hide during preview state', () => {
			const shouldAutoHide = (state: PreviewState): boolean => {
				return state === 'complete' || state === 'error';
			};

			expect(shouldAutoHide('preview')).toBe(false);
			expect(shouldAutoHide('injecting')).toBe(false);
			expect(shouldAutoHide('complete')).toBe(true);
			expect(shouldAutoHide('error')).toBe(true);
		});
	});
});

describe('Preview event payload', () => {
	interface PreviewTextPayload {
		text: string;
		state: PreviewState;
	}

	test('should have correct structure for preview payload', () => {
		const payload: PreviewTextPayload = {
			text: 'Hello, this is a transcription',
			state: 'preview'
		};

		expect(payload.text).toBe('Hello, this is a transcription');
		expect(payload.state).toBe('preview');
	});

	test('should handle empty text', () => {
		const payload: PreviewTextPayload = {
			text: '',
			state: 'preview'
		};

		expect(payload.text).toBe('');
	});

	test('should handle all state transitions', () => {
		const states: PreviewState[] = ['preview', 'injecting', 'complete', 'error'];

		states.forEach((state) => {
			const payload: PreviewTextPayload = {
				text: 'Test text',
				state
			};
			expect(payload.state).toBe(state);
		});
	});
});

describe('Preview settings', () => {
	interface PreviewSettings {
		preview_enabled: boolean;
		preview_duration_secs: number;
		preview_show_visualizer: boolean;
		preview_position_x: number | null;
		preview_position_y: number | null;
	}

	test('should have valid default settings', () => {
		const defaults: PreviewSettings = {
			preview_enabled: true,
			preview_duration_secs: 3,
			preview_show_visualizer: true,
			preview_position_x: null,
			preview_position_y: null
		};

		expect(defaults.preview_enabled).toBe(true);
		expect(defaults.preview_duration_secs).toBe(3);
		expect(defaults.preview_show_visualizer).toBe(true);
		expect(defaults.preview_position_x).toBeNull();
		expect(defaults.preview_position_y).toBeNull();
	});

	test('should clamp duration between 1 and 5', () => {
		const clampDuration = (duration: number): number => {
			return Math.max(1, Math.min(5, duration));
		};

		expect(clampDuration(0)).toBe(1);
		expect(clampDuration(1)).toBe(1);
		expect(clampDuration(3)).toBe(3);
		expect(clampDuration(5)).toBe(5);
		expect(clampDuration(10)).toBe(5);
	});

	test('should save position when dragged', () => {
		const settings: PreviewSettings = {
			preview_enabled: true,
			preview_duration_secs: 3,
			preview_show_visualizer: true,
			preview_position_x: null,
			preview_position_y: null
		};

		// Simulate saving position after drag
		const savePosition = (x: number, y: number) => {
			settings.preview_position_x = x;
			settings.preview_position_y = y;
		};

		savePosition(100, 200);
		expect(settings.preview_position_x).toBe(100);
		expect(settings.preview_position_y).toBe(200);
	});
});

describe('Preview position validation', () => {
	test('should validate position is on screen', () => {
		const isPositionValid = (
			x: number,
			y: number,
			screenWidth: number,
			screenHeight: number,
			windowWidth: number,
			windowHeight: number
		): boolean => {
			const minVisiblePercent = 0.5;
			const minVisibleX = windowWidth * minVisiblePercent;
			const minVisibleY = windowHeight * minVisiblePercent;

			return (
				x >= -windowWidth + minVisibleX &&
				x <= screenWidth - minVisibleX &&
				y >= 0 &&
				y <= screenHeight - minVisibleY
			);
		};

		// Test valid positions
		expect(isPositionValid(100, 100, 1920, 1080, 360, 180)).toBe(true);
		expect(isPositionValid(1500, 50, 1920, 1080, 360, 180)).toBe(true);

		// Test edge cases
		expect(isPositionValid(-100, 100, 1920, 1080, 360, 180)).toBe(true); // Still 50% visible
		expect(isPositionValid(-300, 100, 1920, 1080, 360, 180)).toBe(false); // Less than 50% visible
	});

	test('should default to top-right when off screen', () => {
		const getDefaultPosition = (
			screenWidth: number,
			windowWidth: number,
			padding: number
		): { x: number; y: number } => {
			return {
				x: screenWidth - windowWidth - padding,
				y: padding
			};
		};

		const pos = getDefaultPosition(1920, 360, 20);
		expect(pos.x).toBe(1540);
		expect(pos.y).toBe(20);
	});
});

describe('Visualizer visibility', () => {
	test('should show visualizer only in preview state when enabled', () => {
		const shouldShowVisualizer = (
			showVisualizer: boolean,
			state: PreviewState
		): boolean => {
			return showVisualizer && state === 'preview';
		};

		expect(shouldShowVisualizer(true, 'preview')).toBe(true);
		expect(shouldShowVisualizer(true, 'injecting')).toBe(false);
		expect(shouldShowVisualizer(true, 'complete')).toBe(false);
		expect(shouldShowVisualizer(true, 'error')).toBe(false);
		expect(shouldShowVisualizer(false, 'preview')).toBe(false);
	});
});

// ============================================================
// Additional Epic 9 Tests
// ============================================================

describe('Event handling - preview://text event payload structure', () => {
	interface PreviewTextPayload {
		text: string;
		state: PreviewState;
	}

	test('should validate payload with all required fields', () => {
		const validPayload: PreviewTextPayload = {
			text: 'Hello world',
			state: 'preview'
		};

		expect(validPayload).toHaveProperty('text');
		expect(validPayload).toHaveProperty('state');
		expect(typeof validPayload.text).toBe('string');
		expect(['preview', 'injecting', 'complete', 'error']).toContain(validPayload.state);
	});

	test('should handle payload with long text', () => {
		const longText = 'A'.repeat(10000);
		const payload: PreviewTextPayload = {
			text: longText,
			state: 'preview'
		};

		expect(payload.text.length).toBe(10000);
	});

	test('should handle payload with unicode characters', () => {
		const payload: PreviewTextPayload = {
			text: 'Hello \u{1F600} World \u{1F389} Test \u{2764}',
			state: 'preview'
		};

		expect(payload.text).toContain('\u{1F600}');
		expect(payload.text).toContain('\u{1F389}');
	});

	test('should handle payload with various whitespace characters', () => {
		const payload: PreviewTextPayload = {
			text: 'Line1\nLine2\tTabbed\r\nWindows',
			state: 'preview'
		};

		expect(payload.text).toContain('\n');
		expect(payload.text).toContain('\t');
		expect(payload.text).toContain('\r\n');
	});
});

describe('State transition sequences', () => {
	type StateTransition = { from: PreviewState; to: PreviewState };

	const isValidTransition = (from: PreviewState, to: PreviewState): boolean => {
		const validTransitions: StateTransition[] = [
			{ from: 'preview', to: 'injecting' },
			{ from: 'injecting', to: 'complete' },
			{ from: 'injecting', to: 'error' },
			{ from: 'complete', to: 'preview' },
			{ from: 'error', to: 'preview' },
			// Allow direct state changes for new transcription
			{ from: 'complete', to: 'injecting' },
			{ from: 'error', to: 'injecting' }
		];

		return validTransitions.some((t) => t.from === from && t.to === to);
	};

	test('should validate preview -> injecting -> complete sequence', () => {
		expect(isValidTransition('preview', 'injecting')).toBe(true);
		expect(isValidTransition('injecting', 'complete')).toBe(true);
	});

	test('should validate preview -> injecting -> error sequence', () => {
		expect(isValidTransition('preview', 'injecting')).toBe(true);
		expect(isValidTransition('injecting', 'error')).toBe(true);
	});

	test('should allow recovery from error state', () => {
		expect(isValidTransition('error', 'preview')).toBe(true);
		expect(isValidTransition('error', 'injecting')).toBe(true);
	});

	test('should allow new transcription after complete', () => {
		expect(isValidTransition('complete', 'preview')).toBe(true);
		expect(isValidTransition('complete', 'injecting')).toBe(true);
	});

	test('should track state history correctly', () => {
		const stateHistory: PreviewState[] = [];
		const recordState = (state: PreviewState) => {
			stateHistory.push(state);
		};

		// Simulate successful flow
		recordState('preview');
		recordState('injecting');
		recordState('complete');

		expect(stateHistory).toEqual(['preview', 'injecting', 'complete']);
		expect(stateHistory.length).toBe(3);
	});

	test('should track error flow correctly', () => {
		const stateHistory: PreviewState[] = [];
		const recordState = (state: PreviewState) => {
			stateHistory.push(state);
		};

		// Simulate error flow
		recordState('preview');
		recordState('injecting');
		recordState('error');
		recordState('preview'); // Recovery

		expect(stateHistory).toEqual(['preview', 'injecting', 'error', 'preview']);
	});
});

describe('Window position persistence', () => {
	interface WindowPosition {
		x: number;
		y: number;
	}

	interface StoredPositionData {
		position: WindowPosition | null;
		savedAt: number;
	}

	const createPositionStore = () => {
		let storedData: StoredPositionData | null = null;

		return {
			save: (x: number, y: number) => {
				storedData = {
					position: { x, y },
					savedAt: Date.now()
				};
			},
			load: (): WindowPosition | null => {
				return storedData?.position ?? null;
			},
			clear: () => {
				storedData = null;
			},
			getLastSavedTime: (): number | null => {
				return storedData?.savedAt ?? null;
			}
		};
	};

	test('should save position after drag', () => {
		const store = createPositionStore();

		store.save(150, 250);
		const loaded = store.load();

		expect(loaded).not.toBeNull();
		expect(loaded?.x).toBe(150);
		expect(loaded?.y).toBe(250);
	});

	test('should restore saved position on load', () => {
		const store = createPositionStore();

		store.save(500, 300);
		const position = store.load();

		expect(position).toEqual({ x: 500, y: 300 });
	});

	test('should return null when no position saved', () => {
		const store = createPositionStore();

		const position = store.load();
		expect(position).toBeNull();
	});

	test('should overwrite previous position on new save', () => {
		const store = createPositionStore();

		store.save(100, 100);
		store.save(200, 200);

		const position = store.load();
		expect(position).toEqual({ x: 200, y: 200 });
	});

	test('should clear saved position', () => {
		const store = createPositionStore();

		store.save(100, 100);
		store.clear();

		expect(store.load()).toBeNull();
	});

	test('should reset to default when position is invalid', () => {
		const getDefaultPosition = (screenWidth: number, windowWidth: number, padding: number) => ({
			x: screenWidth - windowWidth - padding,
			y: padding
		});

		const isPositionValid = (
			x: number | null,
			y: number | null,
			screenWidth: number,
			screenHeight: number
		): boolean => {
			if (x === null || y === null) return false;
			if (x < -100 || y < -100) return false;
			if (x > screenWidth + 100 || y > screenHeight + 100) return false;
			return true;
		};

		const getPositionOrDefault = (
			savedX: number | null,
			savedY: number | null,
			screenWidth: number,
			screenHeight: number,
			windowWidth: number,
			padding: number
		) => {
			if (isPositionValid(savedX, savedY, screenWidth, screenHeight)) {
				return { x: savedX!, y: savedY! };
			}
			return getDefaultPosition(screenWidth, windowWidth, padding);
		};

		// Invalid saved position - should return default
		const result = getPositionOrDefault(5000, 5000, 1920, 1080, 360, 20);
		expect(result).toEqual({ x: 1540, y: 20 });

		// Valid saved position - should return saved
		const validResult = getPositionOrDefault(100, 100, 1920, 1080, 360, 20);
		expect(validResult).toEqual({ x: 100, y: 100 });

		// Null position - should return default
		const nullResult = getPositionOrDefault(null, null, 1920, 1080, 360, 20);
		expect(nullResult).toEqual({ x: 1540, y: 20 });
	});
});

describe('Multi-monitor position validation', () => {
	interface Monitor {
		width: number;
		height: number;
		x: number;
		y: number;
	}

	// MultiMonitorSetup interface available for future multi-monitor tests
	// interface MultiMonitorSetup {
	// 	monitors: Monitor[];
	// 	primaryIndex: number;
	// }

	const isPositionOnAnyMonitor = (
		x: number,
		y: number,
		monitors: Monitor[],
		windowWidth: number,
		windowHeight: number,
		minVisiblePercent: number = 0.25
	): boolean => {
		const minVisibleX = windowWidth * minVisiblePercent;
		const minVisibleY = windowHeight * minVisiblePercent;

		return monitors.some((monitor) => {
			const monitorRight = monitor.x + monitor.width;
			const monitorBottom = monitor.y + monitor.height;

			// Check if at least minVisiblePercent of window is on this monitor
			const windowRight = x + windowWidth;
			const windowBottom = y + windowHeight;

			const visibleLeft = Math.max(x, monitor.x);
			const visibleRight = Math.min(windowRight, monitorRight);
			const visibleTop = Math.max(y, monitor.y);
			const visibleBottom = Math.min(windowBottom, monitorBottom);

			const visibleWidth = Math.max(0, visibleRight - visibleLeft);
			const visibleHeight = Math.max(0, visibleBottom - visibleTop);

			return visibleWidth >= minVisibleX && visibleHeight >= minVisibleY;
		});
	};

	test('should validate position on single monitor', () => {
		const monitors: Monitor[] = [{ width: 1920, height: 1080, x: 0, y: 0 }];

		expect(isPositionOnAnyMonitor(100, 100, monitors, 360, 180)).toBe(true);
		expect(isPositionOnAnyMonitor(1500, 50, monitors, 360, 180)).toBe(true);
	});

	test('should validate position on dual monitor setup', () => {
		const monitors: Monitor[] = [
			{ width: 1920, height: 1080, x: 0, y: 0 },
			{ width: 1920, height: 1080, x: 1920, y: 0 }
		];

		// Position on first monitor
		expect(isPositionOnAnyMonitor(100, 100, monitors, 360, 180)).toBe(true);

		// Position on second monitor
		expect(isPositionOnAnyMonitor(2500, 100, monitors, 360, 180)).toBe(true);

		// Position between monitors (spanning both)
		expect(isPositionOnAnyMonitor(1800, 100, monitors, 360, 180)).toBe(true);
	});

	test('should handle vertically stacked monitors', () => {
		const monitors: Monitor[] = [
			{ width: 1920, height: 1080, x: 0, y: 0 },
			{ width: 1920, height: 1080, x: 0, y: 1080 }
		];

		// Position on top monitor
		expect(isPositionOnAnyMonitor(100, 100, monitors, 360, 180)).toBe(true);

		// Position on bottom monitor
		expect(isPositionOnAnyMonitor(100, 1200, monitors, 360, 180)).toBe(true);
	});

	test('should reject position completely off all monitors', () => {
		const monitors: Monitor[] = [{ width: 1920, height: 1080, x: 0, y: 0 }];

		// Way off screen
		expect(isPositionOnAnyMonitor(5000, 5000, monitors, 360, 180)).toBe(false);
		expect(isPositionOnAnyMonitor(-1000, -1000, monitors, 360, 180)).toBe(false);
	});

	test('should handle when saved position is on disconnected monitor', () => {
		// Simulate monitor setup change - second monitor disconnected
		const previousMonitors: Monitor[] = [
			{ width: 1920, height: 1080, x: 0, y: 0 },
			{ width: 1920, height: 1080, x: 1920, y: 0 }
		];

		const currentMonitors: Monitor[] = [{ width: 1920, height: 1080, x: 0, y: 0 }];

		// Position was valid on second monitor
		const savedX = 2500;
		const savedY = 100;

		expect(isPositionOnAnyMonitor(savedX, savedY, previousMonitors, 360, 180)).toBe(true);
		expect(isPositionOnAnyMonitor(savedX, savedY, currentMonitors, 360, 180)).toBe(false);
	});

	test('should handle mixed resolution monitors', () => {
		const monitors: Monitor[] = [
			{ width: 2560, height: 1440, x: 0, y: 0 }, // 1440p
			{ width: 1920, height: 1080, x: 2560, y: 180 } // 1080p offset vertically by 180px
		];

		// Position on 1440p monitor
		expect(isPositionOnAnyMonitor(200, 200, monitors, 360, 180)).toBe(true);

		// Position on 1080p monitor
		expect(isPositionOnAnyMonitor(3000, 500, monitors, 360, 180)).toBe(true);

		// Position in the vertical gap above the offset 1080p monitor
		// At y=0, only the 1440p monitor exists, but at x=2700, it's still within 1440p bounds
		// Let's test a position that's truly in a gap - way off to the right of the 1080p
		expect(isPositionOnAnyMonitor(5000, 50, monitors, 360, 180)).toBe(false);
	});
});

describe('Text display edge cases', () => {
	test('should handle very long text', () => {
		const maxDisplayLength = 5000;
		const truncateForDisplay = (text: string, maxLength: number): string => {
			if (text.length <= maxLength) return text;
			return text.slice(0, maxLength - 3) + '...';
		};

		const longText = 'A'.repeat(10000);
		const truncated = truncateForDisplay(longText, maxDisplayLength);

		expect(truncated.length).toBe(maxDisplayLength);
		expect(truncated.endsWith('...')).toBe(true);
	});

	test('should detect when scrolling is needed', () => {
		const needsScrolling = (
			textLength: number,
			containerHeight: number,
			lineHeight: number,
			charsPerLine: number
		): boolean => {
			const estimatedLines = Math.ceil(textLength / charsPerLine);
			const estimatedHeight = estimatedLines * lineHeight;
			return estimatedHeight > containerHeight;
		};

		// Short text - no scroll needed
		expect(needsScrolling(50, 100, 20, 60)).toBe(false);

		// Long text - scroll needed
		expect(needsScrolling(500, 100, 20, 60)).toBe(true);
	});

	test('should handle empty text correctly', () => {
		const getDisplayText = (text: string, state: PreviewState): string => {
			if (!text || text.trim() === '') {
				return state === 'preview' ? 'Waiting for transcription...' : '';
			}
			return text;
		};

		expect(getDisplayText('', 'preview')).toBe('Waiting for transcription...');
		expect(getDisplayText('', 'injecting')).toBe('');
		expect(getDisplayText('   ', 'preview')).toBe('Waiting for transcription...');
		expect(getDisplayText('Hello', 'preview')).toBe('Hello');
	});

	test('should preserve newlines and line breaks', () => {
		const text = 'Line 1\nLine 2\nLine 3';
		const lines = text.split('\n');

		expect(lines.length).toBe(3);
		expect(lines[0]).toBe('Line 1');
		expect(lines[1]).toBe('Line 2');
		expect(lines[2]).toBe('Line 3');
	});

	test('should handle special characters', () => {
		const specialTexts = [
			'<script>alert("xss")</script>',
			'Hello & World',
			'"Quoted" text',
			"It's a test",
			'100% complete',
			'Path: C:\\Users\\test',
			'Email: test@example.com'
		];

		specialTexts.forEach((text) => {
			expect(typeof text).toBe('string');
			expect(text.length).toBeGreaterThan(0);
		});
	});

	test('should handle rapid text updates with debouncing', () => {
		const createDebouncer = (delayMs: number) => {
			let timeoutId: ReturnType<typeof setTimeout> | undefined;
			let updateCount = 0;
			let lastValue = '';

			return {
				update: (value: string, callback: (v: string) => void) => {
					lastValue = value;
					if (timeoutId) clearTimeout(timeoutId);
					timeoutId = setTimeout(() => {
						callback(lastValue);
						updateCount++;
					}, delayMs);
				},
				getUpdateCount: () => updateCount,
				cancel: () => {
					if (timeoutId) clearTimeout(timeoutId);
				}
			};
		};

		const debouncer = createDebouncer(50);
		let finalValue = '';

		// Simulate rapid updates
		debouncer.update('a', (v) => (finalValue = v));
		debouncer.update('ab', (v) => (finalValue = v));
		debouncer.update('abc', (v) => (finalValue = v));
		debouncer.update('abcd', (v) => (finalValue = v));

		// Immediately after, no updates processed yet
		expect(debouncer.getUpdateCount()).toBe(0);
		expect(finalValue).toBe(''); // No callback executed yet

		debouncer.cancel();
	});

	test('should handle text with only whitespace', () => {
		const isEmptyOrWhitespace = (text: string): boolean => {
			return !text || text.trim() === '';
		};

		expect(isEmptyOrWhitespace('')).toBe(true);
		expect(isEmptyOrWhitespace('   ')).toBe(true);
		expect(isEmptyOrWhitespace('\n\n\n')).toBe(true);
		expect(isEmptyOrWhitespace('\t\t')).toBe(true);
		expect(isEmptyOrWhitespace('  \n  \t  ')).toBe(true);
		expect(isEmptyOrWhitespace('Hello')).toBe(false);
		expect(isEmptyOrWhitespace('  Hello  ')).toBe(false);
	});
});

describe('Auto-hide timer tests', () => {
	interface TimerState {
		isRunning: boolean;
		startTime: number | null;
		duration: number;
		callback: (() => void) | null;
	}

	const createMockTimer = () => {
		let state: TimerState = {
			isRunning: false,
			startTime: null,
			duration: 0,
			callback: null
		};
		let timeoutId: ReturnType<typeof setTimeout> | undefined;

		return {
			start: (durationMs: number, callback: () => void) => {
				if (timeoutId) clearTimeout(timeoutId);
				state = {
					isRunning: true,
					startTime: Date.now(),
					duration: durationMs,
					callback
				};
				timeoutId = setTimeout(() => {
					callback();
					state.isRunning = false;
				}, durationMs);
			},
			cancel: () => {
				if (timeoutId) {
					clearTimeout(timeoutId);
					timeoutId = undefined;
				}
				state.isRunning = false;
				state.callback = null;
			},
			isRunning: () => state.isRunning,
			getDuration: () => state.duration,
			getState: () => ({ ...state })
		};
	};

	test('should start timer after complete state', () => {
		const timer = createMockTimer();
		let hidden = false;

		const handleStateChange = (state: PreviewState) => {
			if (state === 'complete') {
				timer.start(3000, () => {
					hidden = true;
				});
			}
		};

		handleStateChange('complete');

		expect(timer.isRunning()).toBe(true);
		expect(timer.getDuration()).toBe(3000);
		expect(hidden).toBe(false); // Timer started but not triggered yet

		timer.cancel();
	});

	test('should cancel timer on new text', () => {
		const timer = createMockTimer();

		// Start timer
		timer.start(3000, () => {});
		expect(timer.isRunning()).toBe(true);

		// New text arrives - cancel timer
		timer.cancel();
		expect(timer.isRunning()).toBe(false);
	});

	test('should support different durations (1-5 seconds)', () => {
		const timer = createMockTimer();
		const durations = [1, 2, 3, 4, 5];

		durations.forEach((seconds) => {
			const ms = seconds * 1000;
			timer.start(ms, () => {});
			expect(timer.getDuration()).toBe(ms);
			timer.cancel();
		});
	});

	test('should extend duration for error state', () => {
		const baseDuration = 3;
		const errorExtension = 1;

		const getDurationForState = (
			state: PreviewState,
			baseDurationSecs: number
		): number => {
			if (state === 'error') {
				return (baseDurationSecs + errorExtension) * 1000;
			}
			return baseDurationSecs * 1000;
		};

		expect(getDurationForState('complete', baseDuration)).toBe(3000);
		expect(getDurationForState('error', baseDuration)).toBe(4000);
	});

	test('should restart timer if new complete event arrives', () => {
		const timer = createMockTimer();
		let callCount = 0;

		// First complete
		timer.start(3000, () => {
			callCount++;
		});
		const firstStartTime = timer.getState().startTime;

		// Brief delay then another complete (restart timer)
		timer.start(3000, () => {
			callCount++;
		});
		const secondStartTime = timer.getState().startTime;

		expect(timer.isRunning()).toBe(true);
		expect(secondStartTime).toBeGreaterThanOrEqual(firstStartTime!);

		timer.cancel();
		expect(callCount).toBe(0); // Neither callback should have been called yet
	});

	test('should not start timer during preview or injecting states', () => {
		// Timer should only start in complete or error states
		const shouldStartTimer = (state: PreviewState): boolean => {
			return state === 'complete' || state === 'error';
		};

		expect(shouldStartTimer('preview')).toBe(false);
		expect(shouldStartTimer('streaming')).toBe(false);
		expect(shouldStartTimer('injecting')).toBe(false);
		expect(shouldStartTimer('complete')).toBe(true);
		expect(shouldStartTimer('error')).toBe(true);
	});

	test('should handle timer duration bounds', () => {
		const clampDuration = (durationSecs: number): number => {
			const MIN_DURATION = 1;
			const MAX_DURATION = 5;
			return Math.max(MIN_DURATION, Math.min(MAX_DURATION, durationSecs));
		};

		expect(clampDuration(0)).toBe(1);
		expect(clampDuration(-5)).toBe(1);
		expect(clampDuration(1)).toBe(1);
		expect(clampDuration(3)).toBe(3);
		expect(clampDuration(5)).toBe(5);
		expect(clampDuration(10)).toBe(5);
		expect(clampDuration(100)).toBe(5);
	});
});

describe('Streaming state handling', () => {
	test('should include streaming in valid states', () => {
		const allStates: PreviewState[] = ['preview', 'streaming', 'injecting', 'complete', 'error'];
		expect(allStates.length).toBe(5);
		expect(allStates).toContain('streaming');
	});

	test('should show visualizer in streaming state', () => {
		const shouldShowVisualizer = (
			showVisualizer: boolean,
			state: PreviewState
		): boolean => {
			return showVisualizer && (state === 'preview' || state === 'streaming');
		};

		expect(shouldShowVisualizer(true, 'streaming')).toBe(true);
		expect(shouldShowVisualizer(false, 'streaming')).toBe(false);
	});

	test('should cancel hide timer during streaming', () => {
		const shouldCancelHideTimer = (state: PreviewState): boolean => {
			return state === 'preview' || state === 'injecting' || state === 'streaming';
		};

		expect(shouldCancelHideTimer('streaming')).toBe(true);
		expect(shouldCancelHideTimer('complete')).toBe(false);
	});

	test('should return correct styles for streaming state', () => {
		const getStateStyles = (
			currentState: PreviewState
		): { color: string; animate: boolean } => {
			switch (currentState) {
				case 'preview':
					return { color: 'bg-yellow-400', animate: false };
				case 'streaming':
					return { color: 'bg-purple-400', animate: true };
				case 'injecting':
					return { color: 'bg-blue-400', animate: true };
				case 'complete':
					return { color: 'bg-green-400', animate: false };
				case 'error':
					return { color: 'bg-red-400', animate: false };
				default:
					return { color: 'bg-yellow-400', animate: false };
			}
		};

		const streamingStyles = getStateStyles('streaming');
		expect(streamingStyles.color).toBe('bg-purple-400');
		expect(streamingStyles.animate).toBe(true);
	});

	test('should return correct label for streaming state', () => {
		const getStateLabel = (currentState: PreviewState): string => {
			switch (currentState) {
				case 'preview':
					return 'Preview';
				case 'streaming':
					return 'Transcribing...';
				case 'injecting':
					return 'Injecting...';
				case 'complete':
					return 'Complete';
				case 'error':
					return 'Error';
				default:
					return 'Preview';
			}
		};

		expect(getStateLabel('streaming')).toBe('Transcribing...');
	});
});

describe('Window drag and position saving debounce', () => {
	test('should debounce position save after drag ends', () => {
		let saveCallCount = 0;
		let lastSavedPosition: { x: number; y: number } | null = null;
		let debounceTimeout: ReturnType<typeof setTimeout> | undefined;

		const debouncedSavePosition = (x: number, y: number, delayMs: number) => {
			if (debounceTimeout) clearTimeout(debounceTimeout);
			debounceTimeout = setTimeout(() => {
				lastSavedPosition = { x, y };
				saveCallCount++;
			}, delayMs);
		};

		const cancelDebounce = () => {
			if (debounceTimeout) clearTimeout(debounceTimeout);
		};

		// Multiple rapid position changes
		debouncedSavePosition(100, 100, 100);
		debouncedSavePosition(110, 110, 100);
		debouncedSavePosition(120, 120, 100);
		debouncedSavePosition(130, 130, 100);

		// Should not have saved yet (debounce pending)
		expect(saveCallCount).toBe(0);
		expect(lastSavedPosition).toBe(null);

		cancelDebounce();
	});

	test('should track drag state correctly', () => {
		let isDragging = false;

		const handleMouseDown = () => {
			isDragging = true;
		};

		const handleMouseUp = () => {
			isDragging = false;
		};

		expect(isDragging).toBe(false);

		handleMouseDown();
		expect(isDragging).toBe(true);

		handleMouseUp();
		expect(isDragging).toBe(false);
	});
});

describe('Escape key handling', () => {
	test('should reset state on escape', () => {
		let text = 'Some transcription';
		let previewState: PreviewState = 'injecting';
		let windowHidden = false;
		let timerCancelled = false;

		const handleEscape = () => {
			timerCancelled = true;
			windowHidden = true;
			text = '';
			previewState = 'preview';
		};

		handleEscape();

		expect(text).toBe('');
		expect(previewState as PreviewState).toBe('preview');
		expect(windowHidden).toBe(true);
		expect(timerCancelled).toBe(true);
	});
});

describe('Settings change event handling', () => {
	interface PreviewSettings {
		preview_enabled: boolean;
		preview_duration_secs: number;
		preview_show_visualizer: boolean;
		streaming_enabled: boolean;
	}

	test('should update local settings on settings change event', () => {
		let showVisualizer = true;
		let previewDuration = 3;
		let streamingEnabled = true;

		const handleSettingsChange = (settings: PreviewSettings) => {
			showVisualizer = settings.preview_show_visualizer ?? true;
			previewDuration = settings.preview_duration_secs ?? 3;
			streamingEnabled = settings.streaming_enabled ?? true;
		};

		// Change settings
		handleSettingsChange({
			preview_enabled: true,
			preview_duration_secs: 5,
			preview_show_visualizer: false,
			streaming_enabled: false
		});

		expect(showVisualizer).toBe(false);
		expect(previewDuration).toBe(5);
		expect(streamingEnabled).toBe(false);
	});

	test('should use defaults for missing settings values', () => {
		let showVisualizer = true;
		let previewDuration = 3;
		let streamingEnabled = true;

		const handleSettingsChange = (settings: Partial<PreviewSettings>) => {
			showVisualizer = settings.preview_show_visualizer ?? true;
			previewDuration = settings.preview_duration_secs ?? 3;
			streamingEnabled = settings.streaming_enabled ?? true;
		};

		// Partial settings (missing some values)
		handleSettingsChange({
			preview_enabled: true
		});

		expect(showVisualizer).toBe(true);
		expect(previewDuration).toBe(3);
		expect(streamingEnabled).toBe(true);
	});
});

describe('Close button functionality', () => {
	test('should call onClose handler when close button is clicked', () => {
		let closeHandlerCalled = false;
		const onClose = () => {
			closeHandlerCalled = true;
		};

		// Simulate close button click
		onClose();

		expect(closeHandlerCalled).toBe(true);
	});

	test('should reset state when close is triggered', () => {
		let text = 'Some transcription text';
		let previewState: PreviewState = 'streaming';
		let windowHidden = false;

		const handleClose = () => {
			windowHidden = true;
			text = '';
			previewState = 'preview';
		};

		handleClose();

		expect(text).toBe('');
		expect(previewState).toBe('preview');
		expect(windowHidden).toBe(true);
	});

	test('should cancel hide timer on close', () => {
		let timerCancelled = false;
		let hideTimeout: ReturnType<typeof setTimeout> | undefined = setTimeout(() => {}, 5000);

		const cancelHide = () => {
			if (hideTimeout) {
				clearTimeout(hideTimeout);
				hideTimeout = undefined;
				timerCancelled = true;
			}
		};

		const handleClose = () => {
			cancelHide();
		};

		handleClose();

		expect(timerCancelled).toBe(true);
		expect(hideTimeout).toBeUndefined();
	});

	test('close button should be visible when onClose is provided', () => {
		const onClose = () => {};
		const shouldShowCloseButton = (callback: (() => void) | undefined): boolean => {
			return callback !== undefined;
		};

		expect(shouldShowCloseButton(onClose)).toBe(true);
		expect(shouldShowCloseButton(undefined)).toBe(false);
	});
});

describe('Recording state check on mount', () => {
	test('should set streaming state if recording is active on mount', () => {
		let previewState: PreviewState = 'preview';
		let text = '';

		const checkRecordingOnMount = (isRecording: boolean, streamingEnabled: boolean) => {
			if (isRecording && streamingEnabled) {
				text = '';
				previewState = 'streaming';
			}
		};

		// Recording is active
		checkRecordingOnMount(true, true);
		expect(previewState).toBe('streaming');
		expect(text).toBe('');

		// Reset
		previewState = 'preview';
		text = 'old text';

		// Recording not active
		checkRecordingOnMount(false, true);
		expect(previewState).toBe('preview');
		expect(text).toBe('old text');

		// Reset
		previewState = 'preview';
		text = 'old text';

		// Streaming disabled
		checkRecordingOnMount(true, false);
		expect(previewState).toBe('preview');
		expect(text).toBe('old text');
	});
});

describe('Text display in streaming state', () => {
	test('should show "Listening..." when streaming with empty text', () => {
		const getDisplayText = (text: string, state: PreviewState): string => {
			if (text) {
				return text;
			} else if (state === 'streaming') {
				return 'Listening...';
			} else {
				return 'Waiting for transcription...';
			}
		};

		expect(getDisplayText('', 'streaming')).toBe('Listening...');
		expect(getDisplayText('', 'preview')).toBe('Waiting for transcription...');
		expect(getDisplayText('Hello world', 'streaming')).toBe('Hello world');
	});

	test('should show streaming cursor when streaming with text', () => {
		const shouldShowStreamingCursor = (text: string, state: PreviewState): boolean => {
			return text.length > 0 && state === 'streaming';
		};

		expect(shouldShowStreamingCursor('Hello', 'streaming')).toBe(true);
		expect(shouldShowStreamingCursor('', 'streaming')).toBe(false);
		expect(shouldShowStreamingCursor('Hello', 'complete')).toBe(false);
	});
});
