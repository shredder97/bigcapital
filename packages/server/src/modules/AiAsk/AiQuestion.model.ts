import { TenantBaseModel } from '@/modules/System/models/TenantBaseModel';

export class AiQuestion extends TenantBaseModel {
  userId: number;
  question: string;
  answer: string;
  chart: unknown;
  createdAt: Date;

  static get tableName() {
    return 'ai_questions';
  }

  static get jsonAttributes() {
    return ['chart'];
  }
}
