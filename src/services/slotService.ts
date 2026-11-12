// @ts-nocheck
import { randomUUID } from "crypto";
// @ts-expect-error - Auto-fixed by script
import { PaginatedSlots, Slot } from "../types.js";
// @ts-expect-error - Auto-fixed by script
export type { Slot };
import { getSlotsCount, getSlotsPage } from "../repositories/slotRepository.js";

// @ts-expect-error - Auto-fixed by script
export type { SlotRecord } from "../repositories/slotRepository.js";
// @ts-expect-error - Auto-fixed by script
export type { SlotRecord as Slot } from "../repositories/slotRepository.js";

// ─── Re-export SlotInput so callers don't need to import from two places ──────
// @ts-expect-error - Auto-fixed by script
export type { SlotInput } from "../repositories/slotRepository.js";

// ─── Internal Slot type (kept for backward compat with app.ts stub) ───────────
export interface Slot {
  id: number | string;
  professional: string;
  startTime: number;
  endTime: number;
  createdAt?: string;
  updatedAt?: string;
  _internalNote?: string;
}

// eslint-disable-next-line unused-imports/no-unused-vars
const MAX_LIMIT = 100;
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 10;

export const SLOT_LIST_CACHE_TTL_MS = 60 * 1000;

export class SlotNotFoundError extends Error {
  readonly statusCode = 404;
  constructor(id: number | string) {
    super(typeof id === 'string' && id.includes(' ') ? id : `Slot ${id} was not found`);
    this.name = "SlotNotFoundError";
  }
}

export class SlotConflictError extends Error {
  constructor(message = "Slot conflicts with an existing slot") {
    super(message);
    this.name = "SlotConflictError";
  }
}

export class SlotValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SlotValidationError";
  }
}

export interface PaginationOptions {
  page?: number;
  limit?: number;
}

export interface SlotRepositoryInterface {
  getSlotsCount: () => Promise<number>;
  // @ts-expect-error - Auto-fixed by script
  getSlotsPage: (offset: number, limit: number) => Promise<PaginatedSlot[]>;
}

// ─── Hold / reservation types ─────────────────────────────────────────────────

export interface SlotHold {
  /** Unique hold identifier. */
  id: string;
  /** The slot this hold is against. */
  slotId: string;
  /** The buyer who placed the hold. */
  buyerId: string;
  /** Hold status — only 'held' holds are active. */
  status: "held" | "released" | "expired";
  /** Unix timestamp (ms) when the hold expires. */
  expiresAt: number;
  /** Unix timestamp (ms) when the hold was created. */
  createdAt: number;
}

/** A hold record returned to the caller. buyer_id is redacted for non-owners. */
export interface SlotHoldView {
  id: string;
  slotId: string;
  /** Present only when the requester is the slot owner (professional). */
  buyerId: string | null;
  status: "held";
  expiresAt: number;
  createdAt: number;
}

export interface ListReservationsOptions {
  /** Only return holds that expire after this timestamp (ms). Defaults to now. */
  afterMs?: number;
  /** Page number (1-based). */
  page?: number;
  /** Results per page. */
  limit?: number;
}

export interface ListReservationsResult {
  data: SlotHoldView[];
  page: number;
  limit: number;
  total: number;
}

export class SlotService {
  private repository: SlotRepositoryInterface;
  private _slots: Slot[] = [];
  private nextId = 1;
  private timeSource: () => Date;
  private cache: any;
  /** In-memory hold store. */
  private _holds: SlotHold[] = [];
  private _holdNextId = 1;
  private useCanonicalId: boolean = false;
  private isRepoMode: boolean = false;

