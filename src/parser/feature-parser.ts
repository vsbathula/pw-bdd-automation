import * as fs from "fs";
import * as path from "path";
import { Feature, Scenario, Background, Step } from "../types/feature-types";

export class FeatureParser {
  /**
   * Parse a single feature file
   */
  static parseFeatureFile(filePath: string): Feature {
    if (!fs.existsSync(filePath)) {
      throw new Error(`Feature file not found: ${filePath}`);
    }
    const content = fs.readFileSync(filePath, "utf8");
    return this.parseFeatureContent(content, filePath);
  }

  /**
   * Parse multiple feature files from a directory
   */
  static parseFeatureDirectory(dirPath: string): Feature[] {
    const features: Feature[] = [];
    const files = fs.readdirSync(dirPath);
    for (const file of files) {
      if (!file.endsWith(".feature")) {
        continue;
      }
      const featureFile = path.join(dirPath, file);
      features.push(this.parseFeatureFile(featureFile));
    }
    return features;
  }

  /**
   * Parse feature content from string
   */
  static parseFeatureContent(content: string, filePath: string): Feature {
    const lines = content.split("\n").map((line, index) => ({
      text: line.trim(),
      number: index + 1,
    }));

    let currentLine = 0;
    const feature: Feature = {
      name: "",
      scenarios: [],
      tags: [],
      filePath,
    };

    // Parse feature tags and name
    while (currentLine < lines.length) {
      const line = lines[currentLine];

      if (line.text.startsWith("@")) {
        feature.tags.push(...this.parseTags(line.text));
      } else if (line.text.startsWith("Feature:")) {
        feature.name = line.text.substring(8).trim();
        currentLine++;
        break;
      }
      currentLine++;
    }

    // Parse feature description
    while (currentLine < lines.length) {
      const line = lines[currentLine];
      if (
        line.text == "" ||
        line.text.startsWith("Background: ") ||
        line.text.startsWith("@") ||
        line.text.startsWith("Scenario:")
      ) {
        break;
      }

      if (!feature.description) {
        feature.description = line.text;
      } else {
        feature.description += "\n" + line.text;
      }
      currentLine++;
    }

    // Parse background and scenarios
    while (currentLine < lines.length) {
      const line = lines[currentLine];

      if (line.text.startsWith("Background:")) {
        const { background, nextLine } = this.parseBackground(
          lines,
          currentLine
        );
        feature.background = background;
        currentLine = nextLine;
      } else if (
        line.text.startsWith("@") ||
        line.text.startsWith("Scenario:")
      ) {
        const { scenario, nextLine } = this.parseScenario(lines, currentLine);
        feature.scenarios.push(scenario);
        currentLine = nextLine;
      } else {
        currentLine++;
      }
    }

    return feature;
  }

  /**
   * Parse a background
   */
  private static parseBackground(
    lines: Array<{ text: string; number: number }>,
    startLine: number
  ): { background: Background; nextLine: number } {
    const background: Background = {
      steps: [],
      line: lines[startLine].number,
    };

    let currentLine = startLine + 1;

    while (currentLine < lines.length) {
      const line = lines[currentLine];
      if (line.text === "" || line.text.startsWith("#")) {
        currentLine++;
        continue;
      }

      if (line.text.startsWith("@") || line.text.startsWith("Scenario:")) {
        break;
      }

      if (this.isStepKeyword(line.text)) {
        const step = this.parseStep(line);
        background.steps.push(step);
      }

      currentLine++;
    }
    return { background, nextLine: currentLine };
  }

  /**
   * Parse a scenario
   */
  private static parseScenario(
    lines: Array<{ text: string; number: number }>,
    startLine: number
  ): { scenario: Scenario; nextLine: number } {
    let currentLine = startLine;
    const tags: string[] = [];

    // Parse scenario tags
    while (
      currentLine < lines.length &&
      lines[currentLine].text.startsWith("@")
    ) {
      tags.push(...this.parseTags(lines[currentLine].text));
      currentLine++;
    }

    // Parse scenario name
    const scenarioLine = lines[currentLine];
    if (!scenarioLine.text.startsWith("Scenario:")) {
      throw new Error(`Expected 'Scenario:' at line ${scenarioLine.number}`);
    }

    const scenario: Scenario = {
      name: scenarioLine.text.substring(9).trim(),
      steps: [],
      tags,
      line: scenarioLine.number,
    };

    currentLine++;

    // Parse steps
    while (currentLine < lines.length) {
      const line = lines[currentLine];
      if (line.text === "" || line.text.startsWith("#")) {
        currentLine++;
        continue;
      }

      if (line.text.startsWith("@") || line.text.startsWith("Scenario:")) {
        break;
      }

      if (this.isStepKeyword(line.text)) {
        const step = this.parseStep(line);
        scenario.steps.push(step);
      }

      currentLine++;
    }

    return { scenario, nextLine: currentLine };
  }

