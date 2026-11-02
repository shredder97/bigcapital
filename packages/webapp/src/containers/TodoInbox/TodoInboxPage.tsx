import { useMemo, useState } from 'react';
import './TodoInbox.css';
import { AnswerChoices } from './AnswerChoices';
import { parseAnswerChoices } from './question';
import { TodoInboxView } from './TodoInboxView';
import { useTodoInbox } from './useTodoInbox';
import type { ExistingRule } from './planRule';
import type { AnswerPill } from './question';
import type { AccountSelectModel } from '@/components/Accounts/AccountsMultiSelect';
import type { CreateBankRuleBody } from '@bigcapital/sdk-ts';
import { DialogsName } from '@/constants/dialogs';
import { DRAWERS } from '@/constants/drawers';
import { CategorizeTransactionDrawer } from '@/containers/CashFlow/CategorizeTransaction/drawers/CategorizeTransactionDrawer/CategorizeTransactionDrawer';
import { useAccounts } from '@/hooks/query/accounts/queries';
import { useBankRules, useCreateBankRule } from '@/hooks/query/banking';
import { useCategorizeTransaction } from '@/hooks/query/cashflow-accounts/queries';
import {
  useSaveSettings,
  useSettingCashFlow,
} from '@/hooks/query/settings/queries';
import { useDialogActions, useDrawerActions } from '@/hooks/state';
import { useSetTransactionsToCategorizeSelected } from '@/hooks/state/banking';

const CHOICES_KEY = 'todo_answer_choices';

function readChoices(value: unknown, accounts: Array<{ id?: number | null }>) {
  return parseAnswerChoices(value, accounts);
}

export function TodoInboxPage() {
  const inbox = useTodoInbox();
  const accountsQuery = useAccounts();
  const accounts = useMemo(
    () => (accountsQuery.data ?? []) as AccountSelectModel[],
    [accountsQuery.data],
  );
  const settings = useSettingCashFlow();
  const rulesQuery = useBankRules();
  const { mutateAsync: categorize } = useCategorizeTransaction();
  const { mutateAsync: createRule } = useCreateBankRule();
  const { mutateAsync: saveSettings, isPending: saving } = useSaveSettings();
  const { openDrawer } = useDrawerActions();
  const { openDialog } = useDialogActions();
  const setSelected = useSetTransactionsToCategorizeSelected();
  const [saveFailed, setSaveFailed] = useState(false);

  const pills = useMemo(() => {
    const raw = settings.data?.todoAnswerChoices;
    return readChoices(raw, accounts).map((pill) => ({
      ...pill,
      accountName: accounts.find((account) => account.id === pill.accountId)
        ?.name,
    }));
  }, [settings.data, accounts]);

  const rules = Array.isArray(rulesQuery.data) ? rulesQuery.data : [];

  const saveChoices = (next: AnswerPill[]) => {
    return saveSettings({
      options: [
        {
          group: 'cashflow',
          key: CHOICES_KEY,
          value: JSON.stringify(
            next.map(({ label, accountId, assignCategory }) => ({
              label,
              accountId,
              assignCategory,
            })),
          ),
        },
      ],
    });
  };

  return (
    <>
      <TodoInboxView
        rows={inbox.rows}
        pills={pills}
        rules={rules as ExistingRule[]}
        loading={inbox.loading}
        error={inbox.error || saveFailed}
        onCategorize={async (id, values) => {
          await categorize({ id, values });
        }}
        onCreateRule={(dto) => createRule(dto as CreateBankRuleBody)}
        onSomethingElse={(id) => {
          setSelected([id]);
          openDrawer(DRAWERS.CATEGORIZE_TRANSACTION, {
            uncategorizedTransactionId: id,
          });
        }}
        onEditRule={(ruleId) =>
          openDialog(DialogsName.BankRuleForm, { bankRuleId: ruleId })
        }
        choices={
          <AnswerChoices
            choices={pills}
            accounts={accounts}
            saving={saving}
            onSave={(next) => {
              setSaveFailed(false);
              saveChoices(next).catch(() => setSaveFailed(true));
            }}
          />
        }
      />
      <CategorizeTransactionDrawer name={DRAWERS.CATEGORIZE_TRANSACTION} />
    </>
  );
}