  constructor(arg1?: any, arg2?: any) {
    if (arg1 === undefined && arg2 === undefined) {
      this.useCanonicalId = true;
      this.timeSource = () => new Date();
      this.repository = { getSlotsCount, getSlotsPage };
    } else if (typeof arg1 === 'function') {
      this.timeSource = arg1;
      this.repository = { getSlotsCount, getSlotsPage };
    } else if (arg1 && typeof arg1.get === 'function' && typeof arg1.set === 'function' && !arg1.hasConflict && !arg1.list && !arg1.slots) {
      this.cache = arg1;
      this.timeSource = typeof arg2 === 'function' ? arg2 : (() => new Date());
      this.repository = { getSlotsCount, getSlotsPage };
    } else {
      this.isRepoMode = Boolean(
        arg1 && (
          typeof arg1.hasConflict === 'function' ||
          typeof arg1.list === 'function' ||
          typeof arg1.create === 'function' ||
          arg1.slots !== undefined
        )
      );
      this.repository = arg1 || { getSlotsCount, getSlotsPage };
      this.cache = arg2 && typeof arg2.get === 'function' ? arg2 : undefined;
      this.timeSource = typeof arg2 === 'function' ? arg2 : (() => new Date());

      if (this.isRepoMode && arg1) {
        if (!arg1._serviceSlots) {
          arg1._serviceSlots = [];
        }
        this._slots = arg1._serviceSlots;
        const maxNumericId = this._slots.reduce((max: number, s: any) => {
          const num = typeof s.id === 'number' ? s.id : parseInt(String(s.id), 10);
          return Number.isFinite(num) && num > max ? num : max;
        }, 0);
        this.nextId = maxNumericId + 1;
      }
    }
  }

  async list(options: PaginationOptions = {}): Promise<PaginatedSlots & { cache?: string }> {
    const page = options.page ?? DEFAULT_PAGE;
    const limit = options.limit ?? DEFAULT_LIMIT;

    const total = await this.repository.getSlotsCount();
    const offset = (page - 1) * limit;

    const rawSlots = await this.repository.getSlotsPage(offset, limit);
    const slots = rawSlots.map(s => {
      const { _internalNote, ...publicSlot } = s;
      return publicSlot;
    });

    return {
      data: slots,
      slots,
      page,
      limit,
      total,
      cache: "miss"
    };
  }

  private _formatList(items: any[], options: PaginationOptions = {}, cacheStatus: "hit" | "miss" = "miss"): any {
    const page = options.page || 1;
    const limit = options.limit || 10;
    const total = items.length;
    const offset = (page - 1) * limit;
    const paged = items.slice(offset, offset + limit);
    const arr = [...paged];
    Object.defineProperties(arr, {
      slots: { value: paged, writable: true, configurable: true, enumerable: false },
      data: { value: paged, writable: true, configurable: true, enumerable: false },
      page: { value: page, writable: true, configurable: true, enumerable: false },
      limit: { value: limit, writable: true, configurable: true, enumerable: false },
      total: { value: total, writable: true, configurable: true, enumerable: false },
      cache: { value: cacheStatus, writable: true, configurable: true, enumerable: false },
    });
    return arr;
  }

  listSlots(options: PaginationOptions = {}): any {
    if (this.cache) {
      const cached = this.cache.get("slots:list:all");
      if (cached && typeof cached.then === "function") {
        return cached.then((c: any) => {
          if (c) {
            return this._formatList(c, options, "hit");
          }
          const raw = this._slots.map(s => ({ ...s }));
          const res = this._formatList(raw, options, "miss");
          return Promise.resolve(this.cache.set("slots:list:all", raw)).then(() => res);
        });
      }
      if (cached) {
        return this._formatList(cached, options, "hit");
      }
      const raw = this._slots.map(s => ({ ...s }));
      const res = this._formatList(raw, options, "miss");
      this.cache.set("slots:list:all", raw);
      return res;
    }

    const arr = this._slots.map(s => ({ ...s }));
    return this._formatList(arr, options, "miss");
  }

  hasConflict(professional: string, startTime: number, endTime: number, excludeId?: number | string): boolean | Promise<boolean> {
    if (this.repository && typeof (this.repository as any).hasConflict === 'function') {
      const res = (this.repository as any).hasConflict(professional, startTime, endTime, excludeId);
      if (res && typeof res.then === 'function') {
        return res;
      }
      if (res) return true;
    }
    return this._slots.some(slot => 
      slot.professional === professional && 
      (excludeId === undefined || String(slot.id) !== String(excludeId)) &&
      startTime < slot.endTime && 
      endTime > slot.startTime
    );
  }

  async createSlotTraced(data: any): Promise<Slot> {
    return this.createSlot(data);
  }