  /**
   * Parse a single step
   */
  private static parseStep(line: { text: string; number: number }): Step {
    const stepKeywords = ["Given", "When", "Then", "And", "But"];

    for (const keyword of stepKeywords) {
      if (line.text.startsWith(keyword + " ")) {
        return {
          keyword: keyword as any,
          text: line.text.substring(keyword.length + 1).trim(),
          line: line.number,
        };
      }
    }

    throw new Error(`Invalid step format at line ${line.number}: ${line.text}`);
  }

  /**
   * Check if line starts with a step keyword
   */
  private static isStepKeyword(text: string): boolean {
    const keywords = ["Given", "When", "Then", "And", "But"];
    return keywords.some((keyword) => text.startsWith(keyword + " "));
  }

  /**
   * Parse tags from a line
   */
  private static parseTags(tagLine: string): string[] {
    return tagLine.split(/\s+/).filter((tag) => tag.startsWith("@"));
    // .map((tag) => tag.substring(1));
  }

  /**
   * Filter scenarios based on include and exclude tags
   */
  static filterScenarios(
    scenarios: Scenario[],
    includeTags: string[],
    excludeTags: string[]
  ): Scenario[] {
    return scenarios.filter((scenario) =>
      this.shouldIncludeScenario(scenario.tags, includeTags, excludeTags)
    );
  }

  /**
   * Filter features based on tags, removing scenarios that don't match
   */
  static filterFeaturesByTags(
    features: Feature[],
    includeTags: string[],
    excludeTags: string[]
  ): Feature[] {
    return features
      .map((feature) => ({
        ...feature,
        scenarios: this.filterScenarios(
          feature.scenarios,
          includeTags,
          excludeTags
        ),
      }))
      .filter((feature) => feature.scenarios.length > 0);
  }

  /**
   * Determine if a scenario should be included based on tags
   */
  private static shouldIncludeScenario(
    scenarioTags: string[],
    includeTags: string[],
    excludeTags: string[]
  ): boolean {
    // if exclude tags are specified and scenario has any of them, exclude
    if (excludeTags && excludeTags.length > 0) {
      if (scenarioTags.some((tag) => excludeTags.includes(tag))) {
        return false;
      }
    }

    // If include tags are specified, scenario must have at least one
    if (includeTags && includeTags.length > 0) {
      return scenarioTags.some((tag) => includeTags.includes(tag));
    }

    // If no tags specified, include all scenarios (except excluded ones)
    return true;
  }

  /**
   * Get all unique tags from a
   */
  static getAllTagsFromFeature(feature: Feature): string[] {
    const allTags = new Set<string>();

    // Add feature-level tags
    feature.tags.forEach((tag) => allTags.add(tag));
    // Add scenario-level tags
    feature.scenarios.forEach((scenario) => {
      scenario.tags.forEach((tag) => allTags.add(tag));
    });

    return Array.from(allTags);
  }

  /**
   * Get all unique tags from multiple features
   */
  static getAllTagsFromFeatures(features: Feature[]): string[] {
    const allTags = new Set<string>();

    features.forEach((feature) => {
      this.getAllTagsFromFeature(feature).forEach((tag) => allTags.add(tag));
    });

    return Array.from(allTags);
  }

  /**
   * Parse feature directory with tag filtering
   */
  static parseFeatureDirectoryWithTags(
    dirPath: string,
    includeTags?: string[],
    excludeTags?: string[]
  ): Feature[] {
    const features = this.parseFeatureDirectory(dirPath);
    return this.filterFeaturesByTags(
      features,
      includeTags || [],
      excludeTags || []
    );
  }
}
