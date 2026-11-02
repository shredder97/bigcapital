import { Inject, Injectable } from '@nestjs/common';
import { AccountingBasis } from '@/common/types/AccountingBasis';
import { ReportsAction } from '../FinancialStatements/types/Report.types';
import { LlmToolDefinition } from './AnthropicLlmClient';

export const PROFIT_LOSS_SHEET = Symbol('PROFIT_LOSS_SHEET');
export const GENERAL_LEDGER_SHEET = Symbol('GENERAL_LEDGER_SHEET');

interface ReportSheet {
  sheet(query: any): Promise<any>;
}

const BYTE_CAP = 20 * 1024;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

const TOOLS: Record<
  string,
  { permission: ReportsAction; description: string }
> = {
  profit_loss: {
    permission: ReportsAction.READ_PROFIT_LOSS,
    description: 'Profit and loss totals between two dates. Accrual basis.',
  },
  account_activity: {
    permission: ReportsAction.READ_GENERAL_LEDGET,
    description:
      'General-ledger activity for up to 10 accounts between two dates. Accrual basis.',
  },
};

function capText(text: string): string {
  if (Buffer.byteLength(text) <= BYTE_CAP) return text;
  let end = Math.min(text.length, BYTE_CAP);
  while (end > 0 && Buffer.byteLength(text.slice(0, end)) > BYTE_CAP) end -= 1;
  return text.slice(0, end);
}

function unexpected(input: unknown, allowed: string[]): string | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return 'invalid arguments';
  }
  for (const key of Object.keys(input)) {
    if (!allowed.includes(key)) return `unexpected property ${key}`;
  }
  return null;
}

function dates(input: Record<string, unknown>): string | null {
  if (typeof input.fromDate !== 'string' || !DATE.test(input.fromDate)) {
    return 'invalid fromDate';
  }
  if (typeof input.toDate !== 'string' || !DATE.test(input.toDate)) {
    return 'invalid toDate';
  }
  return null;
}

function walkNode(node: any): any {
  if (!node || typeof node !== 'object') return null;
  const children = Array.isArray(node.children)
    ? node.children.map(walkNode).filter(Boolean)
    : undefined;
  return {
    id: node.id,
    amount: node.total?.amount ?? node.amount ?? null,
    name: node.name,
    ...(children?.length ? { children } : {}),
  };
}

function netIncome(nodes: any[]): number | null {
  const stack = Array.isArray(nodes) ? [...nodes] : [];
  while (stack.length) {
    const node = stack.shift();
    if (node?.id === 'NET_INCOME') {
      const amount = node.total?.amount ?? node.amount;
      return typeof amount === 'number' ? amount : null;
    }
    if (Array.isArray(node?.children)) stack.push(...node.children);
  }
  return null;
}

@Injectable()
export class AiAskTools {
  constructor(
    @Inject(PROFIT_LOSS_SHEET) private readonly profitLoss: ReportSheet,
    @Inject(GENERAL_LEDGER_SHEET) private readonly generalLedger: ReportSheet,
  ) {}

  definitions(): LlmToolDefinition[] {
    return [
      {
        name: 'profit_loss',
        description: TOOLS.profit_loss.description,
        input_schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            fromDate: { type: 'string' },
            toDate: { type: 'string' },
          },
          required: ['fromDate', 'toDate'],
        },
      },
      {
        name: 'account_activity',
        description: TOOLS.account_activity.description,
        input_schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            fromDate: { type: 'string' },
            toDate: { type: 'string' },
            accountsIds: {
              type: 'array',
              items: { type: 'number' },
              maxItems: 10,
            },
          },
          required: ['fromDate', 'toDate'],
        },
      },
      {
        name: 'answer',
        description:
          'Final plain-English answer. Include a bar chart only when it helps.',
        input_schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            answer: { type: 'string' },
            chart: { type: ['object', 'null'] },
          },
          required: ['answer'],
        },
      },
    ];
  }

  isKnown(name: string): boolean {
    return name in TOOLS;
  }

  permission(name: string): ReportsAction | undefined {
    return TOOLS[name]?.permission;
  }

  async run(name: string, input: unknown): Promise<string> {
    if (name === 'profit_loss') return this.profitLossTool(input);
    if (name === 'account_activity') return this.activityTool(input);
    return `unknown tool ${name}`;
  }

  private async profitLossTool(input: unknown): Promise<string> {
    const extra = unexpected(input, ['fromDate', 'toDate']);
    if (extra) return extra;
    const record = input as Record<string, unknown>;
    const dateError = dates(record);
    if (dateError) return dateError;
    const sheet = await this.profitLoss.sheet({
      fromDate: record.fromDate as string,
      toDate: record.toDate as string,
      basis: AccountingBasis.Accrual,
    } as never);
    const nodes = Array.isArray(sheet?.data) ? sheet.data.map(walkNode) : [];
    return capText(
      JSON.stringify({
        basis: AccountingBasis.Accrual,
        fromDate: record.fromDate,
        toDate: record.toDate,
        netIncome: netIncome(sheet?.data),
        nodes,
      }),
    );
  }

  private async activityTool(input: unknown): Promise<string> {
    const extra = unexpected(input, ['fromDate', 'toDate', 'accountsIds']);
    if (extra) return extra;
    const record = input as Record<string, unknown>;
    const dateError = dates(record);
    if (dateError) return dateError;
    const accountsIds = Array.isArray(record.accountsIds)
      ? record.accountsIds
      : [];
    if (
      accountsIds.length > 10 ||
      accountsIds.some((id) => typeof id !== 'number' || !Number.isFinite(id))
    ) {
      return 'invalid accountsIds';
    }
    try {
      const sheet = await this.generalLedger.sheet({
        fromDate: record.fromDate as string,
        toDate: record.toDate as string,
        accountsIds: accountsIds as number[],
        basis: AccountingBasis.Accrual,
      } as never);
      const accounts = Array.isArray(sheet?.data)
        ? sheet.data.map((account) => ({
            id: account.id,
            name: account.name,
            transactions: (account.transactions || []).map((tx) => ({
              date: tx.date,
              amount: tx.amount,
              debit: tx.debit,
              credit: tx.credit,
              note: tx.note,
            })),
          }))
        : [];
      return capText(
        JSON.stringify({
          basis: AccountingBasis.Accrual,
          fromDate: record.fromDate,
          toDate: record.toDate,
          accounts,
        }),
      );
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes('Node does not exist')
      ) {
        return JSON.stringify({ accounts: [] });
      }
      return JSON.stringify({ error: 'report unavailable' });
    }
  }
}
