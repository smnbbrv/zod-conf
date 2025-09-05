// the metadata stores env key and type for each schema

import { type ZodType } from 'zod';

// we can use it when building the input object
export const _envMetadata = new WeakMap<ZodType, { key: string; type: string }>();
