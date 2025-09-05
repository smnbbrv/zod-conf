import { ZodObject, object, type ZodRawShape, type ZodType, type infer as ZodInfer } from 'zod';
import { _envMetadata } from './env-metadata.js';

type Env = Record<string, string | undefined>;

export type LoadParams = {
  env: Env;
};

export class ZodConfSchema<T extends ZodRawShape> {
  constructor(
    private shape: T,
    private schema: ZodObject<T>,
  ) {}

  private loadValue(shape: ZodRawShape, env: Env): any {
    const input: any = {};

    for (const key in shape) {
      const schema = shape[key];

      if (schema instanceof ZodObject) {
        // for nested objects, recurse
        input[key] = this.loadValue(schema.shape, env);
      } else {
        let currentSchema = schema as ZodType;
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

        if (envKey) {
          const value = env[envKey];

          switch (envType) {
            case 'string':
              input[key] = value;
              break;
            case 'number':
              input[key] = value ? Number(value) : undefined;
              break;
            case 'boolean':
              input[key] = value === 'true' ? true : value === 'false' ? false : undefined;
              break;
            case 'enum': {
              const numValue = Number(value);

              // guess if enum is number-based
              if (value && !isNaN(numValue) && Number.isInteger(numValue)) {
                input[key] = numValue;
              } else {
                input[key] = value;
              }

              break;
            }
            default:
              input[key] = undefined;
          }
        } else {
          input[key] = undefined;
        }
      }
    }

    return input;
  }

  /**
   * Loads and validates configuration from environment variables.
   * Throws a ZodError if validation fails.
   *
   * @param input - Object containing environment variables
   * @param input.env - Environment variables as key-value pairs
   * @returns Validated configuration object
   * @throws {ZodError} If validation fails
   *
   * @example
   * ```typescript
   * const config = schema.load({ env: process.env });
   * ```
   */
  load(input: LoadParams): ZodInfer<ZodObject<T>> {
    const result = this.safeLoad(input);

    if (!result.success) {
      throw result.error;
    }

    return result.data;
  }

  /**
   * Safely loads and validates configuration without throwing.
   * Returns a result object with either success or error.
   *
   * @param input - Object containing environment variables
   * @param input.env - Environment variables as key-value pairs
   * @returns SafeParseReturnType with either { success: true, data } or { success: false, error }
   *
   * @example
   * ```typescript
   * const result = schema.safeLoad({ env: process.env });
   *
   * if (result.success) {
   *   console.log('Config:', result.data);
   * } else {
   *   console.error('Errors:', result.error.issues);
   * }
   * ```
   */
  safeLoad(input: LoadParams) {
    const value = this.loadValue(this.shape, input.env);

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
 * // load configuration from environment
 * const config = schema.load({ env: process.env });
 *
 * // safe load without throwing
 * const result = schema.safeLoad({ env: process.env });
 * if (result.success) {
 *   console.log(result.data);
 * }
 * ```
 */
export const define = <T extends ZodRawShape>(shape: T): ZodConfSchema<T> => {
  return new ZodConfSchema(shape, object(shape));
};
