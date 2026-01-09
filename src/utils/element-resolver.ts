import { Page, Locator } from "playwright";
import { DOMAnalyzer } from "./dom-analyzer";
import Logger from "./logger";

export class ElementResolver {
  private logger = new Logger();
  private cache = new Map<string, string>();
  private domAnalyzer = new DOMAnalyzer();

  async resolve(
    page: Page,
    elementName: string,
    elementType?: string,
    scenarioId?: string
  ): Promise<Locator> {
    const url = page.url();
    const cacheKey = `${url}_${elementName}_${scenarioId} || "default"}_${Date.now()}`;

    this.logger.info(
      `🔍 Resolving element: "${elementName}" of type: "${elementType}"`
    );

    // Check cache first
    if (this.cache.has(cacheKey)) {
      const cachedSelector = this.cache.get(cacheKey)!;
      const locator = page.locator(cachedSelector);
      if ((await locator.count()) > 0) {
        this.logger.info(
          `Using cached selector for "${elementName}": ${cachedSelector}`
        );
        return locator;
      }
    }

    // Try element-type specific strategies first
    const typeSelector = await this.tryTypeSpecificStrategies(
      page,
      elementName,
      elementType
    );

    if (typeSelector) {
      this.cache.set(cacheKey, typeSelector);
      this.logger.info(
        `✅ Found "${elementName}" with type-specific strategy: ${typeSelector}`
      );
      return page.locator(typeSelector);
    }

    // Try role-based strategies directly (without caching)
    if (elementType == "button") {
      try {
        this.logger.info(
          `Trying role-based button strategies for: "${elementName}"`
        );
        const roleLocator = page.getByRole("button", {
          name: elementName,
          exact: true,
        });
        if (
          (await roleLocator.count()) > 0 &&
          (await roleLocator.first().isVisible({ timeout: 1000 }))
        ) {
          this.logger.info(
            `✅ Found button "${elementName}" using getByRole exact match`
          );
          return roleLocator;
        }
        const roleRegexLocator = page.getByRole("button", {
          name: new RegExp(elementName, "i"),
        });
        if (
          (await roleRegexLocator.count()) > 0 &&
          (await roleRegexLocator.first().isVisible({ timeout: 1000 }))
        ) {
          this.logger.info(
            `✅ Found button "${elementName}" using getByRole regex match`
          );
          return roleRegexLocator;
        }
      } catch (error) {
        this.logger.info(
          `Role-based button strategies failed: ${(error as Error).message}`
        );
      }
    }

    // Try quick strategies first
    const quickSelector = await this.tryQuickStrategies(page, elementName);

    if (quickSelector) {
      this.cache.set(cacheKey, quickSelector);
      return page.locator(quickSelector);
    }

    // Fallback to DOM analysis
    this.logger.info(
      `Quick strategies failed for "${elementName}", analyzing DOM...`
    );

    const suggestions = await this.domAnalyzer.analyzeElement(
      page,
      elementName
    );

    if (suggestions.length > 0) {
      const bestSelector = await this.domAnalyzer.findBestSelector(
        page,
        suggestions
      );
      if (bestSelector) {
        this.logger.info(
          `Found element "${elementName}" using DOM analysis: ${bestSelector}`
        );
        this.cache.set(cacheKey, bestSelector);
        return page.locator(bestSelector);
      }
    }
    throw new Error(
      `Could not locate element, "${elementName}" after trying ${suggestions.length} strategies`
    );
  }

  private async tryTypeSpecificStrategies(
    page: Page,
    name: string,
    elementType?: string
  ): Promise<string | null> {
    switch (elementType) {
      case "link":
        return await this.tryLinkStrategies(page, name);
      case "button":
        return await this.tryButtonStrategies(page, name);
      case "input":
        return await this.tryInputStrategies(page, name);
      case "dropdown":
        return await this.tryDropdownStrategies(page, name);
      case "checkbox":
      case "radio":
        return await this.tryCheckboxRadioStrategies(page, name, elementType);
      default:
        return null;
    }
  }

