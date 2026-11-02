import { Field, Form, Formik } from 'formik';
import { ANSWER_KIND_OPTIONS } from './kind';
import type { AnswerPill } from './question';
import type { AccountSelectModel } from '@/components/Accounts/AccountsMultiSelect';
import { AccountsSelect } from '@/components/Accounts/AccountsSelect';

export function AnswerChoices({
  choices,
  accounts,
  onSave,
  saving = false,
}: {
  choices: AnswerPill[];
  accounts: AccountSelectModel[];
  onSave: (next: AnswerPill[]) => void;
  saving?: boolean;
}) {
  return (
    <section className="todo-choices">
      <h2>Answer choices</h2>
      <p>Add the answers you tap the most. Up to four.</p>
      <ul className="todo-choice-list">
        {choices.map((choice, index) => (
          <li key={`${choice.label}-${choice.accountId}`}>
            <span>{choice.label}</span>
            <button
              type="button"
              onClick={() => onSave(choices.filter((_, i) => i !== index))}
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
      {choices.length < 4 ? (
        <Formik
          initialValues={{
            label: '',
            accountId: '',
            assignCategory: 'Expense',
          }}
          onSubmit={(values, helpers) => {
            const accountId = Number(values.accountId);
            const label = values.label.trim();
            if (!label || !accountId) {
              return;
            }
            onSave([
              ...choices,
              {
                label,
                accountId,
                assignCategory: values.assignCategory,
              },
            ]);
            helpers.resetForm();
          }}
        >
          {({ values, setFieldValue }) => (
            <Form className="todo-choice-form">
              <label>
                Name
                <Field name="label" aria-label="Name" />
              </label>
              <label>
                Account
                <AccountsSelect
                  name="accountId"
                  items={accounts}
                  buttonProps={{ 'aria-label': 'Account' }}
                />
              </label>
              <label>
                What it is
                <select
                  aria-label="What it is"
                  value={values.assignCategory}
                  onChange={(event) =>
                    setFieldValue('assignCategory', event.target.value)
                  }
                >
                  {ANSWER_KIND_OPTIONS.map((option) => (
                    <option
                      key={option.value}
                      value={option.value}
                      title={option.tip}
                    >
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <button type="submit" disabled={saving}>
                Add
              </button>
            </Form>
          )}
        </Formik>
      ) : null}
    </section>
  );
}
