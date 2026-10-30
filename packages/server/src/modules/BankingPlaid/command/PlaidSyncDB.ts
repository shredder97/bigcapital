import * as R from 'ramda';
import * as bluebird from 'bluebird';
import * as uniqid from 'uniqid';
import { entries, groupBy } from 'lodash';
import {
  AccountBase as PlaidAccountBase,
  Item as PlaidItem,
  Institution as PlaidInstitution,
  Transaction as PlaidTransaction,
} from 'plaid';
import {
  transformPlaidAccountToCreateAccount,
  transformPlaidTrxsToCashflowCreate,
} from '../utils';
import { Knex } from 'knex';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { RemovePendingUncategorizedTransaction } from '../../BankingTransactions/commands/RemovePendingUncategorizedTransaction.service';
import { CreateAccountService } from '../../Accounts/CreateAccount.service';
import { Account } from '../../Accounts/models/Account.model';
import { events } from '@/common/events/events';
import { PlaidItem as PlaidItemModel } from '../models/PlaidItem';
import { IAccountCreateDTO } from '@/interfaces/Account';
import { IPlaidTransactionsSyncedEventPayload } from '../types/BankingPlaid.types';
import { UncategorizedBankTransaction } from '../../BankingTransactions/models/UncategorizedBankTransaction';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { CreateUncategorizedTransactionService } from '@/modules/BankingCategorize/commands/CreateUncategorizedTransaction.service';
import { CreateUncategorizedTransactionDTO } from '@/modules/BankingCategorize/types/BankingCategorize.types';
import { TenantModelProxy } from '../../System/models/TenantBaseModel';
import {
  planPlaidRemovals,
  planPlaidSync,
  plaidSyncLookupIds,
  PlaidSyncCommand,
  PlaidSyncedRow,
} from './PlaidTransactionSync';

const CONCURRENCY_ASYNC = 10;

@Injectable()
export class PlaidSyncDb {
  private readonly logger = new Logger(PlaidSyncDb.name);

  constructor(
    private readonly createAccountService: CreateAccountService,
    private readonly createUncategorizedTransaction: CreateUncategorizedTransactionService,
    private readonly removePendingTransaction: RemovePendingUncategorizedTransaction,
    private readonly eventPublisher: EventEmitter2,

    @Inject(Account.name)
    private readonly accountModel: TenantModelProxy<typeof Account>,

    @Inject(PlaidItemModel.name)
    private readonly plaidItemModel: TenantModelProxy<typeof PlaidItemModel>,

    @Inject(UncategorizedBankTransaction.name)
    private readonly uncategorizedBankTransactionModel: TenantModelProxy<
      typeof UncategorizedBankTransaction
    >,
  ) {}

  /**
   * Syncs the Plaid bank account.
   * @param {IAccountCreateDTO} createBankAccountDTO
   * @param {Knex.Transaction} trx
   * @returns {Promise<void>}
   */
  public async syncBankAccount(
    createBankAccountDTO: IAccountCreateDTO,
    trx?: Knex.Transaction,
  ) {
    const plaidAccount = await this.accountModel()
      .query(trx)
      .findOne('plaidAccountId', createBankAccountDTO.plaidAccountId);
    // Can't continue if the Plaid account is already created.
    if (plaidAccount) {
      return;
    }
    await this.createAccountService.createAccount(createBankAccountDTO, trx, {
      ignoreUniqueName: true,
      ignoreAccountCode: true,
    });
  }

  /**
   * Syncs the plaid accounts to the system accounts.
   * @param {PlaidAccount[]} plaidAccounts
   * @returns {Promise<void>}
   */
  public async syncBankAccounts(
    plaidAccounts: PlaidAccountBase[],
    institution: PlaidInstitution,
    item: PlaidItem,
    trx?: Knex.Transaction,
  ): Promise<void> {
    const transformToPlaidAccounts = R.curry(
      transformPlaidAccountToCreateAccount,
    )(item, institution);
    const accountCreateDTOs = R.map(transformToPlaidAccounts)(plaidAccounts);

    await bluebird.map(
      accountCreateDTOs,
      (createAccountDTO: any) => this.syncBankAccount(createAccountDTO, trx),
      { concurrency: CONCURRENCY_ASYNC },
    );
  }

  /**
   * Synsc the Plaid transactions to the system GL entries.
   * @param {number} plaidAccountId - Plaid account ID.
   * @param {PlaidTransaction[]} plaidTranasctions - Plaid transactions
   * @return {Promise<void>}
   */
  public async syncAccountTranactions(
    plaidAccountId: number,
    plaidTranasctions: PlaidTransaction[],
    trx?: Knex.Transaction,
  ): Promise<void> {
    const batch = uniqid();
    const cashflowAccount = await this.accountModel()
      .query(trx)
      .findOne({ plaidAccountId })
      .throwIfNotFound();

    const incoming = plaidTranasctions.map((transaction) =>
      transformPlaidTrxsToCashflowCreate(
        cashflowAccount.id,
        transaction as any,
      ),
    );
    const existing = await this.loadSyncedRows(
      plaidSyncLookupIds(incoming),
      trx,
      cashflowAccount.id,
    );
    await this.applyCommands(planPlaidSync(incoming, existing), batch, trx);
    // Triggers `onPlaidTransactionsSynced` event.
    await this.eventPublisher.emitAsync(events.plaid.onTransactionsSynced, {
      plaidAccountId,
      batch,
      trx,
    } as IPlaidTransactionsSyncedEventPayload);
  }

