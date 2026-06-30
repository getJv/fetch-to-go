# fetch-to-go

A lightweight library inspired by Go's return pattern, designed to simplify error handling in `fetch` requests without the need for verbose `try-catch` blocks.

## Installation

```bash
npm install fetch-to-go
```

## Lib Core

The library uses a `Result` type to ensure you always handle both success and error.

### Standard HTTP Failures

You can use predefined common HTTP failures:

```ts
import { HttpFailures, NO_CONTENT } from 'fetch-to-go';

// Predefined errors
const err400 = HttpFailures.BAD_REQUEST('Custom message');
const err401 = HttpFailures.UNAUTHORIZED;
const err500 = HttpFailures.INTERNAL_SERVER;

// Predefined success
const success204 = NO_CONTENT;
```

### Auto Mapping Status

Use `mapStatusToFailure` to automatically convert HTTP status codes to standard errors.

```ts
import { mapStatusToFailure, togo } from 'fetch-to-go';

const result = await togo(fetch('/api/data'));

if (!result.ok) {
    // Automatically maps 400, 401, 403, 404, 422, 5xx to standard failures
    return mapStatusToFailure(result.err.status, result.err.data);
}
```

## Usage Examples

### Linear Usage (Simulating Go)

```ts
const result = await doLogin({ user: 'admin', pass: '123' });

if (!result.ok) {
    if (result.err.code === 'AUTH_001') {
        showToast(result.err.message);
        return;
    }
    showToast('An unexpected error occurred.');
    return;
}

console.log("Welcome!", result.data.token);
```

### Sequential Requests

```ts
const userResult = await togo(fetch('/api/user'));
if (!userResult.ok) return;

const postsResult = await togo(fetch(`/api/posts?userId=${userResult.data.id}`));
if (!postsResult.ok) return;

console.log(postsResult.data);
```

### Parallel Requests

```ts
const [res1, res2] = await Promise.all([
    togo(fetch('/api/data1')),
    togo(fetch('/api/data2'))
]);

if (res1.ok) console.log(res1.data);
if (res2.ok) console.log(res2.data);
```

### Advanced Usage

#### Custom Failures combined with Standard ones

```ts
import { HttpFailures, fail, ExtractError, Result, togo, mapStatusToFailure } from 'fetch-to-go';

const LOGIN_FAILURES = {
    ...HttpFailures,
    INVALID_CREDENTIALS: fail({ code: 'AUTH_001', status: 401, message: 'Invalid credentials' } as const)
} as const;

type LoginError = ExtractError<typeof LOGIN_FAILURES[keyof typeof LOGIN_FAILURES]>;

async function doLogin(credentials: any): Promise<Result<any, LoginError>> {
    const result = await togo(fetch('/api/login', { method: 'POST', body: JSON.stringify(credentials) }));

    if (result.ok) return result;

    if (result.err.status === 401) return LOGIN_FAILURES.INVALID_CREDENTIALS;
    
    return mapStatusToFailure(result.err.status, result.err.data);
}
```

### Advanced Pattern Matching (with ts-pattern)

For a more declarative flow, you can use [ts-pattern](https://github.com/gvergnaud/ts-pattern) to handle results.
You should add `ts-pattern` as a dependency to use this example:

```bash
  npm install ts-pattern
``` 

```ts
import { match } from 'ts-pattern';

export const doLogin = async (credentials: any): Promise<Result<LoginResponse, LoginError>> => {
    const result = await togo<LoginResponse>(fetch('/api/login', {
        method: 'POST',
        body: JSON.stringify(credentials)
    }));

    // Instead of nested if/else, we use a declarative flow
    return match(result)
        .with({ ok: true }, (res) => res) // Direct success return
        .with({ ok: false, err: { status: 401 } }, () => LOGIN_ERRORS.INVALID_CREDENTIALS)
        .with({ ok: false }, () => LOGIN_ERRORS.NETWORK_ERROR)
        .exhaustive(); // TypeScript ensures all cases are covered
};
```

## Why use it?

- **Strong Typing**: Fully written in TypeScript.
- **No try-catch**: Cleaner and more linear code flow.
- **Minimalist**: Only essential types and helpers, no heavy dependencies.
