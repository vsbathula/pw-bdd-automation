import { runAllFeatures, runSingleFeature } from "./src/runner/runner";
import { ExecutionOptions } from "./src/types/feature-types";
import { environmentManager } from "./src/config/environment-manager";
import Logger from "./src/utils/logger";
import { trainModel } from "./src/nlp/nlp-processor";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const args = process.argv.slice(2);
  const command = args.find((arg) => arg === "--single") ? "single" : "all";
  const envArg = args.find((arg) => arg.startsWith("--env="));
  const environment = envArg ? envArg.split("=")[1] : "qa";
  const tagsArg = args.find((arg) => arg.startsWith("--tags="));
  const tags = tagsArg ? tagsArg.split("=")[1].split(",") : [];
  const featurePath =
    args.find((arg) => !arg.startsWith("--")) || "./src/features";
  const logger = new Logger();

  logger.info(`Running tests with environment: ${environment}`);

  try {
    // Train the NLP model before parsing steps
    await trainModel();
    logger.info("NLP engine initialized.");
    // Load environment configuration
    environmentManager.setEnvironment(environment);

    const options: ExecutionOptions = {
      environment,
      baseUrl: environmentManager.getString("BASE_URL"),
      headless: environmentManager.getBoolean("HEADLESS", true),
      parallel: environmentManager.getBoolean("PARALLEL_EXECUTION", true),
      maxParallel: environmentManager.getNumber("MAX_WORKERS", 5),
      browser: environmentManager.getString("BROWSER", "chromium") as
        | "chromium"
        | "firefox"
        | "webkit",
      timeout: environmentManager.getNumber("TIMEOUT"),
      retries: environmentManager.getNumber("RETRIES"),
      tags,
      excludeTags: [],
      screenshotOnFailure: environmentManager.getBoolean(
        "ENABLE_SCREENSHOTS",
        true
      ),
      video: environmentManager.getBoolean("ENABLE_VIDEO"),
      reportDir: "./test-results",
    };
    logger.info(
      `Execution Options: ${JSON.stringify(
        {
          environment: options.environment,
          baseUrl: options.baseUrl,
          headless: options.headless,
          browser: options.browser,
          timeout: options.timeout,
          retries: options.retries,
          tags: options.tags,
        },
        null,
        2
      )}`
    );

    if (command === "single") {
      // Run single feature file
      const fileArg = args
        .find((arg) => arg.startsWith("--file="))
        ?.split("=")[1];
      const singleFeaturePath = path.resolve(`${featurePath}/${fileArg}`);

      // Check if feature file exists
      if (!fs.existsSync(singleFeaturePath)) {
        const availableFeatures = fs.existsSync("./src/features")
          ? fs
              .readdirSync("./src/features")
              .filter((file) => file.endsWith(".feature"))
              .join(", ")
          : "No features directory found";
        throw new Error(
          `Feature file not found: ${singleFeaturePath}\n` +
            `Available feature files: ${availableFeatures}\n` +
            `Usage: npm run test: single:qa --file=your-feature.feature`
        );
      }
      logger.info(`Running single feature: ${singleFeaturePath}`);
      const result = await runSingleFeature(singleFeaturePath, options);

      logger.info(`\n=== Single Feature Execution Result ===`);
      logger.info(`Feature: ${result.feature.name}`);
      logger.info(`Status: ${result.status}`);
      logger.info(`Duration: ${result.duration}ms`);
      logger.info(`Scenarios: ${result.scenarios.length}`);

      result.scenarios.forEach((scenario) => {
        logger.info(
          `  - ${scenario.scenario.name}: ${scenario.status} (${scenario.duration}ms)`
        );
      });
    } else {
      // Run all features
      logger.info(`Running all features from: ${featurePath}`);
      const report = await runAllFeatures(featurePath, options);

      logger.info(`\n=== Test Execution Summary ===`);
      logger.info(`Environment: ${environment}`);
      logger.info(`Total scenarios: ${report.summary.total}`);
      logger.info(`Passed: ${report.summary.passed}`);
      logger.info(`Failed: ${report.summary.failed}`);
      logger.info(`Skipped: ${report.summary.skipped}`);
      logger.info(`Duration: ${report.summary.duration}ms`);

      // Exit with error code if tests failed
      process.exit(report.summary.failed > 0 ? 1 : 0);
    }
  } catch (error) {
    console.error("Test execution failed:", error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on("SIGINT", () => {
  console.log("\nTest execution interrupted.");
  process.exit(1);
});

process.on("uncaughtException", (error) => {
  console.log(`Uncaught Exception: ${error}`);
  process.exit(1);
});

// call the main function
main();
