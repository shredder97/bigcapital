import { Logger, Inject, Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PlaidApi } from 'plaid';
import { events } from '@/common/events/events';
import { IAccountEventDeletedPayload } from '@/interfaces/Account';
import { Account } from '@/modules/Accounts/models/Account.model';
import { PlaidItem } from '@/modules/BankingPlaid/models/PlaidItem';
import { SystemPlaidItem } from '@/modules/BankingPlaid/models/SystemPlaidItem';
import { PLAID_CLIENT } from '@/modules/Plaid/Plaid.module';
import { TenantModelProxy } from '@/modules/System/models/TenantBaseModel';
import { runAfterTransaction } from '@/modules/Tenancy/TenancyDB/TransactionsHooks';

@Injectable()
export class DisconnectPlaidItemOnAccountDeleted {
  private readonly logger = new Logger(
    DisconnectPlaidItemOnAccountDeleted.name,
  );

  constructor(
    @Inject(PLAID_CLIENT) private plaidClient: PlaidApi,

    @Inject(PlaidItem.name)
    private plaidItemModel: TenantModelProxy<typeof PlaidItem>,

    @Inject(Account.name)
    private accountModel: TenantModelProxy<typeof Account>,

    @Inject(SystemPlaidItem.name)
    private systemPlaidItemModel: typeof SystemPlaidItem,
  ) {}

  /**
   * Unlinks the deleted account from Plaid.
   * The Plaid item is removed only when no other account still uses it.
   * `itemRemove` runs after the tenant transaction commits.
   * @param {IAccountEventDeletedPayload} payload
   * @returns {Promise<void>}
   */
  @OnEvent(events.accounts.onDeleted)
  public async handleDisconnectPlaidItemOnAccountDelete({
    oldAccount,
    trx,
  }: IAccountEventDeletedPayload) {
    // Can't continue if the deleted account is not linked to Plaid item.
    const plaidItemId = oldAccount.plaidItemId;

    if (!plaidItemId) return;

    // Unlink only the account that was deleted.
    await this.accountModel().query(trx).findById(oldAccount.id).patch({
      plaidAccountId: null,
      plaidItemId: null,
    });

    // Keep the item while any sibling account still references it.
    const remainingLinkedAccounts = await this.accountModel()
      .query(trx)
      .where('plaidItemId', plaidItemId)
      .whereNot('id', oldAccount.id)
      .resultSize();

    if (remainingLinkedAccounts > 0) return;

    const oldPlaidItem = await this.plaidItemModel()
      .query(trx)
      .findOne('plaidItemId', plaidItemId);

    // Remove the Plaid item from the tenant database.
    await this.plaidItemModel()
      .query(trx)
      .findOne('plaidItemId', plaidItemId)
      .delete();

    // Linking inserts the same item id on the system database.
    const systemPlaidItem = await this.systemPlaidItemModel
      .query()
      .findOne('plaidItemId', plaidItemId);

    if (systemPlaidItem) {
      await this.systemPlaidItemModel
        .query()
        .findOne('plaidItemId', plaidItemId)
        .delete();
    }

    const accessToken = oldPlaidItem?.plaidAccessToken;

    if (!accessToken) return;

    // Remove the Plaid item once the transaction commits.
    runAfterTransaction(trx, async () => {
      try {
        await this.plaidClient.itemRemove({
          access_token: accessToken,
        });
      } catch (error) {
        const detail =
          error instanceof Error
            ? error.message
            : typeof error === 'string'
              ? error
              : 'unknown error';

        this.logger.error(
          `Failed to remove Plaid item ${plaidItemId} after account delete: ${detail
            .split(accessToken)
            .join('[redacted]')}`,
        );
      }
    });
  }
}
