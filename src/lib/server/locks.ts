import { EventEmitter } from 'events';

/**
 * Temporary seat locks with expiry.
 *  - MemoryLockStore: single-process (default, zero setup)
 *  - RedisLockStore: multi-instance; all-or-nothing hold via a Lua script (set REDIS_URL)
 *
 * `hold()` sets the holder's locks for a show to EXACTLY `seatIds` (adding new ones, releasing
 * ones no longer selected). It fails atomically if any requested seat is held by someone else.
 */
export interface HoldResult { ok: boolean; conflicts: string[]; expiresAt: number }
export interface LockEntry { holderId: string; expiresAt: number }

export interface LockStore {
  hold(showId: string, holderId: string, seatIds: string[], ttlMs: number, blocked: Set<string>): Promise<HoldResult>;
  extend(showId: string, holderId: string, ttlMs: number): Promise<number>;
  release(showId: string, holderId: string): Promise<void>;
  all(showId: string): Promise<Map<string, LockEntry>>;
}

class MemoryLockStore implements LockStore {
  private shows = new Map<string, Map<string, LockEntry>>();

  private table(showId: string) {
    let t = this.shows.get(showId);
    if (!t) { t = new Map(); this.shows.set(showId, t); }
    const now = Date.now();
    for (const [k, v] of t) if (v.expiresAt <= now) t.delete(k);
    return t;
  }

  async hold(showId: string, holderId: string, seatIds: string[], ttlMs: number, blocked: Set<string>) {
    const t = this.table(showId);
    const conflicts = seatIds.filter((s) => blocked.has(s) || (t.has(s) && t.get(s)!.holderId !== holderId));
    if (conflicts.length) return { ok: false, conflicts, expiresAt: 0 };
    const expiresAt = Date.now() + ttlMs;
    for (const [k, v] of t) if (v.holderId === holderId && !seatIds.includes(k)) t.delete(k);
    for (const s of seatIds) t.set(s, { holderId, expiresAt });
    return { ok: true, conflicts: [], expiresAt };
  }

  async extend(showId: string, holderId: string, ttlMs: number) {
    const t = this.table(showId);
    const expiresAt = Date.now() + ttlMs;
    let any = false;
    for (const v of t.values()) if (v.holderId === holderId) { v.expiresAt = expiresAt; any = true; }
    return any ? expiresAt : 0;
  }

  async release(showId: string, holderId: string) {
    const t = this.table(showId);
    for (const [k, v] of t) if (v.holderId === holderId) t.delete(k);
  }

  async all(showId: string) {
    return new Map(this.table(showId));
  }
}

// KEYS[1] = hash "locks:{showId}"; ARGV = holder, now, expiresAt, n, seat1..seatN, blocked1..
const HOLD_LUA = `
local key, holder, now, exp, n = KEYS[1], ARGV[1], tonumber(ARGV[2]), ARGV[3], tonumber(ARGV[4])
local want, conflicts = {}, {}
for i = 1, n do want[ARGV[4 + i]] = true end
local blocked = {}
for i = 5 + n, #ARGV do blocked[ARGV[i]] = true end
for seat, _ in pairs(want) do
  if blocked[seat] then table.insert(conflicts, seat) else
    local v = redis.call('HGET', key, seat)
    if v then
      local h, e = string.match(v, '^(.*)|(%d+)$')
      if tonumber(e) > now and h ~= holder then table.insert(conflicts, seat) end
    end
  end
end
if #conflicts > 0 then return conflicts end
local all = redis.call('HGETALL', key)
for i = 1, #all, 2 do
  local h, e = string.match(all[i + 1], '^(.*)|(%d+)$')
  if tonumber(e) <= now or (h == holder and not want[all[i]]) then redis.call('HDEL', key, all[i]) end
end
for seat, _ in pairs(want) do redis.call('HSET', key, seat, holder .. '|' .. exp) end
redis.call('PEXPIRE', key, 86400000)
return {}
`;

class RedisLockStore implements LockStore {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(private redis: any) {}
  private key = (s: string) => `cv:locks:${s}`;

  async hold(showId: string, holderId: string, seatIds: string[], ttlMs: number, blocked: Set<string>) {
    const now = Date.now();
    const expiresAt = now + ttlMs;
    const conflicts: string[] = await this.redis.eval(HOLD_LUA, 1, this.key(showId), holderId, now, expiresAt, seatIds.length, ...seatIds, ...[...blocked].filter((b) => seatIds.includes(b)));
    return conflicts.length ? { ok: false, conflicts, expiresAt: 0 } : { ok: true, conflicts: [], expiresAt };
  }
  async extend(showId: string, holderId: string, ttlMs: number) {
    const m = await this.all(showId);
    const exp = Date.now() + ttlMs;
    const mine = [...m].filter(([, v]) => v.holderId === holderId).map(([k]) => k);
    if (!mine.length) return 0;
    const r = await this.hold(showId, holderId, mine, ttlMs, new Set());
    return r.ok ? exp : 0;
  }
  async release(showId: string, holderId: string) {
    await this.hold(showId, holderId, [], 1, new Set());
  }
  async all(showId: string) {
    const raw: Record<string, string> = await this.redis.hgetall(this.key(showId));
    const now = Date.now();
    const m = new Map<string, LockEntry>();
    for (const [seat, v] of Object.entries(raw)) {
      const i = v.lastIndexOf('|');
      const e = Number(v.slice(i + 1));
      if (e > now) m.set(seat, { holderId: v.slice(0, i), expiresAt: e });
    }
    return m;
  }
}

type G = typeof globalThis & { __cv_locks?: LockStore; __cv_bus?: EventEmitter };
const g = globalThis as G;

export function locks(): LockStore {
  if (!g.__cv_locks) {
    if (process.env.REDIS_URL) {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const Redis = require('ioredis');
      g.__cv_locks = new RedisLockStore(new Redis(process.env.REDIS_URL));
    } else {
      g.__cv_locks = new MemoryLockStore();
    }
  }
  return g.__cv_locks;
}

/** In-process pub/sub for live seat updates. Multi-instance: swap for Redis pub/sub. */
export function bus(): EventEmitter {
  if (!g.__cv_bus) { g.__cv_bus = new EventEmitter(); g.__cv_bus.setMaxListeners(10_000); }
  return g.__cv_bus;
}

export const HOLD_MS = Number(process.env.SEAT_HOLD_SECONDS || 420) * 1000;
export const PAYMENT_HOLD_MS = Math.max(HOLD_MS, 10 * 60_000);
