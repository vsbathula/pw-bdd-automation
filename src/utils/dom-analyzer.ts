import { Page } from "playwright";
import stringSimilarity from "string-similarity";
import Logger from "./logger";

export class DOMAnalyzer {
  private logger = new Logger();
  private readonly SIMILARITY_THRESHOLD = 0.6;

  async analyzeElementAcrossFrames(
    page: Page,
    description: string
  ): Promise<string[]> {
    let allSuggestions: string[] = [];

    for (const frame of page.frames()) {
      try {
        const elements = await frame.evaluate(() => {
          const items: any[] = [];

          // Recursive function to pierce Shadow Roots
          const collectElements = (root: Document | ShadowRoot) => {
            const selectors = [
              "button",
              "input",
              "a[href]",
              "[role='button']",
              "[data-testid]",
              "select",
            ];

            // 1. Find elements in current root
            root.querySelectorAll(selectors.join(",")).forEach((el) => {
              const element = el as HTMLElement;
              items.push({
                tag: element.tagName.toLowerCase(),
                text: element.textContent?.trim().substring(0, 50) || "",
                id: element.id || "",
                name: (element as any).name || "",
                placeholder: (element as any).placeholder || "",
                dataTestId:
                  element.getAttribute("data-testid") ||
                  element.getAttribute("data-test") ||
                  "",
              });
            });

            // 2. Look for nested Shadow Roots
            root.querySelectorAll("*").forEach((el) => {
              if (el.shadowRoot) {
                collectElements(el.shadowRoot);
              }
            });
          };

          collectElements(document);
          return items;
        });

        const matches = elements.filter((el) =>
          this.elementMatches(el, description)
        );
        for (const el of matches) {
          if (el.dataTestId)
            allSuggestions.push(
              `[data-testid="${el.dataTestId}"], [data-test="${el.dataTestId}"]`
            );
          if (el.id) allSuggestions.push(`#${el.id}`);
          if (el.text) allSuggestions.push(`${el.tag}:has-text("${el.text}")`);
        }
      } catch (e) {
        continue;
      }
    }
    return [...new Set(allSuggestions)];
  }

  private elementMatches(el: any, description: string): boolean {
    const target = description.toLowerCase().trim();
    const attributes = [el.text, el.id, el.name, el.placeholder, el.dataTestId]
      .map((v) => v.toLowerCase().trim())
      .filter((v) => v !== "");

    if (attributes.some((a) => a.includes(target))) return true;
    const bestMatch = stringSimilarity.findBestMatch(
      target,
      attributes.length ? attributes : [""]
    );
    return bestMatch.bestMatch.rating > this.SIMILARITY_THRESHOLD;
  }
}
