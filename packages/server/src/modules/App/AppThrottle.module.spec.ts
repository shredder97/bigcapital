import 'reflect-metadata';
import { ExecutionContext, Controller, Get } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { ClsModule, ClsService } from 'nestjs-cls';
import request = require('supertest');
import {
  AppThrottleModule,
  createThrottleOptions,
  resolveThrottleTracker,
  skipUnlessAuthThrottled,
  skipUnlessThrottled,
} from './AppThrottle.module';

class UndecoratedController {
  handler() {
    return null;
  }
}

class AuthThrottledHandlerController {
  @Throttle({ auth: {} })
  handler() {
    return null;
  }
}

@Throttle({ auth: {} })
class AuthThrottledClassController {
  handler() {
    return null;
  }
}

function contextFor(instance: { handler: () => unknown }): ExecutionContext {
  return {
    getHandler: () => instance.handler,
    getClass: () => instance.constructor,
  } as unknown as ExecutionContext;
}

describe('skipUnlessAuthThrottled', () => {
  it('does not skip a handler decorated with @Throttle({ auth: {} })', () => {
    const skipped = skipUnlessAuthThrottled(
      contextFor(new AuthThrottledHandlerController()),
    );

    expect(skipped).toBe(false);
  });

  it('does not skip a controller decorated with @Throttle({ auth: {} })', () => {
    const skipped = skipUnlessAuthThrottled(
      contextFor(new AuthThrottledClassController()),
    );

    expect(skipped).toBe(false);
  });

  it('skips an undecorated handler', () => {
    const skipped = skipUnlessAuthThrottled(
      contextFor(new UndecoratedController()),
    );

    expect(skipped).toBe(true);
  });
});

class AiThrottledController {
  @Throttle({ ai: {} })
  handler() {
    return null;
  }
}

describe('skipUnlessThrottled', () => {
  it('skips the ai throttler unless the route opts in', () => {
    const skipAi = skipUnlessThrottled('ai');

    expect(skipAi(contextFor(new UndecoratedController()))).toBe(true);
    expect(skipAi(contextFor(new AiThrottledController()))).toBe(false);
  });

  it('does not treat an auth opt-in as an ai opt-in', () => {
    const skipAi = skipUnlessThrottled('ai');

    expect(skipAi(contextFor(new AuthThrottledHandlerController()))).toBe(true);
  });

  it('keeps auth opt-in on its own throttler', () => {
    const skipAuth = skipUnlessThrottled('auth');

    expect(skipAuth(contextFor(new AuthThrottledHandlerController()))).toBe(
      false,
    );
    expect(skipAuth(contextFor(new AiThrottledController()))).toBe(true);
  });
});

describe('createThrottleOptions', () => {
  it('registers a 10/min ai throttler in test and production', () => {
    for (const isTest of [true, false]) {
      const options = createThrottleOptions({
        isTest,
        globalTtl: 60000,
        globalLimit: 300,
        authTtl: 60000,
        authLimit: 30,
      });
      const ai = options.throttlers.find(
        (throttler) => throttler.name === 'ai',
      );

      expect(ai).toBeDefined();
      expect(ai?.limit).toBe(10);
      expect(ai?.ttl).toBe(60000);
      expect(ai?.skipIf?.(contextFor(new UndecoratedController()))).toBe(true);
      expect(ai?.skipIf?.(contextFor(new AiThrottledController()))).toBe(false);
    }
  });
});

describe('resolveThrottleTracker', () => {
  it('counts by CLS userId when the IP changes', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ClsModule.forRoot({
          global: true,
          middleware: { mount: false },
        }),
      ],
    }).compile();
    const cls = moduleRef.get(ClsService);
    await cls.run(async () => {
      cls.set('userId', 42);

      expect(resolveThrottleTracker({ ip: '203.0.113.4' })).toBe('user:42');
      expect(resolveThrottleTracker({ ip: '198.51.100.8' })).toBe('user:42');
    });
    await moduleRef.close();
  });
});

@Controller('probe')
class ProbeController {
  @Get('open')
  open() {
    return { ok: true };
  }

  @Throttle({ ai: { limit: 10, ttl: 60000 } })
  @Get('ai')
  ai() {
    return { ok: true };
  }
}

describe('ai throttler', () => {
  let app: import('@nestjs/common').INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        ClsModule.forRoot({
          global: true,
          middleware: {
            mount: true,
            setup: (cls, req) => {
              const header = req.headers['x-user-id'];
              if (header) cls.set('userId', Number(header));
            },
          },
        }),
        AppThrottleModule,
      ],
      controllers: [ProbeController],
      providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
    }).compile();

    app = moduleRef.createNestApplication();
    app.getHttpAdapter().getInstance().set('trust proxy', 1);
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('does not throttle an unrelated route', async () => {
    for (let i = 1; i <= 15; i += 1) {
      await request(app.getHttpServer())
        .get('/probe/open')
        .set('x-user-id', '7')
        .set('x-forwarded-for', `198.51.100.${i}`)
        .expect(200);
    }
  });

  it('returns 429 on the 11th call from the same user when the IP changes', async () => {
    for (let i = 1; i <= 10; i += 1) {
      await request(app.getHttpServer())
        .get('/probe/ai')
        .set('x-user-id', '42')
        .set('x-forwarded-for', `203.0.113.${i}`)
        .expect(200);
    }

    await request(app.getHttpServer())
      .get('/probe/ai')
      .set('x-user-id', '42')
      .set('x-forwarded-for', '192.0.2.55')
      .expect(429);

    await request(app.getHttpServer())
      .get('/probe/open')
      .set('x-user-id', '42')
      .set('x-forwarded-for', '192.0.2.56')
      .expect(200);
  });
});
