import { ZodObject, object, type ZodRawShape, type ZodType, type infer as ZodInfer } from 'zod';
import { _envMetadata } from './env-metadata.js';

type Env = Record<string, string | undefined>;

export type EnvLoader = { env: Env; values?: never | undefined };
export type ValuesLoader = { values: Record<string, unknown>; env?: never | undefined };
export type Loader = EnvLoader | ValuesLoader;

export class ZodConfSchema<T extends ZodRawShape> {
  constructor(
    private shape: T,
    private schema: ZodObject<T>,
  ) {}

  private resolveEnvValue(schema: ZodType, env: Env): unknown {
    let currentSchema = schema;
    let envKey: string | undefined;
    let envType: string | undefined;

    // traverse wrapped schemas to find metadata
    while (currentSchema && !envKey) {
      const metadata = _envMetadata.get(currentSchema);

      if (metadata) {
        // found metadata -> use it
        envKey = metadata.key;
        envType = metadata.type;
        break;
      }

      // check if this is a wrapped schema (default, optional, etc.)
      const def = (currentSchema as any)._def;

      if (def?.innerType) {
        // zod wrappers like optional, default, nullable, etc.
        currentSchema = def.innerType;
      } else if (def?.schema) {
        // zod effects
        currentSchema = def.schema;
      } else {
        // end of the chain, no metadata found
        break;
      }
    }

    if (!envKey) {
      return undefined;
    }

    const value = env[envKey];

    switch (envType) {
      case 'string':
        return value;
      case 'number':
        return value ? Number(value) : undefined;
      case 'boolean':
        return value === 'true' ? true : value === 'false' ? false : undefined;
      case 'enum': {
        const numValue = Number(value);

        // guess if enum is number-based
        if (value && !isNaN(numValue) && Number.isInteger(numValue)) {
          return numValue;
        }

        return value;
      }
      default:
        return undefined;
    }
  }

  private loadValue(shape: ZodRawShape, loaders: Loader[]): any {
    const input: any = {};

    for (const key in shape) {
      const schema = shape[key];

      if (schema instanceof ZodObject) {
        // for nested objects: drill into values loaders, pass env loaders as-is
        const subLoaders = loaders.map((loader) => {
          if ('values' in loader && loader.values) {
            const nested = loader.values[key];

            return { values: nested && typeof nested === 'object' ? nested : {} } as ValuesLoader;
          }

          return loader;
        });

        input[key] = this.loadValue(schema.shape, subLoaders);
      } else {
        // try each loader in order, later overrides earlier
        for (const loader of loaders) {
          if ('values' in loader && loader.values) {
            const value = loader.values[key];

            if (value !== undefined) {
              input[key] = value;
            }
          } else if ('env' in loader && loader.env) {
            const value = this.resolveEnvValue(schema as ZodType, loader.env);

            if (value !== undefined) {
              input[key] = value;
            }
          }
        }
      }
    }

    return input;
  }

  /**
   * Loads and validates configuration from the provided loaders.
   * Throws a ZodError if validation fails.
   *
   * Loaders are processed left-to-right; later loaders override earlier ones.
   *
   * @param loaders - One or more loaders: `{ env }` for environment variables, `{ values }` for plain objects
   * @returns Validated configuration object
   * @throws {ZodError} If validation fails
   *
   * @example
   * ```typescript
   * // env only
   * const config = schema.load({ env: process.env });
   *
   * // yaml + env (env overrides yaml)
   * const config = schema.load({ values: parsedYaml }, { env: process.env });
   * ```
   */
  load(...loaders: [Loader, ...Loader[]]): ZodInfer<ZodObject<T>> {
    const result = this.safeLoad(...loaders);

    if (!result.success) {
      throw result.error;
    }

    return result.data;
  }

  /**
   * Safely loads and validates configuration without throwing.
   * Returns a result object with either success or error.
   *
   * Loaders are processed left-to-right; later loaders override earlier ones.
   *
   * @param loaders - One or more loaders: `{ env }` for environment variables, `{ values }` for plain objects
   * @returns SafeParseReturnType with either { success: true, data } or { success: false, error }
   *
   * @example
   * ```typescript
   * const result = schema.safeLoad({ values: yamlConfig }, { env: process.env });
   *
   * if (result.success) {
   *   console.log('Config:', result.data);
   * } else {
   *   console.error('Errors:', result.error.issues);
   * }
   * ```
   */
  safeLoad(...loaders: [Loader, ...Loader[]]) {
    const value = this.loadValue(this.shape, loaders);

    return this.schema.safeParse(value);
  }
}

/**
 * Creates a configuration schema with environment variable bindings.
 *
 * @param shape - An object defining the configuration structure where each field
 *                uses `env()` to bind to environment variables or `object()` for nesting
 * @returns A ZodConfSchema instance with `load()` and `safeLoad()` methods
 *
 * @example
 * ```typescript
 * // define a configuration schema
 * const schema = define({
 *   port: env('PORT').number().default(3000),
 *   host: env('HOST').string().default('localhost'),
 *   database: object({
 *     url: env('DATABASE_URL').string(),
 *     poolSize: env('DB_POOL_SIZE').number().default(10),
 *   }),
 * });
 *
 * // load from env only
 * const config = schema.load({ env: process.env });
 *
 * // load from yaml + env (env overrides yaml)
 * const config = schema.load({ values: parsedYaml }, { env: process.env });
 * ```
 */
export const define = <T extends ZodRawShape>(shape: T): ZodConfSchema<T> => {
  return new ZodConfSchema(shape, object(shape));
};
