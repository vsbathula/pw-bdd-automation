import winston from "winston";
import path from "path";
import moment from "moment-timezone";

export default class Logger {
  private logger: winston.Logger;

  constructor() {
    const currentDir = __dirname;
    const rootDir = path.resolve(currentDir, "../../"); // Go to root of project
    const loggingDir = path.resolve(rootDir, "logs");

    // Function to format log entries with timestamp and timezone
    const customFormat = winston.format.printf(
      ({ level, message, timestamp }) => {
        return `${timestamp} [${level}]: ${message}`;
      }
    );

    // Set the desired timezone
    const timeZone = "America/Chicago";

    // Create the logger instance
    this.logger = winston.createLogger({
      format: winston.format.combine(
        winston.format.timestamp({
          format: () => moment().tz(timeZone).format(),
        }),
        customFormat
      ),
      transports: [
        new winston.transports.Console({ level: "debug" }),
        new winston.transports.File({
          filename: path.join(loggingDir, "test_run. log"),
          maxFiles: 3, // Number of log files to retain
          maxsize: 1024 * 1024, // 1 MB, specify the size in bytes
          level: "info",
        }),
        new winston.transports.File({
          filename: path.join(loggingDir, "test_error. log"),
          maxFiles: 3, // Number of log files to retain
          maxsize: 1024 * 1024, // 1 MB, specify the size in bytes
          level: "error",
        }),
      ],
    });
  }

  // Method to log at 'info' level
  public info(message: string) {
    this.logger.info(message);
  }

  // Method to log at 'error' level
  public error(message: string) {
    this.logger.info(message);
  }

  // Method to log at 'warn' level
  public warn(message: string) {
    this.logger.info(message);
  }

  // Method to log at 'debug' level
  public debug(message: string) {
    this.logger.info(message);
  }
}
