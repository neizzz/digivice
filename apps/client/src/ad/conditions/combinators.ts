import type { AdContext, AdDisplayCondition } from "../AdDisplayPolicy";

/**
 * AND 조건 조합
 * 모든 조건이 만족되어야 함
 */
export class AndCondition implements AdDisplayCondition {
  name = "and";
  private conditions: AdDisplayCondition[];

  constructor(conditions: AdDisplayCondition[]) {
    this.conditions = conditions;
  }

  async check(context: AdContext): Promise<boolean> {
    for (const condition of this.conditions) {
      const result = await condition.check(context);
      if (!result) {
        console.log(`[AndCondition] Failed at condition: ${condition.name}`);
        return false;
      }
    }
    return true;
  }
}

/**
 * OR 조건 조합
 * 하나 이상의 조건이 만족되면 됨
 */
export class OrCondition implements AdDisplayCondition {
  name = "or";
  private conditions: AdDisplayCondition[];

  constructor(conditions: AdDisplayCondition[]) {
    this.conditions = conditions;
  }

  async check(context: AdContext): Promise<boolean> {
    for (const condition of this.conditions) {
      const result = await condition.check(context);
      if (result) {
        console.log(`[OrCondition] Passed at condition: ${condition.name}`);
        return true;
      }
    }
    return false;
  }
}

/**
 * NOT 조건
 * 조건의 반대
 */
export class NotCondition implements AdDisplayCondition {
  name = "not";
  private condition: AdDisplayCondition;

  constructor(condition: AdDisplayCondition) {
    this.condition = condition;
  }

  async check(context: AdContext): Promise<boolean> {
    const result = await this.condition.check(context);
    return !result;
  }
}
