import request = require('supertest');
import { Controller, Get, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Test, TestingModule } from '@nestjs/testing';
import { Throttle, ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

const EDGE = '10.0.0.2';

@Controller('probe')
@Throttle({ auth: {} })
class ProbeController {
  @Get()
  probe() {
    return { ok: true };
  }
}

@Module({
  imports: [
    ThrottlerModule.forRoot({
      throttlers: [
        {
          name: 'auth',
          ttl: 60000,
          limit: 3,
        },
      ],
    }),
  ],
  controllers: [ProbeController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
class ThrottleTrustProxyModule {}

function forwardedFor(client: string) {
  const spoof = `1.2.3.${Math.floor(Math.random() * 254) + 1}`;
  return `${spoof}, ${client}, ${EDGE}`;
}

describe('throttle trust proxy (e2e)', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [ThrottleTrustProxyModule],
    }).compile();

    app = moduleFixture.createNestApplication<NestExpressApplication>();
    app.set('trust proxy', 2);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('ignores a spoofed X-Forwarded-For hop and limits the real client', async () => {
    const server = app.getHttpServer();
    const client = '203.0.113.7';

    await request(server)
      .get('/probe')
      .set('X-Forwarded-For', forwardedFor(client))
      .expect(200);
    await request(server)
      .get('/probe')
      .set('X-Forwarded-For', forwardedFor(client))
      .expect(200);
    await request(server)
      .get('/probe')
      .set('X-Forwarded-For', forwardedFor(client))
      .expect(200);
    await request(server)
      .get('/probe')
      .set('X-Forwarded-For', forwardedFor(client))
      .expect(429);

    await request(server)
      .get('/probe')
      .set('X-Forwarded-For', forwardedFor('198.51.100.9'))
      .expect(200);
  });
});
