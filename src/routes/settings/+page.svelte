<script lang="ts">
	import { onMount } from 'svelte';
	import { settings, type RecordingMode, type IndicatorPosition } from '$lib/stores/settings';
	import { invoke } from '@tauri-apps/api/core';
	import { save, open } from '@tauri-apps/plugin-dialog';
	import { WebviewWindow } from '@tauri-apps/api/webviewWindow';

	let advancedExpanded = $state(false);
	let showResetConfirm = $state(false);
	let importExportStatus = $state<string | null>(null);

	// Load settings on mount
	onMount(() => {
		settings.init();
	});

	// Handle hotkey change
	async function handleHotkeyChange(e: Event) {
		const target = e.target as HTMLInputElement;
		await settings.updateField('hotkey', target.value);
	}

	// Handle recording mode change
	async function handleRecordingModeChange(mode: RecordingMode) {
		await settings.updateField('recording_mode', mode);
	}

	// Handle model change
	async function handleModelChange(e: Event) {
		const target = e.target as HTMLSelectElement;
		await settings.updateField('model_id', target.value);
	}

	// Handle language change
	async function handleLanguageChange(e: Event) {
		const target = e.target as HTMLSelectElement;
		const value = target.value === '' ? null : target.value;
		await settings.updateField('language', value);
	}

	// Handle launch at login toggle
	async function handleLaunchAtLoginChange(e: Event) {
		const target = e.target as HTMLInputElement;
		await settings.updateField('launch_at_login', target.checked);
	}

	// Handle indicator position change
	async function handleIndicatorPositionChange(e: Event) {
		const target = e.target as HTMLSelectElement;
		await settings.updateField('indicator_position', target.value as IndicatorPosition);
	}

	// Handle auto-paste toggle
	async function handleAutoPasteChange(e: Event) {
		const target = e.target as HTMLInputElement;
		await settings.updateField('auto_paste', target.checked);
	}

	// Handle auto-copy toggle
	async function handleAutoCopyChange(e: Event) {
		const target = e.target as HTMLInputElement;
		await settings.updateField('auto_copy', target.checked);
	}

	// Handle injection delay change
	async function handleInjectionDelayChange(e: Event) {
		const target = e.target as HTMLInputElement;
		await settings.updateField('injection_delay_ms', parseInt(target.value, 10));
	}

	// Export settings to file
	async function handleExportSettings() {
		try {
			const path = await save({
				defaultPath: 'ez-flow-settings.json',
				filters: [{ name: 'JSON', extensions: ['json'] }]
			});
			if (path) {
				await invoke('export_settings', { path });
				importExportStatus = 'Settings exported successfully';
				setTimeout(() => (importExportStatus = null), 3000);
			}
		} catch (error) {
			importExportStatus = `Export failed: ${error}`;
			setTimeout(() => (importExportStatus = null), 5000);
		}
	}

	// Import settings from file
	async function handleImportSettings() {
		try {
			const path = await open({
				filters: [{ name: 'JSON', extensions: ['json'] }]
			});
			if (path) {
				const imported = await invoke('import_settings', { path });
				settings.localUpdate(() => imported as typeof $settings);
				importExportStatus = 'Settings imported successfully';
				setTimeout(() => (importExportStatus = null), 3000);
			}
		} catch (error) {
			importExportStatus = `Import failed: ${error}`;
			setTimeout(() => (importExportStatus = null), 5000);
		}
	}

	// Reset settings to defaults
	async function handleResetSettings() {
		await settings.reset();
		showResetConfirm = false;
	}

	// Open the setup wizard
	async function openSetupWizard() {
		// Reset onboarding state
		await settings.updateField('onboarding_completed', false);
		await settings.updateField('onboarding_skipped', false);
		// Open onboarding window
		const onboardingWindow = await WebviewWindow.getByLabel('onboarding');
		if (onboardingWindow) {
			await onboardingWindow.show();
			await onboardingWindow.setFocus();
		}
	}

	const models = [
		{ id: 'tiny', name: 'Tiny (75MB)', description: 'Fastest, lowest accuracy' },
		{ id: 'base', name: 'Base (142MB)', description: 'Good balance' },
		{ id: 'small', name: 'Small (466MB)', description: 'Better accuracy' },
		{ id: 'medium', name: 'Medium (1.5GB)', description: 'High accuracy' },
		{ id: 'large', name: 'Large (3GB)', description: 'Best accuracy' }
	];

	const languages = [
		{ code: '', name: 'Auto-detect' },
		{ code: 'en', name: 'English' },
		{ code: 'es', name: 'Spanish' },
		{ code: 'fr', name: 'French' },
		{ code: 'de', name: 'German' },
		{ code: 'zh', name: 'Chinese' },
		{ code: 'ja', name: 'Japanese' },
		{ code: 'ko', name: 'Korean' },
		{ code: 'pt', name: 'Portuguese' },
		{ code: 'ru', name: 'Russian' }
	];

	const indicatorPositions = [
		{ value: 'top_right', label: 'Top Right' },
		{ value: 'bottom_right', label: 'Bottom Right' },
		{ value: 'cursor', label: 'Near Cursor' },
		{ value: 'hidden', label: 'Hidden' }
	];