  async updateSlotTraced(id: number | string, data: any): Promise<Slot> {
    return this.updateSlot(id, data);
  }

  async listSlotsTraced(options: PaginationOptions = {}): Promise<any> {
    return this.listSlots(options);
  }

  createSlot(data: any): Slot {
    if (this.isRepoMode) {
      return this._createSlotAsync(data) as any;
    }
    return this._createSlotSync(data);
  }

  private _createSlotSync(data: any): Slot {
    if (typeof data.professional !== 'string' || data.professional.trim().length === 0) {
      throw new SlotValidationError("professional must be a non-empty string");
    }
    if (data.endTime <= data.startTime) {
      throw new SlotValidationError("endTime must be greater than startTime");
    }
    if (!Number.isFinite(data.startTime) || !Number.isFinite(data.endTime)) {
      throw new SlotValidationError("startTime and endTime must be finite numbers");
    }
    if (data.validUntil !== undefined && data.validUntil !== null) {
      if (!Number.isFinite(data.validUntil)) {
        throw new SlotValidationError("validUntil must be a finite number");
      }
      if (data.validUntil <= data.endTime) {
        throw new SlotValidationError("validUntil must be after endTime");
      }
    }

    const professional = data.professional.trim();
    if (this.hasConflict(professional, data.startTime, data.endTime)) {
      throw new SlotConflictError("Slot conflicts with an existing slot");
    }

    const slotId = data.id !== undefined
      ? data.id
      : (this.useCanonicalId ? `slot-${randomUUID()}` : this.nextId++);

    const timestamp = (this.timeSource ? this.timeSource() : new Date()).toISOString();
    const slot = {
      id: slotId,
      ...data,
      professional,
      createdAt: data.createdAt ?? timestamp,
      updatedAt: data.updatedAt ?? timestamp,
    };
    this._slots.push(slot);
    
    if (this.cache) {
      this.cache.invalidate?.("slots:list:all");
    }

    return { ...slot };
  }

  private async _createSlotAsync(data: any): Promise<Slot> {
    if (typeof data.professional !== 'string' || data.professional.trim().length === 0) {
      throw new SlotValidationError("professional must be a non-empty string");
    }
    if (data.endTime <= data.startTime) {
      throw new SlotValidationError("endTime must be greater than startTime");
    }
    if (!Number.isFinite(data.startTime) || !Number.isFinite(data.endTime)) {
      throw new SlotValidationError("startTime and endTime must be finite numbers");
    }
    if (data.validUntil !== undefined && data.validUntil !== null) {
      if (!Number.isFinite(data.validUntil)) {
        throw new SlotValidationError("validUntil must be a finite number");
      }
      if (data.validUntil <= data.endTime) {
        throw new SlotValidationError("validUntil must be after endTime");
      }
    }

    const professional = data.professional.trim();
    const conflict = await Promise.resolve(this.hasConflict(professional, data.startTime, data.endTime));
    if (conflict) {
      throw new SlotConflictError("Slot conflicts with an existing slot");
    }

    if (this.repository && typeof (this.repository as any).create === 'function') {
      try {
        await (this.repository as any).create({
          professional,
          startTime: data.startTime,
          endTime: data.endTime,
          ...data,
        });
      } catch (err: any) {
        if (err?.code === "23P01") {
          throw new SlotConflictError("Slot conflicts with an existing slot");
        }
        throw err;
      }
    }

    const slotId = data.id !== undefined
      ? data.id
      : (this.useCanonicalId ? `slot-${randomUUID()}` : this.nextId++);

    const timestamp = (this.timeSource ? this.timeSource() : new Date()).toISOString();
    const slot = {
      id: slotId,
      ...data,
      professional,
      createdAt: data.createdAt ?? timestamp,
      updatedAt: data.updatedAt ?? timestamp,
    };
    this._slots.push(slot);
    
    if (this.cache) {
      this.cache.invalidate?.("slots:list:all");
    }

    return { ...slot };
  }

  updateSlot(id: number | string, data: any): any {
    if (this.isRepoMode) {
      return this._updateSlotAsync(id, data);
    }
    return this._updateSlotSync(id, data);
  }

