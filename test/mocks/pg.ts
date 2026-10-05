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

function executeMockQuery(text: string, values?: any[]): QueryResult {
  const normalized = (text || "").trim();

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

  // Handle: INSERT INTO slots ... RETURNING id
  if (/^INSERT\s+INTO\s+slots/i.test(normalized)) {
    const id = crypto.randomUUID();
    const record = {
      id,
      professional_id: values?.[0],
      start_time: values?.[1],
      end_time: values?.[2],
      status: values?.[3] ?? "available",
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
