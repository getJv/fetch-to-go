import { createServer, Server } from 'http';
import { togo, createErrorMap, ExtractError } from '../src/index';

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
});
