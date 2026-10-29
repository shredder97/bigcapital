import { OnEvent } from '@nestjs/event-emitter';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { IAccountEventDeletedPayload } from '@/interfaces/Account';
import { events } from '@/common/events/events';
import { PlaidItem } from '@/modules/BankingPlaid/models/PlaidItem';
import { SystemPlaidItem } from '@/modules/BankingPlaid/models/SystemPlaidItem';
import { Account } from '@/modules/Accounts/models/Account.model';
import { PlaidApi } from 'plaid';
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
   * Removes the Plaid item after commit when no sibling account still uses it.
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

    const remainingLinkedAccounts = await this.accountModel()
      .query(trx)
      .where('plaidItemId', plaidItemId)
      .whereNot('id', oldAccount.id)
      .resultSize();
    if (remainingLinkedAccounts > 0) return;

    const accessToken = (
      await this.plaidItemModel().query(trx).findOne('plaidItemId', plaidItemId)
    )?.plaidAccessToken;
    await this.plaidItemModel()
      .query(trx)
      .where('plaidItemId', plaidItemId)
      .delete();

    // System row, then Plaid, after the tenant transaction commits.
    runAfterTransaction(trx, async () => {
      try {
        await this.systemPlaidItemModel
          .query()
          .where('plaidItemId', plaidItemId)
          .delete();
        if (!accessToken) return;

        await this.plaidClient.itemRemove({ access_token: accessToken });
      } catch (error) {
        const detail = String((error as any)?.message ?? error);
        this.logger.error(
          `Failed to remove Plaid item ${plaidItemId} after account delete: ${detail
            .split(accessToken)
            .join('[redacted]')}`,
        );
      }
    });
  }
}
