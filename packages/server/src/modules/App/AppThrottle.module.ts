import { ExecutionContext, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { THROTTLER_LIMIT } from '@nestjs/throttler/dist/throttler.constants';
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';

// Public entry does not re-export THROTTLER_LIMIT. @Throttle({ auth }) writes this key.
const AUTH_THROTTLE_LIMIT_KEY = `${THROTTLER_LIMIT}auth`;

/** Skip the auth throttler unless the handler or controller opted in. */
export function skipUnlessAuthThrottled(context: ExecutionContext): boolean {
  return (
    !Reflect.hasMetadata(AUTH_THROTTLE_LIMIT_KEY, context.getHandler()) &&
    !Reflect.hasMetadata(AUTH_THROTTLE_LIMIT_KEY, context.getClass())
  );
}

@Module({
  imports: [
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        // Use in-memory storage with very high limits for test environment
        const isTest =
          process.env.NODE_ENV === 'test' ||
          process.env.JEST_WORKER_ID !== undefined;

        if (isTest) {
          return {
            throttlers: [
              {
                name: 'default',
                ttl: 60000,
                limit: 1000000, // Effectively disable throttling in tests
              },
              {
                name: 'auth',
                ttl: 60000,
                limit: 1000000, // Effectively disable throttling in tests
                skipIf: skipUnlessAuthThrottled,
              },
            ],
            // No storage specified = uses in-memory storage
          };
        }

        const host = configService.get<string>('redis.host') || 'localhost';
        const port = Number(configService.get<number>('redis.port') || 6379);
        const password = configService.get<string>('redis.password');
        const db = configService.get<number>('redis.db');

        const globalTtl = configService.get<number>('throttle.global.ttl');
        const globalLimit = configService.get<number>('throttle.global.limit');
        const authTtl = configService.get<number>('throttle.auth.ttl');
        const authLimit = configService.get<number>('throttle.auth.limit');

        return {
          throttlers: [
            {
              name: 'default',
              ttl: globalTtl,
              limit: globalLimit,
            },
            {
              name: 'auth',
              ttl: authTtl,
              limit: authLimit,
              // Only routes that opt in with @Throttle({ auth: ... }) are auth-throttled.
              skipIf: skipUnlessAuthThrottled,
            },
          ],
          storage: new ThrottlerStorageRedisService({
            host,
            port,
            password,
            db,
          }),
        };
      },
    }),
  ],
})
export class AppThrottleModule {}
