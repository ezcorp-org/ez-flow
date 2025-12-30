<script lang="ts">
	import { onMount } from 'svelte';
	import { invoke } from '@tauri-apps/api/core';
	import { listen } from '@tauri-apps/api/event';
	import { settings } from '$lib/stores/settings';
	import { getCurrentWindow } from '@tauri-apps/api/window';

	type Step = 'welcome' | 'permissions' | 'model' | 'hotkey' | 'success';

	let currentStep = $state<Step>('welcome');
	let micPermission = $state<'unknown' | 'granted' | 'denied'>('unknown');

	// Model state
	let models = $state<Array<{ id: string; name: string; size_mb: number; downloaded: boolean }>>([]);
	let selectedModelId = $state('base');
	let downloading = $state(false);
	let downloadProgress = $state(0);

	// Hotkey state
	let testResult = $state<string | null>(null);

	const steps: Step[] = ['welcome', 'permissions', 'model', 'hotkey', 'success'];
	$effect(() => {
		// Load settings on mount
		settings.init();
	});

	onMount(async () => {
		try {
			micPermission = await invoke<'unknown' | 'granted' | 'denied'>('check_microphone_permission');
		} catch {
			micPermission = 'unknown';
		}

		try {
			const availableModels = await invoke<
				Array<{ id: string; name: string; size_mb: number; downloaded: boolean }>
			>('get_available_models');
			models = availableModels;

			// If a model is already downloaded, preselect it
			const downloaded = models.find((m) => m.downloaded);
			if (downloaded) {
				selectedModelId = downloaded.id;
			}
		} catch (e) {
			console.error('Failed to get models:', e);
		}
	});

	function nextStep() {
		const idx = steps.indexOf(currentStep);
		if (idx < steps.length - 1) {
			currentStep = steps[idx + 1];
		}
	}

	function prevStep() {
		const idx = steps.indexOf(currentStep);
		if (idx > 0) {
			currentStep = steps[idx - 1];
		}
	}

	async function skipOnboarding() {
		await settings.updateField('onboarding_skipped', true);
		await closeWindow();
	}

	async function completeOnboarding() {
		await settings.updateField('onboarding_completed', true);
		await closeWindow();
	}

	async function closeWindow() {
		try {
			const win = getCurrentWindow();
			await win.close();
		} catch {
			// Ignore
		}
	}

	async function requestMicPermission() {
		// Try to trigger permission request by listing devices
		try {
			await invoke('get_audio_devices');
			micPermission = await invoke<'unknown' | 'granted' | 'denied'>('check_microphone_permission');
		} catch {
			micPermission = 'unknown';
		}
	}

	async function downloadModel() {
		downloading = true;
		downloadProgress = 0;

		const unlisten = await listen<{ progress: number }>('model:download_progress', (event) => {
			downloadProgress = event.payload.progress * 100;
		});

		try {
			await invoke('download_model', { modelId: selectedModelId });
			// Mark the model as downloaded in local state
			models = models.map((m) =>
				m.id === selectedModelId ? { ...m, downloaded: true } : m
			);
		} catch (e) {
			console.error('Download failed:', e);
		} finally {
			unlisten();
			downloading = false;
		}
	}

	function hasDownloadedModel(): boolean {
		return models.some((m) => m.downloaded);
	}
</script>

