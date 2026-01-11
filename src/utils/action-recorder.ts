import { Page, BrowserContext } from "playwright";
import Logger from "./logger";

export class ActionRecorder {
  private logger = new Logger();

  async start(page: Page) {
    this.logger.info(
      "🔴 Recording started... Perform your actions in the browser."
    );

    // Inject a listener into the browser
    await page.exposeBinding(
      "onActionDetected",
      async ({ frame }, actionData) => {
        const { type, name, value, tagName } = actionData;

        // Translate raw events into YOUR framework's BDD language
        let bddStep = "";
        switch (type) {
          case "click":
            if (tagName === "a") {
              bddStep = `And user click "${name}" link`;
            } else {
              bddStep = `And user click "${name}" ${tagName}`;
            }
            break;
          case "fill":
            bddStep = `And user fill "${value}" in "${name}" input`;
            break;
        }

        this.logger.info(`✨ Generated Step: ${bddStep}`);
      }
    );

    // Inject the Client-Side script
    await page.addInitScript(() => {
      window.addEventListener(
        "click",
        (e) => {
          const target = e.target as HTMLElement;
          const name =
            target.innerText || target.getAttribute("aria-label") || target.id;

          (window as any).onActionDetected({
            type: "click",
            tagName: target.tagName.toLowerCase(),
            name: name?.trim().substring(0, 30),
          });
        },
        true
      );

      window.addEventListener(
        "blur",
        (e) => {
          const target = e.target as HTMLInputElement;
          if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") {
            (window as any).onActionDetected({
              type: "fill",
              name: target.placeholder || target.id || target.name,
              value: target.value,
            });
          }
        },
        true
      );
    });
  }
}
