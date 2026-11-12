import { EventEmitter } from "node:events";
import crypto from "node:crypto";

// Minimal type stubs so imports of QueryResult, PoolClient, etc. resolve
// when the real `pg` module is replaced by this mock in Jest.
export interface QueryResult<R = any> {
  rows: R[];
  rowCount: number | null;
  command: string;
  oid: number;
  fields: any[];
}

export interface PoolClient {
  query: (text: string, values?: any[]) => Promise<QueryResult>;
  release: (err?: Error) => void;
}

const usersTable = new Map<string, any>();
const slotsTable = new Map<string, any>();
const mfaTable = new Map<string, any>();
const schemaMigrationsTable = new Map<string, any>();
let mfaTableExists = false;
let mfaIndexExists = false;

function executeMockQuery(text: string, values?: any[]): QueryResult {
  const normalized = (text || "").trim();

  // Handle: CREATE TABLE / CREATE INDEX for mfa_enrollments
  if (/^CREATE\s+TABLE\s+(IF\s+NOT\s+EXISTS\s+)?mfa_enrollments/i.test(normalized)) {
    mfaTableExists = true;
    return { rows: [], rowCount: 0, command: "CREATE", oid: 0, fields: [] };
  }
  if (/^CREATE\s+(UNIQUE\s+)?INDEX\s+(IF\s+NOT\s+EXISTS\s+)?mfa_enrollments_verified_idx/i.test(normalized)) {
    mfaIndexExists = true;
    return { rows: [], rowCount: 0, command: "CREATE", oid: 0, fields: [] };
  }
  if (/^DROP\s+INDEX\s+(IF\s+EXISTS\s+)?mfa_enrollments_verified_idx/i.test(normalized)) {
    mfaIndexExists = false;
    return { rows: [], rowCount: 0, command: "DROP", oid: 0, fields: [] };
  }

  // Handle: information_schema and pg catalog queries
  if (/FROM\s+information_schema\.tables\s+WHERE\s+table_name\s*=\s*'mfa_enrollments'/i.test(normalized)) {
    const rows = mfaTableExists ? [{ table_name: "mfa_enrollments" }] : [];
    return { rows, rowCount: rows.length, command: "SELECT", oid: 0, fields: [] };
  }
  if (/FROM\s+information_schema\.columns\s+WHERE\s+table_name\s*=\s*'mfa_enrollments'/i.test(normalized)) {
    const cols = [
      { column_name: "user_id", data_type: "text", is_nullable: "NO", column_default: null },
      { column_name: "secret_ciphertext", data_type: "text", is_nullable: "NO", column_default: null },
      { column_name: "secret_iv", data_type: "text", is_nullable: "NO", column_default: null },
      { column_name: "secret_auth_tag", data_type: "text", is_nullable: "NO", column_default: null },
      { column_name: "kdf_salt", data_type: "text", is_nullable: "NO", column_default: null },
      { column_name: "algorithm", data_type: "character varying", is_nullable: "NO", column_default: "'SHA1'::character varying" },
      { column_name: "digits", data_type: "smallint", is_nullable: "NO", column_default: "6" },
      { column_name: "period", data_type: "integer", is_nullable: "NO", column_default: "30" },
      { column_name: "verified", data_type: "boolean", is_nullable: "NO", column_default: "false" },
      { column_name: "last_used_counter", data_type: "bigint", is_nullable: "YES", column_default: null },
      { column_name: "created_at", data_type: "timestamp with time zone", is_nullable: "NO", column_default: "now()" },
      { column_name: "updated_at", data_type: "timestamp with time zone", is_nullable: "NO", column_default: "now()" },
    ];
    return { rows: cols, rowCount: cols.length, command: "SELECT", oid: 0, fields: [] };
  }
  if (/FROM\s+information_schema\.table_constraints.*tc\.constraint_type\s*=\s*'PRIMARY KEY'/is.test(normalized)) {
    return { rows: [{ column_name: "user_id" }], rowCount: 1, command: "SELECT", oid: 0, fields: [] };
  }
  if (/FROM\s+pg_constraint\s+WHERE\s+conrelid\s*=\s*'mfa_enrollments'::regclass/i.test(normalized)) {
    const rows = [
      { conname: "mfa_enrollments_digits_check", definition: "CHECK (digits BETWEEN 6 AND 10)" },
      { conname: "mfa_enrollments_period_check", definition: "CHECK (period > 0)" },
      { conname: "mfa_enrollments_last_used_counter_check", definition: "CHECK (last_used_counter IS NULL OR last_used_counter >= 0)" },
    ];
    return { rows, rowCount: 3, command: "SELECT", oid: 0, fields: [] };
  }
  if (/FROM\s+pg_indexes\s+WHERE/i.test(normalized) && /mfa_enrollments/i.test(normalized)) {
    const rows = mfaIndexExists ? [{ indexname: "mfa_enrollments_verified_idx" }] : [];
    return { rows, rowCount: rows.length, command: "SELECT", oid: 0, fields: [] };
  }
  if (/SELECT\s+obj_description\('mfa_enrollments'::regclass\)/i.test(normalized)) {
    return {
      rows: [{ comment: "Per-user TOTP MFA enrollments. Secrets are encrypted using AES-256-GCM with keys derived via HKDF." }],
      rowCount: 1,
      command: "SELECT",
      oid: 0,
      fields: [],
    };
  }

  // Handle: INSERT INTO mfa_enrollments
  if (/^INSERT\s+INTO\s+mfa_enrollments/i.test(normalized)) {
    const colMatch = /INSERT\s+INTO\s+mfa_enrollments\s*\(([^)]+)\)/i.exec(normalized);
    const colNames = colMatch ? colMatch[1].split(",").map((c) => c.trim()) : [];
    const record: Record<string, any> = {};
    colNames.forEach((col, idx) => {
      record[col] = values?.[idx];
    });

    if (record.user_id && mfaTable.has(record.user_id)) {
      throw new Error('duplicate key value violates unique constraint "mfa_enrollments_pkey"');
    }
    if (!record.secret_ciphertext) {
      throw new Error('null value in column "secret_ciphertext" violates not-null constraint');
    }
    if (!record.secret_iv) {
      throw new Error('null value in column "secret_iv" violates not-null constraint');
    }
    if (!record.secret_auth_tag) {
      throw new Error('null value in column "secret_auth_tag" violates not-null constraint');
    }
    if (!record.kdf_salt) {
      throw new Error('null value in column "kdf_salt" violates not-null constraint');
    }
    if (record.digits !== undefined && (record.digits < 6 || record.digits > 10)) {
      throw new Error('check constraint "mfa_enrollments_digits_check"');
    }
    if (record.period !== undefined && record.period <= 0) {
      throw new Error('check constraint "mfa_enrollments_period_check"');
    }
    if (
      record.last_used_counter !== undefined &&
      record.last_used_counter !== null &&
      record.last_used_counter < 0
    ) {
      throw new Error('check constraint "mfa_enrollments_last_used_counter_check"');
    }

    const fullRecord = {
      user_id: record.user_id,
      secret_ciphertext: record.secret_ciphertext,
      secret_iv: record.secret_iv,
      secret_auth_tag: record.secret_auth_tag,
      kdf_salt: record.kdf_salt,
      algorithm: record.algorithm ?? "SHA1",
      digits: record.digits ?? 6,
      period: record.period ?? 30,
      verified: record.verified ?? false,
      last_used_counter: record.last_used_counter ?? null,
      created_at: new Date(),
      updated_at: new Date(),
    };
    mfaTable.set(record.user_id, fullRecord);
    return { rows: [{ ...fullRecord }], rowCount: 1, command: "INSERT", oid: 0, fields: [] };
  }

  // Handle: SELECT FROM mfa_enrollments WHERE user_id = $1
  if (/^SELECT.*FROM\s+mfa_enrollments\s+WHERE\s+user_id\s*=\s*\$1/i.test(normalized)) {
    const id = values?.[0];
    const rec = id ? mfaTable.get(id) : null;
    if (!rec) {
      return { rows: [], rowCount: 0, command: "SELECT", oid: 0, fields: [] };
    }
    if (/SELECT\s+last_used_counter/i.test(normalized)) {
      return {
        rows: [
          {
            last_used_counter:
              rec.last_used_counter !== null && rec.last_used_counter !== undefined
                ? String(rec.last_used_counter)
                : null,
          },
        ],
        rowCount: 1,
        command: "SELECT",
        oid: 0,
        fields: [],
      };
    }
    return {
      rows: [{ ...rec }],
      rowCount: 1,
      command: "SELECT",
      oid: 0,
      fields: [],
    };
  }

  // Handle: INSERT INTO users ... RETURNING id
  if (/^INSERT\s+INTO\s+users/i.test(normalized)) {
    const id = crypto.randomUUID();
    const email = values?.[0] ?? "user@example.com";
    const kyc_status = values?.[1] ?? "pending";
    const record = { id, email, kyc_status, kyc_ref: null, region: null };
    usersTable.set(id, record);
    return { rows: [{ id, ...record }], rowCount: 1, command: "INSERT", oid: 0, fields: [] };
  }

  // Handle: SELECT ... FROM users WHERE id = $1
  if (/^SELECT.*FROM\s+users\s+WHERE\s+id\s*=\s*\$1/i.test(normalized)) {
    const id = values?.[0];
    const record = id ? usersTable.get(id) : null;
    return {
      rows: record ? [{ ...record }] : [],
      rowCount: record ? 1 : 0,
      command: "SELECT",
      oid: 0,
      fields: [],
    };
  }

  // Handle: UPDATE users SET kyc_status = $1, kyc_ref = $2, updated_at = NOW() WHERE id = $3
  if (/^UPDATE\s+users/i.test(normalized)) {
    const status = values?.[0];
    const kycRef = values?.[1];
    const id = values?.[2];
    const record = id ? usersTable.get(id) : null;
    if (record) {
      record.kyc_status = status;
      record.kyc_ref = kycRef;
      return { rows: [{ ...record }], rowCount: 1, command: "UPDATE", oid: 0, fields: [] };
    }
    return { rows: [], rowCount: 0, command: "UPDATE", oid: 0, fields: [] };
  }

  // Handle: schema_migrations
  if (/^INSERT\s+INTO\s+schema_migrations/i.test(normalized)) {
    const id = values?.[0];
    const name = values?.[1];
    schemaMigrationsTable.set(id, { id, name, applied_at: new Date() });
    return { rows: [], rowCount: 1, command: "INSERT", oid: 0, fields: [] };
  }
  if (/^SELECT.*FROM\s+schema_migrations/i.test(normalized)) {
    const rows = [...schemaMigrationsTable.values()].sort((a, b) => a.id.localeCompare(b.id));
    return { rows, rowCount: rows.length, command: "SELECT", oid: 0, fields: [] };
  }
  if (/^DELETE\s+FROM\s+schema_migrations\s+WHERE\s+id\s*=\s*\$1/i.test(normalized)) {
    const id = values?.[0];
    schemaMigrationsTable.delete(id);
    return { rows: [], rowCount: 1, command: "DELETE", oid: 0, fields: [] };
  }

  // Handle: DROP TABLE
  if (/^DROP\s+TABLE/i.test(normalized)) {
    if (/slots/i.test(normalized)) {
      slotsTable.clear();
    }
    if (/users/i.test(normalized)) {
      usersTable.clear();
    }
    if (/mfa_enrollments/i.test(normalized)) {
      mfaTable.clear();
      mfaTableExists = false;
      mfaIndexExists = false;
    }
    if (/schema_migrations/i.test(normalized)) {
      schemaMigrationsTable.clear();
    }
    return { rows: [], rowCount: 0, command: "DROP", oid: 0, fields: [] };
  }

  // Handle: INSERT INTO slots ... RETURNING id
  if (/^INSERT\s+INTO\s+slots/i.test(normalized)) {
    const professional_id = values?.[0];
    const start_time = values?.[1];
    const end_time = values?.[2];
    const status = values?.[3] ?? "available";

    const newStart = new Date(start_time).getTime();
    const newEnd = new Date(end_time).getTime();

    for (const existing of slotsTable.values()) {
      if (existing.professional_id === professional_id) {
        const exStart = new Date(existing.start_time).getTime();
        const exEnd = new Date(existing.end_time).getTime();
        if (newStart < exEnd && exStart < newEnd) {
          const err = new Error(
            'conflicting key value violates exclusion constraint "excl_slots_no_overlap"'
          );
          (err as any).code = "23P01";
          throw err;
        }
      }
    }

    const id = crypto.randomUUID();
    const record = {
      id,
      professional_id,
      start_time,
      end_time,
      status,
    };
    slotsTable.set(id, record);
    return { rows: [{ id, ...record }], rowCount: 1, command: "INSERT", oid: 0, fields: [] };
  }

  return { rows: [], rowCount: 0, command: "UNKNOWN", oid: 0, fields: [] };
}

export class Pool extends EventEmitter {
  constructor() {
    super();
  }
  async connect(): Promise<PoolClient> {
    return {
      query: async (text: string, values?: any[]) => executeMockQuery(text, values),
      release: () => {},
    };
  }
  async query(text: string, values?: any[]): Promise<QueryResult> {
    return executeMockQuery(text, values);
  }
  async end() {}
}

export class Client {
  constructor() {}
  async connect() {}
  async query(text: string, values?: any[]): Promise<QueryResult> {
    return executeMockQuery(text, values);
  }
  async end() {}
}

export default { Pool, Client };
