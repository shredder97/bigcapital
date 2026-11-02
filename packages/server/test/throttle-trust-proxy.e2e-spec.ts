import request = require('supertest');
import { Controller, Get } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { Throttle, ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { trustProxyHops } from '@/common/trust-proxy';

const CLIENT = '203.0.113.7';
const OTHER_CLIENT = '198.51.100.9';
const THIRD_CLIENT = '192.0.2.10';

@Controller('probe')
@Throttle({ auth: {} })
class ProbeController {
  @Get()
  probe() {
    return { ok: true };
  }
}

async function boot(env: NodeJS.ProcessEnv) {
  const fixture = await Test.createTestingModule({
    imports: [
      ThrottlerModule.forRoot({
        throttlers: [{ name: 'auth', ttl: 60000, limit: 3 }],
      }),
    ],
    controllers: [ProbeController],
    providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
  }).compile();

  const app = fixture.createNestApplication<NestExpressApplication>();
  const hops = trustProxyHops(env);
  if (hops > 0) app.set('trust proxy', hops);
  await app.init();

  const hit = (client: string) =>
    request(app.getHttpServer())
      .get('/probe')
      .set(
        'X-Forwarded-For',
        `1.2.3.${Math.floor(Math.random() * 255)}, ${client}, 10.0.0.2`,
      );

  return { app, hit };
}

describe('throttle trust proxy (e2e)', () => {
  it('limits the real client and ignores a rotating spoof when hops is 2', async () => {
    const { app, hit } = await boot({ TRUST_PROXY_HOPS: '2' });

    try {
      for (let i = 0; i < 3; i++) await hit(CLIENT).expect(200);
      await hit(CLIENT).expect(429);
      await hit(CLIENT).expect(429);
      await hit(OTHER_CLIENT).expect(200);
      await hit(THIRD_CLIENT).expect(200);
    } finally {
      await app.close();
    }
  });

  it('treats surrounding whitespace as the same hop count', async () => {
    const { app, hit } = await boot({ TRUST_PROXY_HOPS: ' 2 ' });

    try {
      for (let i = 0; i < 3; i++) await hit(CLIENT).expect(200);
      await hit(CLIENT).expect(429);
      await hit(OTHER_CLIENT).expect(200);
    } finally {
      await app.close();
    }
  });

  it.each(['true', '2.5', 'abc', '-1', '0', ''])(
    'does not isolate clients when TRUST_PROXY_HOPS is %j',
    async (raw) => {
      const { app, hit } = await boot({ TRUST_PROXY_HOPS: raw });

      try {
        for (let i = 0; i < 3; i++) await hit(CLIENT).expect(200);
        await hit(CLIENT).expect(429);
        await hit(OTHER_CLIENT).expect(429);
      } finally {
        await app.close();
      }
    },
  );

  it('does not isolate clients when TRUST_PROXY_HOPS is unset', async () => {
    const { app, hit } = await boot({});

    try {
      for (let i = 0; i < 3; i++) await hit(CLIENT).expect(200);
      await hit(CLIENT).expect(429);
      await hit(OTHER_CLIENT).expect(429);
    } finally {
      await app.close();
    }
  });
});
