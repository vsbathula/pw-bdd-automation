declare module "node-nlp" {
  export class NlpManager {
    constructor(config?: any);
    addDocument(lang: string, utterance: string, intent: string): void;
    addBetweenCondition(
      lang: string,
      entity: string,
      left: string,
      right: string
    ): void;
    addAfterCondition(lang: string, entity: string, after: string): void;
    train(): Promise<void>;
    process(lang: string, utterance: string): Promise<any>;
    save(filename?: string): void;
    load(filename?: string): void;
    container: any;
  }
}
