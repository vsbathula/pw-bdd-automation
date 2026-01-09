import { Page } from "playwright";
import * as fs from "fs";
import * as path from "path";

export class DOMDebugHelper {
  static async capturePageInfo(
    page: Page,
    stepName: string,
    reportDir: string
  ) {
    const debugDir = path.join(reportDir, "debug");
    if (!fs.existsSync(debugDir)) {
      fs.mkdirSync(debugDir, { recursive: true });
    }

    const timestamp = Date.now();

    // Capture DOM structure
    const domInfo = await page.evaluate(() => {
      const getAllElements = (element: Element, depth = 0): any => {
        if (depth > 3) return null; // Limit depth
        return {
          tag: element.tagName.toLowerCase(),
          id: element.id || null,
          className: element.className || null,
          textContent: element.textContent?.trim().substring(0, 100) || null,
          attributes: Array.from(element.attributes).reduce((acc, attr) => {
            acc[attr.name] = attr.value;
            return acc;
          }, {} as any),
          children: Array.from(element.children)
            .slice(0, 10)
            .map((child) => getAllElements(child, depth + 1))
            .filter(Boolean),
        };
      };
      return getAllElements(document.body);
    });

    // Save DOM structure
    fs.writeFileSync(
      path.join(debugDir, `dom_${stepName}_${timestamp}.json`),
      JSON.stringify(domInfo, null, 2)
    );

    // Save screenshot
    await page.screenshot({
      path: path.join(debugDir, `page_${stepName}_${timestamp}.png`),
      fullPage: true,
    });
  }
}
