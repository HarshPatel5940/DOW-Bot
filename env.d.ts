import type { EnvSchemaType } from './src/config';

declare global {
  namespace NodeJS {
    // eslint-disable-next-line @typescript-eslint/no-empty-interface
    interface ProcessEnv extends EnvSchemaType {}
  }
}