  private async tryLinkStrategies(
    page: Page,
    name: string
  ): Promise<string | null> {
    this.logger.info(`🔍 Looking for link with name: "${name}"`);
    const strategies = [
      // For "forgot username" type scenarios
      `a:has-text("${name}")`,
      `a[id*="${name}" i]`,
      `a[href*="${name}" i]`,
      `a[alt*="${name}" i]`,
      `a[title*="${name}" i]`,
      () => page.getByRole("link", { name: name, exact: true }),
      () => page.getByRole("link", { name: new RegExp(name, "i") }),
    ];
    return await this.executeStrategies(page, strategies, name);
  }

  private async tryButtonStrategies(
    page: Page,
    name: string
  ): Promise<string | null> {
    this.logger.info(`🔍 Looking for button with name: "${name}"`);

    const strategies = [
      // Try data-test-id and data-testid first (most reliable)
      `button[data-test-id*="${name}" i]`,
      `button [data-testid*="${name}" i]`,
      `[data-test-id*="${name}" i]`,
      `[data-testid*="${name}" i]`,

      // ID and direct name matching
      `#${name}`,
      `button[id*="${name}" i]`,
      `button[name="${name}"]`,

      // Text content matching (most common case)
      `button:has-text("${name}")`,
      `input[type="submit"][value*="${name}" i]`,

      // Aria-label and title attributes
      `button[aria-label*="${name}" i]`,
      `button[title*="${name}" i]`,

      // Class-based fallback (in case button uses class names)
      `button[class*="${name}" i]`,

      // Generic button with text content (broader match)
      `button:text("${name}")`,
      `input[type="button"][value*="${name}" i]`,
    ];

    return await this.executeStrategies(page, strategies, name);
  }

  private async tryInputStrategies(
    page: Page,
    name: string
  ): Promise<string | null> {
    this.logger.info(`🔍 Looking for input with name: "${name}"`);
    const strategies = [
      // Direct name and ID matches (highest priority)
      `input[name="${name}"]`,
      `#${name}'`,

      // Placeholder and aria-label matches
      `input[placeholder*="${name}" i]`,
      `input[aria-label*="${name}" i]`,

      // Input with data-testid
      `input[data-testid*="${name}" i]`,

      // Input with type attribute
      `input[type="${name}"]`,

      // Role-based (Playwright semantic selectors)
      () => page.getByLabel(new RegExp(name, "i")),
      () => page.getByRole("textbox", { name: new RegExp(name, "i") }),
      () => page.getByPlaceholder(new RegExp(name, "i")),
    ];

    return await this.executeStrategies(page, strategies, name);
  }

  private async tryDropdownStrategies(
    page: Page,
    name: string
  ): Promise<string | null> {
    this.logger.info(`🔍 Looking for dropdown with name: "${name}"`);
    const strategies = [
      `select[name="${name}"]`,
      `#${name}`,
      () => page.getByRole("combobox", { name: new RegExp(name, "i") }),
      `select[aria-label*="${name}" i]`,
    ];
    return await this.executeStrategies(page, strategies, name);
  }

  private async tryCheckboxRadioStrategies(
    page: Page,
    name: string,
    type: string
  ): Promise<string | null> {
    this.logger.info(`🔍 Looking for checkbox/radio with name: "${name}"`);
    const strategies = [
      `input[type="${type}"][name="${name}"]`,
      `#${name}`,
      () => page.getByRole(type as any, { name: new RegExp(name, "i") }),
      `input[type="${type}"][aria-label*="${name}" i]`,
    ];
    return await this.executeStrategies(page, strategies, name);
  }

