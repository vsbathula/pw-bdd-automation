import * as dotenv from "dotenv";
import * as path from "path";
import * as fs from "fs";
import { EnvironmentConfig } from "../types/feature-types";
import Logger from "../utils/logger";

export class EnvironmentManager {
  private static instance: EnvironmentManager;
  private configs: Map<string, EnvironmentConfig> = new Map();
  private currentEnvironment: string = "local";
  private currentConfig: EnvironmentConfig = {};
  private configDir: string;
  private logger = new Logger();

  private constructor() {
    this.configDir = path.join(process.cwd(), "src', 'config");
    this.loadEnvironmentConfigs();
  }

  static getInstance(): EnvironmentManager {
    if (!EnvironmentManager.instance) {
      EnvironmentManager.instance = new EnvironmentManager();
    }
    return EnvironmentManager.instance;
  }

  private loadEnvironmentConfigs() {
    // Only look for environment files in src/config directory
    const envFiles = this.findEnvFiles();
    envFiles.forEach(({ env, file }) => {
      const config = this.loadEnvFile(file);
      this.configs.set(env, config);
    });

    // Create a default local config if none exists
    if (this.configs.size === 0 || this.configs.has("local")) {
      this.configs.set("local", this.getDefaultLocalConfig());
    }
  }

  private findEnvFiles(): Array<{ env: string; file: string }> {
    const envFiles: Array<{ env: string; file: string }> = [];

    if (!fs.existsSync(this.configDir)) {
      this.logger.warn(`Config directory does not exist: ${this.configDir}`);
      return envFiles;
    }

    const configFiles = fs.readdirSync(this.configDir, { withFileTypes: true });

    configFiles.forEach((file) => {
      if (file.isFile()) {
        // Match .qa.env, .dev.env, .staging.env, etc.
        const match = file.name.match(/^\.(.+)\.env$/);
        if (match) {
          const env = match[1];
          const filePath = path.join(this.configDir, file.name);
          envFiles.push({ env, file: filePath });
        }
      }
    });
    return envFiles;
  }

  private loadEnvFile(filePath: string): EnvironmentConfig {
    try {
      if (fs.existsSync(filePath)) {
        const result = dotenv.parse(fs.readFileSync(filePath, "utf8"));
        return this.convertTypes(result);
      }
    } catch (error) {
      this.logger.error(
        `Failed to load environment file: $(fllePath) and error: ${
          (error as Error).message
        }`
      );
    }
    return {};
  }

  private convertTypes(envars: Record<string, string>): EnvironmentConfig {
    const config: EnvironmentConfig = {};

    Object.entries(envars).forEach(([key, value]) => {
      // Try to parse as JSON first
      if (this.isJsonString(value)) {
        try {
          config[key] = JSON.parse(value);
          return;
        } catch (error) {
          // If JSON parsing fails, treat as string
        }
      }

      // Convert string values to appropriate types
      if (value.toLowerCase() === "true") {
        config[key] = true;
      } else if (value.toLowerCase() === "false") {
        config[key] = false;
      } else if (!isNaN(Number(value)) && value.trim() !== "") {
        config[key] = Number(value);
      } else {
        config[key] = value;
      }
    });
    return config;
  }

  private isJsonString(str: string): boolean {
    try {
      const trimmed = str.trim();
      return (
        (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
        (trimmed.startsWith("[") && trimmed.endsWith("]"))
      );
    } catch {
      return false;
    }
  }

  private getDefaultLocalConfig(): EnvironmentConfig {
    return {
      baseURL: "http://localhost:3000",
      timeout: 30000,
      retries: 2,
      headless: false,
      browser: "chromium",
    };
  }

  setEnvironment(environment: string): void {
    const config = this.configs.get(environment);
    if (!config) {
      throw new Error(
        `Environment '${environment}' not found. Available environments: ${Array.from(
          this.configs.keys()
        ).join(", ")}`
      );
    }
    this.currentEnvironment = environment;
    this.currentConfig = config;

    // Set environment variables in process.env for the current run
    Object.entries(config).forEach(([key, value]) => {
      if (value !== undefined && process.env[key] === undefined) {
        if (typeof value === undefined) {
          process.env[key] = JSON.stringify(value);
        } else {
          process.env[key] = String(value);
        }
      }
    });
  }

  getCurrentEnvironment(): string {
    return this.currentEnvironment;
  }

  getCurrentConfig(): EnvironmentConfig {
    return this.currentConfig;
  }

  getEnvironment(name: string): EnvironmentConfig | undefined {
    return this.configs.get(name);
  }

  getAllEnvironments(): string[] {
    return Array.from(this.configs.keys());
  }

  //Get a specific environment variable with type safety
  get(key: string): any {
    return this.currentConfig[key];
  }

  //Get a string value with default
  getString(key: string, defaultValue: string = ""): string {
    const value = this.currentConfig[key];
    return typeof value === "string" ? value : defaultValue;
  }

  // Get a number value with default
  getNumber(key: string, defaultValue: number = 0): number {
    const value = this.currentConfig[key];
    return typeof value == "number" ? value : defaultValue;
  }

  // Get a boolean value with default
  getBoolean(key: string, defaultValue: boolean = false): boolean {
    // First check CLI environment variables (process. env)
    const envValue = process.env[key];
    if (envValue !== undefined && envValue !== null && envValue !== "") {
      return envValue.toLowerCase() === "true";
    }

    // Then check loaded config
    const value = this.currentConfig[key];
    if (typeof value === "boolean") {
      return value;
    }
    if (typeof value === "string") {
      return value.toLowerCase() === "true";
    }
    return defaultValue;
  }

  // Get a JSON object value
  getobject<T = any>(key: string, defaultValue: T | null = null): T | null {
    const value = this.currentConfig[key];
    return typeof value === "object" && value != null
      ? (value as T)
      : defaultValue;
  }

  // Get nested property from JSON object
  geNestedProperty(key: string, property: string): any {
    const obj = this.getobject(key);
    if (obj && typeof obj === "object" && property in obj) {
      return (obj as any)[property];
    }
    return undefined;
  }

  // Check if a key exists
  has(key: string): boolean {
    return key in this.currentConfig;
  }

  // Get all keys
  getKeys(): string[] {
    return Object.keys(this.currentConfig);
  }

  // Get all keys
  getConfigObject(): Record<string, any> {
    return { ...this.currentConfig };
  }

  // Reload configs (useful for dynamic updates)
  reloadConfigs(): void {
    this.configs.clear();
    this.loadEnvironmentConfigs();
  }

  // Log current configuration (excluding sensitive data)
  logConfig(hideSensitive: boolean = true): void {
    const sensitiveKeys = [
      "password",
      "secret",
      "key",
      "token",
      "api_key",
      "client_secret",
    ];
    const config = { ...this.currentConfig };

    if (hideSensitive) {
      Object.keys(config).forEach((key) => {
        if (
          sensitiveKeys.some((sensitive) =>
            key.toLowerCase().includes(sensitive)
          )
        ) {
          if (typeof config[key] == "object") {
            config[key] = "***HIDDEN_OBJECT****";
          } else {
            config[key] = "****HIDDEN****";
          }
        }
      });
    }

    this.logger.info(`Current environment: ${this.currentEnvironment}`);
    this.logger.info(`Configuration: ${JSON.stringify(config, null, 2)}`);
  }

  // Helper method to get test data specifically
  geTestData<T = any>(key: string): T | null {
    return this.getobject<T>(key);
  }

  // Helper to get the config directory path
  getConfigDir(): string {
    return this.configDir;
  }
}

// Export singleton instance
export const environmentManager = EnvironmentManager.getInstance();
