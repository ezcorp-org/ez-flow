/**
 * Global test setup - runs before all tests
 * Mocks Tauri APIs that aren't available in test environment
 */
import { mock } from 'bun:test';

// Mock @tauri-apps/api/core
mock.module('@tauri-apps/api/core', () => ({
	invoke: mock(() => Promise.resolve(undefined)),
	transformCallback: mock(() => 0),
	convertFileSrc: mock((path: string) => path),
	isTauri: mock(() => false),
	Channel: class {
		id = 0;
		onmessage = () => {};
	},
	Resource: class {
		rid = 0;
		close() {
			return Promise.resolve();
		}
	},
	PluginListener: class {
		plugin = '';
		event = '';
		unregister() {
			return Promise.resolve();
		}
	}
}));

// Mock @tauri-apps/api/event
mock.module('@tauri-apps/api/event', () => ({
	listen: mock(() => Promise.resolve(() => {})),
	once: mock(() => Promise.resolve(() => {})),
	emit: mock(() => Promise.resolve()),
	emitTo: mock(() => Promise.resolve()),
	TauriEvent: {}
}));

// Mock @tauri-apps/api/app
mock.module('@tauri-apps/api/app', () => ({
	getName: mock(() => Promise.resolve('ez-flow')),
	getVersion: mock(() => Promise.resolve('1.0.0')),
	getTauriVersion: mock(() => Promise.resolve('2.0.0'))
}));

// Mock @tauri-apps/plugin-dialog
mock.module('@tauri-apps/plugin-dialog', () => ({
	open: mock(() => Promise.resolve(null)),
	save: mock(() => Promise.resolve(null)),
	message: mock(() => Promise.resolve()),
	ask: mock(() => Promise.resolve(false)),
	confirm: mock(() => Promise.resolve(false))
}));

// Mock @tauri-apps/plugin-clipboard-manager
mock.module('@tauri-apps/plugin-clipboard-manager', () => ({
	writeText: mock(() => Promise.resolve()),
	readText: mock(() => Promise.resolve('')),
	writeHtml: mock(() => Promise.resolve()),
	readHtml: mock(() => Promise.resolve(''))
}));

// Mock @tauri-apps/plugin-updater
mock.module('@tauri-apps/plugin-updater', () => ({
	check: mock(() => Promise.resolve(null)),
	Update: class {
		version = '1.0.0';
		currentVersion = '0.9.0';
		body = '';
		date = '';
		download() {
			return Promise.resolve();
		}
		install() {
			return Promise.resolve();
		}
	}
}));
