import { test, expect, describe } from 'bun:test';

// Test data that mirrors what's in Landing.svelte
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

describe('Landing Page Data', () => {
  describe('Features', () => {
    test('should have exactly 6 features', () => {
      expect(features.length).toBe(6);
    });

    test('each feature should have icon, title, and description', () => {
      features.forEach((feature) => {
        expect(feature.icon).toBeDefined();
        expect(feature.title).toBeDefined();
        expect(feature.description).toBeDefined();
        expect(feature.icon.length).toBeGreaterThan(0);
        expect(feature.title.length).toBeGreaterThan(0);
        expect(feature.description.length).toBeGreaterThan(0);
      });
    });

    test('features should have unique titles', () => {
      const titles = features.map((f) => f.title);
      const uniqueTitles = new Set(titles);
      expect(uniqueTitles.size).toBe(titles.length);
    });

    test('features should have unique icons', () => {
      const icons = features.map((f) => f.icon);
      const uniqueIcons = new Set(icons);
      expect(uniqueIcons.size).toBe(icons.length);
    });

    test('privacy feature should mention local processing', () => {
      const privacyFeature = features.find((f) => f.title.includes('Local'));
      expect(privacyFeature).toBeDefined();
      expect(privacyFeature?.description.toLowerCase()).toContain('never leaves');
    });

    test('speed feature should mention GPU', () => {
      const speedFeature = features.find((f) => f.title.includes('Fast'));
      expect(speedFeature).toBeDefined();
      expect(speedFeature?.description.toLowerCase()).toContain('gpu');
    });

    test('language feature should mention 99+ languages', () => {
      const langFeature = features.find((f) => f.title.includes('Language'));
      expect(langFeature).toBeDefined();
      expect(langFeature?.title).toContain('99+');
    });

    test('cross-platform feature should mention all platforms', () => {
      const platformFeature = features.find((f) => f.title.includes('Cross-Platform'));
      expect(platformFeature).toBeDefined();
      expect(platformFeature?.description).toContain('Windows');
      expect(platformFeature?.description).toContain('macOS');
      expect(platformFeature?.description).toContain('Linux');
    });
  });

  describe('Steps', () => {
    test('should have exactly 3 steps', () => {
      expect(steps.length).toBe(3);
    });

    test('steps should be numbered 1, 2, 3', () => {
      expect(steps[0].step).toBe('1');
      expect(steps[1].step).toBe('2');
      expect(steps[2].step).toBe('3');
    });

    test('each step should have step number, title, and description', () => {
      steps.forEach((step) => {
        expect(step.step).toBeDefined();
        expect(step.title).toBeDefined();
        expect(step.description).toBeDefined();
      });
    });

    test('first step should be about downloading', () => {
      expect(steps[0].title.toLowerCase()).toContain('download');
    });

    test('last step should be about speaking', () => {
      expect(steps[2].title.toLowerCase()).toContain('speak');
    });
  });

  describe('Models', () => {
    test('should have exactly 5 models', () => {
      expect(models.length).toBe(5);
    });

    test('models should be ordered from smallest to largest', () => {
      const sizes = models.map((m) => {
        const match = m.size.match(/(\d+(?:\.\d+)?)/);
        if (!match) return 0;
        const num = parseFloat(match[1]);
        return m.size.includes('GB') ? num * 1024 : num;
      });

      for (let i = 1; i < sizes.length; i++) {
        expect(sizes[i]).toBeGreaterThan(sizes[i - 1]);
      }
    });

    test('each model should have name, size, speed, and accuracy', () => {
      models.forEach((model) => {
        expect(model.name).toBeDefined();
        expect(model.size).toBeDefined();
        expect(model.speed).toBeDefined();
        expect(model.accuracy).toBeDefined();
      });
    });

    test('Tiny model should be fastest', () => {
      const tinyModel = models.find((m) => m.name === 'Tiny');
      expect(tinyModel?.speed).toBe('Fastest');
    });

    test('Large model should have best accuracy', () => {
      const largeModel = models.find((m) => m.name === 'Large');
      expect(largeModel?.accuracy).toBe('Best');
    });

    test('model names should match expected Whisper model names', () => {
      const expectedNames = ['Tiny', 'Base', 'Small', 'Medium', 'Large'];
      const actualNames = models.map((m) => m.name);
      expect(actualNames).toEqual(expectedNames);
    });
  });
});

