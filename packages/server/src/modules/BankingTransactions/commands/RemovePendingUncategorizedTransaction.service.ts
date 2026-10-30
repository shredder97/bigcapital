import { Knex } from 'knex';
import { ERRORS } from '../constants';
import {
  IPendingTransactionRemovedEventPayload,
  IPendingTransactionRemovingEventPayload,
} from '../types/BankingTransactions.types';
import { Inject, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { UncategorizedBankTransaction } from '../models/UncategorizedBankTransaction';
import { ServiceError } from '@/modules/Items/ServiceError';
import { Account } from '@/modules/Accounts/models/Account.model';
import { UnitOfWork } from '@/modules/Tenancy/TenancyDB/UnitOfWork.service';
import { events } from '@/common/events/events';
import { TenantModelProxy } from '@/modules/System/models/TenantBaseModel';
import type { RecognizedBankTransaction } from '@/modules/BankingTranasctionsRegonize/models/RecognizedBankTransaction';

@Injectable()
export class RemovePendingUncategorizedTransaction {
  constructor(
    private readonly eventPublisher: EventEmitter2,
    private readonly uow: UnitOfWork,

    @Inject(UncategorizedBankTransaction.name)
    private readonly uncategorizedBankTransaction: TenantModelProxy<
      typeof UncategorizedBankTransaction
    >,

    @Inject(Account.name)
    private readonly accountModel: TenantModelProxy<typeof Account>,
  ) {}

  /**
   * REmoves the pending uncategorized transaction.
   * @param {number} uncategorizedTransactionId -
   * @param {Knex.Transaction} trx -
   * @returns {Promise<void>}
   */
  public async removePendingTransaction(
    uncategorizedTransactionId: number,
    trx?: Knex.Transaction,
  ): Promise<void> {
    const pendingTransaction = await this.findTransaction(
      uncategorizedTransactionId,
      trx,
    );
    if (!pendingTransaction.isPending) {
      throw new ServiceError(ERRORS.TRANSACTION_NOT_PENDING);
    }
    return this.deleteUncategorizedTransaction(pendingTransaction, trx);
  }

  /**
   * Removes an uncategorized Plaid row. Pending rows were never counted.
   * A posted row decrements `accounts.uncategorized_transactions`.
   */
  public async removeUncategorizedTransaction(
    uncategorizedTransactionId: number,
    trx?: Knex.Transaction,
  ): Promise<void> {
    const transaction = await this.findTransaction(
      uncategorizedTransactionId,
      trx,
    );
    return this.deleteUncategorizedTransaction(transaction, trx);
  }

  private findTransaction(
    uncategorizedTransactionId: number,
    trx?: Knex.Transaction,
  ) {
    return this.uncategorizedBankTransaction()
      .query(trx)
      .findById(uncategorizedTransactionId)
      .throwIfNotFound();
  }

  private deleteUncategorizedTransaction(
    transaction: UncategorizedBankTransaction,
    trx?: Knex.Transaction,
  ): Promise<void> {
    const uncategorizedTransactionId = transaction.id;
    return this.uow.withTransaction(async (trx: Knex.Transaction) => {
      if (transaction.isPending) {
        await this.eventPublisher.emitAsync(
          events.bankTransactions.onPendingRemoving,
          {
            uncategorizedTransactionId,
            pendingTransaction: transaction,
            trx,
          } as IPendingTransactionRemovingEventPayload,
        );
      }
      // Unlink and remove the recognized transaction (if any) before deleting
      // the row, since both tables reference each other.
      await this.removeRecognizedTransaction(
        uncategorizedTransactionId,
        transaction,
        trx,
      );
      await this.uncategorizedBankTransaction()
        .query(trx)
        .findById(uncategorizedTransactionId)
        .delete();

      if (transaction.isPending) {
        await this.eventPublisher.emitAsync(
          events.bankTransactions.onPendingRemoved,
          {
            uncategorizedTransactionId,
            pendingTransaction: transaction,
            trx,
          } as IPendingTransactionRemovedEventPayload,
        );
        return;
      }
      if (transaction.accountId) {
        await this.accountModel()
          .query(trx)
          .findById(transaction.accountId)
          .decrement('uncategorizedTransactions', 1);
      }
    }, trx);
  }

  /**
   * Removes the recognized bank transaction linked to the given pending
   * transaction.
   * @param {number} uncategorizedTransactionId - Pending transaction id.
   * @param {UncategorizedBankTransaction} pendingTransaction - Pending transaction.
   * @param {Knex.Transaction} trx - Knex transaction.
   * @returns {Promise<void>}
   */
  private async removeRecognizedTransaction(
    uncategorizedTransactionId: number,
    pendingTransaction: UncategorizedBankTransaction,
    trx: Knex.Transaction,
  ): Promise<void> {
    if (!pendingTransaction.recognizedTransactionId) {
      return;
    }
    // Break the circular reference before deleting the recognized row.
    await this.uncategorizedBankTransaction()
      .query(trx)
      .findById(uncategorizedTransactionId)
      .patch({ recognizedTransactionId: null });

    await pendingTransaction
      .$relatedQuery<RecognizedBankTransaction>('recognizedTransaction', trx)
      .delete();
  }
}
