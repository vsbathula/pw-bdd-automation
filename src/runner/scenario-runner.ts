import {
  chromium,
  firefox,
  webkit,
  Browser,
  BrowserContext,
  Page,
} from "playwright";
import {
  Feature,
  Scenario,
  Step,
  TestContext,
  ScenarioResult,
  StepResult,
  ExecutionOptions,
  Embedding,
} from "../types/feature-types";
import { environmentManager } from "../config/environment-manager";
import Logger from "../utils/logger";
import { parseStep, StepAction } from "../utils/step-parser";
import { ElementResolver } from "../utils/element-resolver";
import { DOMDebugHelper } from "../utils/dom-debug-helper";
import * as path from "path";
import * as fs from "fs";

export class ScenarioRunner {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private logger = new Logger();
  private options: ExecutionOptions;
  private elementResolver = new ElementResolver();

  constructor(options: ExecutionOptions) {
    this.options = options;

    // Set environment and load config
    environmentManager.setEnvironment(options.environment);

    // Log current configuration
    // environmentManager, LogConfig (true) i
  }

  async setup() {
    this.logger.info(
      `Setting up browser for environments ${environmentManager.getCurrentEnvironment()}`
    );

    // Get browser settings from environment or options
    const browserType =
      this.options.browser ||
      (environmentManager.getString("BROWSER", "chromium") as
        | "chromium"
        | "firefox"
        | "webkit");
    const headless =
      this.options.headless ?? environmentManager.getBoolean("HEADLESS", true);
    const slowMo = environmentManager.getNumber("SLOW_MO", 0);
    const launchOptions: any = {
      headless,
      slowMo,
      args: headless ? [] : ["--start-maximized"],
    };

    switch (browserType) {
      case "firefox":
        this.browser = await firefox.launch(launchOptions);
        break;
      case "webkit":
        this.browser = await webkit.launch(launchOptions);
        break;
      default:
        this.browser = await chromium.launch(launchOptions);
    }
    this.logger.info(
      `Browser launched for environment: ${environmentManager.getCurrentEnvironment()}`
    );

    // // Get baseURL from options or environment
    // const baseURL =
    //   this.options.baseUrl || environmentManager.getString("BASE_URL");

    // // Create context with video recording if enabled
    // const contextOptions: any = {
    //   baseURL,
    // };

    // // Set viewport if defined in environment
    // const viewportWidth = environmentManager.getNumber("VIEWPORT_WIDTH");
    // const viewportHeight = environmentManager.getNumber("VIEWPORT_HEIGHT");
    // if (viewportWidth && viewportHeight) {
    //   contextOptions.viewport = {
    //     width: viewportWidth,
    //     height: viewportHeight,
    //   };
    // }

    // // Enable video recording if configured
    // const enableVideo =
    //   this.options.video ??
    //   environmentManager.getBoolean(" ENABLE_VIDEO", false);
    // if (enableVideo) {
    //   contextOptions.recordVideo = {
    //     dir: path.join(this.options.reportDir, "videos"),
    //     size: contextOptions.viewport || { width: 1280, height: 720 },
    //   };
    // }

    // // Enable tracing if configured
    // if (environmentManager.getBoolean("ENABLE_TRACING", false)) {
    //   contextOptions.recordTrace = {
    //     dir: path.join(this.options.reportDir, "traces"),
    //   };
    // }

    // this.context = await this.browser.newContext(contextOptions);
    // this.page = await this.context.newPage();

    // // Set timeout from environment or options
    // const timeout =
    //   this.options.timeout || environmentManager.getNumber("TIMEOUT", 30000);
    // this.page.setDefaultTimeout(timeout);

    // // Navigate to baseURL automatically (like Playwright's behavior)
    // this.logger.info(`Navigating to base URL: ${baseURL}`);
    // await this.page.goto(baseURL);
  }

  async teardown() {
    // await this.context?.close();
    await this.browser?.close();
  }

