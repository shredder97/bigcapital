import { Module } from '@nestjs/common';
import { GeneralLedgerApplication } from '../FinancialStatements/modules/GeneralLedger/GeneralLedgerApplication';
import { GeneralLedgerModule } from '../FinancialStatements/modules/GeneralLedger/GeneralLedger.module';
import { ProfitLossSheetApplication } from '../FinancialStatements/modules/ProfitLossSheet/ProfitLossSheetApplication';
import { ProfitLossSheetModule } from '../FinancialStatements/modules/ProfitLossSheet/ProfitLossSheet.module';
import { AiAskController } from './AiAsk.controller';
import { AiAskService } from './AiAsk.service';
import {
  AiAskTools,
  GENERAL_LEDGER_SHEET,
  PROFIT_LOSS_SHEET,
} from './AiAsk.tools';
import { AnthropicLlmClient, LLM_CLIENT } from './AnthropicLlmClient';

@Module({
  imports: [ProfitLossSheetModule, GeneralLedgerModule],
  controllers: [AiAskController],
  providers: [
    AiAskService,
    AiAskTools,
    AnthropicLlmClient,
    { provide: LLM_CLIENT, useExisting: AnthropicLlmClient },
    { provide: PROFIT_LOSS_SHEET, useExisting: ProfitLossSheetApplication },
    { provide: GENERAL_LEDGER_SHEET, useExisting: GeneralLedgerApplication },
  ],
})
export class AiAskModule {}