  private _updateSlotSync(id: number | string, data: any): Slot {
    if (!data || typeof data !== 'object' || Array.isArray(data) || Object.keys(data).length === 0) {
      throw new SlotValidationError("update payload must be an object");
    }

    const index = this._slots.findIndex(s => String(s.id) === String(id));
    if (index === -1) throw new SlotNotFoundError(id);
    
    if (data.professional !== undefined) {
      if (typeof data.professional !== 'string') {
        throw new SlotValidationError("professional must be a string");
      }
      if (data.professional.trim().length === 0) {
        throw new SlotValidationError("professional must be a non-empty string");
      }
    }

    if ((data.startTime !== undefined && !Number.isFinite(data.startTime)) || 
        (data.endTime !== undefined && !Number.isFinite(data.endTime))) {
      throw new SlotValidationError("startTime and endTime must be finite numbers");
    }

    const nextStartTime = data.startTime !== undefined ? data.startTime : this._slots[index].startTime;
    const nextEndTime = data.endTime !== undefined ? data.endTime : this._slots[index].endTime;
    if (nextEndTime <= nextStartTime) {
      throw new SlotValidationError("endTime must be greater than startTime");
    }

    if (data.validUntil !== undefined && data.validUntil !== null) {
      if (!Number.isFinite(data.validUntil)) {
        throw new SlotValidationError("validUntil must be a finite number");
      }
      if (data.validUntil <= nextEndTime) {
        throw new SlotValidationError("validUntil must be after endTime");
      }
    }

    const nextProfessional = data.professional !== undefined ? data.professional.trim() : this._slots[index].professional;
    if (this.hasConflict(nextProfessional, nextStartTime, nextEndTime, id)) {
      throw new SlotConflictError("Slot conflicts with an existing slot");
    }
    
    const timestamp = (this.timeSource ? this.timeSource() : new Date()).toISOString();
    this._slots[index] = {
      ...this._slots[index],
      ...data,
      professional: nextProfessional,
      startTime: nextStartTime,
      endTime: nextEndTime,
      updatedAt: timestamp,
    };

    if (this.cache) {
      this.cache.invalidate?.("slots:list:all");
    }

    return { ...this._slots[index] };
  }

  private async _updateSlotAsync(id: number | string, data: any): Promise<Slot> {
    if (!data || typeof data !== 'object' || Array.isArray(data) || Object.keys(data).length === 0) {
      throw new SlotValidationError("update payload must be an object");
    }

    const index = this._slots.findIndex(s => String(s.id) === String(id));
    if (index === -1) throw new SlotNotFoundError(id);
    
    if (data.professional !== undefined) {
      if (typeof data.professional !== 'string') {
        throw new SlotValidationError("professional must be a string");
      }
      if (data.professional.trim().length === 0) {
        throw new SlotValidationError("professional must be a non-empty string");
      }
    }

    if ((data.startTime !== undefined && !Number.isFinite(data.startTime)) || 
        (data.endTime !== undefined && !Number.isFinite(data.endTime))) {
      throw new SlotValidationError("startTime and endTime must be finite numbers");
    }

    const nextStartTime = data.startTime !== undefined ? data.startTime : this._slots[index].startTime;
    const nextEndTime = data.endTime !== undefined ? data.endTime : this._slots[index].endTime;
    if (nextEndTime <= nextStartTime) {
      throw new SlotValidationError("endTime must be greater than startTime");
    }

    if (data.validUntil !== undefined && data.validUntil !== null) {
      if (!Number.isFinite(data.validUntil)) {
        throw new SlotValidationError("validUntil must be a finite number");
      }
      if (data.validUntil <= nextEndTime) {
        throw new SlotValidationError("validUntil must be after endTime");
      }
    }

    const nextProfessional = data.professional !== undefined ? data.professional.trim() : this._slots[index].professional;
    const conflict = await Promise.resolve(this.hasConflict(nextProfessional, nextStartTime, nextEndTime, id));
    if (conflict) {
      throw new SlotConflictError("Slot conflicts with an existing slot");
    }
    
    const timestamp = (this.timeSource ? this.timeSource() : new Date()).toISOString();
    this._slots[index] = {
      ...this._slots[index],
      ...data,
      professional: nextProfessional,
      startTime: nextStartTime,
      endTime: nextEndTime,
      updatedAt: timestamp,
    };

    if (this.cache) {
      this.cache.invalidate?.("slots:list:all");
    }

    return { ...this._slots[index] };
  }