  async runScenario(
    feature: Feature,
    scenario: Scenario
  ): Promise<ScenarioResult> {
    const startTime = new Date();
    const embeddings: Embedding[] = [];
    this.logger.info(`\n ▶️ Running scenario: ${scenario.name}`);
    let status: "passed" | "failed" | "skipped" = "passed";
    let videoPath: string | undefined;
    const stepResults: StepResult[] = [];

    // Create a new context for each scenario to get individual videos
    const scenarioContext = await this.createScenarioContext(scenario.name);
    const scenarioPage = await scenarioContext.newPage();

    // Set timeout from environment or options
    const timeout =
      this.options.timeout || environmentManager.getNumber("TIMEOUT", 10000);
    scenarioPage.setDefaultTimeout(timeout);

    const testContext: TestContext = {
      browser: this.browser!,
      context: scenarioContext,
      page: scenarioPage,
      feature,
      scenario,
      variables: {},
      environment: environmentManager.getCurrentConfig(),
      attach: this.createAttachFunction(scenario.name, embeddings),
      screenshot: this.createScreenshotFunction(scenario.name, embeddings),
      log: (message: string) => this.logger.info(message),
    };

    try {
      // Navigate to base URL for the scenario page
      const baseURL =
        this.options.baseUrl || environmentManager.getString("BASE_URL");
      this.logger.info(`Navigating scenario page to base URL: ${baseURL}`);
      await scenarioPage.goto(baseURL);

      // Execute background steps if present
      if (feature.background) {
        this.logger.info(" Processing background steps...");
        for (const step of feature.background.steps) {
          const result = await this.executeStepWithRetries(step, testContext);
          stepResults.push(result);
          if (result.status === "failed") {
            status = "failed";
            break;
          }
        }
      }

      // Process scenario steps only if background passed
      if (status != "failed") {
        // Execute scenario steps
        for (const step of scenario.steps) {
          const result = await this.executeStepWithRetries(step, testContext);
          stepResults.push(result);
          if (result.status === "failed") {
            status = "failed";
            break;
          }
        }
      }

      const endTime = new Date();
      // const status = stepResults.some((r) => r.status === "failed" ) ? "failed" : "passed";

      this.logger.info(`Scenario ${status}: ${scenario.name}`);
      videoPath = await this.getVideoPath(scenarioPage, scenario.name);
      return {
        scenario,
        steps: stepResults,
        status,
        duration: endTime.getTime() - startTime.getTime(),
        startTime,
        endTime,
        videoPath,
        embeddings,
      };
    } catch (error) {
      this.logger.error(
        `Scenario failed: ${scenario.name}: ${(error as Error).message}`
      );

      const enableScreenshots =
        this.options.screenshotOnFailure ??
        environmentManager.getBoolean("ENABLE_SCREENSHOTS", true);
      if (enableScreenshots) {
        await this.takeScreenshotForPage(scenarioPage, scenario.name);
      }

      // Get video path even for failed scenarios
      videoPath = await this.getVideoPath(scenarioPage, scenario.name);
      return {
        scenario,
        steps: stepResults,
        status: "failed",
        duration: new Date().getTime() - startTime.getTime(),
        startTime,
        endTime: new Date(),
        videoPath,
        embeddings,
      };
    } finally {
      // Close the scenario-specific context to save the video
      await scenarioContext.close();
    }
  }

  private async createScenarioContext(
    scenarioName: string
  ): Promise<BrowserContext> {
    // Get baseURL from options or environment
    const baseURL =
      this.options.baseUrl || environmentManager.getString("BASE_URL");

    // Create context with video recording for this specific scenario
    const contextOptions: any = {
      baseURL,
    };

    // Set viewport if defined in environment
    const viewportWidth = environmentManager.getNumber("VIEWPORT_WIDTH");
    const viewportHeight = environmentManager.getNumber("VIEWPORT_HEIGHT");

    if (viewportWidth && viewportHeight) {
      contextOptions.viewport = {
        width: viewportWidth,
        height: viewportHeight,
      };
    }

    // Enable video recording with scenario-specific name
    const enableVideo =
      this.options.video ?? environmentManager.getBoolean("ENABLE_VIDEO", true);

    if (enableVideo) {
      const videoDir = path.join(this.options.reportDir, "videos");
      if (fs.existsSync(videoDir)) {
        fs.mkdirSync(videoDir, { recursive: true });
      }

      contextOptions.recordVideo = {
        dir: videoDir,
        size: contextOptions.viewport || { width: 1280, height: 720 },
      };
    }

    // Enable tracing if configured
    if (environmentManager.getBoolean("ENABLE_TRACING", false)) {
      const traceDir = path.join(this.options.reportDir, "traces");
      if (!fs.existsSync(traceDir)) {
        fs.mkdirSync(traceDir, { recursive: true });
      }
      contextOptions.recordTrace = {
        dir: traceDir,
      };
    }
    return await this.browser!.newContext(contextOptions);
  }

