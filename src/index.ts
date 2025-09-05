import { boolean, number, string, enum as zenum } from 'zod';
import { define, ZodConfSchema } from './values/define.js';
import { env } from './values/env.js';
import { object } from './values/object.js';

export const zc = {
  // core values
  define,
  env,
  object,
  ZodConfSchema,

  // re-export common zod values for convenience
  string,
  boolean,
  number,
  enum: zenum,
};

export default zc;