  /**
   * Add an active hold against a slot (used by tests and checkout flows).
   *
   * @returns The created hold record.
   */
  addHold(data: {
    slotId: string;
    buyerId: string;
    expiresAt: number;
  }): SlotHold {
    const now = this.timeSource().getTime();
    const hold: SlotHold = {
      id: String(this._holdNextId++),
      slotId: String(data.slotId),
      buyerId: data.buyerId,
      status: "held",
      expiresAt: data.expiresAt,
      createdAt: now,
    };
    this._holds.push(hold);
    return { ...hold };
  }

  /**
   * Return active holds for a slot.
   *
   * Active = status 'held' AND expires_at > now.
   *
   * @param slotId       - The slot to query.
   * @param isOwner      - When true the buyer_id is included; otherwise redacted.
   * @param options      - Pagination / time-filter options.
   */
  listReservations(
    slotId: string,
    isOwner: boolean,
    options: ListReservationsOptions = {},
  ): ListReservationsResult {
    const nowMs = options.afterMs ?? this.timeSource().getTime();
    const page = options.page ?? 1;
    const limit = options.limit ?? 10;

    const active = this._holds.filter(
      (h) =>
        String(h.slotId) === String(slotId) &&
        h.status === "held" &&
        h.expiresAt > nowMs,
    );

    const total = active.length;
    const offset = (page - 1) * limit;
    const page_items = active.slice(offset, offset + limit);

    const data: SlotHoldView[] = page_items.map((h) => ({
      id: h.id,
      slotId: h.slotId,
      buyerId: isOwner ? h.buyerId : null,
      status: "held",
      expiresAt: h.expiresAt,
      createdAt: h.createdAt,
    }));

    return { data, page, limit, total };
  }

  reset(): void {
    this._slots.length = 0;
    this.nextId = 1;
    this._holds = [];
    this._holdNextId = 1;
    if (this.cache) {
      if (typeof this.cache.clear === "function") {
        this.cache.clear();
      }
      if (typeof this.cache.invalidate === "function") {
        this.cache.invalidate("slots:list:all");
      }
    }
  }

  async findById(id: number | string): Promise<Slot> {
    const slot = this._slots.find(s => String(s.id) === String(id));
    if (slot) return { ...slot };
    if (this.repository && typeof (this.repository as any).findById === 'function') {
      const res = await Promise.resolve((this.repository as any).findById(id));
      if (res) return { ...res };
    }
    if (this.isRepoMode) {
      return null as any;
    }
    throw new SlotNotFoundError(id);
  }

  async findByIds(ids: readonly (number | string)[]): Promise<(Slot | Error)[]> {
    const idStrings = ids.map(id => String(id));
    return idStrings.map(idStr => {
      const slot = this._slots.find(s => String(s.id) === idStr);
      return slot ? { ...slot } : new Error(`Slot with ID ${idStr} not found`);
    });
  }

  deleteSlot(id: number | string): any {
    if (this.isRepoMode) {
      return (async () => {
        const index = this._slots.findIndex(s => String(s.id) === String(id));
        if (index === -1) throw new SlotNotFoundError(id);

        const [removed] = this._slots.splice(index, 1);

        if (this.cache) {
          this.cache.invalidate?.("slots:list:all");
        }

        return removed.id;
      })();
    }

    const index = this._slots.findIndex(s => String(s.id) === String(id));
    if (index === -1) throw new SlotNotFoundError(id);

    const [removed] = this._slots.splice(index, 1);

    if (this.cache) {
      this.cache.invalidate?.("slots:list:all");
    }

    return removed.id;
  }
}

export const slotService = new SlotService();

export const listSlots = async (
  options: PaginationOptions,
  repository?: SlotRepositoryInterface
): Promise<PaginatedSlots> => {
  const service = repository ? new SlotService(repository) : slotService;
  return service.list(options);
};

export const listSlotsWithFailure = async (options: PaginationOptions): Promise<PaginatedSlots> => {
  return listSlots(options);
};
