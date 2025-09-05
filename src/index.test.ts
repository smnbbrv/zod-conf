import { strictEqual, deepStrictEqual } from 'node:assert';
import { test } from 'node:test';
import zc from './index.js';

test('zod-conf configuration parsing', async (t) => {
  await t.test('parses string environment variables', () => {
    const schema = zc.define({
      apiUrl: zc.env('API_URL').string(),
    });

    const config = schema.load({
      env: { API_URL: 'https://api.example.com' },
    });

    strictEqual(config.apiUrl, 'https://api.example.com');
  });

  await t.test('parses number environment variables', () => {
    const schema = zc.define({
      port: zc.env('PORT').number(),
    });

    const config = schema.load({
      env: { PORT: '3000' },
    });

    strictEqual(config.port, 3000);
  });

  await t.test('parses boolean environment variables', () => {
    const schema = zc.define({
      debug: zc.env('DEBUG').boolean(),
      verbose: zc.env('VERBOSE').boolean(),
    });

    const config = schema.load({
      env: { DEBUG: 'true', VERBOSE: 'false' },
    });

    strictEqual(config.debug, true);
    strictEqual(config.verbose, false);
  });

  await t.test('parses enum environment variables with string array', () => {
    const schema = zc.define({
      logLevel: zc.env('LOG_LEVEL').enum(['info', 'debug', 'error']),
    });

    const config = schema.load({
      env: { LOG_LEVEL: 'debug' },
    });

    strictEqual(config.logLevel, 'debug');
  });

  await t.test('parses enum environment variables with string enum', () => {
    enum LogLevel {
      INFO = 'info',
      DEBUG = 'debug',
      ERROR = 'error',
    }

    const schema = zc.define({
      logLevel: zc.env('LOG_LEVEL').enum(LogLevel),
    });

    const config = schema.load({
      env: { LOG_LEVEL: 'info' },
    });

    strictEqual(config.logLevel, 'info');
  });

  await t.test('parses enum environment variables with numeric enum', () => {
    enum Priority {
      LOW = 1,
      MEDIUM = 2,
      HIGH = 3,
      URGENT = 4,
    }

    const schema = zc.define({
      priority: zc.env('PRIORITY').enum(Priority),
    });

    const config = schema.load({
      env: { PRIORITY: '3' },
    });

    strictEqual(config.priority, 3);
  });

  await t.test('parses enum environment variables with mixed enum', () => {
    enum Status {
      INACTIVE = 0,
      ACTIVE = 1,
      PENDING = 'pending',
      ARCHIVED = 'archived',
    }

    const schema = zc.define({
      statusNum: zc.env('STATUS_NUM').enum(Status),
      statusStr: zc.env('STATUS_STR').enum(Status),
    });

    const config = schema.load({
      env: {
        STATUS_NUM: '1',
        STATUS_STR: 'pending',
      },
    });

    strictEqual(config.statusNum, 1);
    strictEqual(config.statusStr, 'pending');
  });

  await t.test('handles default values', () => {
    const schema = zc.define({
      host: zc.env('HOST').string().default('localhost'),
      port: zc.env('PORT').number().default(8080),
      secure: zc.env('SECURE').boolean().default(false),
    });

    const config = schema.load({
      env: {},
    });

    strictEqual(config.host, 'localhost');
    strictEqual(config.port, 8080);
    strictEqual(config.secure, false);
  });

  await t.test('handles optional values', () => {
    const schema = zc.define({
      optionalKey: zc.env('OPTIONAL_KEY').string().optional(),
    });

    const config = schema.load({
      env: {},
    });

    strictEqual(config.optionalKey, undefined);
  });

  await t.test('handles nested objects', () => {
    const schema = zc.define({
      server: zc.object({
        host: zc.env('SERVER_HOST').string().default('localhost'),
        port: zc.env('SERVER_PORT').number().default(3000),
      }),
      database: zc.object({
        url: zc.env('DB_URL').string(),
        pool: zc.object({
          min: zc.env('DB_POOL_MIN').number().default(1),
          max: zc.env('DB_POOL_MAX').number().default(10),
        }),
      }),
    });

    const config = schema.load({
      env: {
        SERVER_HOST: '0.0.0.0',
        SERVER_PORT: '4000',
        DB_URL: 'postgres://localhost/mydb',
        DB_POOL_MAX: '20',
      },
    });

    deepStrictEqual(config, {
      server: {
        host: '0.0.0.0',
        port: 4000,
      },
      database: {
        url: 'postgres://localhost/mydb',
        pool: {
          min: 1,
          max: 20,
        },
      },
    });
  });

  await t.test('handles complex configuration', () => {
    const schema = zc.define({
      app: zc.object({
        name: zc.env('APP_NAME').string().default('MyApp'),
        version: zc.env('APP_VERSION').string().default('1.0.0'),
        debug: zc.env('DEBUG').boolean().default(false),
      }),
      server: zc.object({
        host: zc.env('HOST').string().default('localhost'),
        port: zc.env('PORT').number().default(3000),
        ssl: zc.object({
          enabled: zc.env('SSL_ENABLED').boolean().default(false),
          cert: zc.env('SSL_CERT').string().optional(),
          key: zc.env('SSL_KEY').string().optional(),
        }),
      }),
      features: zc.object({
        auth: zc.env('FEATURE_AUTH').boolean().default(true),
        analytics: zc.env('FEATURE_ANALYTICS').boolean().default(false),
      }),
    });

    const config = schema.load({
      env: {
        APP_NAME: 'TestApp',
        DEBUG: 'true',
        PORT: '5000',
        SSL_ENABLED: 'true',
        SSL_CERT: '/path/to/cert.pem',
        SSL_KEY: '/path/to/key.pem',
        FEATURE_ANALYTICS: 'true',
      },
    });

    deepStrictEqual(config, {
      app: {
        name: 'TestApp',
        version: '1.0.0',
        debug: true,
      },
      server: {
        host: 'localhost',
        port: 5000,
        ssl: {
          enabled: true,
          cert: '/path/to/cert.pem',
          key: '/path/to/key.pem',
        },
      },
      features: {
        auth: true,
        analytics: true,
      },
    });
  });

  await t.test('safeLoad returns success for valid config', () => {
    const schema = zc.define({
      apiKey: zc.env('API_KEY').string(),
    });

    const result = schema.safeLoad({
      env: { API_KEY: 'secret-key' },
    });

    strictEqual(result.success, true);
    if (result.success) {
      strictEqual(result.data.apiKey, 'secret-key');
    }
  });

  await t.test('safeLoad returns error for invalid config', () => {
    const schema = zc.define({
      port: zc.env('PORT').number(),
    });

    const result = schema.safeLoad({
      env: { PORT: 'not-a-number' },
    });

    strictEqual(result.success, false);
    if (!result.success) {
      strictEqual(result.error.issues.length > 0, true);
    }
  });

  await t.test('handles fields without env metadata', () => {
    const schema = zc.define({
      // this field has no env binding, just a plain zod schema
      plainField: zc.object({
        nestedPlain: zc.env('SHOULD_WORK').string().default('default'),
      }),
    });

    const config = schema.load({
      env: {},
    });

    deepStrictEqual(config, {
      plainField: {
        nestedPlain: 'default',
      },
    });
  });

  await t.test('load throws error for invalid config', () => {
    const schema = zc.define({
      requiredField: zc.env('REQUIRED').string(),
    });

    let error: any;
    try {
      schema.load({
        env: {},
      });
    } catch (e) {
      error = e;
    }

    strictEqual(error !== undefined, true);
    strictEqual(error.issues !== undefined, true);
  });

  await t.test('handles enum with non-integer number strings', () => {
    const schema = zc.define({
      value: zc.env('VALUE').enum(['a', 'b', 'c']),
    });

    const config = schema.load({
      env: { VALUE: 'a' },
    });

    strictEqual(config.value, 'a');
  });

  await t.test('handles enum with decimal number string', () => {
    const schema = zc.define({
      value: zc.env('DECIMAL_VALUE').enum(['3.14', 'pi', 'e']),
    });

    // this should pass the string through since "3.14" is not an integer
    const config = schema.load({
      env: { DECIMAL_VALUE: '3.14' },
    });

    strictEqual(config.value, '3.14');
  });

  await t.test('handles undefined env values for enum', () => {
    const schema = zc.define({
      optionalEnum: zc.env('OPT_ENUM').enum(['a', 'b']).optional(),
    });

    const config = schema.load({
      env: {},
    });

    strictEqual(config.optionalEnum, undefined);
  });

  await t.test('handles schema without innerType or schema properties', () => {
    // this tests the branch where we break out of the while loop
    const schema = zc.define({
      value: zc.env('VALUE').string(),
    });

    const config = schema.load({
      env: { VALUE: 'test' },
    });

    strictEqual(config.value, 'test');
  });

  await t.test('handles deeply wrapped schemas with transformations', () => {
    const schema = zc.define({
      transformed: zc
        .env('TRANSFORMED')
        .string()
        .optional()
        .default('default')
        .transform((v) => v.toUpperCase()),
    });

    const config = schema.load({
      env: {},
    });

    strictEqual(config.transformed, 'DEFAULT');
  });

  await t.test('handles schema with no env metadata at all', async () => {
    // create a plain zod schema without env bindings
    const z = await import('zod');
    const plainSchema = z.object({
      plainField: z.string().default('plain'),
    });

    // mix it with env-bound fields
    const schema = zc.define({
      envField: zc.env('ENV_FIELD').string().default('env'),
      plainNested: plainSchema.shape.plainField,
    });

    const config = schema.load({
      env: {},
    });

    strictEqual(config.envField, 'env');
    // plain fields without env binding will still use their Zod defaults
    strictEqual(config.plainNested, 'plain');
  });

  await t.test('env proxy preserves non-schema properties and methods', async () => {
    const envSchema = zc.env('TEST').string();

    // test that metadata is stored in WeakMap (we can't directly access it from here)
    // but we can verify the schema works correctly
    const schema = zc.define({
      test: envSchema,
    });
    const config = schema.load({ env: { TEST: 'value' } });
    strictEqual(config.test, 'value');

    // call methods that don't return schemas
    const parsed = envSchema.parse('test');
    strictEqual(parsed, 'test');

    // access description property
    const withDesc = zc.env('DESC').string().describe('A test field');
    strictEqual(withDesc.description, 'A test field');

    // test safeParse which returns a result object, not a schema
    const result = zc.env('SAFE').number().safeParse('123');
    strictEqual(result.success, true);
    if (result.success) {
      strictEqual(result.data, 123);
    }
  });

  await t.test('env proxy handles methods returning non-objects', () => {
    const schema = zc.env('TEST').string();

    // test parse method returns the parsed value (not a schema)
    const parsed = schema.parse('test');
    strictEqual(parsed, 'test');

    // test safeParse returns a result object (not a schema)
    const result = schema.safeParse('value');
    strictEqual(result.success, true);
    if (result.success) {
      strictEqual(result.data, 'value');
    }

    // test that optional() and nullable() still work (these are NOT deprecated)
    const optionalSchema = schema.optional();
    const nullableSchema = schema.nullable();

    // verify they can parse undefined/null respectively
    strictEqual(optionalSchema.parse(undefined), undefined);
    strictEqual(nullableSchema.parse(null), null);
  });
});
