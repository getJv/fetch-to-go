export type Result<T, E> = { ok: true; data: T } | { ok: false; err: E };

export const ok = <T>(data: T): Result<T, never> => ({ ok: true, data });
export const fail = <E>(err: E): Result<never, E> => ({ ok: false, err });

export const HttpFailures = {
  // Client Errors (4xx)
  BAD_REQUEST: (msg = 'Invalid request') => fail({ code: 'BAD_REQUEST', status: 400, message: msg } as const),
  UNAUTHORIZED: fail({ code: 'UNAUTHORIZED', status: 401, message: 'Unauthorized' } as const),
  FORBIDDEN: fail({ code: 'FORBIDDEN', status: 403, message: 'Access denied' } as const),
  NOT_FOUND: fail({ code: 'NOT_FOUND', status: 404, message: 'Resource not found' } as const),
  VALIDATION: (details: any) => fail({ code: 'VALIDATION', status: 422, message: 'Validation error', data: details } as const),

  // Server Errors (5xx)
  INTERNAL_SERVER: fail({ code: 'INTERNAL_SERVER', status: 500, message: 'Internal server error' } as const),

  // Infra/Network Error (Status 0)
  NETWORK: fail({ code: 'NETWORK', status: 0, message: 'Connection error' } as const),
} as const;

// Helper for success without body (204 No Content)
export const NO_CONTENT = ok(null);

/**
 * Helper to map common HTTP status to failure results.
 */
export const mapStatusToFailure = (status: number, body?: any) => {
  if (status === 400) return HttpFailures.BAD_REQUEST(body?.message);
  if (status === 401) return HttpFailures.UNAUTHORIZED;
  if (status === 403) return HttpFailures.FORBIDDEN;
  if (status === 404) return HttpFailures.NOT_FOUND;
  if (status === 422) return HttpFailures.VALIDATION(body?.errors);
  if (status >= 500 && status <= 599) return HttpFailures.INTERNAL_SERVER;
  return fail({ code: 'UNKNOWN', status, message: 'Unknown error', data: body } as const);
};

export type TogoError = {
  status: number;
  message: string;
  data: any;
};

/**
 * Encapsulates a Response Promise into a Result.
 */
export async function togo<T>(promise: Promise<Response>): Promise<Result<T, TogoError>> {
  try {
    const res = await promise;
    const body = await res.json().catch(() => ({}));
    return res.ok
      ? ok(body as T)
      : fail({
          status: res.status,
          message: body.message || 'API Error',
          data: body,
        });
  } catch (e) {
    return fail({
      status: 0,
      message: 'Network error',
      data: null,
    });
  }
}

/**
 * Error extraction utility for Result types.
 */
export type ExtractError<R> = R extends { ok: false; err: infer E } ? E : never;

/**
 * Factory to simplify error mapping creation.
 */
export function createErrorMap<T extends Record<string, any>>(map: T) {
  const result = {} as { [K in keyof T]: Result<never, T[K]> };
  for (const key in map) {
    result[key] = fail(map[key]);
  }
  return result as { readonly [K in keyof T]: Result<never, T[K]> };
}
