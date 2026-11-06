exports.up = (knex) => {
  return knex.schema.createTable('ai_questions', (table) => {
    table.increments('id').primary();
    table.integer('user_id').unsigned().notNullable();
    table.string('question', 500).notNullable();
    table.text('answer').notNullable();
    table.json('chart').nullable();
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.index(['user_id', 'created_at']);
  });
};

exports.down = (knex) => knex.schema.dropTableIfExists('ai_questions');
