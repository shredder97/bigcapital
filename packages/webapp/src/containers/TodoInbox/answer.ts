import type { RulePlan } from './planRule';

/**
 * Categorize the tapped row first. Create a rule only after that succeeds.
 */
export async function answerTodo(input: {
  categorize: () => Promise<unknown>;
  createRule: () => Promise<unknown>;
  plan: RulePlan;
}): Promise<void> {
  await input.categorize();
  if (input.plan.kind === 'create') {
    await input.createRule();
  }
}
