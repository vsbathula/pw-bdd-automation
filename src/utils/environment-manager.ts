import * as dotenv from "dotenv";
import * as path from "path";
import * as fs from "fs";
import { EnvironmentConfig } from "../types/feature-types";
import Logger from "../utils/logger";

export class EnvironmentManager {
  private static instance: EnvironmentManager;
  private currentConfig: EnvironmentConfig = {};
  private configDir: string;
  private logger = new Logger();

  private constructor() {
    this.configDir = path.join(process.cwd(), "src", "config");
  }

  static getInstance(): EnvironmentManager {
    if (!EnvironmentManager.instance) {
      EnvironmentManager.instance = new EnvironmentManager();
    }
    return EnvironmentManager.instance;
  }

  /**
   * Initialize with environment (called from run-tests.ts)
   * @param environment - Environment name to initialize with
   */
  initialize(environment?: string): EnvironmentConfig {
    if (environment) {
      process.env.ENV = environment;
      const envFile = `.${environment}.env`;
      const envFilePath = path.join(this.configDir, envFile);
      if (!fs.existsSync(envFilePath)) {
        this.logger.error(`Environment file not found: ${envFilePath}.`);
        throw new Error(`Environment file not found: ${envFilePath}`);
      }
      try {
        // Load the env file
        const result = dotenv.config({ path: envFilePath });

        if (result.error) {
          throw result.error;
        }

        // Parse environment variables into typed config
        this.currentConfig = this.parseEnvironmentConfig(result.parsed || {});
        this.logger.info(
          `Loaded configuration for environment: ${environment}`
        );
        this.logger.info(
          `EnvironmentManager initialized with environment ${environment}`
        );
      } catch (error) {
        this.logger.error(`Failed to load environment config: ${error}`);
        throw new Error(`Failed to load environment config: ${error}`);
      }
      return this.currentConfig;
    }
    return this.currentConfig;
  }

  /**
   * Parse environment variables into typed configuration
   */
  private parseEnvironmentConfig(
    envars: Record<string, string>
  ): EnvironmentConfig {
    const config: EnvironmentConfig = {};

    try {
      for (const [key, value] of Object.entries(envars)) {
        // Parse boolean values
        if (value.toLowerCase() === "true") {
          config[key] = true;
        } else if (value.toLowerCase() === "false") {
          config[key] = false;
        }
        // Parse numeric values
        else if (!isNaN(Number(value)) && value.trim() !== "") {
          config[key] = Number(value);
        }
        // Otherwise, treat as string
        else {
          config[key] = value;
        }
      }
      return config;
    } catch (error) {
      this.logger.error(`Error parsing environment config: ${error}`);
      throw new Error(`Error parsing environment config: ${error}`);
    }
  }
}

// Export singleton instance
export const environmentManager = EnvironmentManager.getInstance();
