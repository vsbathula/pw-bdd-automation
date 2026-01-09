import { Browser, BrowserContext, Page } from "playwright";

// Core interfaces for the BDD framework

export interface Step {
  keyword: "Given" | "When" | "Then" | "And" | "But";
  text: string;
  line: number;
}

export interface Scenario {
  name: string;
  steps: Step[];
  tags: string[];
  line: number;
}

export interface Background {
  steps: Step[];
  line: number;
}

export interface Feature {
  name: string;
  description?: string;
  background?: Background;
  scenarios: Scenario[];
  tags: string[];
  filePath: string;
}

// Step definition types
export type StepDefinitionFunction = (
  this: TestContext,
  ...args: any[]
) => Promise<void> | void;

export interface StepDefinition {
  pattern: RegExp | string;
  fn: StepDefinitionFunction;
  keyword: "Given" | "When" | "Then";
}

// Environment configuration - flexible key-value pairs
export interface EnvironmentConfig {
  [key: string]: string | number | boolean | undefined;
}

// Test context for steps
export interface TestContext {
  browser: Browser;
  context: BrowserContext;
  page: Page;
  feature: Feature;
  scenario: Scenario;
  environment: EnvironmentConfig;
  attach: (
    data: string | Buffer,
    mediaType: string,
    name?: string
  ) => Promise<void>;
  // Helper functions
  screenshot: (name?: string) => Promise<string>;
  log: (message: string) => void;
  // Variables for sharing data between steps
  variables: { [key: string]: any };
}

// Execution options
export interface ExecutionOptions {
  environment: string;
  baseUrl: string;
  parallel?: boolean;
  maxParallel?: number;
  headless?: boolean;
  browser?: "chromium" | "firefox" | "webkit";
  timeout?: number;
  retries?: number;
  tags?: string[];
  excludeTags?: string[];
  screenshotOnFailure: boolean;
  video: boolean;
  reportDir: string;
}

// Embedding interface for attachments
export interface Embedding {
  data: string; // Base64 encoded data
  mime_type: string;
  name?: string;
}

// Test results
export interface StepResult {
  step: Step;
  status: "passed" | "failed" | "skipped" | "pending";
  duration: number;
  error?: Error;
  embeddings?: Embedding[];
}

export interface ScenarioResult {
  scenario: Scenario;
  steps: StepResult[];
  status: "passed" | "failed" | "skipped";
  duration: number;
  startTime: Date;
  endTime: Date;
  videoPath?: string;
  embeddings?: Embedding[];
}

export interface FeatureResult {
  feature: Feature;
  scenarios: ScenarioResult[];
  status: "passed" | "failed" | "skipped";
  duration: number;
}

export interface TestReport {
  features: FeatureResult[];
  summary: {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
    duration: number;
  };
  startTime: Date;
  endTime: Date;
}
