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
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { ApiCommonHeaders } from '@/common/decorators/ApiCommonHeaders';
import { AuthorizationGuard } from '../Roles/Authorization.guard';
import { AbilitySubject } from '../Roles/Roles.types';
import { AiAskService } from './AiAsk.service';
import { AskQuestionDto } from './AskQuestion.dto';

type RequestWithAbility = Request & {
  ability?: { can: (action: string, subject: AbilitySubject) => boolean };
};

@Controller('ai')
@ApiTags('AI')
@ApiCommonHeaders()
@UseGuards(AuthorizationGuard)
export class AiAskController {
  constructor(private readonly aiAsk: AiAskService) {}

  @Post('ask')
  @HttpCode(HttpStatus.OK)
  @Throttle({ ai: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Ask a read-only question about the books' })
  ask(@Body() dto: AskQuestionDto, @Req() req: RequestWithAbility) {
    return this.aiAsk.ask(dto.question, req.ability);
  }

  @Get('questions')
  @ApiOperation({ summary: 'List the caller’s recent questions' })
  questions() {
    return this.aiAsk.list();
  }
}
