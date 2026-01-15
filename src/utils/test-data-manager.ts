import * as fs from "fs";
import * as path from "path";
import Logger from "./logger";

export class TestDataManager {
  private static instance: TestDataManager;
  private testData: Map<string, any> = new Map();
  private logger = new Logger();
  private testDataDir: string;

  private constructor() {
    this.testDataDir = path.join(process.cwd(), "src", "testdata");
    this.loadTestData();
  }

  static getInstance(): TestDataManager {
    if (!TestDataManager.instance) {
      TestDataManager.instance = new TestDataManager();
    }
    return TestDataManager.instance;
  }

  /**
   * Load test data from JSON files in the testdata directory
   */
  private loadTestData(): void {
    if (!fs.existsSync(this.testDataDir)) {
      this.logger.warn(
        `Test data directory not found at ${this.testDataDir}. Skipping test data loading.`
      );
      throw new Error(`Test data directory not found at ${this.testDataDir}`);
    }

    try {
      const files = fs
        .readdirSync(this.testDataDir)
        .filter((file) => file.endsWith(".json"));

      for (const file of files) {
        const environment = path.basename(file, ".json");
        const filePath = path.join(this.testDataDir, file);
        try {
          const fileContent = fs.readFileSync(filePath, "utf-8");
          const data = JSON.parse(fileContent);
          this.testData.set(environment, data);
          this.logger.info(`Loaded test data for environment: ${environment}`);
        } catch (error) {
          this.logger.error(`Failed to parse test data file ${file}: ${error}`);
        }
      }
    } catch (error) {
      this.logger.error(`Failed to read test data directory: ${error}`);
      throw error;
    }
  }

  /**
   * Get test data by key for a specific environment environment - Environment name (e.g., 'qa', 'int')
   * @param key - Dot-notation key (e.g., 'users-valid.userName' or 'emails. VALID_EMAIL')
   * @returns string | object | undefined
   */
  getTestData(environment: string, key: string): any {
    const envData = this.testData.get(environment);
    if (!envData) {
      this.logger.error(`No test data found for environment: ${environment}`);
      throw new Error(`No test data found for environment: ${environment}`);
    }
    return this.getNestedValue(envData, key);
  }

  /**
   * Get test data by key for current environment (from environment manager)
   * @param key - Dot-notation key (e.g., 'users. valid. userName' )
   * @returns string | object | undefined
   */
  getData(key: string): any {
    // Import here to avoid circular dependency
    const currentEnv = process.env.ENV;
    if (!currentEnv) {
      throw new Error("Current environment is not set in ENV variable");
    }
    return this.getTestData(currentEnv, key);
  }

  /**
   * Get nested value from object using dot notation
   * @param obj - Object to search in
   * @param path - Dot-separated path (e.g., 'users.valid.userName')
   * @returns any
   */
  private getNestedValue(obj: any, path: string): any {
    const keys = path.split(".");
    let current = obj;
    for (const key of keys) {
      if (current && typeof current === "object" && key in current) {
        current = current[key];
      } else {
        return undefined;
      }
    }
    return current;
  }

  /**
   * Get all available environments
   * @returns string[]
   */
  getAvailableEnvironments(): string[] {
    return Array.from(this.testData.keys());
  }

  /**
   * Get all test data for a specific environment
   * @param environment - Environment name
   * @returns object | undefined
   */
  getAllTestData(environment: string): any {
    return this.testData.get(environment);
  }
  /**
   * Check if a key exists in the test data
   * @param environment - Environment name
   * @param key - Dot-notation key
   * @returns boolean
   */
  hasTestData(environment: string, key: string): boolean {
    const data = this.getTestData(environment, key);
    return data !== undefined;
  }

  /**
   * Reload test data from files
   */
  reload(): void {
    this.testData.clear();
    this.loadTestData();
  }
}

// Export singleton instance
export const testDataManager = TestDataManager.getInstance();
