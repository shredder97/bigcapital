import { existsSync } from 'fs';
import * as path from 'path';
import { registerAs } from '@nestjs/config';

/**
 * Jest loads this file from src, where migrations are TypeScript. The tenant
 * runner only executes compiled .js files, which live next to this file in
 * the built server and under dist/ when the tests import the source.
 */
function resolveDir(
  sourceRelative: string,
  compiledRelative: string,
  marker: string,
) {
  const sourceDir = path.join(__dirname, sourceRelative);
  if (existsSync(path.join(sourceDir, marker))) return sourceDir;
  const compiledDir = path.join(__dirname, compiledRelative);
  if (existsSync(path.join(compiledDir, marker))) return compiledDir;
  return sourceDir;
}

export default registerAs('tenantDatabase', () => ({
  client: 'mysql',
  host: process.env.TENANT_DB_HOST || process.env.DB_HOST,
  port: process.env.TENANT_DB_PORT || process.env.DB_PORT || 3306,
  user: process.env.TENANT_DB_USER || process.env.DB_USER,
  password: process.env.TENANT_DB_PASSWORD || process.env.DB_PASSWORD,
  dbNamePrefix: process.env.TENANT_DB_NAME_PERFIX || 'bigcapital_tenant_',
  migrationsDir: resolveDir(
    '../../database/tenant/migrations',
    '../../../dist/database/tenant/migrations',
    '20190822214303_create_accounts_table.js',
  ),
  seedsDir: resolveDir(
    '../../database/tenant/seeds/core',
    '../../../dist/database/tenant/seeds/core',
    '20190423085242_seed_accounts.js',
  ),
}));
