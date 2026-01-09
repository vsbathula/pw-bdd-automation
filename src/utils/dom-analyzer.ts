import { Page } from "playwright";
import Logger from "./logger";

export class DOMAnalyzer {
  private logger = new Logger();

  /**
   * Analyze page structure and suggest selectors for an element
   * */
  async analyzeElement(
    page: Page,
    elementDescription: string
  ): Promise<string[]> {
    this.logger.info(`Analyzing DOM for element: ${elementDescription}`);

    const suggestions: string[] = [];

    try {
      // Get all interactive elements
      const interactiveElements = await page.evaluate(() => {
        const elements: Array<{
          tag: string;
          text: string;
          id: string;
          className: string;
          name: string;
          type: string;
          placeholder: string;
          ariaLabel: string;
          dataTestId: string;
          role: string;
        }> = [];

        // Query all potentially interactive elements
        const selectors = [
          "button",
          "input",
          "select",
          "textarea",
          "a[href]",
          '[role="button"]',
          '[role="link"]',
          '[role="textbox"]',
          "[data-testid]",
          "[onclick]",
          ".btn",
          ".button",
        ];

        selectors.forEach((selector) => {
          document.querySelectorAll(selector).forEach((el) => {
            const element = el as HTMLElement;
            elements.push({
              tag: element.tagName.toLowerCase(),
              text: element.textContent?.trim().substring(0, 100) || "",
              id: element.id || "",
              className: element.className || "",
              name: (element as any).name || "",
              type: (element as any).type || "",
              placeholder: (element as any).placeholder || "",
              ariaLabel: element.getAttribute("aria-label") || "",
              dataTestId: element.getAttribute("data-testid") || "",
              role: element.getAttribute("role") || "",
            });
          });
        });
        return elements;
      });

      // Filter elements that might match the description
      const matchingElements = interactiveElements.filter((el) => {
        this.elementMatches(el, elementDescription);
      });

      // Generate selector suggestions
      for (const el of matchingElements) {
        suggestions.push(...this.generateSelectors(el));
      }

      this.logger.info(`Found ${suggestions.length} potential selectors`);
      return [...new Set(suggestions)]; // Remove duplicates
    } catch (error) {
      this.logger.error(`DOM analysis failed: ${(error as Error).message}`);
      return [];
    }
  }

  private elementMatches(element: any, description: string): boolean {
    const desc = description.toLowerCase();
    const text = element.text.toLowerCase();
    const id = element.id.toLowerCase();
    const className = element.className.toLowerCase();
    const name = element.name.toLowerCase();
    const placeholder = element.placeholder.toLowerCase();
    const ariaLabel = element.ariaLabel.toLowerCase();
    return (
      text.includes(desc) ||
      desc.includes(text) ||
      id.includes(desc) ||
      className.includes(desc) ||
      name.includes(desc) ||
      placeholder.includes(desc) ||
      ariaLabel.includes(desc)
    );
  }

  private generateSelectors(element: any): string[] {
    const selectors: string[] = [];

    // ID selector (highest priority)
    if (element.id) {
      selectors.push(`#${element.id}`);
    }

    // Data-testid selector
    if (element.dataTestId) {
      selectors.push(`[data-testid="${element.dataTestId}"]`);
    }

    // Name attribute
    if (element.name) {
      selectors.push(`[name="${element.name}"]`);
      selectors.push(`${element.tag}[name="${element.name}"]`);
    }

    // Type + name combination
    if (element.type && element.name) {
      selectors.push(`input[type="${element.type}"][name="${element.name}"]`);
    }

    // Placeholder
    if (element.placeholder) {
      selectors.push(`[placeholder="${element.placeholder}"]`);
    }

    // Aria-label
    if (element.ariaLabel) {
      selectors.push(`[aria-label="${element.ariaLabel}"]`);
    }

    // Text-based selectors
    if (element.text && element.text.length < 50) {
      if (element.tag == "button" || element.tag === "a") {
        selectors.push(`${element.tag}:has-text("${element.text}")`);
      }
    }

    // Class-based selectors (be careful with dynamic classes)
    if (
      element.className &&
      !element.className.includes("css-") &&
      !element.className.includes("emotion-")
    ) {
      const classes = element.className.split(" ").filter(
        (cls: string) => cls.length > 2 && !cls.match(/^\w{6,}$/) // Avoid generated class names
      );

      if (classes.length > 0) {
        selectors.push(`.${classes[0]}`);
      }
    }
    return selectors;
  }

  /**
   * Test multiple selectors and return the most reliable one
   */
  async findBestSelector(
    page: Page,
    selectors: string[]
  ): Promise<string | null> {
    const results: Array<{
      selector: string;
      count: number;
      isVisible: boolean;
    }> = [];

    for (const selector of selectors) {
      try {
        const locator = page.locator(selector);
        const count = await locator.count();
        let isVisible = false;

        if (count > 0) {
          isVisible = await locator
            .first()
            .isVisible({ timeout: 1000 })
            .catch(() => false);
        }
        results.push({ selector, count, isVisible });
      } catch (error) {
        results.push({ selector, count: 0, isVisible: false });
      }
    }

    // Prioritize selectors: visible › unique › exists
    const best = results
      .filter((r) => r.count > 0)
      .sort((a, b) => {
        if (a.isVisible !== b.isVisible) return b.isVisible ? 1 : -1;
        if (a.count !== b.count) return a.count - b.count; // Prefer unique selectors
        return 0;
      })[0];
    return best?.selector || null;
  }
}
