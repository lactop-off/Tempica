// connect-pg-simple は型定義を同梱していないため最小限の宣言を提供する。
declare module 'connect-pg-simple' {
  import { Store } from 'express-session';
  interface PgStoreOptions {
    conString?: string;
    conObject?: Record<string, unknown>;
    pool?: unknown;
    tableName?: string;
    schemaName?: string;
    createTableIfMissing?: boolean;
    ttl?: number;
    pruneSessionInterval?: number | false;
  }
  function connectPgSimple(session: { Store: typeof Store }): {
    new (options?: PgStoreOptions): Store;
  };
  export default connectPgSimple;
}