  /**
   * Syncs the accounts transactions in paraller under controlled concurrency.
   * @param {PlaidTransaction[]} plaidTransactions
   * @return {Promise<void>}
   */
  public async syncAccountsTransactions(
    plaidAccountsTransactions: PlaidTransaction[],
    trx?: Knex.Transaction,
  ): Promise<void> {
    const groupedTrnsxByAccountId = entries(
      groupBy(plaidAccountsTransactions, 'account_id'),
    );
    await bluebird.map(
      groupedTrnsxByAccountId,
      ([plaidAccountId, plaidTransactions]: [number, PlaidTransaction[]]) => {
        return this.syncAccountTranactions(
          plaidAccountId,
          plaidTransactions,
          trx,
        );
      },
      { concurrency: CONCURRENCY_ASYNC },
    );
  }

  /**
   * Syncs the removed Plaid transactions ids from the cashflow system transactions.
   * @param {string[]} plaidTransactionsIds - Plaid Transactions IDs.
   */
  public async syncRemoveTransactions(
    plaidTransactionsIds: string[],
    trx?: Knex.Transaction,
  ) {
    if (!plaidTransactionsIds?.length) {
      return;
    }
    const existing = await this.loadSyncedRows(plaidTransactionsIds, trx);
    await this.applyCommands(
      planPlaidRemovals(plaidTransactionsIds, existing),
      undefined,
      trx,
    );
  }

  /**
   * Loads uncategorized rows for the given Plaid ids. Account scope applies
   * only when `accountId` is set; removals are matched by Plaid id alone.
   */
  private async loadSyncedRows(
    plaidTransactionIds: string[],
    trx?: Knex.Transaction,
    accountId?: number,
  ): Promise<PlaidSyncedRow[]> {
    if (!plaidTransactionIds.length) {
      return [];
    }
    const query = this.uncategorizedBankTransactionModel().query(trx);
    if (accountId !== undefined) {
      query.where('accountId', accountId);
    }
    const rows = await query
      .whereIn('plaidTransactionId', plaidTransactionIds)
      .withGraphFetched('matchedBankTransactions');

    return rows.map((row) => {
      const matched = (
        row as UncategorizedBankTransaction & {
          matchedBankTransactions?: unknown[];
        }
      ).matchedBankTransactions;
      return {
        id: row.id,
        plaidTransactionId: row.plaidTransactionId,
        pending: !!row.pending,
        categorized: !!row.categorized,
        categorizeRefId: row.categorizeRefId ?? null,
        excludedAt: row.excludedAt ?? null,
        matched: (matched?.length ?? 0) > 0,
      };
    });
  }

  /**
   * Applies planner commands in order. `pending` is never part of a patch.
   */
  private async applyCommands(
    commands: PlaidSyncCommand<CreateUncategorizedTransactionDTO>[],
    batch: string | undefined,
    trx?: Knex.Transaction,
  ): Promise<void> {
    for (const command of commands) {
      if (command.type === 'skip') {
        this.logger.warn(command.message);
      } else if (command.type === 'patch') {
        await this.uncategorizedBankTransactionModel()
          .query(trx)
          .findById(command.id)
          .patch(command.values);
      } else if (command.type === 'delete') {
        await this.removePendingTransaction.removePendingTransaction(
          command.id,
          trx,
        );
      } else {
        await this.createUncategorizedTransaction.create(
          { ...command.transaction, batch },
          trx,
        );
      }
    }
  }

  /**
   * Syncs the Plaid item last transaction cursor.
   * @param {string} itemId - Plaid item ID.
   * @param {string} lastCursor - Last transaction cursor.
   * @return {Promise<void>}
   */
  public async syncTransactionsCursor(
    plaidItemId: string,
    lastCursor: string,
    trx?: Knex.Transaction,
  ): Promise<void> {
    await this.plaidItemModel()
      .query(trx)
      .findOne({ plaidItemId })
      .patch({ lastCursor });
  }

  /**
   * Updates the last feeds updated at of the given Plaid accounts ids.
   * @param {string[]} plaidAccountIds - Plaid accounts ids.
   * @return {Promise<void>}
   */
  public async updateLastFeedsUpdatedAt(
    plaidAccountIds: string[],
    trx?: Knex.Transaction,
  ): Promise<void> {
    await this.accountModel()
      .query(trx)
      .whereIn('plaid_account_id', plaidAccountIds)
      .patch({
        lastFeedsUpdatedAt: new Date(),
      });
  }

  /**
   * Updates the accounts feed active status of the given Plaid accounts ids.
   * @param {number[]} plaidAccountIds - Plaid accounts ids.
   * @param {boolean} isFeedsActive - Feeds active status.
   * @returns {Promise<void>}
   */
  public async updateAccountsFeedsActive(
    plaidAccountIds: string[],
    isFeedsActive: boolean = true,
    trx?: Knex.Transaction,
  ): Promise<void> {
    await this.accountModel()
      .query(trx)
      .whereIn('plaid_account_id', plaidAccountIds)
      .patch({
        isFeedsActive,
      });
  }

  /**
   * Updates the bank balance of the accounts linked to the given Plaid
   * accounts, which is otherwise only set when the account is created.
   * @param {PlaidAccountBase[]} plaidAccounts - Plaid accounts.
   * @param {Knex.Transaction} trx - Knex transaction.
   * @returns {Promise<void>}
   */
  public async updateAccountsBankBalance(
    plaidAccounts: PlaidAccountBase[],
    trx?: Knex.Transaction,
  ): Promise<void> {
    const balancedPlaidAccounts = plaidAccounts.filter(
      (plaidAccount) => plaidAccount.balances.current !== null,
    );
    await bluebird.map(
      balancedPlaidAccounts,
      (plaidAccount) =>
        this.accountModel()
          .query(trx)
          .where('plaid_account_id', plaidAccount.account_id)
          .patch({ bankBalance: plaidAccount.balances.current }),
      { concurrency: CONCURRENCY_ASYNC },
    );
  }
}
