# Fraq Kysely consumer lifecycle checklist

SUMMARY: Always register a consumer schema during `apply`, defer table access until `start`, and let `KyselyService` own the shared connection and database URL.
READ WHEN: before any Fraq plugin consumes KyselyService or registers a database schema

---

`@fraqjs/plugin-kysely` creates and provides its shared database during `apply`, then runs all registered schema migrations during its `start`. A consuming plugin should therefore:

1. Declare and inject `KyselyService`, and list `@fraqjs/plugin-kysely` plus the directly imported `kysely` package as peer dependencies.
2. Register its stable schema name and ordered migrations during `apply`. It may construct services around `ctx.kysely.db` there, but must not query business tables yet.
3. Load persisted settings, register commands, or otherwise access migrated tables during the consumer's `start`.
4. Never destroy the production `Kysely` instance from a consumer service; connection disposal belongs to `KyselyService`.
5. Treat `fraqjs/kysely.sqliteUrl` as the sole database-location setting. To adopt an older plugin-owned SQLite file, point `sqliteUrl` at that exact file before first startup so the registered migration upgrades it in place.

Keep published table and column names stable when adopting an existing database. The first registered migration must create missing tables, add all columns that older releases may lack, and backfill any derived tables before recording the migration as applied.