  private async getVideoPath(
    page: Page,
    scenarioName: string
  ): Promise<string | undefined> {
    try {
      const enableVideo =
        this.options.video ??
        environmentManager.getBoolean("ENABLE_VIDEO", true);
      if (!enableVideo) return undefined;
      // Get the video path from the page (Playwright saves it automatically)
      const videoPath = await page.video()?.path();
      if (videoPath) {
        // Return relative path from report directory
        const relativePath = path.relative(this.options.reportDir, videoPath);
        this.logger.info(`📹 Video saved: ${relativePath}`);
        return relativePath;
      }
    } catch (error) {
      this.logger.error(
        `Failed to get video path: ${(error as Error).message}`
      );
    }
    return undefined;
  }

  private async addScreenshotEmbedding(
    screenshotPath: string,
    embeddings: Embedding[]
  ): Promise<void> {
    try {
      const fullPath = path.join(this.options.reportDir, screenshotPath);
      if (fs.existsSync(fullPath)) {
        const imageData = fs.readFileSync(fullPath);
        const embedding: Embedding = {
          data: imageData.toString("base64"),
          mime_type: "image/png",
          name: path.basename(screenshotPath, ".png"),
        };
        embeddings.push(embedding);
      }
    } catch (error) {
      this.logger.error(
        `Failed to add screenshot embedding: ${(error as Error).message}`
      );
    }
  }