<div class="onboarding-page" data-testid="onboarding-wizard">
	<!-- Progress dots -->
	<div class="progress-dots">
		{#each steps as step, i}
			<div
				class="dot"
				class:active={steps.indexOf(currentStep) >= i}
				class:current={currentStep === step}
			></div>
		{/each}
	</div>

	<!-- Step Content -->
	<div class="step-content">
		{#if currentStep === 'welcome'}
			<div class="step welcome-step" data-testid="welcome-step">
				<div class="logo">
					<svg width="64" height="64" viewBox="0 0 200 200" fill="none">
						<circle cx="100" cy="100" r="95" fill="#0A0A0A"/>
						<circle cx="100" cy="100" r="95" fill="none" stroke="#F4C430" stroke-width="4"/>
						<rect x="82" y="40" width="36" height="80" rx="18" fill="#F4C430"/>
						<line x1="88" y1="55" x2="112" y2="55" stroke="#0A0A0A" stroke-width="2.5" stroke-linecap="round"/>
						<line x1="88" y1="67" x2="112" y2="67" stroke="#0A0A0A" stroke-width="2.5" stroke-linecap="round"/>
						<line x1="88" y1="79" x2="112" y2="79" stroke="#0A0A0A" stroke-width="2.5" stroke-linecap="round"/>
						<line x1="88" y1="91" x2="112" y2="91" stroke="#0A0A0A" stroke-width="2.5" stroke-linecap="round"/>
						<line x1="88" y1="103" x2="112" y2="103" stroke="#0A0A0A" stroke-width="2.5" stroke-linecap="round"/>
						<path d="M65 95 Q65 140 100 140 Q135 140 135 95" fill="none" stroke="#F4C430" stroke-width="6" stroke-linecap="round"/>
						<line x1="100" y1="140" x2="100" y2="165" stroke="#F4C430" stroke-width="6" stroke-linecap="round"/>
					</svg>
				</div>
				<h1>Welcome to EZ Flow</h1>
				<p class="description">
					Turn your voice into text instantly. Hold a hotkey, speak, and your words appear wherever
					you're typing.
				</p>
				<ul class="features">
					<li><span class="check">✓</span> 100% local - audio never leaves your device</li>
					<li><span class="check">✓</span> Works with any application</li>
					<li><span class="check">✓</span> Free and open source</li>
				</ul>
			</div>
		{:else if currentStep === 'permissions'}
			<div class="step permissions-step" data-testid="permissions-step">
				<div class="icon">🎤</div>
				<h2>Microphone Access</h2>
				<p class="description">EZ Flow needs access to your microphone to transcribe your speech.</p>

				{#if micPermission === 'granted'}
					<div class="permission-granted">
						<span class="check-circle">✓</span>
						<span>Microphone access granted</span>
					</div>
				{:else}
					<button class="primary-button" onclick={requestMicPermission}>
						Grant Microphone Access
					</button>
					<p class="hint">Click to request microphone permission from your system.</p>
				{/if}
			</div>
		{:else if currentStep === 'model'}
			<div class="step model-step" data-testid="model-step">
				<h2>Choose a Model</h2>
				<p class="description">
					Larger models are more accurate but slower. We recommend "Base" for most users.
				</p>

				<div class="model-list">
					{#each models as model}
						<label class="model-option" class:selected={selectedModelId === model.id}>
							<input type="radio" name="model" value={model.id} bind:group={selectedModelId} />
							<div class="model-info">
								<span class="model-name">
									{model.name}
									{#if model.id === 'base'}
										<span class="recommended">Recommended</span>
									{/if}
								</span>
								<span class="model-size">{model.size_mb} MB</span>
							</div>
							{#if model.downloaded}
								<span class="downloaded-badge">✓</span>
							{/if}
						</label>
					{/each}
				</div>

				{#if downloading}
					<div class="download-progress">
						<div class="progress-bar">
							<div class="progress-fill" style="width: {downloadProgress}%"></div>
						</div>
						<p class="progress-text">Downloading... {Math.round(downloadProgress)}%</p>
					</div>
				{:else if !hasDownloadedModel()}
					<button class="primary-button" onclick={downloadModel}>
						Download {models.find((m) => m.id === selectedModelId)?.name || 'Model'}
					</button>
				{:else}
					<p class="hint">You have a model downloaded. You can download more from Settings later.</p>
				{/if}
			</div>
		{:else if currentStep === 'hotkey'}
			<div class="step hotkey-step" data-testid="hotkey-step">
				<h2>Your Hotkey</h2>
				<p class="description">Press and hold this key combination to record and transcribe:</p>

				<div class="hotkey-display">
					<kbd>{$settings.hotkey}</kbd>
				</div>

				<p class="hint">
					You can change this in Settings anytime. Hold the hotkey, speak, and release to
					transcribe.
				</p>

				{#if testResult}
					<div class="test-result">
						<strong>Test result:</strong>
						{testResult}
					</div>
				{/if}
			</div>
		{:else if currentStep === 'success'}
			<div class="step success-step" data-testid="success-step">
				<div class="success-icon">🎉</div>
				<h2>You're All Set!</h2>
				<p class="description">EZ Flow is ready to use. Here are some quick tips:</p>

				<ul class="tips">
					<li>
						<strong>Recording:</strong> Hold <kbd>{$settings.hotkey}</kbd> to record, release to transcribe
					</li>
					<li><strong>Tray Menu:</strong> Right-click the tray icon for quick access</li>
					<li><strong>History:</strong> View past transcriptions from the tray menu</li>
					<li><strong>Settings:</strong> Customize hotkey, model, and more</li>
				</ul>
			</div>
		{/if}
	</div>

	<!-- Navigation -->
	<div class="navigation">
		<div class="nav-left">
			{#if currentStep !== 'welcome'}
				<button class="back-button" onclick={prevStep} data-testid="back-btn">Back</button>
			{/if}
		</div>

		<div class="nav-right">
			{#if currentStep !== 'success'}
				<button class="skip-button" onclick={skipOnboarding} data-testid="skip-btn">Skip</button>
			{/if}

			{#if currentStep === 'success'}
				<button class="primary-button" onclick={completeOnboarding} data-testid="finish-btn">
					Start Using EZ Flow
				</button>
			{:else}
				<button class="primary-button" onclick={nextStep} data-testid="next-btn">Next</button>
			{/if}
		</div>
	</div>
</div>

<style>
	.onboarding-page {
		display: flex;
		flex-direction: column;
		min-height: 100vh;
		background: #0a0a0a;
		color: #e5e5e5;
		padding: 2rem;
	}

	.progress-dots {
		display: flex;
		justify-content: center;
		gap: 0.5rem;
		margin-bottom: 2rem;
	}

	.dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: #404040;
		transition: background 0.2s;
	}

	.dot.active {
		background: #f4c430;
	}

	.dot.current {
		transform: scale(1.25);
	}

	.step-content {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.step {
		max-width: 480px;
		text-align: center;
	}

	.logo,
	.icon,
	.success-icon {
		margin-bottom: 1.5rem;
		display: flex;
		justify-content: center;
	}

	.icon {
		font-size: 3rem;
	}

	.success-icon {
		font-size: 4rem;
	}

	h1 {
		font-size: 2rem;
		font-weight: 700;
		margin-bottom: 1rem;
		color: #f4c430;
	}

	h2 {
		font-size: 1.5rem;
		font-weight: 600;
		margin-bottom: 0.75rem;
	}

	.description {
		color: #a3a3a3;
		font-size: 1.0625rem;
		line-height: 1.6;
		margin-bottom: 1.5rem;
	}

	.features,
	.tips {
		text-align: left;
		list-style: none;
		padding: 0;
		margin: 0;
	}

	.features li,
	.tips li {
		display: flex;
		align-items: flex-start;
		gap: 0.75rem;
		margin-bottom: 0.75rem;
		color: #d4d4d4;
	}

	.check {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 1.5rem;
		height: 1.5rem;
		background: rgba(34, 197, 94, 0.2);
		color: #22c55e;
		border-radius: 50%;
		font-size: 0.75rem;
		flex-shrink: 0;
	}

	.tips li {
		flex-direction: column;
		gap: 0.25rem;
		background: #171717;
		padding: 0.75rem 1rem;
		border-radius: 8px;
	}

	.tips li strong {
		color: #f4c430;
	}

	kbd {
		display: inline-block;
		padding: 0.25rem 0.5rem;
		background: #262626;
		border: 1px solid #404040;
		border-radius: 4px;
		font-family: monospace;
		font-size: 0.875rem;
	}

	.permission-granted {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		background: rgba(34, 197, 94, 0.15);
		color: #22c55e;
		padding: 1rem;
		border-radius: 8px;
		margin-top: 1rem;
	}

	.check-circle {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 1.5rem;
		height: 1.5rem;
		background: #22c55e;
		color: black;
		border-radius: 50%;
		font-size: 0.75rem;
	}

	.model-list {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		margin-bottom: 1.5rem;
		text-align: left;
	}

	.model-option {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 1rem;
		background: #171717;
		border: 2px solid transparent;
		border-radius: 8px;
		cursor: pointer;
		transition:
			border-color 0.2s,
			background 0.2s;
	}

	.model-option:hover {
		background: #1f1f1f;
	}

	.model-option.selected {
		border-color: #f4c430;
	}

	.model-option input {
		accent-color: #f4c430;
	}

	.model-info {
		flex: 1;
		display: flex;
		justify-content: space-between;
	}

	.model-name {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.recommended {
		font-size: 0.75rem;
		color: #f4c430;
		background: rgba(244, 196, 48, 0.15);
		padding: 0.125rem 0.5rem;
		border-radius: 4px;
	}

	.model-size {
		color: #737373;
		font-size: 0.875rem;
	}

	.downloaded-badge {
		color: #22c55e;
		font-size: 1.25rem;
	}

	.download-progress {
		margin-top: 1rem;
	}

	.progress-bar {
		height: 8px;
		background: #262626;
		border-radius: 4px;
		overflow: hidden;
	}

	.progress-fill {
		height: 100%;
		background: #f4c430;
		transition: width 0.3s ease;
	}

	.progress-text {
		margin-top: 0.5rem;
		color: #a3a3a3;
		font-size: 0.875rem;
	}

	.hotkey-display {
		margin: 2rem 0;
	}

	.hotkey-display kbd {
		font-size: 1.5rem;
		padding: 0.75rem 1.5rem;
		background: #171717;
	}

	.hint {
		color: #737373;
		font-size: 0.875rem;
		margin-top: 1rem;
	}

	.test-result {
		margin-top: 1.5rem;
		padding: 1rem;
		background: #171717;
		border-radius: 8px;
		text-align: left;
	}

	.navigation {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding-top: 2rem;
	}

	.nav-left,
	.nav-right {
		display: flex;
		gap: 0.75rem;
	}

	.primary-button {
		padding: 0.75rem 1.5rem;
		background: #f4c430;
		color: #000;
		border: none;
		border-radius: 8px;
		font-size: 1rem;
		font-weight: 600;
		cursor: pointer;
		transition: background 0.2s;
	}

	.primary-button:hover {
		background: #eab308;
	}

	.back-button,
	.skip-button {
		padding: 0.75rem 1.5rem;
		background: transparent;
		color: #737373;
		border: none;
		border-radius: 8px;
		font-size: 1rem;
		cursor: pointer;
		transition: color 0.2s;
	}

	.back-button:hover,
	.skip-button:hover {
		color: #a3a3a3;
	}
</style>
