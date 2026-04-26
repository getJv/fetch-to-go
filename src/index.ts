export type Result<T, E> = { ok: true; data: T } | { ok: false; err: E };

export const ok = <T>(data: T): Result<T, never> => ({ ok: true, data });
export const fail = <E>(err: E): Result<never, E> => ({ ok: false, err });

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
