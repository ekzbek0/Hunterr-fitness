import type { AvciDocument, DocumentStorage, StoredDocument } from './document-repository';

const STORE = 'documents';
const KEY = 'main';

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export function indexedDbStorage(factory: IDBFactory, name: string): DocumentStorage {
  let dbPromise: Promise<IDBDatabase> | null = null;
  const open = () => {
    dbPromise ??= new Promise<IDBDatabase>((resolve, reject) => {
      const req = factory.open(name, 1);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
      req.onblocked = () => reject(new Error('IndexedDB başka bir sekme tarafından kilitlendi.'));
    });
    return dbPromise;
  };

  return {
    async load() {
      const db = await open();
      const tx = db.transaction(STORE, 'readonly');
      const value = await request(tx.objectStore(STORE).get(KEY));
      return (value as StoredDocument | undefined) ?? null;
    },
    async commit(expectedRev: number, doc: AvciDocument) {
      const db = await open();
      return new Promise<boolean>((resolve, reject) => {
        const tx = db.transaction(STORE, 'readwrite');
        const store = tx.objectStore(STORE);
        let ok = false;
        const getReq = store.get(KEY);
        getReq.onsuccess = () => {
          const current = getReq.result as StoredDocument | undefined;
          if ((current?.rev ?? 0) !== expectedRev) {
            tx.abort();
            return;
          }
          ok = true;
          store.put({ rev: expectedRev + 1, doc } satisfies StoredDocument, KEY);
        };
        tx.oncomplete = () => resolve(ok);
        tx.onabort = () => (ok ? reject(tx.error ?? new Error('IndexedDB yazımı iptal edildi.')) : resolve(false));
        tx.onerror = () => undefined; // handled by onabort
      });
    },
    async close() {
      if (dbPromise) (await dbPromise).close();
      dbPromise = null;
    },
  };
}
