import { type util, type ZodEnum, type ZodType } from 'zod';
import { coerce, string, enum as zenum } from 'zod';
import { _envMetadata } from './env-metadata.js';

/**
 * Binds a Zod schema to an environment variable.
 *
 * @param key - The name of the environment variable to bind to
 * @returns An object with methods to create different types of schemas:
 *   - `string()` - Creates a string schema
 *   - `number()` - Creates a number schema (auto-coerced from string)
 *   - `boolean()` - Creates a boolean schema (accepts 'true'/'false')
 *   - `enum(values)` - Creates an enum schema (string array or TypeScript enum)
 *
 * @example
 * ```typescript
 * // string environment variable
 * const apiUrl = env('API_URL').string();
 *
 * // number with default
 * const port = env('PORT').number().default(3000);
 *
 * // boolean
 * const debug = env('DEBUG').boolean().default(false);
 *
 * // enum with string array
 * const logLevel = env('LOG_LEVEL').enum(['info', 'debug', 'error']);
 *
 * // enum with TypeScript enum
 * enum Level { INFO = 'info', DEBUG = 'debug' }
 * const level = env('LOG_LEVEL').enum(Level);
 * ```
 */
export const env = (key: string) => {
  const wrap = <T extends ZodType>(schema: T, envKey: string, envType: string): T => {
    // create a proxy to preserve metadata through method chaining
    const proxied = new Proxy(schema, {
      get(target, prop) {
        const value = (target as any)[prop];

        // if it's a method, wrap the result to preserve metadata
        // e.g. .default(), .optional(), etc.
        if (typeof value === 'function') {
          return (...args: any[]) => {
            // call original method
            const result = value.apply(target, args);

            if (result && typeof result === 'object' && result._def) {
              // if result is a new chained Zod schema, wrap it in a new proxy
              return wrap(result, envKey, envType);
            }

            return result;
          };
        }

        // regular property, just return it
        return value;
      },
    }) as T;

    // remember metadata for the proxied object
    _envMetadata.set(proxied, { key: envKey, type: envType });

    return proxied;
  };

  return {
    string: () => wrap(string(), key, 'string'),
    number: () => wrap(coerce.number(), key, 'number'),
    boolean: () => wrap(coerce.boolean(), key, 'boolean'),
    enum: (() => {
      type EnumValue = string | number;
      type EnumLike = Readonly<Record<string, EnumValue>>;

      // enum like
      function enumMethod<const T extends readonly string[]>(values: T): ZodEnum<util.ToEnum<T[number]>>;
      // string or number enum
      function enumMethod<const T extends EnumLike>(entries: T): ZodEnum<T>;
      // implementation
      function enumMethod(values: any): any {
        return wrap(zenum(values), key, 'enum');
      }

      return enumMethod;
    })(),
  };
};
