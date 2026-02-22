# zod-conf

Type-safe configuration management with Zod schemas and environment variables.

Not affiliated with the official Zod library.

## Features

- **Type-safe** - Full TypeScript support with Zod schema validation
- **Multi-source** - Load from env vars, config files (e.g. YAML), or any plain object
- **Env-first** - Bind schema fields directly to environment variables
- **Simple API** - Intuitive, Zod-native API that feels familiar
- **Zero compromise** - All Zod features work - transformations, refinements, and more
- **Lightweight** - Only Zod as peer dependency, no extra bloat
- **Universal** - Works with process.env, dotenv, or any environment loader

## Installation

```bash
npm install zod-conf zod
# or
yarn add zod-conf zod
# or
pnpm add zod-conf zod
```

## Quick Start

```typescript
import zc from 'zod-conf';

// define your configuration schema
const schema = zc.define({
  port: zc.env('PORT').number().default(3000),
  host: zc.env('HOST').string().default('localhost'),
  debug: zc.env('DEBUG').boolean().default(false),
});

// load configuration from environment
const config = schema.load({
  env: process.env,
});

console.log(config);
// { port: 3000, host: 'localhost', debug: false }
```

## Usage

### Basic Types

```typescript
const schema = zc.define({
  // string
  apiUrl: zc.env('API_URL').string(),

  // number
  port: zc.env('PORT').number(),

  // boolean
  isProduction: zc.env('NODE_ENV').boolean(),

  // enum
  logLevel: zc.env('LOG_LEVEL').enum(['debug', 'info', 'warn', 'error']),
});
```

### Defaults and Optional Values

```typescript
const schema = zc.define({
  // with default value
  port: zc.env('PORT').number().default(3000),

  // optional field
  apiKey: zc.env('API_KEY').string().optional(),

  // nullable field
  proxyUrl: zc.env('PROXY_URL').string().nullable(),
});
```

### Nested Objects

```typescript
const schema = zc.define({
  server: zc.object({
    host: zc.env('SERVER_HOST').string().default('localhost'),
    port: zc.env('SERVER_PORT').number().default(3000),
  }),
  database: zc.object({
    url: zc.env('DATABASE_URL').string(),
    pool: zc.object({
      min: zc.env('DB_POOL_MIN').number().default(1),
      max: zc.env('DB_POOL_MAX').number().default(10),
    }),
  }),
});
```

### TypeScript Enums

```typescript
enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
}

const schema = zc.define({
  logLevel: zc.env('LOG_LEVEL').enum(LogLevel).default(LogLevel.INFO),
});
```

### Loading Configuration

```typescript
// from process.env
const config = schema.load({ env: process.env });

// from .env file (using dotenv)
import { config as dotenvConfig } from 'dotenv';

const env = dotenvConfig();
const config = schema.load({ env: env.parsed });

// from custom source
const config = schema.load({
  env: {
    PORT: '8080',
    HOST: '0.0.0.0',
  },
});
```

### Multiple Configuration Sources

You can load from multiple sources. Loaders are processed left-to-right; later loaders override earlier ones.

```typescript
import { parse } from 'yaml';
import { readFileSync } from 'fs';

const yamlConfig = parse(readFileSync('config.yml', 'utf8'));

// yaml values are used as base, env vars override
const config = schema.load({ values: yamlConfig }, { env: process.env });
```

You can also layer multiple objects for defaults:

```typescript
const defaults = { port: 3000, host: 'localhost' };
const yamlConfig = parse(readFileSync('config.yml', 'utf8'));

const config = schema.load({ values: defaults }, { values: yamlConfig }, { env: process.env });
```

The `values` loader maps values by property name and passes them directly to Zod — no string coercion is needed since YAML/JSON already preserves types. This also means you can use types that env vars can't represent, like arrays:

```typescript
import { z } from 'zod';

const schema = zc.define({
  host: zc.env('HOST').string().default('localhost'),
  port: zc.env('PORT').number().default(3000),
  allowedOrigins: z.array(z.string()),
  servers: z.array(z.object({ host: z.string(), port: z.number() })),
});

// arrays come from yaml, scalar fields can be overridden by env
const config = schema.load({ values: yamlConfig }, { env: process.env });
```

### Error Handling

The error-handling is similar to Zod's standard behavior:

```typescript
// throws on validation error
try {
  const config = schema.load({ env: process.env });
} catch (error) {
  console.error('Configuration validation failed:', error);
}

// safe parsing without throwing
const result = schema.safeLoad({ env: process.env });
if (result.success) {
  console.log('Config:', result.data);
} else {
  console.error('Validation errors:', result.error);
}
```

### Advanced: Transformations

All Zod transformations work seamlessly:

```typescript
const schema = zc.define({
  port: zc
    .env('PORT')
    .number()
    .default(3000)
    .transform((p) => Math.max(1024, p)), // Ensure port is at least 1024

  apiUrl: zc
    .env('API_URL')
    .string()
    .transform((url) => url.replace(/\/$/, '')), // Remove trailing slash
});
```

## API Reference

### `zc.define(shape)`

Creates a configuration schema with environment variable bindings.

- **shape**: An object where each value is created using `zc.env()` or `zc.object()`
- **returns**: A `ZodConfSchema` instance with `load()` and `safeLoad()` methods

### `zc.env(key)`

Binds a schema field to an environment variable.

- **key**: The environment variable name
- **returns**: An object with methods for different types:
  - `.string()` - String value
  - `.number()` - Numeric value (auto-converted)
  - `.boolean()` - Boolean value (accepts 'true'/'false')
  - `.enum(values)` - Enum value (string array or TypeScript enum)

### `zc.object(shape)`

Creates a nested object schema.

- **shape**: An object where values are `zc.env()` or nested `zc.object()` calls
- **returns**: A Zod object schema

### `schema.load(...loaders)`

Loads and validates configuration from one or more loaders.

- **loaders**: One or more loader objects, processed left-to-right (later overrides earlier)
  - `{ env: Record<string, string | undefined> }` - Load from environment variables
  - `{ values: Record<string, unknown> }` - Load from a plain object (e.g. parsed YAML/JSON)
- **returns**: Validated configuration object
- **throws**: ZodError if validation fails

### `schema.safeLoad(...loaders)`

Safely loads configuration without throwing. Same loader arguments as `load()`.

- **returns**: `{ success: true, data: T }` or `{ success: false, error: ZodError }`

## License

MIT
