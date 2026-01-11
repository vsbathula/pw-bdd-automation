import { Page } from "playwright";
import Logger from "./logger";

type ElementType =
  | "input"
  | "textarea"
  | "button"
  | "link"
  | "select"
  | "checkbox"
  | "radio";

interface RecordedStep {
  action: "click" | "fill" | "select" | "check" | "uncheck" | "assertUrl";
  locator: string;
  value?: string;
  elementType: ElementType;
}

export class ActionRecorder {
  private logger = new Logger();
  private stepBuffer: RecordedStep[] = [];
  private lastFocusTarget: string | null = null;
  private lastClickedUrl: string | null = null;

  async start(page: Page) {
    this.logger.info("🔴 Recorder ACTIVE: Steps will appear below...");

    // Initialize lastClickedUrl
    this.lastClickedUrl = page.url();

    // Listen for navigation events to capture redirects
    page.on("framenavigated", (frame) => {
      const newUrl = frame.url();
      if (this.lastClickedUrl && this.lastClickedUrl !== newUrl) {
        const locator = this.urlToPageName(newUrl);
        const step: RecordedStep = {
          action: "assertUrl",
          locator,
          value: newUrl,
          elementType: "link",
        };
        this.stepBuffer.push(step);
        this.logger.info(
          `✨ Generated Step: Then user should be redirected to "${locator}"`
        );

        this.lastClickedUrl = newUrl;
      }
    });

    // Expose handler for browser events
    await page.exposeBinding("onActionDetected", async ({}, data) => {
      // Track URL before clicks
      if (["click"].includes(data.action)) {
        this.lastClickedUrl = page.url();
      }

      const step = this.processEvent(data);
      if (step) {
        this.stepBuffer.push(step);
        this.logger.info(`✨ Generated Step: ${this.renderStep(step)}`);
      }
    });

    // Inject browser-side listeners
    await page.addInitScript(() => {
      const extractName = (el: HTMLElement) =>
        el.getAttribute("aria-label") ||
        (el.innerText && el.innerText.trim().split("\n")[0]) ||
        el.getAttribute("placeholder") ||
        el.getAttribute("name") ||
        el.id;

      // Click listener
      window.addEventListener(
        "click",
        (e) => {
          const target = e.target as HTMLElement;
          const tag = target.tagName.toLowerCase();
          const type = (target as HTMLInputElement).type;
          const role = target.getAttribute("role") || "";

          const allowedTags = ["input", "textarea", "button", "a", "select"];
          const semanticRole = role.match(/button|link/i);

          if (!allowedTags.includes(tag) && !semanticRole) return;

          const name = extractName(target);
          if (!name) return;

          let action: "click" | "fill" | "select" | "check" | "uncheck" =
            "click";

          if (tag === "input") {
            const inputEl = target as HTMLInputElement;
            if (type === "checkbox")
              action = inputEl.checked ? "check" : "uncheck";
            else if (type === "radio") action = "check";
            else if (type === "submit" || type === "button") action = "click";
            else return;
          } else if (tag === "select") action = "select";

          (window as any).onActionDetected({
            action,
            name,
            tagName: tag,
            value: (target as HTMLInputElement | HTMLSelectElement).value,
          });
        },
        true
      );

      // Input/textarea blur -> fill
      window.addEventListener(
        "blur",
        (e) => {
          const target = e.target as HTMLInputElement | HTMLTextAreaElement;
          if (target.tagName !== "INPUT" && target.tagName !== "TEXTAREA")
            return;
          if (!target.value) return;

          const name =
            target.getAttribute("aria-label") ||
            target.placeholder ||
            target.name ||
            target.id;

          if (!name) return;

          (window as any).onActionDetected({
            action: "fill",
            name,
            tagName: target.tagName.toLowerCase(),
            value: target.value,
          });
        },
        true
      );

      // Select change
      window.addEventListener(
        "change",
        (e) => {
          const target = e.target as HTMLSelectElement;
          if (target.tagName !== "SELECT") return;

          const name =
            target.getAttribute("aria-label") ||
            target.name ||
            target.id ||
            target.tagName;

          (window as any).onActionDetected({
            action: "select",
            name,
            tagName: "select",
            value: target.value,
          });
        },
        true
      );
    });
  }

  private processEvent(data: any): RecordedStep | null {
    const { action, name, tagName, value } = data;

    if (!name || name.trim() === "") return null;

    let elementType: ElementType;
    switch (tagName) {
      case "input":
        elementType =
          action === "check" || action === "uncheck"
            ? (action as "checkbox" | "radio")
            : "input";
        break;
      case "textarea":
        elementType = "textarea";
        break;
      case "button":
        elementType = "button";
        break;
      case "a":
        elementType = "link";
        break;
      case "select":
        elementType = "select";
        break;
      default:
        elementType = "input";
    }

    // Collapse focus + fill
    if (action === "fill" && this.lastFocusTarget === name) {
      this.lastFocusTarget = null;
      const lastStep = this.stepBuffer[this.stepBuffer.length - 1];
      if (
        lastStep &&
        lastStep.locator === name &&
        lastStep.action === "click"
      ) {
        this.stepBuffer.pop();
      }
    }

    if (["fill", "select", "check", "uncheck"].includes(action)) {
      return { action, locator: name.trim(), value, elementType };
    }

    if (action === "click") {
      if (elementType === "input") return null;
      return { action, locator: name.trim(), elementType };
    }

    return null;
  }

  private renderStep(step: RecordedStep): string {
    switch (step.action) {
      case "fill":
        return `And user fill "${step.value}" in "${step.locator}" ${step.elementType}`;
      case "click":
        return `And user click "${step.locator}" ${step.elementType}`;
      case "select":
        return `And user select "${step.value}" in "${step.locator}" ${step.elementType}`;
      case "check":
        return `And user check "${step.locator}" ${step.elementType}`;
      case "uncheck":
        return `And user uncheck "${step.locator}" ${step.elementType}`;
      case "assertUrl":
        return `Then user should be redirected to "${step.locator}"`;
      default:
        return `And user ${step.action} "${step.locator}"`;
    }
  }

  // Convert URL to human-readable page name
  private urlToPageName(url: string): string {
    try {
      const u = new URL(url);
      const path = u.pathname.replace(/\//g, " ").trim();
      return path || "home page";
    } catch {
      return url;
    }
  }

  // Retrieve all recorded steps
  public getSteps(): RecordedStep[] {
    return this.stepBuffer;
  }
}
