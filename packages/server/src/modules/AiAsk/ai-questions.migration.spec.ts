describe('ai_questions migration', () => {
  it('creates ai_questions on up and drops it on down', async () => {
    const migration = require('../../database/tenant/migrations/20261102120000_create_ai_questions_table');
    const created: string[] = [];
    const dropped: string[] = [];
    const columns: string[] = [];
    const indexes: unknown[] = [];
    const table = new Proxy(
      {},
      {
        get(_target, prop) {
          if (prop === 'index') {
            return (cols: unknown) => {
              indexes.push(cols);
              return table;
            };
          }
          return (...args: unknown[]) => {
            if (typeof args[0] === 'string') columns.push(args[0]);
            return table;
          };
        },
      },
    );
    const knex = {
      fn: { now: () => 'now' },
      schema: {
        createTable: async (
          name: string,
          build: (builder: unknown) => void,
        ) => {
          created.push(name);
          build(table);
        },
        dropTableIfExists: async (name: string) => {
          dropped.push(name);
        },
      },
    };

    await migration.up(knex);
    await migration.down(knex);

    expect(created).toEqual(['ai_questions']);
    expect(dropped).toEqual(['ai_questions']);
    expect(columns).toEqual(
      expect.arrayContaining([
        'user_id',
        'question',
        'answer',
        'chart',
        'created_at',
      ]),
    );
    expect(indexes).toContainEqual(['user_id', 'created_at']);
  });
});
