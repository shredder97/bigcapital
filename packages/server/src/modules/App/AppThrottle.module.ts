import { ExecutionContext, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { THROTTLER_LIMIT } from '@nestjs/throttler/dist/throttler.constants';
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import { ClsServiceManager } from 'nestjs-cls';

/** Skip a named throttler unless the handler or controller opted in. */
export function skipUnlessThrottled(name: string) {
  const key = `${THROTTLER_LIMIT}${name}`;
  return (context: ExecutionContext): boolean =>
    !Reflect.hasMetadata(key, context.getHandler()) &&
    !Reflect.hasMetadata(key, context.getClass());
}

/** Skip the auth throttler unless the handler or controller opted in. */
export function skipUnlessAuthThrottled(context: ExecutionContext): boolean {
  return skipUnlessThrottled('auth')(context);
}

/** Ask calls count by the CLS user. Default and auth keep the guard's IP key. */
export function resolveThrottleTracker(req: Record<string, any>): string {
  try {
    const userId = ClsServiceManager.getClsService().get('userId');
    if (userId != null && userId !== '') return `user:${userId}`;
  } catch {
    // Called outside a request.
  }
  return `ip:${req.ip || 'unknown'}`;
}

const aiThrottler = {
  name: 'ai',
  ttl: 60000,
  limit: 10,
  skipIf: skipUnlessThrottled('ai'),
  getTracker: (req: Record<string, any>) => resolveThrottleTracker(req),
};

export function createThrottleOptions(input: {
  isTest: boolean;
  globalTtl?: number;
  globalLimit?: number;
  authTtl?: number;
  authLimit?: number;
}) {
  return {
    throttlers: [
      {
        name: 'default',
        ttl: input.isTest ? 60000 : input.globalTtl,
        limit: input.isTest ? 1000000 : input.globalLimit,
      },
      {
        name: 'auth',
        ttl: input.isTest ? 60000 : input.authTtl,
        limit: input.isTest ? 1000000 : input.authLimit,
        skipIf: skipUnlessThrottled('auth'),
      },
      aiThrottler,
    ],
  };
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
          return createThrottleOptions({ isTest: true });
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
          ...createThrottleOptions({
            isTest: false,
            globalTtl,
            globalLimit,
            authTtl,
            authLimit,
          }),
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
