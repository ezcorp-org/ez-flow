<script lang="ts">
  import { onMount } from 'svelte';

  let currentYear = new Date().getFullYear();
  let isMac = false;

  onMount(() => {
    isMac = navigator.platform.toLowerCase().includes('mac');
  });

  const features = [
    {
      icon: '🔒',
      title: '100% Local Processing',
      description: 'Your audio never leaves your device. Zero servers. Zero tracking. Zero BS.',
    },
    {
      icon: '⚡',
      title: 'Lightning Fast',
      description: 'GPU-accelerated transcription in under 3 seconds. NVIDIA, Apple Silicon, or CPU fallback.',
    },
    {
      icon: '🎯',
      title: 'Push-to-Talk',
      description: 'Hold your hotkey, speak, release. Text appears at your cursor. That simple.',
    },
    {
      icon: '🌍',
      title: '99+ Languages',
      description: 'Powered by OpenAI Whisper models. Auto-detect language or pick your own.',
    },
    {
      icon: '💰',
      title: 'Free Forever',
      description: 'Open source under MIT license. No subscriptions. No "premium tiers." Just works.',
    },
    {
      icon: '🖥️',
      title: 'Cross-Platform',
      description: 'Windows, macOS, and Linux. Same great experience everywhere.',
    },
  ];

  const steps = [
    {
      step: '1',
      title: 'Download & Install',
      description: 'Grab the installer for your OS. No account needed.',
    },
    {
      step: '2',
      title: 'Pick Your Model',
      description: 'Choose between speed (Tiny) and accuracy (Large). Download once, use forever.',
    },
    {
      step: '3',
      title: 'Press & Speak',
      description: 'Hold your hotkey, say what you want, release. Text appears instantly.',
    },
  ];

  const models = [
    { name: 'Tiny', size: '75 MB', speed: 'Fastest', accuracy: 'Basic' },
    { name: 'Base', size: '145 MB', speed: 'Fast', accuracy: 'Good' },
    { name: 'Small', size: '488 MB', speed: 'Medium', accuracy: 'Better' },
    { name: 'Medium', size: '1.5 GB', speed: 'Slow', accuracy: 'Great' },
    { name: 'Large', size: '3 GB', speed: 'Slowest', accuracy: 'Best' },
  ];
</script>

<!-- Navigation -->
<nav class="fixed top-0 left-0 right-0 z-50 bg-ez-dark/80 backdrop-blur-md border-b border-ez-border">
  <div class="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
    <a href="/" class="flex items-center gap-2 text-xl font-semibold">
      <img src="/logo.svg" alt="EZ Flow" class="w-8 h-8" />
      <span><span class="text-ez-yellow">EZ</span> Flow</span>
    </a>
    <div class="hidden md:flex items-center gap-6">
      <a href="#features" class="text-ez-muted hover:text-ez-text transition-colors link-underline">Features</a>
      <a href="#how-it-works" class="text-ez-muted hover:text-ez-text transition-colors link-underline">How it Works</a>
      <a href="#download" class="text-ez-muted hover:text-ez-text transition-colors link-underline">Download</a>
      <a
        href="https://github.com/ezcorp-org/ez-flow"
        target="_blank"
        rel="noopener noreferrer"
        class="text-ez-muted hover:text-ez-text transition-colors"
      >
        GitHub
      </a>
      <a
        href="https://discord.ezcorp.org"
        target="_blank"
        rel="noopener noreferrer"
        class="text-ez-muted hover:text-ez-purple transition-colors"
      >
        Discord
      </a>
      <a
        href="https://ezcorp.org"
        target="_blank"
        rel="noopener noreferrer"
        class="text-ez-yellow hover:text-ez-yellow-hover transition-colors font-medium"
      >
        EZCorp
      </a>
    </div>
    <a
      href="#download"
      class="bg-ez-yellow hover:bg-ez-yellow-hover text-ez-dark font-semibold px-4 py-2 rounded-md transition-colors btn-press"
    >
      Download Free
    </a>
  </div>
</nav>

