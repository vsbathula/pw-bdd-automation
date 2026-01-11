import { Page, Locator } from "playwright";
import { DOMAnalyzer } from "./dom-analyzer";
import Logger from "./logger";
import * as fs from "fs";
import * as path from "path";

export class ElementResolver {
  private logger = new Logger();
  private domAnalyzer = new DOMAnalyzer();
  private registriesDir = path.join(process.cwd(), "registries");

  constructor() {
    if (!fs.existsSync(this.registriesDir)) {
      fs.mkdirSync(this.registriesDir, { recursive: true });
    }
  }

  async resolve(
    page: Page,
    elementName: string,
    elementType?: string
  ): Promise<Locator> {
    const pageName = this.getPageNameFromUrl(page.url());
    const registryPath = path.join(this.registriesDir, `${pageName}.json`);
    const registryKey = `${elementName.toLowerCase().replace(/\s+/g, "_")}_${
      elementType || "any"
    }`;

    // 1. Check Page-Specific Registry
    const savedSelector = this.getSavedSelector(registryPath, registryKey);
    if (savedSelector) {
      const locator = await this.findInFrames(page, savedSelector);
      if (locator) {
        this.logger.info(`⚡ Registry Hit in frame: ${savedSelector}`);
        return locator;
      }
    }

    // 2. Try Semantic Visual Strategies across all frames
    const visualLocator = await this.tryVisualInFrames(
      page,
      elementName,
      elementType
    );
    if (visualLocator) {
      const selector = await this.getSelectorFromLocator(visualLocator);
      if (selector) this.saveSelector(registryPath, registryKey, selector);
      return visualLocator;
    }

    // 3. Deep DOM Analysis (Fuzzy Match) across all frames
    this.logger.info(`🧠 Deep scanning all iframes for "${elementName}"...`);
    const suggestions = await this.domAnalyzer.analyzeElementAcrossFrames(
      page,
      elementName
    );
    const bestLocator = await this.findBestInFrames(page, suggestions);

    if (bestLocator) {
      const selector = await this.getSelectorFromLocator(bestLocator);
      if (selector) this.saveSelector(registryPath, registryKey, selector);
      return bestLocator;
    }

    throw new Error(
      `CRITICAL: "${elementName}" not found in main page or any iframes.`
    );
  }

  private async findInFrames(
    page: Page,
    selector: string
  ): Promise<Locator | null> {
    for (const frame of page.frames()) {
      const loc = frame.locator(selector).first();
      if (await loc.isVisible({ timeout: 500 }).catch(() => false)) return loc;
    }
    return null;
  }

  private async tryVisualInFrames(
    page: Page,
    name: string,
    type?: string
  ): Promise<Locator | null> {
    const regex = new RegExp(name, "i");
    for (const frame of page.frames()) {
      if (type === "button" || type === "link") {
        const loc = frame.getByRole(type as any, { name: regex }).first();
        if (await loc.isVisible({ timeout: 300 }).catch(() => false))
          return loc;
      }
      const labelLoc = frame.getByLabel(regex).first();
      if (await labelLoc.isVisible({ timeout: 200 }).catch(() => false))
        return labelLoc;

      const phLoc = frame.getByPlaceholder(regex).first();
      if (
        await phLoc
          .first()
          .isVisible({ timeout: 200 })
          .catch(() => false)
      )
        return phLoc;
    }
    return null;
  }

  private async findBestInFrames(
    page: Page,
    suggestions: string[]
  ): Promise<Locator | null> {
    for (const selector of suggestions) {
      const loc = await this.findInFrames(page, selector);
      if (loc) return loc;
    }
    return null;
  }

  private getPageNameFromUrl(urlString: string): string {
    const url = new URL(urlString);
    return (
      url.pathname.replace(/^\/|\.html$/g, "").replace(/\//g, "_") || "home"
    );
  }

  private async getSelectorFromLocator(
    locator: Locator
  ): Promise<string | null> {
    return await locator
      .evaluate((el) => {
        if (el.id) return `#${el.id}`;
        const dt =
          el.getAttribute("data-testid") || el.getAttribute("data-test");
        if (dt) return `[data-testid="${dt}"], [data-test="${dt}"]`;
        return null;
      })
      .catch(() => null);
  }

  private getSavedSelector(filePath: string, key: string): string | null {
    if (!fs.existsSync(filePath)) return null;
    const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
    return data[key] || null;
  }

  private saveSelector(filePath: string, key: string, selector: string) {
    const data = fs.existsSync(filePath)
      ? JSON.parse(fs.readFileSync(filePath, "utf8"))
      : {};
    data[key] = selector;
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  }
}
