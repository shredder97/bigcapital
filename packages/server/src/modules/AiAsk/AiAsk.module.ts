import { Module } from '@nestjs/common';
import { GeneralLedgerModule } from '../FinancialStatements/modules/GeneralLedger/GeneralLedger.module';
import { ProfitLossSheetModule } from '../FinancialStatements/modules/ProfitLossSheet/ProfitLossSheet.module';
import { AiAskController } from './AiAsk.controller';
import { AiAskService } from './AiAsk.service';

@Module({
  imports: [ProfitLossSheetModule, GeneralLedgerModule],
  controllers: [AiAskController],
  providers: [AiAskService],
})
export class AiAskModule {}