  private async executeStepWithRetries(
    step: Step,
    context: TestContext
  ): Promise<StepResult> {
    const maxRetries =
      this.options.retries || environmentManager.getNumber("RETRIES", 2);
    let lastError: Error | undefined;
    let firstFailure = true;
    const stepEmbeddings: Embedding[] = [];
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const result = await this.executeStep(step, context);
        if (stepEmbeddings.length > 0) {
          result.embeddings = stepEmbeddings;
        }
        return result;
      } catch (error) {
        lastError = error as Error;

        // Take screenshot on first failure(attempt 0)
        if (firstFailure) {
          const enableScreenshots = environmentManager.getBoolean(
            "ENABLE_SCREENSHOTS",
            true
          );
          if (enableScreenshots) {
            const screenshotPath = await this.takeScreenshotForPage(
              context.page,
              `FIRST_FAILURE_${step.keyword}_${step.text.replace(/\s+/g, "_")}`
            );

            // Add screenshot as embedding
            if (screenshotPath) {
              await this.addScreenshotEmbedding(screenshotPath, stepEmbeddings);
            }

            // Add debug capture here
            await DOMDebugHelper.capturePageInfo(
              context.page,
              `FIRST_FAILURE_${step.keyword}_${step.text.replace(/\s+/g, "_")}`,
              this.options.reportDir
            );
          }
          firstFailure = false;
        }
        if (attempt < maxRetries) {
          this.logger.warn(
            `Step failed, retrying (${attempt + 1}/${maxRetries}): ${
              step.keyword
            } ${step.text}`
          );
          await this.page?.waitForTimeout(1000);
        }
      }
    }

    if (maxRetries > 0) {
      // All retries failed
      const enableScreenshots = environmentManager.getBoolean(
        "ENABLE_SCREENSHOTS",
        true
      );
      if (enableScreenshots) {
        const screenshotPath = await this.takeScreenshotForPage(
          context.page,
          `FINAL_FAILURE_${step.keyword}_${step.text.replace(/\s+/g, "_")}`
        );

        // Add final screenshot as embedding
        if (screenshotPath) {
          await this.addScreenshotEmbedding(screenshotPath, stepEmbeddings);
        }

        // Add debug capture here
        await DOMDebugHelper.capturePageInfo(
          context.page,
          `FInal_FAILURE_${step.keyword}_${step.text.replace(/\s+/g, "_")}`,
          this.options.reportDir
        );
      }
    }
    return {
      step,
      status: "failed",
      duration: 0,
      error: this.serializeError(lastError!),
      embeddings: stepEmbeddings.length > 0 ? stepEmbeddings : undefined,
    };
  }

  private async executeStep(
    step: Step,
    context: TestContext
  ): Promise<StepResult> {
    const startTime = Date.now();
    this.logger.info(`Executing: ${step.keyword} ${step.text}`);
    await this.interpretStep(step, context);
    return {
      step,
      status: "passed",
      duration: Date.now() - startTime,
    };
  }

  private async interpretStep(step: Step, context: TestContext) {
    const { page } = context;
    const fullStepText = `${step.keyword} ${step.text}`;
    try {
      // Parse the step using the new parser
      const actionObj: StepAction = await parseStep(fullStepText);
      this.logger.info(
        `Parsed step action: ${actionObj.action}, locator: ${actionObj.locator}, elementType: ${actionObj.elementType}`
      );
      switch (actionObj.action) {
        case "navigate":
          const url = actionObj.value!.startsWith("http")
            ? actionObj.value!
            : `${this.options.baseUrl}${actionObj.value!}`;
          await page.goto(url, { waitUntil: "networkidle" });
          // Wait for any potential redirects to complete
          await this.waitForPageStable(page);
          break;
        case "fill":
          const fillLocator = await this.elementResolver.resolve(
            page,
            actionObj.locator!,
            actionObj.elementType
          );
          await fillLocator.fill(actionObj.value!);
          // Wait for any potential response/redirect after filling
          await this.waitForPageStable(page, { short: true });
          break;
        case "click":
          const clickLocator = await this.elementResolver.resolve(
            page,
            actionObj.locator!,
            actionObj.elementType
          );
          // Get current URL before click to detect redirects
          const currenturl = page.url();
          await clickLocator.click();
          // Wait for potential redirect/navigation after click
          await this.waitForRedirectOrPageStable(page, currenturl);
          break;
        case "select":
          const selectLocator = await this.elementResolver.resolve(
            page,
            actionObj.locator!,
            actionObj.elementType
          );
          await selectLocator.selectOption({ label: actionObj.value! });
          // Wait for any potential response/redirect after filling
          await this.waitForPageStable(page, { short: true });
          break;
        case "assertText":
          // Try multiple assertion strategies
          try {
            await page.waitForLoadState("domcontentloaded");
            await page.waitForSelector(`text=${actionObj.value}`);
            this.logger.info(
              `Assertion passed: text "${actionObj.value}" is visible on the page.`
            );
          } catch {
            this.logger.error(
              `Assertion failed: could not find text "${actionObj.value}"`
            );
            throw new Error(
              `Assertion failed: could not find text "${actionObj.value}"`
            );
          }
          break;
        case "assertUrl":
          await this.waitForUrlStable(page, actionObj.value!);
          break;
        default:
          throw new Error(`Unknown action: ${actionObj.action}`);
      }
    } catch (error) {
      const errorMessage = (error as Error).message;
      if (
        errorMessage.includes("Unable to parse step") ||
        errorMessage.includes("Unknown action")
      ) {
        // This is a parsing/recognition error - use generic message
        this.logger.error(`Parser failed, ${errorMessage}`);
        throw new Error(
          `Unrecognized steps: ${step.keyword} ${step.text}, Please implement this step or check the step definition.`
        );
      } else {
        // This is an execution error (Like Playwright timeout) - preserve the original error
        this.logger.error(`Step execution failed: ${errorMessage}`);
        throw error;
      }
    }
  }

  private serializeError(error: Error): any {
    const serialized: any = {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
    // Safely check for cause property
    if ("cause" in error && (error as any).cause) {
      serialized.cause = (error as any).cause;
    }
    return serialized;
  }

  /**
   * Wait for page to become stable after potential redirects
   * */
  private async waitForPageStable(
    page: Page,
    options?: { short?: boolean; timeout?: number }
  ): Promise<void> {
    const timeout = options?.timeout || (options?.short ? 3000 : 10000);
    try {
      // Wait for network to be idle (no requests for 500ms)
      await page.waitForLoadState("networkidle", { timeout });

      // Additional wait for DOM to stabilize
      await page.waitForLoadState("domcontentloaded", { timeout });
      this.logger.info("Page stabilized after navigation/action");
    } catch (error) {
      this.logger.warn(`Page stability timeout (${timeout}ms), continuing...`);
    }
  }

  /*
   * Wait for redirect or page stability after an action
   */
  private async waitForRedirectOrPageStable(
    page: Page,
    previousUrl: string
  ): Promise<void> {
    try {
      // First, check if URL changed (indicating redirect)
      const urlChanged = await this.waitForUrlChange(page, previousUrl, 2000);
      if (urlChanged) {
        this.logger.info(`Redirect detected: ${previousUrl} -> ${page.url()}`);
        // If redirected, wait for the new page to fully load
        await this.waitForPageStable(page);
      } else {
        // No redirect, just ensure page is stable
        await this.waitForPageStable(page, { short: true });
      }
    } catch (error) {
      this.logger.warn(
        `Error waiting for redirect/stability: ${(error as Error).message}`
      );
      // Fallback. to basic wait
      await page.waitForLoadState("domcontentloaded");
    }
  }

  /*
   * Wait for URL to change from the previous URL
   */
  private async waitForUrlChange(
    page: Page,
    previousUrl: string,
    timeout: number = 3000
  ): Promise<boolean> {
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
      if (page.url() != previousUrl) {
        return true;
      }
      await page.waitForTimeout(100);
    }
    return false;
  }

  /*
   * Enhanced URL assertion with redirect and stability handling
   */
  private async waitForUrlStable(
    page: Page,
    expectedUrlPart: string
  ): Promise<void> {
    const timeout = 10000;
    try {
      // Wait for URL to contain expected part with longer timeout for redirects
      await page.waitForURL(new RegExp(expectedUrlPart, "i"), { timeout });

      // Ensure page is fully loaded after URL change
      await this.waitForPageStable(page, { short: true });

      const currentUrl = page.url();
      if (!currentUrl.toLowerCase().includes(expectedUrlPart.toLowerCase())) {
        throw new Error(
          `URL assertion failed: expected "${expectedUrlPart}", got "${currentUrl}"`
        );
      }
      this.logger.info(
        `URL assertion passed: "${expectedUrlPart}" found in "${currentUrl}"`
      );
    } catch (error) {
      const currentUrl = page.url();
      this.logger.error(
        `URL assertion failed: expected "${expectedUrlPart}", got "${currentUrl}"`
      );
      throw new Error(
        `URL assertion failed: expected "${expectedUrlPart}", got "${currentUrl}"`
      );
    }
  }

  private async takeScreenshotForPage(
    page: Page | null,
    name: string
  ): Promise<string | undefined> {
    try {
      const screenshotDir = path.join(this.options.reportDir, "screenshots");
      if (fs.existsSync(screenshotDir)) {
        fs.mkdirSync(screenshotDir, { recursive: true });
      }

      const filename = `${name.replace(
        /[^a-zA-Z0-9]/g,
        "_"
      )}_${Date.now()}.png`;
      const screenshotPath = path.join(screenshotDir, filename);

      await page?.screenshot({ path: screenshotPath, fullPage: true });
      this.logger.info(`Screenshot taken: ${screenshotPath}`);
      // Return relative path from report directory
      return path.relative(this.options.reportDir, screenshotPath);
    } catch (error) {
      this.logger.error(
        `Failed to take screenshot: ${(error as Error).message})`
      );
      return undefined;
    }
  }

  private createAttachFunction(scenarioName: string, embeddings: Embedding[]) {
    return async (data: string | Buffer, mediaType: string, name?: string) => {
      try {
        let base64Data: string;

        if (Buffer.isBuffer(data)) {
          base64Data = data.toString("base64");
        } else if (typeof data === "string") {
          // Check if it's a file path
          if (fs.existsSync(data)) {
            const fileData = fs.readFileSync(data);
            base64Data = fileData.toString("base64");
          } else {
            // It's raw data, convert to base64
            base64Data = Buffer.from(data).toString("base64");
          }
        } else {
          throw new Error("Unsupported data type for attachment");
        }

        const embedding: Embedding = {
          data: base64Data,
          mime_type: mediaType,
          name: name || `attachment-${Date.now()}`,
        };

        embeddings.push(embedding);
        this.logger.info(
          `📎 Attached ${mediaType} ${
            name ? `"${name}"` : ""
          } to scenario: ${scenarioName}`
        );
      } catch (error) {
        this.logger.error(`Failed to attach data: ${(error as Error).message}`);
      }
    };
  }

  private createScreenshotFunction(
    scenarioName: string,
    embeddings: Embedding[]
  ) {
    return async (name?: string): Promise<string> => {
      try {
        const screenshotName = name || `screenshot-${Date.now()}`;
        const screenshotPath = await this.takeScreenshotForPage(
          this.page,
          screenshotName
        );
        if (screenshotPath) {
          // Add screenshot to embeddings as base64
          const fullPath = path.join(this.options.reportDir, screenshotPath);
          if (fs.existsSync(fullPath)) {
            const imageData = fs.readFileSync(fullPath);
            const embedding: Embedding = {
              data: imageData.toString("base64"),
              mime_type: "image/png",
              name: screenshotName,
            };
            embeddings.push(embedding);
          }
        }
        return screenshotPath || "";
      } catch (error) {
        this.logger.error(
          `Failed to take screenshot: ${(error as Error).message}`
        );
        return "";
      }
    };
  }
}
