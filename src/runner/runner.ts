import pLimit from "p-limit";
import {
  Feature,
  FeatureResult,
  ScenarioResult,
  TestReport,
  ExecutionOptions,
} from "../types/feature-types";
import { FeatureParser } from "../parser/feature-parser";
import { ScenarioRunner } from "./scenario-runner";
import Logger from "../utils/logger";
import * as fs from "fs";
import * as path from "path";
import { duration } from "moment-timezone";

export async function runAllFeatures(
  featureDir: string,
  options: ExecutionOptions
): Promise<TestReport> {
  const logger = new Logger();
  const startTime = new Date();

  logger.info(
    `Starting text execution with options: ${JSON.stringify(options)}`
  );

  // Ensure report directory exists
  if (!fs.existsSync(options.reportDir)) {
    fs.mkdirSync(options.reportDir, { recursive: true });
  }

  const features: Feature[] = FeatureParser.parseFeatureDirectory(featureDir);
  const limit = pLimit(options.maxParallel || 2);

  const scenarioRunner = new ScenarioRunner(options);
  await scenarioRunner.setup();
  const featureResults: FeatureResult[] = [];

  try {
    for (const feature of features) {
      const featureStartTime = Date.now();
      const scenarioResults: ScenarioResult[] = [];

      if (options.parallel) {
        // Run scenarios in parallel
        const promises = feature.scenarios.map((scenario) =>
          limit(async () => {
            if (
              shouldRunScenario(
                scenario.tags,
                options.tags,
                options.excludeTags
              )
            ) {
              return await scenarioRunner.runScenario(feature, scenario);
            }
            return null;
          })
        );
        const results = await Promise.all(promises);
        scenarioResults.push(
          ...(results.filter((r) => r !== null) as ScenarioResult[])
        );
      } else {
        // Run scenarios sequentially
        for (const scenario of feature.scenarios) {
          if (
            shouldRunScenario(scenario.tags, options.tags, options.excludeTags)
          ) {
            const result = await scenarioRunner.runScenario(feature, scenario);
            scenarioResults.push(result);
          }
        }
      }

      const featureStatus = scenarioResults.some((r) => r.status === "failed")
        ? "failed"
        : scenarioResults.length === 0
        ? "skipped"
        : "passed";
      featureResults.push({
        feature,
        scenarios: scenarioResults,
        status: featureStatus,
        duration: Date.now() - featureStartTime,
      });

      logger.info(`Feature completed: ${feature.name} (${featureStatus})`);
    }
  } finally {
    await scenarioRunner.teardown();
  }

  // Generate and save test report for single feature
  const endTime = new Date();
  const allScenarios = featureResults.flatMap((f) => f.scenarios);
  const report: TestReport = {
    features: featureResults,
    summary: {
      total: allScenarios.length,
      passed: allScenarios.filter((s) => s.status === "passed").length,
      failed: allScenarios.filter((s) => s.status === "failed").length,
      skipped: allScenarios.filter((s) => s.status === "skipped").length,
      duration: endTime.getTime() - startTime.getTime(),
    },
    startTime,
    endTime,
  };

  // Save test report
  const reportPath = path.join(options.reportDir, "test-report.json");
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  logger.info(`Test execution completed. Report saved to: ${reportPath}`);
  logger.info(
    `Summary: ${report.summary.passed} passed, ${report.summary.failed} failed, ${report.summary.skipped} skipped.`
  );
  return report;
}

export async function runSingleFeature(
  featurePath: string,
  options: ExecutionOptions
): Promise<FeatureResult> {
  const logger = new Logger();
  const startTime = new Date();
  const feature = FeatureParser.parseFeatureFile(featurePath);
  logger.info(
    `Starting text execution with options: ${JSON.stringify(options)}`
  );

  // Ensure report directory exists
  if (!fs.existsSync(options.reportDir)) {
    fs.mkdirSync(options.reportDir, { recursive: true });
  }

  const scenarioRunner = new ScenarioRunner(options);
  await scenarioRunner.setup();
  const featureStartTime = Date.now();
  const scenarioResults: ScenarioResult[] = [];
  try {
    for (const scenario of feature.scenarios) {
      if (shouldRunScenario(scenario.tags, options.tags, options.excludeTags)) {
        const result = await scenarioRunner.runScenario(feature, scenario);
        scenarioResults.push(result);
      }
    }
    const featureStatus = scenarioResults.some((r) => r.status === "failed")
      ? "failed"
      : scenarioResults.length === 0
      ? "skipped"
      : "passed";

    const result: FeatureResult = {
      feature,
      scenarios: scenarioResults,
      status: featureStatus,
      duration: Date.now() - featureStartTime,
    };

    // Generate and save test report for single feature
    const endTime = new Date();
    const report: TestReport = {
      features: [result],
      summary: {
        total: scenarioResults.length,
        passed: scenarioResults.filter((s) => s.status === "passed").length,
        failed: scenarioResults.filter((s) => s.status === "failed").length,
        skipped: scenarioResults.filter((s) => s.status === "skipped").length,
        duration: endTime.getTime() - startTime.getTime(),
      },
      startTime,
      endTime,
    };

    // Save test report
    const reportPath = path.join(options.reportDir, "test-report.json");
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    logger.info(`Feature completed: ${feature.name} (${featureStatus})`);
    logger.info(`Test execution completed. Report saved to: ${reportPath}`);
    logger.info(
      `Summary: ${report.summary.passed} passed, ${report.summary.failed} failed, ${report.summary.skipped} skipped.`
    );

    return result;
  } finally {
    await scenarioRunner.teardown();
  }
}

function shouldRunScenario(
  scenarioTags: string[],
  includeTags?: string[],
  excludeTags?: string[]
): boolean {
  // If exclude tags are specified and scenario has any of them, skip
  if (excludeTags && excludeTags.length > 0) {
    if (scenarioTags.some((tag) => excludeTags.includes(tag))) {
      return false;
    }
  }

  // If include tags are specified, scenario must have at least one
  if (includeTags && includeTags.length > 0) {
    return scenarioTags.some((tag) => includeTags.includes(tag));
  }

  // If no tags specified, run all scenarios (except excluded ones)
  return true;
}
