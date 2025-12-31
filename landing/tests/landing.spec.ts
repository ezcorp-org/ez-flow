import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:3001';

test.describe('Landing Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE_URL);
    // Wait for Svelte to mount
    await page.waitForSelector('#app');
  });

  test.describe('Page Load & Meta', () => {
    test('should load successfully with correct title', async ({ page }) => {
      await expect(page).toHaveTitle('EZ Flow - Local Speech-to-Text. No Cloud. No BS.');
    });

    test('should have correct meta description', async ({ page }) => {
      const description = await page.getAttribute('meta[name="description"]', 'content');
      expect(description).toContain('Free, open-source speech-to-text');
      expect(description).toContain('100% locally');
      expect(description).toContain('Privacy-first');
    });

    test('should load Google Fonts', async ({ page }) => {
      const fontLink = page.locator('link[href*="fonts.googleapis.com"]');
      await expect(fontLink).toBeAttached();
    });
  });

  test.describe('Navigation', () => {
    test('should display navigation bar', async ({ page }) => {
      const nav = page.locator('nav');
      await expect(nav).toBeVisible();
    });

    test('should have EZ Flow logo', async ({ page }) => {
      const logo = page.locator('nav a').first();
      await expect(logo).toContainText('EZ');
      await expect(logo).toContainText('Flow');
    });

    test('should have navigation links', async ({ page }) => {
      await expect(page.locator('nav a[href="#features"]')).toBeVisible();
      await expect(page.locator('nav a[href="#how-it-works"]')).toBeVisible();
      await expect(page.locator('nav a[href="#download"]')).toBeVisible();
    });

    test('should have GitHub link', async ({ page }) => {
      const githubLink = page.locator('nav a[href*="github.com"]');
      await expect(githubLink).toBeVisible();
    });

    test('should have Download CTA button in nav', async ({ page }) => {
      const ctaButton = page.locator('nav a[href="#download"]').last();
      await expect(ctaButton).toContainText('Download Free');
    });

    test('navigation links should scroll to sections', async ({ page }) => {
      await page.click('nav a[href="#features"]');
      await expect(page.locator('#features')).toBeInViewport();
    });
  });

  test.describe('Hero Section', () => {
    test('should display hero headline', async ({ page }) => {
      const headline = page.locator('h1');
      await expect(headline).toContainText('Speech-to-Text');
      await expect(headline).toContainText('Local. Private. Fast.');
    });

    test('should display Free & Open Source badge', async ({ page }) => {
      const badge = page.locator('text=Free & Open Source');
      await expect(badge).toBeVisible();
    });

    test('should display hero description', async ({ page }) => {
      const description = page.locator('section').first().locator('p').first();
      await expect(description).toContainText('Your voice never leaves your device');
      await expect(description).toContainText('No servers. No tracking. No BS.');
    });

    test('should have Download for Free CTA', async ({ page }) => {
      const cta = page.locator('a:has-text("Download for Free")');
      await expect(cta).toBeVisible();
      await expect(cta).toHaveAttribute('href', '#download');
    });

    test('should have View on GitHub button', async ({ page }) => {
      const githubButton = page.locator('a:has-text("View on GitHub")');
      await expect(githubButton).toBeVisible();
    });

    test('should display hotkey demo', async ({ page }) => {
      const hotkeyDemo = page.locator('text=Press');
      await expect(hotkeyDemo).toBeVisible();
      // Should have kbd elements
      const kbdElements = page.locator('.kbd');
      await expect(kbdElements).toHaveCount(3); // Ctrl/Cmd, Shift, Space
    });

    test('should display waveform animation', async ({ page }) => {
      const waveBars = page.locator('.wave-bar');
      await expect(waveBars).toHaveCount(5);
    });
  });

  test.describe('Features Section', () => {
    test('should have features section with id', async ({ page }) => {
      const featuresSection = page.locator('#features');
      await expect(featuresSection).toBeVisible();
    });

    test('should display features heading', async ({ page }) => {
      const heading = page.locator('#features h2');
      await expect(heading).toContainText("Everything you need. Nothing you don't.");
    });

    test('should display 6 feature cards', async ({ page }) => {
      const featureCards = page.locator('#features .card-hover');
      await expect(featureCards).toHaveCount(6);
    });

    test('should display key features', async ({ page }) => {
      await expect(page.locator('text=100% Local Processing')).toBeVisible();
      await expect(page.locator('text=Lightning Fast')).toBeVisible();
      await expect(page.locator('text=Push-to-Talk')).toBeVisible();
      await expect(page.locator('text=99+ Languages')).toBeVisible();
      await expect(page.locator('text=Free Forever')).toBeVisible();
      await expect(page.locator('text=Cross-Platform')).toBeVisible();
    });

    test('feature cards should have icons', async ({ page }) => {
      // Each card should have an emoji icon
      const featureSection = page.locator('#features');
      await expect(featureSection.locator('text=🔒')).toBeVisible();
      await expect(featureSection.locator('text=⚡')).toBeVisible();
      await expect(featureSection.locator('text=🎯')).toBeVisible();
      await expect(featureSection.locator('text=🌍')).toBeVisible();
      await expect(featureSection.locator('text=💰')).toBeVisible();
      await expect(featureSection.locator('text=🖥️')).toBeVisible();
    });
  });

  test.describe('How It Works Section', () => {
    test('should have how-it-works section with id', async ({ page }) => {
      const section = page.locator('#how-it-works');
      await expect(section).toBeVisible();
    });

    test('should display heading', async ({ page }) => {
      const heading = page.locator('#how-it-works h2');
      await expect(heading).toContainText("3 clicks. That's it.");
    });

    test('should display 3 steps', async ({ page }) => {
      await expect(page.locator('#how-it-works text=Download & Install')).toBeVisible();
      await expect(page.locator('#how-it-works text=Pick Your Model')).toBeVisible();
      await expect(page.locator('#how-it-works text=Press & Speak')).toBeVisible();
    });

    test('should display step numbers', async ({ page }) => {
      const stepNumbers = page.locator('#how-it-works .bg-ez-yellow');
      await expect(stepNumbers).toHaveCount(3);
    });
  });

  test.describe('Models Section', () => {
    test('should display models table', async ({ page }) => {
      const table = page.locator('table');
      await expect(table).toBeVisible();
    });

    test('should display all 5 models', async ({ page }) => {
      await expect(page.locator('td:has-text("Tiny")')).toBeVisible();
      await expect(page.locator('td:has-text("Base")')).toBeVisible();
      await expect(page.locator('td:has-text("Small")')).toBeVisible();
      await expect(page.locator('td:has-text("Medium")')).toBeVisible();
      await expect(page.locator('td:has-text("Large")')).toBeVisible();
    });

    test('should display model sizes', async ({ page }) => {
      await expect(page.locator('td:has-text("75 MB")')).toBeVisible();
      await expect(page.locator('td:has-text("145 MB")')).toBeVisible();
      await expect(page.locator('td:has-text("488 MB")')).toBeVisible();
      await expect(page.locator('td:has-text("1.5 GB")')).toBeVisible();
      await expect(page.locator('td:has-text("3 GB")')).toBeVisible();
    });

    test('should display table headers', async ({ page }) => {
      await expect(page.locator('th:has-text("Model")')).toBeVisible();
      await expect(page.locator('th:has-text("Size")')).toBeVisible();
      await expect(page.locator('th:has-text("Speed")')).toBeVisible();
      await expect(page.locator('th:has-text("Accuracy")')).toBeVisible();
    });
  });

  test.describe('Privacy Section', () => {
    test('should display privacy section', async ({ page }) => {
      const heading = page.locator('h2:has-text("Your voice. Your device. Period.")');
      await expect(heading).toBeVisible();
    });

    test('should display privacy badges', async ({ page }) => {
      await expect(page.locator('text=No cloud uploads')).toBeVisible();
      await expect(page.locator('text=No account required')).toBeVisible();
      await expect(page.locator('text=No tracking')).toBeVisible();
      await expect(page.locator('text=No telemetry')).toBeVisible();
      await expect(page.locator('span:has-text("Open source")')).toBeVisible();
    });

    test('should display lock icon', async ({ page }) => {
      const lockIcon = page.locator('text=🔐');
      await expect(lockIcon).toBeVisible();
    });
  });

  test.describe('Download Section', () => {
    test('should have download section with id', async ({ page }) => {
      const section = page.locator('#download');
      await expect(section).toBeVisible();
    });

    test('should display download heading', async ({ page }) => {
      const heading = page.locator('#download h2');
      await expect(heading).toContainText('Ready to make it EZ?');
    });

    test('should display Windows download card', async ({ page }) => {
      const windowsCard = page.locator('#download').locator('text=Windows').first();
      await expect(windowsCard).toBeVisible();
      const downloadLink = page.locator('a:has-text("Download .exe")');
      await expect(downloadLink).toBeVisible();
    });

    test('should display macOS download card', async ({ page }) => {
      const macCard = page.locator('#download').locator('text=macOS').first();
      await expect(macCard).toBeVisible();
      const downloadLink = page.locator('a:has-text("Download .dmg")');
      await expect(downloadLink).toBeVisible();
    });

    test('should display Linux download card', async ({ page }) => {
      const linuxCard = page.locator('#download').locator('text=Linux').first();
      await expect(linuxCard).toBeVisible();
      const downloadLink = page.locator('a:has-text("View Releases")');
      await expect(downloadLink).toBeVisible();
    });

    test('should display version and release notes link', async ({ page }) => {
      await expect(page.locator('#download').locator('text=v0.1.0')).toBeVisible();
      const releaseNotesLink = page.locator('a:has-text("Release Notes")');
      await expect(releaseNotesLink).toBeVisible();
    });

    test('download links should have correct hrefs', async ({ page }) => {
      const windowsLink = page.locator('a:has-text("Download .exe")');
      await expect(windowsLink).toHaveAttribute('href', /github.com.*windows.*exe/);

      const macLink = page.locator('a:has-text("Download .dmg")');
      await expect(macLink).toHaveAttribute('href', /github.com.*macos.*dmg/);
    });
  });

  test.describe('CTA Section', () => {
    test('should display final CTA', async ({ page }) => {
      const ctaHeading = page.locator('h2:has-text("Stop typing. Start talking.")');
      await expect(ctaHeading).toBeVisible();
    });

    test('should have Make it EZ button', async ({ page }) => {
      const ctaButton = page.locator('a:has-text("Make it EZ")');
      await expect(ctaButton).toBeVisible();
      await expect(ctaButton).toHaveAttribute('href', '#download');
    });
  });

  test.describe('Footer', () => {
    test('should display footer', async ({ page }) => {
      const footer = page.locator('footer');
      await expect(footer).toBeVisible();
    });

    test('should display EZ Flow branding', async ({ page }) => {
      const footer = page.locator('footer');
      await expect(footer.locator('text=EZ')).toBeVisible();
      await expect(footer.locator('text=Flow')).toBeVisible();
      await expect(footer.locator('text=by EZCorp')).toBeVisible();
    });

    test('should display footer links', async ({ page }) => {
      const footer = page.locator('footer');
      await expect(footer.locator('a[href*="github.com/ezcorp-org/ez-flow"]')).toBeVisible();
      await expect(footer.locator('a[href*="ezcorp.org"]')).toBeVisible();
      await expect(footer.locator('a:has-text("Report Bug")')).toBeVisible();
    });

    test('should display copyright', async ({ page }) => {
      const currentYear = new Date().getFullYear();
      await expect(page.locator(`text=${currentYear} EZCorp`)).toBeVisible();
    });

    test('should display tagline', async ({ page }) => {
      await expect(page.locator('text="If it\'s not EZ, it\'s not worth it."')).toBeVisible();
    });
  });

  test.describe('Responsive Design', () => {
    test('should be responsive on mobile', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto(BASE_URL);

      // Hero should still be visible
      await expect(page.locator('h1')).toBeVisible();

      // Download button should be visible
      await expect(page.locator('a:has-text("Download for Free")')).toBeVisible();
    });

    test('should be responsive on tablet', async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.goto(BASE_URL);

      await expect(page.locator('h1')).toBeVisible();
      await expect(page.locator('#features')).toBeVisible();
    });
  });

  test.describe('Accessibility', () => {
    test('should have proper heading hierarchy', async ({ page }) => {
      const h1Count = await page.locator('h1').count();
      expect(h1Count).toBe(1);

      const h2Count = await page.locator('h2').count();
      expect(h2Count).toBeGreaterThan(0);
    });

    test('should have lang attribute on html', async ({ page }) => {
      const html = page.locator('html');
      await expect(html).toHaveAttribute('lang', 'en');
    });

    test('links should have discernible text', async ({ page }) => {
      const links = page.locator('a');
      const count = await links.count();

      for (let i = 0; i < Math.min(count, 20); i++) {
        const link = links.nth(i);
        const text = await link.textContent();
        expect(text?.trim().length).toBeGreaterThan(0);
      }
    });
  });

  test.describe('Interactions', () => {
    test('should scroll smoothly when clicking nav links', async ({ page }) => {
      await page.click('nav a[href="#download"]');

      // Wait for scroll
      await page.waitForTimeout(500);

      const downloadSection = page.locator('#download');
      await expect(downloadSection).toBeInViewport();
    });

    test('buttons should have hover states', async ({ page }) => {
      const ctaButton = page.locator('a:has-text("Download for Free")').first();

      // Get initial background
      const initialBg = await ctaButton.evaluate((el) =>
        getComputedStyle(el).backgroundColor
      );

      await ctaButton.hover();
      await page.waitForTimeout(200);

      const hoverBg = await ctaButton.evaluate((el) =>
        getComputedStyle(el).backgroundColor
      );

      // Background should change on hover
      expect(initialBg).not.toBe(hoverBg);
    });

    test('cards should have hover transform', async ({ page }) => {
      const card = page.locator('.card-hover').first();

      const initialTransform = await card.evaluate((el) =>
        getComputedStyle(el).transform
      );

      await card.hover();
      await page.waitForTimeout(300);

      const hoverTransform = await card.evaluate((el) =>
        getComputedStyle(el).transform
      );

      // Transform should change on hover
      expect(initialTransform).not.toBe(hoverTransform);
    });
  });

  test.describe('Performance', () => {
    test('page should load within reasonable time', async ({ page }) => {
      const startTime = Date.now();
      await page.goto(BASE_URL);
      await page.waitForLoadState('networkidle');
      const loadTime = Date.now() - startTime;

      // Page should load in under 5 seconds
      expect(loadTime).toBeLessThan(5000);
    });
  });
});
