import { chromium } from "playwright";
import { ActionRecorder } from "./action-recorder";
import Logger from "./logger";

async function launchRecorder() {
  const logger = new Logger();
  const browser = await chromium.launch({
    headless: false,
    args: ["--start-maximized"],
  });

  const context = await browser.newContext({ viewport: null });
  const page = await context.newPage();

  const recorder = new ActionRecorder();

  // Start the BDD Generation engine
  await recorder.start(page);

  // Navigate to your target app
  await page.goto("https://www.saucedemo.com");

  logger.info("--------------------------------------------------");
  logger.info("RECORDER ACTIVE: Steps will appear below...");
  logger.info("--------------------------------------------------");

  // Keep browser open until closed manually
  page.on("close", () => {
    logger.info("--------------------------------------------------");
    logger.info(
      "Recording finished. Copy the steps above into your .feature file."
    );
    process.exit();
  });
}

launchRecorder().catch((err) => console.error(err));
