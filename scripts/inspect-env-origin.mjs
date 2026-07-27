const value = process.env.DATABASE_URL ?? process.env.SUPABASE_DB_URL ?? "";
const host = value.match(/(?:postgres(?:ql)?:\/\/)(?:[^@]+@)?([^/:]+)/)?.[1] ?? null;
const user = value.match(/(?:postgres(?:ql)?:\/\/)([^:]+):/)?.[1] ?? null;
console.log(JSON.stringify({ hasDatabaseUrl: Boolean(value), host, user }));