<!-- Hero Section -->
<section class="hero-gradient min-h-screen flex items-center justify-center pt-16">
  <div class="max-w-6xl mx-auto px-6 py-24 text-center">
    <div class="animate-fade-in opacity-0">
      <span class="inline-block bg-ez-border text-ez-yellow px-3 py-1 rounded-full text-sm font-medium mb-6">
        Free & Open Source
      </span>
    </div>

    <h1 class="text-4xl md:text-6xl lg:text-7xl font-bold leading-tight mb-6 animate-fade-in opacity-0 animate-delay-100">
      Speech-to-Text.<br />
      <span class="text-ez-yellow">Local. Private. Fast.</span>
    </h1>

    <p class="text-xl md:text-2xl text-ez-muted max-w-2xl mx-auto mb-8 animate-fade-in opacity-0 animate-delay-200">
      Your voice never leaves your device. Powered by OpenAI Whisper, running 100% on your computer.
      No servers. No tracking. No BS.
    </p>

    <div class="flex flex-col sm:flex-row gap-4 justify-center items-center mb-12 animate-fade-in opacity-0 animate-delay-300">
      <a
        href="#download"
        class="bg-ez-yellow hover:bg-ez-yellow-hover text-ez-dark font-semibold px-8 py-4 rounded-lg text-lg transition-colors btn-press glow-yellow"
      >
        Download for Free
      </a>
      <a
        href="https://github.com/ezcorp-org/ez-flow"
        target="_blank"
        rel="noopener noreferrer"
        class="border border-ez-border hover:border-ez-muted text-ez-text px-8 py-4 rounded-lg text-lg transition-colors"
      >
        View on GitHub
      </a>
    </div>

    <!-- Demo visualization -->
    <div class="max-w-lg mx-auto bg-ez-border/50 rounded-xl p-6 border border-ez-border">
      <div class="flex items-center gap-4 mb-4">
        <div class="flex gap-1.5">
          <span class="w-3 h-3 rounded-full bg-red-500"></span>
          <span class="w-3 h-3 rounded-full bg-yellow-500"></span>
          <span class="w-3 h-3 rounded-full bg-green-500"></span>
        </div>
        <span class="text-ez-muted text-sm font-mono">EZ Flow</span>
      </div>
      <div class="flex items-center justify-center gap-2 py-8">
        <div class="flex items-end gap-1 h-12">
          {#each [1, 2, 3, 4, 5] as i}
            <div class="w-2 bg-ez-yellow rounded-full wave-bar" style="height: {20 + Math.random() * 30}px"></div>
          {/each}
        </div>
        <span class="text-ez-muted ml-4">Recording...</span>
      </div>
      <div class="flex items-center gap-2 text-sm text-ez-muted">
        <span>Press</span>
        <span class="kbd">{isMac ? '⌘' : 'Ctrl'}</span>
        <span class="kbd">Shift</span>
        <span class="kbd">Space</span>
        <span>to talk</span>
      </div>
    </div>
  </div>
</section>

<!-- Features Section -->
<section id="features" class="py-24 bg-ez-dark">
  <div class="max-w-6xl mx-auto px-6">
    <div class="text-center mb-16">
      <h2 class="text-3xl md:text-4xl font-bold mb-4">
        Everything you need. Nothing you don't.
      </h2>
      <p class="text-ez-muted text-lg max-w-2xl mx-auto">
        We obsess over removing friction, not adding features. Your time is valuable.
      </p>
    </div>

    <div class="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
      {#each features as feature}
        <div class="bg-ez-hover border border-ez-border rounded-xl p-6 card-hover">
          <span class="text-3xl mb-4 block">{feature.icon}</span>
          <h3 class="text-xl font-semibold mb-2">{feature.title}</h3>
          <p class="text-ez-muted">{feature.description}</p>
        </div>
      {/each}
    </div>
  </div>
</section>

<!-- How It Works -->
<section id="how-it-works" class="py-24 bg-ez-dark border-t border-ez-border">
  <div class="max-w-6xl mx-auto px-6">
    <div class="text-center mb-16">
      <h2 class="text-3xl md:text-4xl font-bold mb-4">
        3 clicks. That's it.
      </h2>
      <p class="text-ez-muted text-lg max-w-2xl mx-auto">
        If it takes more than 3 clicks, we screwed up.
      </p>
    </div>

    <div class="grid md:grid-cols-3 gap-8">
      {#each steps as step, i}
        <div class="relative">
          {#if i < steps.length - 1}
            <div class="hidden md:block absolute top-8 left-full w-full h-px bg-ez-border -translate-x-1/2"></div>
          {/if}
          <div class="bg-ez-hover border border-ez-border rounded-xl p-8 text-center card-hover">
            <div class="w-16 h-16 bg-ez-yellow text-ez-dark rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-6">
              {step.step}
            </div>
            <h3 class="text-xl font-semibold mb-3">{step.title}</h3>
            <p class="text-ez-muted">{step.description}</p>
          </div>
        </div>
      {/each}
    </div>
  </div>
</section>

<!-- Models Section -->
<section class="py-24 bg-ez-dark border-t border-ez-border">
  <div class="max-w-6xl mx-auto px-6">
    <div class="text-center mb-16">
      <h2 class="text-3xl md:text-4xl font-bold mb-4">
        Pick your perfect balance
      </h2>
      <p class="text-ez-muted text-lg max-w-2xl mx-auto">
        From lightning-fast to research-grade accuracy. Your computer, your choice.
      </p>
    </div>

    <div class="overflow-x-auto">
      <table class="w-full max-w-3xl mx-auto">
        <thead>
          <tr class="border-b border-ez-border">
            <th class="text-left py-4 px-4 font-semibold">Model</th>
            <th class="text-left py-4 px-4 font-semibold">Size</th>
            <th class="text-left py-4 px-4 font-semibold">Speed</th>
            <th class="text-left py-4 px-4 font-semibold">Accuracy</th>
          </tr>
        </thead>
        <tbody>
          {#each models as model, i}
            <tr class="border-b border-ez-border/50 hover:bg-ez-hover transition-colors">
              <td class="py-4 px-4 font-medium">{model.name}</td>
              <td class="py-4 px-4 text-ez-muted font-mono text-sm">{model.size}</td>
              <td class="py-4 px-4">
                <span class="inline-block px-2 py-1 rounded text-sm {i === 0 ? 'bg-ez-green/20 text-ez-green' : i === models.length - 1 ? 'bg-ez-purple/20 text-ez-purple' : 'bg-ez-border text-ez-muted'}">
                  {model.speed}
                </span>
              </td>
              <td class="py-4 px-4">
                <span class="inline-block px-2 py-1 rounded text-sm {i === models.length - 1 ? 'bg-ez-green/20 text-ez-green' : i === 0 ? 'bg-ez-border text-ez-muted' : 'bg-ez-yellow/20 text-ez-yellow'}">
                  {model.accuracy}
                </span>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </div>
</section>

<!-- Privacy Section -->
<section class="py-24 bg-ez-hover border-t border-ez-border">
  <div class="max-w-4xl mx-auto px-6 text-center">
    <span class="text-5xl mb-6 block">🔐</span>
    <h2 class="text-3xl md:text-4xl font-bold mb-6">
      Your voice. Your device. Period.
    </h2>
    <p class="text-xl text-ez-muted mb-8 max-w-2xl mx-auto">
      Unlike that $99/month tool that "accidentally" uploaded your tax returns to their servers,
      EZ Flow processes everything locally. We literally can't see your data even if we wanted to.
      (We don't want to.)
    </p>
    <div class="flex flex-wrap justify-center gap-4 text-sm">
      <span class="bg-ez-dark border border-ez-border px-4 py-2 rounded-full">No cloud uploads</span>
      <span class="bg-ez-dark border border-ez-border px-4 py-2 rounded-full">No account required</span>
      <span class="bg-ez-dark border border-ez-border px-4 py-2 rounded-full">No tracking</span>
      <span class="bg-ez-dark border border-ez-border px-4 py-2 rounded-full">No telemetry</span>
      <span class="bg-ez-dark border border-ez-border px-4 py-2 rounded-full">Open source</span>
    </div>
  </div>
</section>

<!-- Download Section -->
<section id="download" class="py-24 bg-ez-dark border-t border-ez-border">
  <div class="max-w-6xl mx-auto px-6">
    <div class="text-center mb-16">
      <h2 class="text-3xl md:text-4xl font-bold mb-4">
        Ready to make it EZ?
      </h2>
      <p class="text-ez-muted text-lg max-w-2xl mx-auto">
        Download for your platform. No signup. No credit card. Just speech-to-text that works.
      </p>
    </div>

    <div class="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
      <!-- Windows -->
      <div class="bg-ez-hover border border-ez-border rounded-xl p-8 text-center card-hover">
        <div class="text-4xl mb-4">🪟</div>
        <h3 class="text-xl font-semibold mb-2">Windows</h3>
        <p class="text-ez-muted text-sm mb-6">Windows 10 or later</p>
        <a
          href="https://github.com/ezcorp-org/ez-flow/releases/download/v0.1.0/EZ.Flow_0.1.0_x64-setup.exe"
          class="block bg-ez-yellow hover:bg-ez-yellow-hover text-ez-dark font-semibold px-6 py-3 rounded-lg transition-colors btn-press"
        >
          Download .exe
        </a>
        <a
          href="https://github.com/ezcorp-org/ez-flow/releases/latest"
          class="block text-ez-muted hover:text-ez-text text-xs mt-3 transition-colors"
        >
          or get .msi installer
        </a>
      </div>

      <!-- macOS -->
      <div class="bg-ez-hover border border-ez-border rounded-xl p-8 text-center card-hover">
        <div class="text-4xl mb-4">🍎</div>
        <h3 class="text-xl font-semibold mb-2">macOS</h3>
        <p class="text-ez-muted text-sm mb-4">macOS 12 or later</p>
        <a
          href="https://github.com/ezcorp-org/ez-flow/releases/download/v0.1.0/EZ.Flow_0.1.0_aarch64.dmg"
          class="block bg-ez-yellow hover:bg-ez-yellow-hover text-ez-dark font-semibold px-6 py-3 rounded-lg transition-colors btn-press"
        >
          Apple Silicon
        </a>
        <a
          href="https://github.com/ezcorp-org/ez-flow/releases/download/v0.1.0/EZ.Flow_0.1.0_x64.dmg"
          class="block border border-ez-border hover:border-ez-muted text-ez-text font-medium px-6 py-2 rounded-lg transition-colors mt-2"
        >
          Intel Mac
        </a>
      </div>

      <!-- Linux -->
      <div class="bg-ez-hover border border-ez-border rounded-xl p-8 text-center card-hover">
        <div class="text-4xl mb-4">🐧</div>
        <h3 class="text-xl font-semibold mb-2">Linux</h3>
        <p class="text-ez-muted text-sm mb-6">Ubuntu, Fedora, Arch, etc.</p>
        <a
          href="https://github.com/ezcorp-org/ez-flow/releases/download/v0.1.0/EZ.Flow_0.1.0_amd64.AppImage"
          class="block bg-ez-yellow hover:bg-ez-yellow-hover text-ez-dark font-semibold px-6 py-3 rounded-lg transition-colors btn-press"
        >
          Download AppImage
        </a>
        <a
          href="https://github.com/ezcorp-org/ez-flow/releases/latest"
          class="block text-ez-muted hover:text-ez-text text-xs mt-3 transition-colors"
        >
          .deb and .rpm also available
        </a>
      </div>
    </div>

    <p class="text-center text-ez-muted text-sm mt-8">
      v0.1.0 &middot; <a href="https://github.com/ezcorp-org/ez-flow/releases" class="text-ez-yellow hover:underline">Release Notes</a>
    </p>
  </div>
</section>

<!-- CTA Section -->
<section class="py-24 bg-gradient-to-b from-ez-dark to-ez-hover border-t border-ez-border">
  <div class="max-w-4xl mx-auto px-6 text-center">
    <h2 class="text-3xl md:text-5xl font-bold mb-6">
      Stop typing. Start talking.
    </h2>
    <p class="text-xl text-ez-muted mb-8">
      Join thousands of people who've ditched cloud services for local, private transcription.
    </p>
    <a
      href="#download"
      class="inline-block bg-ez-yellow hover:bg-ez-yellow-hover text-ez-dark font-semibold px-8 py-4 rounded-lg text-lg transition-colors btn-press glow-yellow"
    >
      Make it EZ
    </a>
  </div>
</section>

<!-- Footer -->
<footer class="py-12 bg-ez-hover border-t border-ez-border">
  <div class="max-w-6xl mx-auto px-6">
    <div class="flex flex-col md:flex-row justify-between items-center gap-6">
      <div class="flex items-center gap-3">
        <img src="/logo.svg" alt="EZ Flow" class="w-10 h-10" />
        <div>
          <span class="font-semibold text-xl"><span class="text-ez-yellow">EZ</span> Flow</span>
          <a href="https://ezcorp.org" target="_blank" rel="noopener noreferrer" class="text-ez-muted hover:text-ez-yellow text-sm ml-2 transition-colors">by EZCorp</a>
        </div>
      </div>

      <div class="flex flex-wrap items-center justify-center gap-6 text-ez-muted">
        <a href="https://ezcorp.org" target="_blank" rel="noopener noreferrer" class="text-ez-yellow hover:text-ez-yellow-hover transition-colors font-medium">
          EZCorp.org
        </a>
        <a href="https://discord.ezcorp.org" target="_blank" rel="noopener noreferrer" class="hover:text-ez-purple transition-colors">
          Discord
        </a>
        <a href="https://github.com/ezcorp-org/ez-flow" target="_blank" rel="noopener noreferrer" class="hover:text-ez-text transition-colors">
          GitHub
        </a>
        <a href="https://github.com/ezcorp-org/ez-flow/issues" target="_blank" rel="noopener noreferrer" class="hover:text-ez-text transition-colors">
          Report Bug
        </a>
      </div>
    </div>

    <div class="mt-8 pt-8 border-t border-ez-border flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-ez-muted">
      <p>&copy; {currentYear} EZCorp. MIT License.</p>
      <p class="italic">"If it's not EZ, it's not worth it."</p>
    </div>
  </div>
</footer>
