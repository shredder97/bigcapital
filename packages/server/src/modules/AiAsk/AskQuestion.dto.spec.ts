import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AskQuestionDto } from './AskQuestion.dto';

async function errorsFor(question: unknown) {
  const dto = plainToInstance(AskQuestionDto, { question });
  return validate(dto);
}

describe('AskQuestionDto', () => {
  it('trims a question and accepts 1 to 500 characters', async () => {
    const dto = plainToInstance(AskQuestionDto, { question: '  hello  ' });
    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto.question).toBe('hello');
  });

  it('accepts a question of exactly 500 characters', async () => {
    const errors = await errorsFor('a'.repeat(500));

    expect(errors).toHaveLength(0);
  });

  it('rejects a question longer than 500 characters', async () => {
    const errors = await errorsFor('a'.repeat(501));

    expect(errors.length).toBeGreaterThan(0);
    expect(JSON.stringify(errors)).toContain('maxLength');
  });

  it('rejects an empty or whitespace question', async () => {
    expect((await errorsFor('')).length).toBeGreaterThan(0);
    expect((await errorsFor('   ')).length).toBeGreaterThan(0);
  });

  it('rejects a non-string question', async () => {
    expect((await errorsFor(12)).length).toBeGreaterThan(0);
  });
});
