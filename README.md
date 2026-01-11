# Playwright Automation Framework

A powerful BDD test automation framework built with Playwright and TypeScript that runs Gherkin feature files directly without traditional step definition files.

## 🚀 Features

- **Direct Gherkin Execution**: Run `.feature` files directly with natural language parsing
- **Multi-Environment Supportie**: Test across dev, int, qa, and production environments
- **Parallel Execution**: Run tests concurrently for faster feedback
- **Smart Retries**: Automatic retry mechanism with configurable attempts
- **Rich Reporting**: Interactive HTML reports with screenshots and videos
- **Screenshot & Video Capture**: Automatic capture on failures with embedded viewing
- **Tag-Based Filterings**: Run specific test subsets using Cucumber tags
- **Background Steps**: Support for common setup steps across scenarios
- **Cross-Browser Testing**: Chrome, Firefox, and Safari support
- **Headless/Headed Modes**: Flexible execution modes for different needs

## 📋 Prereguisites

- Node js 16+
- npm or yarn
- TypeScript knowledge (basic)

## 📦 Installation

```bash
# Clone the repository
git clone <repository-url>
cd pw-automation

# Install dependencies
mpm install

# Install Playwright browsers
npx playwright install
```

## 🗂 Project Structure

```
pw-automation/
├── package.json
├── tsconfig.json
├── run-tests.ts                   # Main test runner
├── generate-html-reports.ts.      # HTML report generator
├── logs/
├── test-results/                  # Generated reports and artifacts
├── registries/                    # cached page elements
└── src/
    ├── config/                    # Environment configurations
    │   └── environment-manager.ts
    ├── features/                  # Gherkin feature files
    │   └── login_flow.feature
    ├── nlp/                       # step nlp train modal
    │   └── nlp-processor.ts
    ├── runner/                    # Test execution engine
    │   ├── runner.ts              # Runner class to execute single or all feature files
    │   └── scenario.ts
    ├── types/                     # TypeScript type definitions
    │   └── feature-types.ts
    └── utils/                     # Utility functions
        ├── action-recorder.ts     # Event capture logic
        ├── dom-analyzer.ts        # Shadow DOM & Iframe scanner
        ├── dom-debug-helper.ts
        ├── element-resolver.ts    # Smart discovery engine
        ├── launch-recoder.ts      # Recorder entry point
        ├── logger.ts              # logger util to log events
        ├── step-parser.ts         # parse feature file in to action, elementType, locator & value
        └── totp.ts                # linka and generate opt for a specific account
```

## ⚡ Quick Start

### Running Tests

```bash
# Auto generate click and fill steps
npm run record
```

### Running Tests

```bash
# Run all tests (default environment)
npm test

# Run tests in specific environment
npm run test:dev
npm run test:qa

# Run smoke tests only
npm run test:smoke
npm run test:smoke:qa

#Run single feature file
npm run test:single:dev -- --file=name.feature

# Run in headed mode (visible browser)
npm run test:headed
```

### Generate Reports

```bash
# Generate interactive HTML report
npm run report
```

The report will be available at 'test-results/test-report.html' with:

- 🗂 Expandable/collapsible features and scenarios
- 📸 Embedded screenshots for failed steps
- 🎥 Video recordings of test executions
- 📊 Comprehensive test statistics and timing

### Logs Location

The test execution logs will be available at `logs/test_run.log`
The error logs will be available at `logs/test_error.log`

## 📝 Writing Feature Files

Create `.feature` files in the `src/features/` directory using standard Gherkin syntax:

```gherkin
Feature: User Authentication Flows

  Background:
    Given user is on client website login page "/"

  Scenario: Successful login with valid credentials
    When user fill "user@example.com" in "email" input
    And user fill "password" in "password" input
    And user click "Log In" button
    Then user should be redirected to "dashboard"
  @smoke
  Scenario: Password reset flow
    When user click forgot "password" link
    Then user should be redirected to "forgot-password" page
    And user fill "user@example.com" in "email" input
    And user click "Next" button
```

## 🧩 Supported Step Patterns

The framework automatically interprets natural language steps:

### Navigation

- `Given user is on client website login page "/path"`
- `Then user should be redirected to "expected-url-part"`

### Form Interactions

- `When user fill "value" in "field-name" input`
- `When user click "Button Text" button`
- `When user click "Link Text" link`
- `When user select "Option" from "dropdown-name"`

### Assertions

- `Then user should see "Expected Text"`
- `Then user should be redirected to "expected-url-part"`

### ⚙️ Configuration

### Environment Setup

Create environment-specific configuration in `src/config`:

### Test Options

Configure test execution via command line arguments:

```bash
# Environment selection
-env=dev|qa|int|prod

# Single file execution
-Single -- --file=.feature

# Tag filtering
-tags=smoke,regression

# Browser selection
—browser=chromium|firefox|webkit

# Headless mode
-headless=true|false

# Retry configuration
-retries=3

# Parallel execution
.parallel=4
```

## 📊 Reporting & Debugging

### HTML Reports

Interactive HTML reports include:

- 📈 Test execution statistics and success rates
- ➕➖ Expandable test details with step-by-step breakdown
- 📸 Embedded screenshots for failed steps (click to enlarge)
- 🎥 Video recordings of test sessions
- ⚡ Quick navigation with expand/collapse controls

### Debug Information

For failed tests, the framework automatically captures:

- Full page screenshots
- DOM snapshots
- Browser console logs
- Network request details
- Video recordings

## 🔬 Advanced Usage

### Running with Custom Options

```bash
# Custom environment with specific browser
BROWSER=firefox npm run test:qa

# Headed mode with slow motion
HEADLESS=false SLOW_M0=1000 npm run test:dev

# Custom timeout and retries
TIMEOUT=20000 RETRIES=5 npm test
```

### Parallel Execution

```bash
# Run with 4 parallel workers
npm test -- --parallel=4

# Run specific tags in parallel
npm run test:smoke -- --parallel=2
```

## 💻 Development

### Adding New Step Patterns

Extend the step parser in `src/utils/step-parser.ts`:

```typescript
export function parseStep(stepText: string): StepAction {
  // Add new patterns here
  if (/user uploads? "([^"]+)" file/.test(stepText)) {
    return {
      action: 'upload',
      locator: extractQuoted(stepText)[0],
      elementType: 'file'
    }:
  }
  // ... existing patterns
}
```

### Custom Element Resolvers

Extend element resolution in 'src/utils/element-resolver.ts' for complex UI patterns.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/new-feature`
3. Make your changes and add tests
4. Commit your changes: `git commit -am 'Add new feature'`
5. Push to the branch: `git push origin feature/new-feature`
6. Submit a pull request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE] (LICENSE) file for details.

## 🔧 Troubleshooting

### Common Issues

**Tests timing out：**

```bash
# Increase timeout
TIMEOUT=30000 npm test
```

**Element not found:**

- Check element selectors in the DOM debug files
- Review screenshot captures in `test-results/screenshots/`

**Browser launch issues:**

```bash
# Reinstall browsers
npx playwright install —force
```

### Getting Help

1. Check the [logging/](logging/) directory for detailed logs
2. Review generated HTML reports for step-by-step execution details
3. Examine DOM debug captures for element resolution issues
4. Enable headed mode to see browser interactions: `npm run test:headed`

---

Built with ❤️ using [Playwright] (https://playwright.dev/) and [TypeScript] (https://www.typescriptlang.org/)