</script>

<div class="settings-page" data-testid="settings-panel">
	<h1 class="settings-title">Settings</h1>

	<!-- Recording Section -->
	<section class="settings-section">
		<h2 class="section-title">Recording</h2>

		<div class="setting-item">
			<label class="setting-label" for="hotkey">Hotkey</label>
			<input
				type="text"
				id="hotkey"
				data-testid="hotkey-input"
				class="setting-input"
				value={$settings.hotkey}
				onchange={handleHotkeyChange}
				placeholder="Ctrl+Shift+Space"
			/>
			<p class="setting-description">Press the keys you want to use as your recording hotkey</p>
		</div>

		<div class="setting-item">
			<span class="setting-label">Recording Mode</span>
			<div class="radio-group" data-testid="recording-mode-radio">
				<label class="radio-label">
					<input
						type="radio"
						name="recording_mode"
						value="push_to_talk"
						checked={$settings.recording_mode === 'push_to_talk'}
						onchange={() => handleRecordingModeChange('push_to_talk')}
					/>
					<span>Push-to-talk</span>
				</label>
				<p class="radio-description">Hold to record, release to stop</p>

				<label class="radio-label">
					<input
						type="radio"
						name="recording_mode"
						value="toggle"
						checked={$settings.recording_mode === 'toggle'}
						onchange={() => handleRecordingModeChange('toggle')}
					/>
					<span>Toggle</span>
				</label>
				<p class="radio-description">Press to start, press again to stop</p>
			</div>
		</div>
	</section>

	<!-- Transcription Section -->
	<section class="settings-section">
		<h2 class="section-title">Transcription</h2>

		<div class="setting-item">
			<label class="setting-label" for="model">Model</label>
			<select
				id="model"
				data-testid="model-selector"
				class="setting-select"
				value={$settings.model_id}
				onchange={handleModelChange}
			>
				{#each models as model}
					<option value={model.id}>{model.name}</option>
				{/each}
			</select>
		</div>

		<div class="setting-item">
			<label class="setting-label" for="language">Language</label>
			<select
				id="language"
				data-testid="language-selector"
				class="setting-select"
				value={$settings.language ?? ''}
				onchange={handleLanguageChange}
			>
				{#each languages as lang}
					<option value={lang.code}>{lang.name}</option>
				{/each}
			</select>
		</div>
	</section>

	<!-- Behavior Section -->
	<section class="settings-section">
		<h2 class="section-title">Behavior</h2>

		<div class="setting-item">
			<label class="checkbox-label" data-testid="launch-at-login-toggle">
				<input
					type="checkbox"
					checked={$settings.launch_at_login}
					onchange={handleLaunchAtLoginChange}
				/>
				<span>Start EZ Flow with system</span>
			</label>
		</div>

		<div class="setting-item">
			<label class="setting-label" for="indicator-position">Recording Indicator Position</label>
			<select
				id="indicator-position"
				class="setting-select"
				value={$settings.indicator_position}
				onchange={handleIndicatorPositionChange}
			>
				{#each indicatorPositions as pos}
					<option value={pos.value}>{pos.label}</option>
				{/each}
			</select>
		</div>
	</section>

	<!-- Advanced Section (Collapsible) -->
	<section class="settings-section advanced-section">
		<button
			class="section-header-button"
			onclick={() => (advancedExpanded = !advancedExpanded)}
			data-testid="advanced-toggle"
		>
			<h2 class="section-title">Advanced</h2>
			<span class="chevron" class:expanded={advancedExpanded}>
				<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
					<path d="M4.646 5.646a.5.5 0 0 1 .708 0L8 8.293l2.646-2.647a.5.5 0 0 1 .708.708l-3 3a.5.5 0 0 1-.708 0l-3-3a.5.5 0 0 1 0-.708z"/>
				</svg>
			</span>
		</button>

		{#if advancedExpanded}
			<div class="advanced-content" data-testid="advanced-section">
				<div class="setting-item">
					<label class="checkbox-label">
						<input
							type="checkbox"
							checked={$settings.auto_copy}
							onchange={handleAutoCopyChange}
							data-testid="auto-copy-toggle"
						/>
						<span>Auto-copy transcription to clipboard</span>
					</label>
				</div>

				<div class="setting-item">
					<label class="checkbox-label">
						<input
							type="checkbox"
							checked={$settings.auto_paste}
							onchange={handleAutoPasteChange}
							data-testid="auto-paste-toggle"
						/>
						<span>Auto-paste transcription after recording</span>
					</label>
				</div>

				<div class="setting-item">
					<label class="setting-label" for="injection-delay">
						Text Injection Delay: {$settings.injection_delay_ms}ms
					</label>
					<input
						type="range"
						id="injection-delay"
						class="setting-slider"
						min="0"
						max="50"
						step="5"
						value={$settings.injection_delay_ms}
						oninput={handleInjectionDelayChange}
						data-testid="injection-delay-slider"
					/>
					<p class="setting-description">
						Delay between clipboard paste and clearing (may help with some apps)
					</p>
				</div>

				<div class="setting-item button-group">
					<button class="secondary-button" onclick={handleExportSettings} data-testid="export-button">
						Export Settings
					</button>
					<button class="secondary-button" onclick={handleImportSettings} data-testid="import-button">
						Import Settings
					</button>
				</div>

				{#if importExportStatus}
					<p class="status-message" class:error={importExportStatus.includes('failed')}>
						{importExportStatus}
					</p>
				{/if}

				<div class="setting-item">
					<button
						class="secondary-button"
						onclick={openSetupWizard}
						data-testid="run-setup-wizard"
					>
						Run Setup Wizard
					</button>
					<p class="setting-description">Re-run the initial setup wizard</p>
				</div>

				<div class="setting-item">
					{#if showResetConfirm}
						<div class="confirm-dialog">
							<p>Are you sure you want to reset all settings to defaults?</p>
							<div class="button-group">
								<button class="danger-button" onclick={handleResetSettings}>
									Yes, Reset
								</button>
								<button class="secondary-button" onclick={() => (showResetConfirm = false)}>
									Cancel
								</button>
							</div>
						</div>
					{:else}
						<button
							class="danger-button"
							onclick={() => (showResetConfirm = true)}
							data-testid="reset-button"
						>
							Reset to Defaults
						</button>
					{/if}
				</div>
			</div>
		{/if}
	</section>
</div>

<style>
	.settings-page {
		padding: 1.5rem;
		background: #0a0a0a;
		min-height: 100vh;
		color: #e5e5e5;
	}

	.settings-title {
		font-size: 1.5rem;
		font-weight: 600;
		margin-bottom: 1.5rem;
		color: #f4c430;
	}

	.settings-section {
		margin-bottom: 2rem;
		padding-bottom: 1.5rem;
		border-bottom: 1px solid #262626;
	}

	.section-title {
		font-size: 1.125rem;
		font-weight: 500;
		margin-bottom: 1rem;
		color: #a3a3a3;
	}

	.setting-item {
		margin-bottom: 1rem;
	}

	.setting-label {
		display: block;
		font-size: 0.875rem;
		color: #a3a3a3;
		margin-bottom: 0.5rem;
	}

	.setting-input,
	.setting-select {
		width: 100%;
		max-width: 300px;
		padding: 0.5rem 0.75rem;
		background: #171717;
		border: 1px solid #262626;
		border-radius: 6px;
		color: #e5e5e5;
		font-size: 0.875rem;
	}

	.setting-input:focus,
	.setting-select:focus {
		outline: none;
		border-color: #f4c430;
	}

	.setting-description {
		font-size: 0.75rem;
		color: #737373;
		margin-top: 0.25rem;
	}

	.radio-group {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.radio-label {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		cursor: pointer;
	}

	.radio-label input[type='radio'] {
		accent-color: #f4c430;
	}

	.radio-description {
		font-size: 0.75rem;
		color: #737373;
		margin-left: 1.5rem;
		margin-top: -0.25rem;
	}

	.checkbox-label {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		cursor: pointer;
	}

	.checkbox-label input[type='checkbox'] {
		accent-color: #f4c430;
	}

	/* Advanced section styles */
	.section-header-button {
		display: flex;
		align-items: center;
		justify-content: space-between;
		width: 100%;
		padding: 0;
		background: none;
		border: none;
		cursor: pointer;
		color: inherit;
	}

	.section-header-button .section-title {
		margin-bottom: 0;
	}

	.chevron {
		color: #737373;
		transition: transform 0.2s ease;
	}

	.chevron.expanded {
		transform: rotate(180deg);
	}

	.advanced-content {
		margin-top: 1rem;
	}

	.setting-slider {
		width: 100%;
		max-width: 300px;
		height: 4px;
		background: #262626;
		border-radius: 2px;
		outline: none;
		appearance: none;
		cursor: pointer;
	}

	.setting-slider::-webkit-slider-thumb {
		appearance: none;
		width: 16px;
		height: 16px;
		background: #f4c430;
		border-radius: 50%;
		cursor: pointer;
	}

	.setting-slider::-moz-range-thumb {
		width: 16px;
		height: 16px;
		background: #f4c430;
		border-radius: 50%;
		cursor: pointer;
		border: none;
	}

	.button-group {
		display: flex;
		gap: 0.75rem;
		flex-wrap: wrap;
	}

	.secondary-button {
		padding: 0.5rem 1rem;
		background: #262626;
		border: 1px solid #404040;
		border-radius: 6px;
		color: #e5e5e5;
		font-size: 0.875rem;
		cursor: pointer;
		transition: background-color 0.2s ease;
	}

	.secondary-button:hover {
		background: #333333;
	}

	.danger-button {
		padding: 0.5rem 1rem;
		background: #7f1d1d;
		border: 1px solid #991b1b;
		border-radius: 6px;
		color: #fecaca;
		font-size: 0.875rem;
		cursor: pointer;
		transition: background-color 0.2s ease;
	}

	.danger-button:hover {
		background: #991b1b;
	}

	.confirm-dialog {
		background: #171717;
		border: 1px solid #404040;
		border-radius: 8px;
		padding: 1rem;
	}

	.confirm-dialog p {
		margin-bottom: 1rem;
		color: #e5e5e5;
	}

	.status-message {
		font-size: 0.875rem;
		color: #22c55e;
		margin-top: 0.5rem;
	}

	.status-message.error {
		color: #ef4444;
	}
</style>
