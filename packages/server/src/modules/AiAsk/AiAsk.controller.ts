import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { Request } from 'express';
import { ApiCommonHeaders } from '@/common/decorators/ApiCommonHeaders';
import { AuthorizationGuard } from '../Roles/Authorization.guard';
import { AiAskService } from './AiAsk.service';
import { AskQuestionDto } from './AskQuestion.dto';

type Ability = { can: (action: string, subject: string) => boolean };

@Controller('ai')
@ApiTags('AI')
@ApiCommonHeaders()
@UseGuards(AuthorizationGuard, ThrottlerGuard)
export class AiAskController {
  constructor(private readonly aiAsk: AiAskService) {}

  @Post('ask')
  @HttpCode(HttpStatus.OK)
  @Throttle({ ai: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Ask a read-only question about the books' })
  ask(
    @Body() dto: AskQuestionDto,
    @Req() req: Request & { ability?: Ability },
  ) {
    return this.aiAsk.ask(dto.question, req.ability);
  }

  @Get('questions')
  @ApiOperation({ summary: 'List the caller’s recent questions' })
  questions() {
    return this.aiAsk.list();
  }
}
