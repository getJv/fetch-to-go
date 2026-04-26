# fetch-to-go

A lightweight library inspired by Go's return pattern, designed to simplify error handling in `fetch` requests without the need for verbose `try-catch` blocks.

## Installation

```bash
npm install fetch-to-go
```

## Lib Core

The library uses a `Result` type to ensure you always handle both success and error.

```ts
import { togo, createErrorMap, ExtractError } from 'fetch-to-go';

// 1. Define your error mappings
const LOGIN_ERRORS = createErrorMap({
    INVALID_CREDENTIALS: { code: 'AUTH_001', message: 'Invalid credentials' },
    NETWORK_ERROR: { code: 'NET_000', message: 'Connection error' }
} as const);

type LoginError = ExtractError<typeof LOGIN_ERRORS[keyof typeof LOGIN_ERRORS]>;

// 2. Use 'togo' to wrap your fetch
async function doLogin(credentials: any) {
    const result = await togo<{ token: string }>(
        fetch('/api/login', {
            method: 'POST',
            body: JSON.stringify(credentials)
        })
    );

    if (!result.ok) {
        // Handle API or Network errors here
        if (result.err.status === 401) return LOGIN_ERRORS.INVALID_CREDENTIALS;
        return LOGIN_ERRORS.NETWORK_ERROR;
    }

    return result; // result.data contains { token: string }
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
