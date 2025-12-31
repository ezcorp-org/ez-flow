/**
 * Build validation tests
 *
 * These tests verify that the application can build successfully,
 * catching dependency compatibility issues, import errors, and
 * bundling problems that unit tests miss.
 */

import { describe, test, expect, beforeAll } from 'bun:test';
import { existsSync, readdirSync, readFileSync } from 'fs';
import { join, resolve } from 'path';

// Resolve project root from this file's location (src/lib/build.test.ts -> project root)
const PROJECT_ROOT = resolve(import.meta.dir, '../..');
const DIST_DIR = join(PROJECT_ROOT, 'dist');
const SRC_TAURI_DIR = join(PROJECT_ROOT, 'src-tauri');

describe('Build Validation', () => {
	describe('Vite Build', () => {
		let buildResult: { success: boolean; stderr: string; stdout: string };

		beforeAll(async () => {
			// Run the build using bun run which uses package.json scripts
			const proc = Bun.spawn(['bun', 'run', 'build'], {
				cwd: PROJECT_ROOT,
				stdout: 'pipe',
				stderr: 'pipe',
			});

			const stdout = await new Response(proc.stdout).text();
			const stderr = await new Response(proc.stderr).text();
			const exitCode = await proc.exited;

			buildResult = {
				success: exitCode === 0,
				stdout,
				stderr,
			};
		}, 120000); // 2 minute timeout for build

		test('build completes without errors', () => {
			if (!buildResult.success) {
				console.error('Build stderr:', buildResult.stderr);
				console.error('Build stdout:', buildResult.stdout);
			}
			expect(buildResult.success).toBe(true);
		});

		test('build produces dist directory', () => {
			expect(existsSync(DIST_DIR)).toBe(true);
		});

		test('build produces index.html', () => {
			expect(existsSync(join(DIST_DIR, 'index.html'))).toBe(true);
		});

		test('build produces assets directory', () => {
			expect(existsSync(join(DIST_DIR, 'assets'))).toBe(true);
		});

		test('build produces JavaScript bundles', () => {
			const assetsDir = join(DIST_DIR, 'assets');
			if (existsSync(assetsDir)) {
				const files = readdirSync(assetsDir);
				const jsFiles = files.filter(f => f.endsWith('.js'));
				expect(jsFiles.length).toBeGreaterThan(0);
			} else {
				expect(existsSync(assetsDir)).toBe(true);
			}
		});

		test('build produces CSS bundles', () => {
			const assetsDir = join(DIST_DIR, 'assets');
			if (existsSync(assetsDir)) {
				const files = readdirSync(assetsDir);
				const cssFiles = files.filter(f => f.endsWith('.css'));
				expect(cssFiles.length).toBeGreaterThan(0);
			} else {
				expect(existsSync(assetsDir)).toBe(true);
			}
		});

		test('build output does not contain Svelte 5 compatibility errors', () => {
			// Check for common Svelte 5 runes mode errors
			const errorPatterns = [
				'Cannot use `$props` in runes mode',
				'Cannot use `$$props` in runes mode',
				'Cannot use `$$restProps` in runes mode',
				'legacy_props_invalid',
			];

			const combined = buildResult.stderr + buildResult.stdout;
			for (const pattern of errorPatterns) {
				expect(combined).not.toContain(pattern);
			}
		});

		test('build output does not contain module resolution errors', () => {
			const errorPatterns = [
				'Module not found',
				'Could not resolve',
				'Failed to resolve import',
			];

			const combined = buildResult.stderr + buildResult.stdout;
			for (const pattern of errorPatterns) {
				expect(combined).not.toContain(pattern);
			}
		});
	});

	describe('TypeScript Compilation', () => {
		test('TypeScript compiles without errors', async () => {
			const proc = Bun.spawn(['bun', 'run', 'check'], {
				cwd: PROJECT_ROOT,
				stdout: 'pipe',
				stderr: 'pipe',
			});

			const stderr = await new Response(proc.stderr).text();
			const stdout = await new Response(proc.stdout).text();
			const exitCode = await proc.exited;

			if (exitCode !== 0) {
				console.error('TypeScript/Svelte check errors:', stdout || stderr);
			}
			expect(exitCode).toBe(0);
		}, 60000);
	});

	describe('Dependency Compatibility', () => {
		test('no legacy Svelte syntax in runes mode components', async () => {
			// Check that we're not using incompatible patterns in our source
			const proc = Bun.spawn(
				['grep', '-rn', '--include=*.svelte', '\\$\\$props\\|\\$\\$restProps', 'src/'],
				{
					cwd: PROJECT_ROOT,
					stdout: 'pipe',
					stderr: 'pipe',
				}
			);

			const stdout = await new Response(proc.stdout).text();
			await proc.exited;

			// Should not find legacy $$props or $$restProps in our code
			if (stdout.trim()) {
				console.warn('Found legacy Svelte syntax:', stdout);
			}
			expect(stdout.trim()).toBe('');
		});

		test('package.json does not contain incompatible lucide-svelte', () => {
			const packageJson = JSON.parse(
				readFileSync(join(PROJECT_ROOT, 'package.json'), 'utf-8')
			);
			const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };

			// Should use @lucide/svelte, not lucide-svelte
			expect(deps['lucide-svelte']).toBeUndefined();
		});

		test('@lucide/svelte is installed for Svelte 5 compatibility', () => {
			const packageJson = JSON.parse(
				readFileSync(join(PROJECT_ROOT, 'package.json'), 'utf-8')
			);
			const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };

			expect(deps['@lucide/svelte']).toBeDefined();
		});
	});
});

