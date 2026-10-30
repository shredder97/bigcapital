import 'reflect-metadata';
import { ExecutionContext } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { skipUnlessAuthThrottled } from './AppThrottle.module';

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