  private async executeStrategies(
    page: Page,
    strategies: any[],
    name: string
  ): Promise<string | null> {
    for (let i = 0; i < strategies.length; i++) {
      const strategy = strategies[i];
      try {
        let locator: Locator;
        let selector: string;

        if (typeof strategy === "function") {
          const result = strategy();
          if (!result) continue;

          if (typeof result === "string") {
            locator = page.locator(result);
            selector = result;
          } else {
            locator = result;
            if (
              (await locator.count()) > 0 &&
              (await locator.first().isVisible({ timeout: 1000 }))
            ) {
              // For role-based locators, we need to return a special identifier
              // that the calling code can handle properly
              this.logger.info(
                `Found element "${name}" using role-based strategy ${i}`
              );
              // Store the actual locator in a way we can retrieve it
              return `__ROLE_LOCATOR_${i}__`;
            }
            continue;
          }
        } else {
          locator = page.locator(strategy);
          selector = strategy;
        }

        if (
          (await locator.count()) > 0 &&
          (await locator.first().isVisible({ timeout: 1000 }))
        ) {
          this.logger.info(
            `✅ Found element "$(name}" using strategy: $(selector}`
          );
          return selector;
        }
      } catch (error) {
        this.logger.info(`Strategy ${i} failed: ${(error as Error).message}`);
        continue;
      }
    }
    return null;
  }

  private async tryQuickStrategies(
    page: Page,
    name: string
  ): Promise<string | null> {
    const strategies = [
      // High-confidence selectors
      `[data-testid="${name}"]`,
      `[data-testid*="${name}" i]`,
      `#${name}`,
      `[name="${name}"]`,

      // Link-specific strategies (fast and reliable)
      async () => {
        const linkLocator = page.getByRole("link", { name: name, exact: true });
        if ((await linkLocator.count()) > 0)
          return `getByRole('link', { name: '${name}', exact: true })`;
        return null;
      },
      async () => {
        const linkLocator = page.getByRole("link", {
          name: new RegExp(name, "i"),
        });
        if ((await linkLocator.count()) > 0)
          return `getByRole('link', { name: /${name}/i })`;
        return null;
      },

      // Button-specific strategies
      async () => {
        const buttonLocator = page.getByRole("button", {
          name: name,
          exact: true,
        });
        if ((await buttonLocator.count()) > 0)
          return `getByRole('button', { name: '${name}', exact: true })`;
        return null;
      },
      async () => {
        const buttonLocator = page.getByRole("button", {
          name: new RegExp(name, "i"),
        });
        if ((await buttonLocator.count()) > 0)
          return `getByRole('button', { name: /${name}/i })`;
        return null;
      },

      // Fallback CSS selectors
      `button:has-text("${name}")`,
      `a:has-text("${name}")`,

      // Input-specific
      `input[placeholder*="${name}" i]`,
      `input[aria-label*="${name}" i]`,

      // Generic text match
      `*:has-text("${name}"):visible`,
    ];

    for (const strategy of strategies) {
      try {
        let selector: string | null = null;
        let locator: Locator;

        if (typeof strategy === "function") {
          // Handle async function strategies
          selector = await strategy();
          if (!selector) continue;

          // Create locator based on the strategy type
          if (selector.includes("getByRole")) {
            if (selector.includes("'link'")) {
              locator = selector.includes("exact: true")
                ? page.getByRole("link", { name: name, exact: true })
                : page.getByRole("link", { name: new RegExp(name, "i") });
            } else {
              locator = selector.includes("exact: true")
                ? page.getByRole("button", { name: name, exact: true })
                : page.getByRole("button", { name: new RegExp(name, "i") });
            }
          } else {
            locator = page.locator(selector);
          }
        } else {
          // Handle string selectors
          selector = strategy;
          locator = page.locator(selector);
        }

        if (
          (await locator.count()) > 0 &&
          (await locator.first().isVisible({ timeout: 1000 }))
        ) {
          return selector;
        }
      } catch {
        continue;
      }
    }

    return null;
  }

  clearCache() {
    this.cache.clear();
  }
}
