/**
 * Web persistence: the whole local database is one versioned JSON document
 * committed atomically with optimistic concurrency (revision check). A
 * transaction works on a private copy; on success the copy is written in a
 * single storage commit, so partial writes are impossible. Another tab that
 * committed meanwhile forces a retry against fresh data.
 */
import type {
  AvciRepository,
  DailyCheckin,
  LedgerEntry,
  Profile,
  QuestSlot,
  StoreTx,
  TaskDay,
} from '../types';

export const DOCUMENT_SCHEMA_VERSION = 1;

export interface AvciDocument {
  schemaVersion: number;
  profile: Profile | null;
  taskDays: TaskDay[];
  slots: QuestSlot[];
  checkins: DailyCheckin[];
  ledger: LedgerEntry[];
}

export interface StoredDocument {
  rev: number;
  doc: AvciDocument;
}

export interface DocumentStorage {
  load(): Promise<StoredDocument | null>;
  /** Writes `doc` as revision expectedRev+1 only if the stored revision is still expectedRev. */
  commit(expectedRev: number, doc: AvciDocument): Promise<boolean>;
  close(): Promise<void>;
}

export function emptyDocument(): AvciDocument {
  return { schemaVersion: DOCUMENT_SCHEMA_VERSION, profile: null, taskDays: [], slots: [], checkins: [], ledger: [] };
}

function migrateDocument(doc: AvciDocument): AvciDocument {
  if (doc.schemaVersion > DOCUMENT_SCHEMA_VERSION) {
    throw new Error(`Kayıtlı veri bu uygulama sürümünden yeni (şema ${doc.schemaVersion}).`);
  }
  // Future migrations go here, one version step at a time.
  return doc;
}

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
const ledgerKey = (e: Pick<LedgerEntry, 'profileId' | 'scopeKind' | 'scopeId' | 'slotKey'>) =>
  `${e.profileId}|${e.scopeKind}|${e.scopeId}|${e.slotKey}`;

function docTx(doc: AvciDocument): StoreTx {
  const byDayDesc = () => [...doc.taskDays].sort((a, b) => b.sequence - a.sequence);
  return {
    getProfile: async () => (doc.profile ? clone(doc.profile) : null),
    putProfile: async (p) => {
      doc.profile = clone(p);
    },
    getLatestTaskDay: async () => {
      const d = byDayDesc()[0];
      return d ? clone(d) : null;
    },
    getTaskDay: async (id) => {
      const d = doc.taskDays.find((x) => x.id === id);
      return d ? clone(d) : null;
    },
    insertTaskDay: async (t) => {
      if (doc.taskDays.some((x) => x.id === t.id || x.sequence === t.sequence || x.localDate === t.localDate)) {
        throw new Error('UNIQUE constraint failed: task_day');
      }
      doc.taskDays.push(clone(t));
    },
    updateTaskDay: async (t) => {
      const d = doc.taskDays.find((x) => x.id === t.id);
      if (d) {
        d.closedAt = t.closedAt;
        d.lastSeenAt = t.lastSeenAt;
      }
    },
    listTaskDays: async (limit) => clone(byDayDesc().slice(0, limit)),
    listSlots: async (dayId) => clone(doc.slots.filter((s) => s.taskDayId === dayId)),
    getSlot: async (dayId, key) => {
      const s = doc.slots.find((x) => x.taskDayId === dayId && x.slotKey === key);
      return s ? clone(s) : null;
    },
    insertSlot: async (s) => {
      if (doc.slots.some((x) => x.taskDayId === s.taskDayId && x.slotKey === s.slotKey)) {
        throw new Error('UNIQUE constraint failed: quest_slot');
      }
      doc.slots.push(clone(s));
    },
    updateSlot: async (s) => {
      const i = doc.slots.findIndex((x) => x.taskDayId === s.taskDayId && x.slotKey === s.slotKey);
      if (i >= 0) doc.slots[i] = clone(s);
    },
    getCheckin: async (dayId) => {
      const c = doc.checkins.find((x) => x.taskDayId === dayId);
      return c ? clone(c) : null;
    },
    putCheckin: async (c) => {
      doc.checkins = doc.checkins.filter((x) => x.taskDayId !== c.taskDayId).concat(clone(c));
    },
    insertLedger: async (e) => {
      const key = ledgerKey(e);
      if (doc.ledger.some((x) => ledgerKey(x) === key || x.id === e.id)) return 'conflict';
      doc.ledger.push(clone(e));
      return 'inserted';
    },
    findLedger: async (profileId, scopeKind, scopeId, slotKey) => {
      const key = ledgerKey({ profileId, scopeKind, scopeId, slotKey });
      const e = doc.ledger.find((x) => ledgerKey(x) === key);
      return e ? clone(e) : null;
    },
    listLedger: async (limit) =>
      clone(
        doc.ledger
          .map((e, i) => ({ e, i }))
          .sort((a, b) => b.e.completedAt.localeCompare(a.e.completedAt) || b.i - a.i)
          .slice(0, limit)
          .map((x) => x.e),
      ),
    totalXp: async (profileId) =>
      doc.ledger.filter((e) => e.profileId === profileId).reduce((sum, e) => sum + e.awardedXp, 0),
  };
}

export async function createDocumentRepository(storage: DocumentStorage, kind: string): Promise<AvciRepository> {
  // Validate early so an unsupported future document fails before any use.
  const initial = await storage.load();
  if (initial) migrateDocument(initial.doc);

  let queue: Promise<unknown> = Promise.resolve();
  const run = async <T>(fn: (tx: StoreTx) => Promise<T>): Promise<T> => {
    for (let attempt = 0; attempt < 5; attempt++) {
      const stored = await storage.load();
      const rev = stored?.rev ?? 0;
      const working = migrateDocument(stored ? clone(stored.doc) : emptyDocument());
      const result = await fn(docTx(working));
      if (await storage.commit(rev, working)) return result;
    }
    throw new Error('Veri başka bir sekmede değişiyor; lütfen tekrar deneyin.');
  };
  return {
    kind,
    transaction<T>(fn: (tx: StoreTx) => Promise<T>): Promise<T> {
      // Serialize within this tab; the revision check covers other tabs.
      const next = queue.then(() => run(fn));
      queue = next.catch(() => undefined);
      return next;
    },
    close: () => storage.close(),
  };
}
