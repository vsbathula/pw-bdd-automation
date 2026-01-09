export interface StepAction {
  action:
    | "navigate"
    | "click"
    | "fill"
    | "select"
    | "check"
    | "assertText"
    | "assertUrl";
  locator?: string; // element selector
  value?: string; // value to fill or assert
  elementType?: "button" | "Link" | "input" | "dropdown" | "checkbox" | "radio";
}

export function parseStep(stepText: string): StepAction {
  stepText = stepText.trim();

  // Navigate - check for "is on" or "navigate to" or "go to"
  let match = stepText.match(/(?:is on|navigate to|go to).*?"([^"]+)"/i);
  if (match) return { action: "navigate", value: match[1] };

  // Fill check for "fill" action with value in quotes and locator after "in" with quotes
  match = stepText.match(
    /fill.*?"([^"]+)".*?in.*?"([^"]+)"(?:\s+(field input|textbox|textbox))?/i
  );
  if (match)
    return {
      action: "fill",
      value: match[1],
      locator: match[2],
      elementType: "input",
    };

  // Click - check for "click" action with locator in quotes
  match = stepText.match(/click.*?"([^"]+)"/i);
  if (match) {
    let elementType: any = "button"; // default
    if (stepText.toLowerCase().includes("link")) {
      elementType = "link";
    } else if (
      stepText.toLowerCase().includes("input") ||
      stepText.toLowerCase().includes("field")
    ) {
      elementType = "input";
    } else if (stepText.toLowerCase().includes("checkbox")) {
      elementType = "checkbox";
    } else if (stepText.toLowerCase().includes("radio")) {
      elementType = "radio";
    } else if (
      stepText.toLowerCase().includes("dropdown") ||
      stepText.toLowerCase().includes("select")
    ) {
      elementType = "dropdown";
    }

    return { action: "click", locator: match[1], elementType };
  }

  // Select from dropdown
  match = stepText.match(/select.*?"([^"]+)".*?from.*?"([^"]+)"/i);
  if (match)
    return {
      action: "select",
      value: match[1],
      locator: match[2],
      elementType: "dropdown",
    };

  // Check checkbox/radio
  match = stepText.match(/check.*?"([^"]+)"/i);
  if (match) {
    let elementType: any = "checkbox";
    if (stepText.toLowerCase().includes("radio")) elementType = "radio";
    return {
      action: "check",
      locator: match[1],
      elementType,
    };
  }
  // Assert text visible - check for "should see"
  match = stepText.match(/should see.*?"([^"]+)"/i);
  if (match) return { action: "assertText", value: match[1] };

  // Assert redirection - check for "should be redirected"
  match = stepText.match(/should be redirected.*?(?:"([^"]+)"|to\s+(\w+))/i);
  if (match) return { action: "assertUrl", value: match[1] || match[2] };

  throw new Error(`Step not recognized: ${stepText}`);
}
