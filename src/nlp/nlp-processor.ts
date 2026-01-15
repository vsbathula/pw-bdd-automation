import { NlpManager } from "node-nlp";

// Export the manager so the Mapper file can use it for processing
export const manager = new NlpManager({ languages: ["en"], forceNER: true });

export async function trainModel(): Promise<void> {
  manager.addAfterCondition("en", "page", "is on");
  manager.addAfterCondition("en", "page", "to");
  manager.addBetweenCondition("en", "value", "Fill", "in");
  manager.addBetweenCondition("en", "value", "Select", "from");
  manager.addBetweenCondition("en", "value", "Check", "from");
  manager.addBetweenCondition("en", "value", "uncheck", "from");
  manager.addBetweenCondition("en", "message", "see a", "message");

  manager.addAfterCondition("en", "element", "in");
  manager.addAfterCondition("en", "element", "from");
  manager.addAfterCondition("en", "element", "Click");
  manager.addAfterCondition("en", "element", "should be visible");

  manager.addDocument("en", "is on the %page%", "navigate");
  manager.addDocument("en", "goes to %page%", "navigate");
  manager.addDocument("en", "Fill %value% in %element%", "fill");
  manager.addDocument("en", "Click %element%", "click");
  manager.addDocument("en", "Select %value% from %element%", "select");
  manager.addDocument("en", "Check %value% from %element%", "check");
  manager.addDocument("en", "uncheck %value% from %element%", "uncheck");
  manager.addDocument("en", "Select %value% from %element% radio", "radio");
  manager.addDocument("en", "see a %message% message", "assertText");
  manager.addDocument("en", "should redirected to %page%", "assertUrl");
  manager.addDocument("en", "%element% should be visible", "assertVisible");

  await manager.train();
}
