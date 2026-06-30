import { createServer, Server } from 'http';
import { togo, createErrorMap, ExtractError, HttpFailures, mapStatusToFailure, NO_CONTENT } from '../src';

describe('fetch-to-go', () => {
  let server: Server;
  const PORT = 3001;
  const BASE_URL = `http://localhost:${PORT}`;

  beforeAll((done) => {
    server = createServer((req, res) => {
      res.setHeader('Content-Type', 'application/json');
      if (req.url === '/success') {
        res.writeHead(200);
        res.end(JSON.stringify({ message: 'Success' }));
      } else if (req.url === '/error') {
        res.writeHead(400);
        res.end(JSON.stringify({ message: 'Bad Request', code: 'BR' }));
      } else if (req.url === '/parallel1') {
        setTimeout(() => {
          res.writeHead(200);
          res.end(JSON.stringify({ id: 1 }));
        }, 100);
      } else if (req.url === '/parallel2') {
        setTimeout(() => {
          res.writeHead(200);
          res.end(JSON.stringify({ id: 2 }));
        }, 50);
      } else {
        res.writeHead(404);
        res.end(JSON.stringify({ message: 'Not Found' }));
      }
    });
    server.listen(PORT, done);
  });

  afterAll((done) => {
    server.close(done);
  });

  it('should return success for a valid request', async () => {
    const result = await togo<{ message: string }>(fetch(`${BASE_URL}/success`));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.message).toBe('Success');
    }
  });

  it('should return error for status 400', async () => {
    const result = await togo<{ message: string }>(fetch(`${BASE_URL}/error`));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.err.status).toBe(400);
      expect(result.err.message).toBe('Bad Request');
      expect(result.err.data.code).toBe('BR');
    }
  });

  it('should work with createErrorMap', async () => {
    const ERRORS = createErrorMap({
      BAD_REQUEST: { code: 'BAD_REQUEST', message: 'Validation error' },
      NOT_FOUND: { code: 'NOT_FOUND', message: 'Not found' },
    } as const);

    type AppError = ExtractError<(typeof ERRORS)[keyof typeof ERRORS]>;

    const result = await togo<{ message: string }>(fetch(`${BASE_URL}/error`));
    
    let finalError: AppError | null = null;
    if (!result.ok) {
        if (result.err.status === 400) {
            const errorResult = ERRORS.BAD_REQUEST;
            if (!errorResult.ok) {
                finalError = errorResult.err;
            }
        }
    }

    expect(finalError).toEqual({ code: 'BAD_REQUEST', message: 'Validation error' });
  });

  it('should handle parallel requests', async () => {
    const [res1, res2] = await Promise.all([
      togo<{ id: number }>(fetch(`${BASE_URL}/parallel1`)),
      togo<{ id: number }>(fetch(`${BASE_URL}/parallel2`))
    ]);

    expect(res1.ok).toBe(true);
    expect(res2.ok).toBe(true);
    if (res1.ok && res2.ok) {
      expect(res1.data.id).toBe(1);
      expect(res2.data.id).toBe(2);
    }
  });

  it('should handle network error', async () => {
    // Port that is certainly not listening
    const result = await togo(fetch(`http://localhost:9999`));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.err.status).toBe(0);
      expect(result.err.message).toBe('Network error');
    }
  });

  describe('HttpFailures and mapping', () => {
    it('should have standard HttpFailures', () => {
      const br = HttpFailures.BAD_REQUEST();
      if (!br.ok) expect(br.err.status).toBe(400);

      const un = HttpFailures.UNAUTHORIZED;
      if (!un.ok) expect(un.err.status).toBe(401);

      const fb = HttpFailures.FORBIDDEN;
      if (!fb.ok) expect(fb.err.status).toBe(403);

      const nf = HttpFailures.NOT_FOUND;
      if (!nf.ok) expect(nf.err.status).toBe(404);

      const vl = HttpFailures.VALIDATION({});
      if (!vl.ok) expect(vl.err.status).toBe(422);

      const is = HttpFailures.INTERNAL_SERVER;
      if (!is.ok) expect(is.err.status).toBe(500);

      const nw = HttpFailures.NETWORK;
      if (!nw.ok) expect(nw.err.status).toBe(0);
    });

    it('should have NO_CONTENT helper', () => {
      expect(NO_CONTENT.ok).toBe(true);
      if (NO_CONTENT.ok) expect(NO_CONTENT.data).toBe(null);
    });

    it('should map status to failure correctly', () => {
      const res400 = mapStatusToFailure(400);
      if (!res400.ok) expect(res400.err.code).toBe('BAD_REQUEST');

      const res401 = mapStatusToFailure(401);
      if (!res401.ok) expect(res401.err.code).toBe('UNAUTHORIZED');

      const res403 = mapStatusToFailure(403);
      if (!res403.ok) expect(res403.err.code).toBe('FORBIDDEN');

      const res404 = mapStatusToFailure(404);
      if (!res404.ok) expect(res404.err.code).toBe('NOT_FOUND');

      const res422 = mapStatusToFailure(422);
      if (!res422.ok) expect(res422.err.code).toBe('VALIDATION');

      const res500 = mapStatusToFailure(500);
      if (!res500.ok) expect(res500.err.code).toBe('INTERNAL_SERVER');

      const res503 = mapStatusToFailure(503);
      if (!res503.ok) expect(res503.err.code).toBe('INTERNAL_SERVER');

      const res999 = mapStatusToFailure(999);
      if (!res999.ok) expect(res999.err.code).toBe('UNKNOWN');
    });

    it('should preserve message and data in mapStatusToFailure', () => {
       const res = mapStatusToFailure(400, { message: 'Custom' });
       if (!res.ok) expect((res.err as any).message).toBe('Custom');

       const res2 = mapStatusToFailure(422, { errors: { field: 'required' } });
       if (!res2.ok) expect((res2.err as any).data).toEqual({ field: 'required' });
    });
  });
});
