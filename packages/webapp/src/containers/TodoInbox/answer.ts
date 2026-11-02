import type { RulePlan } from './planRule';

export async function answerTodo(input: {
  categorize: () => Promise<unknown>;
  createRule?: () => Promise<unknown>;
  plan?: RulePlan;
}): Promise<void> {
  await input.categorize();
  const shouldCreate = input.plan
    ? input.plan.kind === 'create'
    : input.createRule != null;
  if (shouldCreate) {
    await input.createRule?.();
  }
}
