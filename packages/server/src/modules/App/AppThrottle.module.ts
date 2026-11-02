import { createHmac, timingSafeEqual } from 'crypto';
import { ExecutionContext, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule, ThrottlerStorage } from '@nestjs/throttler';
import { THROTTLER_LIMIT } from '@nestjs/throttler/dist/throttler.constants';
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import { ClsServiceManager } from 'nestjs-cls';
import { JWT_AUDIENCE, JWT_ISSUER } from '../Auth/Auth.constants';

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

function userIdFromBearer(req: Record<string, any>): string | undefined {
  const header = req.headers?.authorization || req.headers?.Authorization;
  if (typeof header !== 'string' || !header.startsWith('Bearer ')) return;
  const secret = process.env.APP_JWT_SECRET;
  if (!secret) return;
  const parts = header.slice('Bearer '.length).split('.');
  if (parts.length !== 3) return;
  try {
    const expected = createHmac('sha384', secret)
      .update(`${parts[0]}.${parts[1]}`)
      .digest();
    const actual = Buffer.from(parts[2], 'base64url');
    if (
      actual.length !== expected.length ||
      !timingSafeEqual(actual, expected)
    ) {
      return;
    }
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
    if (payload.iss !== JWT_ISSUER || payload.aud !== JWT_AUDIENCE) return;
    if (typeof payload.exp === 'number' && payload.exp * 1000 < Date.now()) {
      return;
    }
    return payload.sub == null ? undefined : String(payload.sub);
  } catch {
    return;
  }
}

/** Rate-limit key. Authenticated calls count by the user, not the IP. */
export function resolveThrottleTracker(req: Record<string, any>): string {
  try {
    const userId = ClsServiceManager.getClsService().get('userId');
    if (userId != null && userId !== '') return `user:${userId}`;
  } catch {
    // The throttler can run before the auth guard writes CLS.
  }
  const subject = userIdFromBearer(req);
  if (subject) return `user:${subject}`;
  return `ip:${req.ip || req.socket?.remoteAddress || 'unknown'}`;
}

export function createThrottleOptions(input: {
  isTest: boolean;
  globalTtl?: number;
  globalLimit?: number;
  authTtl?: number;
  authLimit?: number;
  storage?: ThrottlerStorage;
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
      {
        name: 'ai',
        ttl: 60000,
        limit: 10,
        skipIf: skipUnlessThrottled('ai'),
      },
    ],
    getTracker: (req: Record<string, any>) => resolveThrottleTracker(req),
    ...(input.storage ? { storage: input.storage } : {}),
  };
}

@Module({
  imports: [
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const isTest =
          process.env.NODE_ENV === 'test' ||
          process.env.JEST_WORKER_ID !== undefined;

        if (isTest) return createThrottleOptions({ isTest: true });

        return createThrottleOptions({
          isTest: false,
          globalTtl: configService.get<number>('throttle.global.ttl'),
          globalLimit: configService.get<number>('throttle.global.limit'),
          authTtl: configService.get<number>('throttle.auth.ttl'),
          authLimit: configService.get<number>('throttle.auth.limit'),
          storage: new ThrottlerStorageRedisService({
            host: configService.get<string>('redis.host') || 'localhost',
            port: Number(configService.get<number>('redis.port') || 6379),
            password: configService.get<string>('redis.password'),
            db: configService.get<number>('redis.db'),
          }),
        });
      },
    }),
  ],
})
export class AppThrottleModule {}