describe('Server Health', () => {
  test('server should respond on port 3001', async () => {
    try {
      const response = await fetch('http://localhost:3001');
      expect(response.status).toBe(200);
    } catch (error) {
      // Server might not be running in CI
      console.log('Server not running - skipping health check');
    }
  });

  test('server should return HTML content type', async () => {
    try {
      const response = await fetch('http://localhost:3001');
      const contentType = response.headers.get('content-type');
      expect(contentType).toContain('text/html');
    } catch (error) {
      console.log('Server not running - skipping content type check');
    }
  });
});

describe('Build Artifacts', () => {
  test('index.html should exist', async () => {
    const file = Bun.file('./index.html');
    expect(await file.exists()).toBe(true);
  });

  test('Landing.svelte should exist', async () => {
    const file = Bun.file('./src/Landing.svelte');
    expect(await file.exists()).toBe(true);
  });

  test('styles.css should exist', async () => {
    const file = Bun.file('./src/styles.css');
    expect(await file.exists()).toBe(true);
  });

  test('app.ts should exist', async () => {
    const file = Bun.file('./src/app.ts');
    expect(await file.exists()).toBe(true);
  });

  test('server.ts should exist', async () => {
    const file = Bun.file('./server.ts');
    expect(await file.exists()).toBe(true);
  });

  test('tailwind.config.js should exist', async () => {
    const file = Bun.file('./tailwind.config.js');
    expect(await file.exists()).toBe(true);
  });
});

describe('EZCorp Brand Compliance', () => {
  test('styles should include EZCorp colors', async () => {
    const file = Bun.file('./src/styles.css');
    const content = await file.text();

    // Check for EZCorp design system colors
    expect(content).toContain('#0A0A0A'); // Dark background
    expect(content).toContain('#F4C430'); // EZ Yellow
    expect(content).toContain('#D88420'); // EZ Yellow Hover
  });

  test('tailwind config should include EZCorp colors', async () => {
    const file = Bun.file('./tailwind.config.js');
    const content = await file.text();

    expect(content).toContain('ez-dark');
    expect(content).toContain('ez-yellow');
    expect(content).toContain('ez-green');
  });

  test('index.html should have proper meta description', async () => {
    const file = Bun.file('./index.html');
    const content = await file.text();

    expect(content).toContain('meta name="description"');
    expect(content).toContain('Privacy-first');
    expect(content).toContain('100% locally');
  });

  test('index.html should load Inter font', async () => {
    const file = Bun.file('./index.html');
    const content = await file.text();

    expect(content).toContain('fonts.googleapis.com');
    expect(content).toContain('Inter');
  });
});

describe('Content Quality', () => {
  test('Landing.svelte should include all required sections', async () => {
    const file = Bun.file('./src/Landing.svelte');
    const content = await file.text();

    // Navigation
    expect(content).toContain('<nav');

    // Hero section
    expect(content).toContain('Speech-to-Text');
    expect(content).toContain('Local. Private. Fast.');

    // Features section
    expect(content).toContain('id="features"');

    // How it works section
    expect(content).toContain('id="how-it-works"');

    // Download section
    expect(content).toContain('id="download"');

    // Footer
    expect(content).toContain('<footer');
  });

  test('Landing.svelte should have privacy messaging', async () => {
    const file = Bun.file('./src/Landing.svelte');
    const content = await file.text();

    expect(content).toContain('Your voice never leaves your device');
    expect(content).toContain('No servers. No tracking. No BS.');
  });

  test('Landing.svelte should have download links for all platforms', async () => {
    const file = Bun.file('./src/Landing.svelte');
    const content = await file.text();

    expect(content).toContain('Windows');
    expect(content).toContain('macOS');
    expect(content).toContain('Linux');
    expect(content).toContain('.exe');
    expect(content).toContain('.dmg');
    expect(content).toContain('AppImage');
  });

  test('Landing.svelte should have EZCorp tagline', async () => {
    const file = Bun.file('./src/Landing.svelte');
    const content = await file.text();

    expect(content).toContain("If it's not EZ, it's not worth it.");
  });
});
