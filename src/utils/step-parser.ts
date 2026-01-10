import { manager } from "../nlp/nlp-processor";

export interface StepAction {
  action:
    | "navigate"
    | "click"
    | "fill"
    | "select"
    | "check"
    | "uncheck"
    | "assertText"
    | "assertUrl";
  locator?: string;
  value?: string;
  elementType?: "button" | "link" | "input" | "dropdown" | "checkbox" | "radio";
}

/**
 * Your Mapping Object now returns the strict 'StepAction' type
 */
const IntentMap: Record<string, (entities: any, text: string) => StepAction> = {
  navigate: (e) => ({
    action: "navigate",
    // Prioritize the extracted URL path over the descriptive page name
    value: e.urlPath || e.page,
  }),
  fill: (e) => ({
    action: "fill",
    locator: e.element,
    value: e.value,
    elementType: "input",
  }),
  click: (e, text) => ({
    action: "click",
    locator: e.element,
    elementType: text.toLowerCase().includes("link") ? "link" : "button",
  }),
  select: (e) => ({
    action: "select",
    locator: e.element,
    value: e.value,
    elementType: "dropdown",
  }),
  check: (e) => ({
    action: "check",
    locator: e.element,
    value: e.value,
    elementType: "checkbox",
  }),
  uncheck: (e) => ({
    action: "uncheck",
    locator: e.element,
    value: e.value,
    elementType: "checkbox",
  }),
  radio: (e) => ({
    action: "click",
    locator: e.element,
    value: e.value,
    elementType: "radio",
  }),
  assertText: (e) => ({ action: "assertText", value: e.message || e.value }),
  assertUrl: (e) => ({ action: "assertUrl", value: e.page }),
};

/**
 * Parses Gherkin text into a structured StepAction.
 */
export async function parseStep(stepText: string): Promise<StepAction> {
  // 1. Bulletproof URL Regex
  const urlMatch = stepText.match(/\/["\w\d\-\/]*|\/$/);

  // 2. Process using the manager exported from nlp-processor
  const response = await manager.process("en", stepText);

  // 3. Fallback for navigation if NLP fails
  if (
    (!response.intent || response.intent === "None") &&
    (stepText.toLowerCase().includes("is on") ||
      stepText.toLowerCase().includes("goes to"))
  ) {
    return {
      action: "navigate",
      value: urlMatch ? urlMatch[0].replace(/"/g, "") : "unknown",
    };
  }

  if (!response.intent || response.intent === "None") {
    throw new Error(`Step not recognized: ${stepText}`);
  }

  const entities: any = {};
  const sorted = response.entities.sort((a: any, b: any) => a.start - b.start);

  if (urlMatch) {
    entities.urlPath = urlMatch[0].replace(/"/g, "").trim();
  }

  // Handle Multi-entity steps (Value vs Element)
  if (
    sorted.length >= 2 &&
    !["action.navigate", "assert.text"].includes(response.intent)
  ) {
    entities.value = sorted[0].sourceText.replace(/"/g, "").trim();
    entities.element = sorted[1].sourceText
      .replace(/"/g, "")
      .replace(/\s(input|button|link|checkbox|radio|page|dropdown)$/i, "")
      .trim();
  }

  // General Entity Mapping
  response.entities.forEach((e: any) => {
    let val = e.sourceText.replace(/"/g, "").trim();
    val = val
      .replace(
        /\s(input|button|link|checkbox|radio|page|dropdown|message)$/i,
        ""
      )
      .trim();
    if (e.entity === "page") val = val.replace(/^the\s/i, "");
    entities[e.entity] = val;
  });

  const mapper = IntentMap[response.intent];
  return mapper(entities, stepText);
}
