# EZ Flow E2E Tests

End-to-end tests for EZ Flow using Playwright and Tauri Driver.

## Test Organization

Tests are organized by Epic, matching the PRD structure:

- `epic-1-foundation.spec.ts` - Foundation & Core Transcription (Stories 1.1-1.7)
- `epic-2-live-workflow.spec.ts` - Live Workflow & System Integration (Stories 2.1-2.8)
- `epic-3-polish.spec.ts` - Polish, Performance & Developer Tools (Stories 3.1-3.10)

## Running Tests

```bash
# Install dependencies
bun install

# Install Playwright browsers
bunx playwright install

# Run all E2E tests
bun run test:e2e

# Run with UI mode (for debugging)
bun run test:e2e:headed

# Run specific test file
bunx playwright test epic-1-foundation.spec.ts

# Run tests matching a pattern
bunx playwright test -g "Story 1.3"
```

## Test Architecture

### Global Setup/Teardown

- `global-setup.ts` - Starts the Tauri application before tests
- `global-teardown.ts` - Stops the application after tests

### Helpers

- `helpers.ts` - Common utilities for:
  - Test element selectors (`testIds`)
  - Navigation helpers
  - Recording/transcription helpers
  - Model management helpers

## Test Data

### Audio Fixtures

Place test audio files in `tests/fixtures/audio/`:
- `hello-world.wav` - Short "Hello World" recording for basic tests
- `long-speech.wav` - 30+ second recording for performance tests
- `multilingual.wav` - Non-English speech for language tests

### Mocking

Tests use Tauri IPC commands to mock:
- Audio input (when real microphone isn't available)
- GPU detection (for platform-specific tests)
- Update availability (for auto-update tests)
- Error conditions (for error handling tests)

## Test Data IDs

All testable elements should have `data-testid` attributes. See `helpers.ts` for the complete list of test IDs.

## Writing New Tests

1. Add tests to the appropriate Epic file
2. Use helpers from `helpers.ts` for common operations
3. Follow the existing pattern of `test.describe` for Stories
4. Include comments referencing the Acceptance Criteria being tested

Example:
```typescript
test.describe('Story X.Y: Feature Name', () => {
  test('should do something specific', async ({ page }) => {
    // ACX: Description of acceptance criteria
    // ... test implementation
  });
});
```

## CI Integration

Tests run automatically on:
- Pull requests
- Pushes to main branch
- Release branches

See `.github/workflows/ci.yml` for configuration.
