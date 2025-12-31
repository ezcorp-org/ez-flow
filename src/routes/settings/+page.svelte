<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { settings, type RecordingMode, type IndicatorPosition } from '$lib/stores/settings';
	import { invoke } from '@tauri-apps/api/core';
	import { listen, type UnlistenFn } from '@tauri-apps/api/event';
	import { save, open } from '@tauri-apps/plugin-dialog';
	import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
	import NavBar from '$lib/components/NavBar.svelte';
	import KeybindCapture from '$lib/components/KeybindCapture.svelte';
	import VocabularyManager from '$lib/components/VocabularyManager.svelte';
	import ContextPromptEditor from '$lib/components/ContextPromptEditor.svelte';

	interface ModelInfo {
		id: string;
		name: string;
		size_mb: number;
		description: string;
	}

	let advancedExpanded = $state(false);
	let showResetConfirm = $state(false);
	let importExportStatus = $state<string | null>(null);

	// Model management state
	let availableModels = $state<ModelInfo[]>([]);
	let downloadedModelIds = $state<string[]>([]);
	let downloadingModelId = $state<string | null>(null);
	let downloadProgress = $state(0);
	let modelError = $state<string | null>(null);
	let unlisteners: UnlistenFn[] = [];

	// Hotkey state
	let hotkeyError = $state<string | null>(null);

	// Load settings and model info on mount
	onMount(async () => {
		settings.init();
		await loadModelInfo();

		// Listen for download progress events
		unlisteners.push(
			await listen<{ progress: number }>('model:download_progress', (event) => {
				downloadProgress = event.payload.progress * 100;
			})
		);
	});

	onDestroy(() => {
		unlisteners.forEach((unlisten) => unlisten());
	});

	async function loadModelInfo() {
		try {
			availableModels = await invoke<ModelInfo[]>('get_available_models');
			downloadedModelIds = await invoke<string[]>('get_downloaded_model_ids');
		} catch (e) {
			console.error('Failed to load model info:', e);
		}
	}

	async function downloadModel(modelId: string) {
		if (downloadingModelId) return;
		downloadingModelId = modelId;
		downloadProgress = 0;
		modelError = null;

		try {
			await invoke('download_model', { modelId });
			downloadedModelIds = [...downloadedModelIds, modelId];
		} catch (e) {
			modelError = `Failed to download model: ${e}`;
			setTimeout(() => (modelError = null), 5000);
		} finally {
			downloadingModelId = null;
			downloadProgress = 0;
		}
	}

	async function deleteModel(modelId: string) {
		modelError = null;
		try {
			await invoke('delete_downloaded_model', { modelId });
			downloadedModelIds = downloadedModelIds.filter((id) => id !== modelId);
			// If this was the selected model, switch to another downloaded model
			if ($settings.model_id === modelId && downloadedModelIds.length > 0) {
				await settings.updateField('model_id', downloadedModelIds[0]);
			}
		} catch (e) {
			modelError = `Failed to delete model: ${e}`;
			setTimeout(() => (modelError = null), 5000);
		}
	}

	function isModelDownloaded(modelId: string): boolean {
		return downloadedModelIds.includes(modelId);
	}

	async function selectActiveModel(modelId: string) {
		if (!isModelDownloaded(modelId)) return;
		await settings.updateField('model_id', modelId);
	}

	// Handle hotkey change from KeybindCapture component
	async function handleHotkeyChange(newHotkey: string) {
		hotkeyError = null;
		try {
			// Update the setting - this will also register the new hotkey on the backend
			await settings.updateField('hotkey', newHotkey);
		} catch (e) {
			hotkeyError = `Failed to set hotkey: ${e}`;
			setTimeout(() => (hotkeyError = null), 5000);
		}
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

	// Handle streaming enabled toggle
	async function handleStreamingEnabledChange(e: Event) {
		const target = e.target as HTMLInputElement;
		await settings.updateField('streaming_enabled', target.checked);
	}

	// Handle streaming mode change
	async function handleStreamingModeChange(e: Event) {
		const target = e.target as HTMLSelectElement;
		await settings.updateField('streaming_mode', target.value as 'speed' | 'balanced' | 'accuracy');
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

	// Handle preview enabled toggle
	async function handlePreviewEnabledChange(e: Event) {
		const target = e.target as HTMLInputElement;
		await settings.updateField('preview_enabled', target.checked);
	}

	// Handle preview duration change
	async function handlePreviewDurationChange(e: Event) {
		const target = e.target as HTMLInputElement;
		await settings.updateField('preview_duration_secs', parseInt(target.value, 10));
	}

	// Handle preview visualizer toggle
	async function handlePreviewVisualizerChange(e: Event) {
		const target = e.target as HTMLInputElement;
		await settings.updateField('preview_show_visualizer', target.checked);
	}

	// Handle custom vocabulary change
	async function handleVocabularyChange(vocabulary: string[]) {
		await settings.updateField('custom_vocabulary', vocabulary);
	}

	// Handle context prompt change
	async function handleContextPromptChange(prompt: string | null) {
		await settings.updateField('context_prompt', prompt);
	}

	// Handle use context prompt toggle
	async function handleUseContextPromptChange(use: boolean) {
		await settings.updateField('use_context_prompt', use);
	}

	// Handle voice commands enabled toggle
	async function handleVoiceCommandsEnabledChange(e: Event) {
		const target = e.target as HTMLInputElement;
		await settings.updateField('voice_commands', {
			...$settings.voice_commands,
			enabled: target.checked
		});
	}

	// Handle voice commands require prefix toggle
	async function handleVoiceCommandsRequirePrefixChange(e: Event) {
		const target = e.target as HTMLInputElement;
		await settings.updateField('voice_commands', {
			...$settings.voice_commands,
			require_prefix: target.checked
		});
	}

	// Handle voice commands prefix change
	async function handleVoiceCommandsPrefixChange(e: Event) {
		const target = e.target as HTMLInputElement;
		await settings.updateField('voice_commands', {
			...$settings.voice_commands,
			prefix: target.value
		});
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
	<div class="sticky-header">
		<h1 class="settings-title">Settings</h1>
	</div>

	<!-- Recording Section -->
	<section class="settings-section">
		<h2 class="section-title">Recording</h2>

		<div class="setting-item">
			<span class="setting-label">Hotkey</span>
			<KeybindCapture
				value={$settings.hotkey}
				onchange={handleHotkeyChange}
			/>
			{#if hotkeyError}
				<p class="setting-description error-text">{hotkeyError}</p>
			{:else}
				<p class="setting-description">Click to capture a new keyboard shortcut for recording</p>
			{/if}
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
			<label class="setting-label" for="model">Active Model</label>
			<select
				id="model"
				data-testid="model-selector"
				class="setting-select"
				value={$settings.model_id}
				onchange={handleModelChange}
				disabled={downloadedModelIds.length === 0}
			>
				{#each models.filter((m) => isModelDownloaded(m.id)) as model}
					<option value={model.id}>{model.name}</option>
				{/each}
			</select>
			{#if downloadedModelIds.length === 0}
				<p class="setting-description warning">No models downloaded. Download a model below.</p>
			{/if}
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

		<div class="setting-item">
			<label class="checkbox-label" data-testid="streaming-enabled-toggle">
				<input
					type="checkbox"
					checked={$settings.streaming_enabled}
					onchange={handleStreamingEnabledChange}
				/>
				<span>Enable streaming transcription</span>
			</label>
			<p class="setting-description">
				Show transcription in real-time as you speak (requires slightly more processing power)
			</p>
		</div>

		<div class="setting-item">
			<label class="setting-label" for="streaming-mode">Streaming Mode</label>
			<select
				id="streaming-mode"
				data-testid="streaming-mode-selector"
				class="setting-select"
				value={$settings.streaming_mode}
				onchange={handleStreamingModeChange}
				disabled={!$settings.streaming_enabled}
			>
				<option value="speed">Speed (fastest, no final cleanup)</option>
				<option value="balanced">Balanced (re-processes ending)</option>
				<option value="accuracy">Accuracy (full re-transcription)</option>
			</select>
			<p class="setting-description">
				Trade-off between transcription speed and final accuracy
			</p>
		</div>
	</section>

	<!-- Custom Vocabulary & Prompts Section -->
	<section class="settings-section">
		<h2 class="section-title">Custom Vocabulary & Prompts</h2>
		<p class="section-description">
			Improve transcription accuracy by adding domain-specific terms and context
		</p>

		<div class="setting-item">
			<span class="setting-label">Custom Vocabulary</span>
			<VocabularyManager
				vocabulary={$settings.custom_vocabulary}
				onChange={handleVocabularyChange}
			/>
			<p class="setting-description">
				Add specialized terms, acronyms, or proper nouns to improve recognition
			</p>
		</div>

		<div class="setting-item">
			<span class="setting-label">Context Prompt</span>
			<ContextPromptEditor
				contextPrompt={$settings.context_prompt}
				useContextPrompt={$settings.use_context_prompt}
				onContextPromptChange={handleContextPromptChange}
				onUseContextPromptChange={handleUseContextPromptChange}
			/>
		</div>
	</section>

	<!-- Model Management Section -->
	<section class="settings-section">
		<h2 class="section-title">Model Management</h2>
		<p class="section-description">Download or remove speech recognition models</p>

		{#if modelError}
			<div class="model-error">{modelError}</div>
		{/if}

		<div class="models-list">
			{#each availableModels as model}
				<div class="model-item" class:downloaded={isModelDownloaded(model.id)} class:active={$settings.model_id === model.id}>
					<div class="model-info">
						<span class="model-name">{model.name}</span>
						<span class="model-size">{model.size_mb}MB</span>
						<p class="model-description">{model.description}</p>
					</div>
					<div class="model-actions">
						{#if downloadingModelId === model.id}
							<div class="download-progress">
								<div class="progress-bar">
									<div class="progress-fill" style="width: {downloadProgress}%"></div>
								</div>
								<span class="progress-text">{Math.round(downloadProgress)}%</span>
							</div>
						{:else if isModelDownloaded(model.id)}
							{#if $settings.model_id === model.id}
								<span class="active-badge">Active</span>
							{:else}
								<button
									class="use-model-button"
									onclick={() => selectActiveModel(model.id)}
									data-testid="use-model-{model.id}"
								>
									Use
								</button>
								<button
									class="delete-model-button"
									onclick={() => deleteModel(model.id)}
									data-testid="delete-model-{model.id}"
								>
									Remove
								</button>
							{/if}
						{:else}
							<button
								class="download-model-button"
								onclick={() => downloadModel(model.id)}
								disabled={downloadingModelId !== null}
								data-testid="download-model-{model.id}"
							>
								Download
							</button>
						{/if}
					</div>
				</div>
			{/each}
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

	<!-- Preview Section -->
	<section class="settings-section">
		<h2 class="section-title">Preview Window</h2>
		<p class="section-description">Configure the floating preview window that shows transcribed text</p>

		<div class="setting-item">
			<label class="checkbox-label" data-testid="preview-enabled-toggle">
				<input
					type="checkbox"
					checked={$settings.preview_enabled}
					onchange={handlePreviewEnabledChange}
				/>
				<span>Show preview window after transcription</span>
			</label>
		</div>

		<div class="setting-item">
			<label class="setting-label" for="preview-duration">
				Display Duration: {$settings.preview_duration_secs}s
			</label>
			<input
				type="range"
				id="preview-duration"
				class="setting-slider"
				min="1"
				max="5"
				step="1"
				value={$settings.preview_duration_secs}
				oninput={handlePreviewDurationChange}
				disabled={!$settings.preview_enabled}
				data-testid="preview-duration-slider"
			/>
			<p class="setting-description">
				How long to show the preview window before auto-hiding (1-5 seconds)
			</p>
		</div>

		<div class="setting-item">
			<label class="checkbox-label" data-testid="preview-visualizer-toggle">
				<input
					type="checkbox"
					checked={$settings.preview_show_visualizer}
					onchange={handlePreviewVisualizerChange}
					disabled={!$settings.preview_enabled}
				/>
				<span>Show audio visualizer in preview</span>
			</label>
		</div>
	</section>

	<!-- Voice Commands Section -->
	<section class="settings-section">
		<h2 class="section-title">Voice Commands</h2>
		<p class="section-description">Convert spoken commands into punctuation, formatting, and editing actions</p>

		<div class="setting-item">
			<label class="checkbox-label" data-testid="voice-commands-enabled-toggle">
				<input
					type="checkbox"
					checked={$settings.voice_commands.enabled}
					onchange={handleVoiceCommandsEnabledChange}
				/>
				<span>Enable voice commands</span>
			</label>
			<p class="setting-description">
				Say "period", "comma", "new line", "new paragraph", "undo", etc.
			</p>
		</div>

		<div class="setting-item">
			<label class="checkbox-label" data-testid="voice-commands-require-prefix-toggle">
				<input
					type="checkbox"
					checked={$settings.voice_commands.require_prefix}
					onchange={handleVoiceCommandsRequirePrefixChange}
					disabled={!$settings.voice_commands.enabled}
				/>
				<span>Require prefix before commands</span>
			</label>
			<p class="setting-description">
				When enabled, say "{$settings.voice_commands.prefix} period" instead of just "period"
			</p>
		</div>

		<div class="setting-item">
			<label class="setting-label" for="voice-command-prefix">Command Prefix</label>
			<input
				type="text"
				id="voice-command-prefix"
				class="setting-input"
				value={$settings.voice_commands.prefix}
				onchange={handleVoiceCommandsPrefixChange}
				disabled={!$settings.voice_commands.enabled || !$settings.voice_commands.require_prefix}
				placeholder="command"
				data-testid="voice-command-prefix-input"
			/>
			<p class="setting-description">
				The word to say before each command (e.g., "command", "insert", "type")
			</p>
		</div>

		<div class="voice-commands-help">
			<h3 class="help-title">Available Commands</h3>
			<div class="commands-grid">
				<div class="command-group">
					<h4>Punctuation</h4>
					<ul>
						<li><code>period</code> / <code>full stop</code> - .</li>
						<li><code>comma</code> - ,</li>
						<li><code>question mark</code> - ?</li>
						<li><code>exclamation point</code> - !</li>
						<li><code>colon</code> - :</li>
						<li><code>semicolon</code> - ;</li>
					</ul>
				</div>
				<div class="command-group">
					<h4>Formatting</h4>
					<ul>
						<li><code>new line</code> - line break</li>
						<li><code>new paragraph</code> - paragraph break</li>
					</ul>
				</div>
				<div class="command-group">
					<h4>Editing</h4>
					<ul>
						<li><code>delete that</code> - backspace</li>
						<li><code>undo</code> - undo last action</li>
					</ul>
				</div>
			</div>
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

	<NavBar />
</div>

<style>
	.settings-page {
		padding: 1.5rem;
		padding-bottom: 5rem; /* Space for navbar */
		background: #0a0a0a;
		min-height: 100vh;
		color: #e5e5e5;
	}

	.sticky-header {
		position: sticky;
		top: 0;
		background: #0a0a0a;
		margin: -1.5rem -1.5rem 0 -1.5rem;
		padding: 1.5rem 1.5rem 0.5rem 1.5rem;
		z-index: 40;
	}

	.settings-title {
		font-size: 1.5rem;
		font-weight: 600;
		margin-bottom: 1rem;
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

	/* Model Management Styles */
	.section-description {
		font-size: 0.875rem;
		color: #737373;
		margin-bottom: 1rem;
	}

	.setting-description.warning {
		color: #f59e0b;
	}

	.setting-description.error-text {
		color: #ef4444;
	}

	.model-error {
		background: rgba(239, 68, 68, 0.1);
		border: 1px solid rgba(239, 68, 68, 0.3);
		color: #ef4444;
		padding: 0.75rem;
		border-radius: 6px;
		margin-bottom: 1rem;
		font-size: 0.875rem;
	}

	.models-list {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.model-item {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 1rem;
		background: #171717;
		border: 1px solid #262626;
		border-radius: 8px;
		gap: 1rem;
	}

	.model-item.downloaded {
		border-color: #22c55e33;
	}

	.model-item.active {
		border-color: #f4c43066;
		background: rgba(244, 196, 48, 0.05);
	}

	.model-info {
		flex: 1;
		min-width: 0;
	}

	.model-name {
		font-weight: 500;
		color: #e5e5e5;
	}

	.model-size {
		font-size: 0.75rem;
		color: #737373;
		margin-left: 0.5rem;
	}

	.model-description {
		font-size: 0.75rem;
		color: #737373;
		margin: 0.25rem 0 0 0;
	}

	.model-actions {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-shrink: 0;
	}

	.active-badge {
		font-size: 0.75rem;
		color: #f4c430;
		background: rgba(244, 196, 48, 0.1);
		padding: 0.25rem 0.5rem;
		border-radius: 4px;
	}

	.download-model-button {
		padding: 0.375rem 0.75rem;
		background: #f4c430;
		border: none;
		border-radius: 4px;
		color: #000;
		font-size: 0.8125rem;
		font-weight: 500;
		cursor: pointer;
		transition: background-color 0.2s ease;
	}

	.download-model-button:hover:not(:disabled) {
		background: #eab308;
	}

	.download-model-button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.use-model-button {
		padding: 0.375rem 0.75rem;
		background: #22c55e;
		border: none;
		border-radius: 4px;
		color: #000;
		font-size: 0.8125rem;
		font-weight: 500;
		cursor: pointer;
		transition: background-color 0.2s ease;
	}

	.use-model-button:hover {
		background: #16a34a;
	}

	.delete-model-button {
		padding: 0.375rem 0.75rem;
		background: #404040;
		border: none;
		border-radius: 4px;
		color: #e5e5e5;
		font-size: 0.8125rem;
		cursor: pointer;
		transition: background-color 0.2s ease;
	}

	.delete-model-button:hover {
		background: #7f1d1d;
		color: #fecaca;
	}

	.download-progress {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		min-width: 120px;
	}

	.progress-bar {
		flex: 1;
		height: 6px;
		background: #262626;
		border-radius: 3px;
		overflow: hidden;
	}

	.progress-fill {
		height: 100%;
		background: #f4c430;
		transition: width 0.3s ease;
	}

	.progress-text {
		font-size: 0.75rem;
		color: #737373;
		min-width: 35px;
		text-align: right;
	}

	/* Voice Commands Styles */
	.setting-input {
		width: 100%;
		max-width: 200px;
		padding: 0.5rem 0.75rem;
		background: #171717;
		border: 1px solid #262626;
		border-radius: 6px;
		color: #e5e5e5;
		font-size: 0.875rem;
	}

	.setting-input:focus {
		outline: none;
		border-color: #f4c430;
	}

	.setting-input:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.voice-commands-help {
		margin-top: 1.5rem;
		padding: 1rem;
		background: #171717;
		border: 1px solid #262626;
		border-radius: 8px;
	}

	.help-title {
		font-size: 0.875rem;
		font-weight: 500;
		color: #a3a3a3;
		margin-bottom: 1rem;
	}

	.commands-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
		gap: 1rem;
	}

	.command-group h4 {
		font-size: 0.8125rem;
		font-weight: 500;
		color: #e5e5e5;
		margin-bottom: 0.5rem;
	}

	.command-group ul {
		list-style: none;
		padding: 0;
		margin: 0;
	}

	.command-group li {
		font-size: 0.75rem;
		color: #737373;
		margin-bottom: 0.25rem;
	}

	.command-group code {
		background: #262626;
		padding: 0.125rem 0.375rem;
		border-radius: 4px;
		color: #f4c430;
		font-family: monospace;
		font-size: 0.6875rem;
	}
</style>
