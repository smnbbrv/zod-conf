import { type ZodObject } from 'zod';
import { type ZodRawShape } from 'zod';
import { object as zobject } from 'zod';

/**
 * Creates a nested object schema for grouping related configuration.
 * This is a convenience wrapper around Zod's object() for consistency.
 *
 * @param shape - An object where values are environment bindings or nested objects
 * @returns A Zod object schema
 *
 * @example
 * ```typescript
 * const schema = define({
 *   // group related configuration
 *   server: object({
 *     host: env('SERVER_HOST').string().default('localhost'),
 *     port: env('SERVER_PORT').number().default(3000),
 *   }),
 *
 *   // nested objects
 *   database: object({
 *     connection: object({
 *       url: env('DATABASE_URL').string(),
 *       timeout: env('DB_TIMEOUT').number().default(5000),
 *     }),
 *     pool: object({
 *       min: env('DB_POOL_MIN').number().default(1),
 *       max: env('DB_POOL_MAX').number().default(10),
 *     }),
 *   }),
 * });
 * ```
 */
export const object = <T extends ZodRawShape>(shape: T): ZodObject<T> => {
  return zobject(shape);
};