describe('Rust Build Validation', () => {
	test('cargo check passes', async () => {
		// Use env -i with login shell to ensure clean NixOS environment
		const proc = Bun.spawn([
			'env', '-i',
			`HOME=${process.env.HOME}`,
			`PATH=/run/current-system/sw/bin:${process.env.PATH}`,
			'bash', '-lc',
			`cd "${SRC_TAURI_DIR}" && cargo check`
		], {
			stdout: 'pipe',
			stderr: 'pipe',
		});

		const stderr = await new Response(proc.stderr).text();
		const exitCode = await proc.exited;

		if (exitCode !== 0) {
			// Filter out warnings, only show errors
			const lines = stderr.split('\n');
			const errors = lines.filter(l => l.includes('error[') || l.includes('error:'));
			if (errors.length > 0) {
				console.error('Cargo check errors:', errors.join('\n'));
			}
		}
		expect(exitCode).toBe(0);
	}, 180000); // 3 minute timeout for cargo check

	test('no compilation errors in Rust code', async () => {
		// Use env -i with login shell to ensure clean NixOS environment
		const proc = Bun.spawn([
			'env', '-i',
			`HOME=${process.env.HOME}`,
			`PATH=/run/current-system/sw/bin:${process.env.PATH}`,
			'bash', '-lc',
			`cd "${SRC_TAURI_DIR}" && cargo check --message-format=json`
		], {
			stdout: 'pipe',
			stderr: 'pipe',
		});

		const stdout = await new Response(proc.stdout).text();
		await proc.exited;

		// Parse JSON messages and check for errors
		const lines = stdout.split('\n').filter(Boolean);
		const errors = lines
			.map(line => {
				try {
					return JSON.parse(line);
				} catch {
					return null;
				}
			})
			.filter(
				msg => msg?.reason === 'compiler-message' && msg?.message?.level === 'error'
			);

		if (errors.length > 0) {
			console.error(
				'Rust compilation errors:',
				errors.map(e => e.message?.message).join('\n')
			);
		}
		expect(errors.length).toBe(0);
	}, 180000);

	test('Cargo.toml exists', () => {
		expect(existsSync(join(SRC_TAURI_DIR, 'Cargo.toml'))).toBe(true);
	});

	test('Cargo.lock exists', () => {
		expect(existsSync(join(SRC_TAURI_DIR, 'Cargo.lock'))).toBe(true);
	});
});

describe('Project Structure Validation', () => {
	test('package.json exists', () => {
		expect(existsSync(join(PROJECT_ROOT, 'package.json'))).toBe(true);
	});

	test('bun.lock exists', () => {
		expect(existsSync(join(PROJECT_ROOT, 'bun.lock'))).toBe(true);
	});

	test('vite.config.ts exists', () => {
		expect(existsSync(join(PROJECT_ROOT, 'vite.config.ts'))).toBe(true);
	});

	test('svelte.config.js exists', () => {
		expect(existsSync(join(PROJECT_ROOT, 'svelte.config.js'))).toBe(true);
	});

	test('tauri.conf.json exists', () => {
		expect(existsSync(join(SRC_TAURI_DIR, 'tauri.conf.json'))).toBe(true);
	});

	test('src directory exists', () => {
		expect(existsSync(join(PROJECT_ROOT, 'src'))).toBe(true);
	});

	test('src-tauri/src directory exists', () => {
		expect(existsSync(join(SRC_TAURI_DIR, 'src'))).toBe(true);
	});
});
