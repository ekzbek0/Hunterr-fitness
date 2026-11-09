import { createDocumentRepository } from './document/document-repository';
import { indexedDbStorage } from './document/indexeddb-storage';
import type { AvciRepository } from './types';

export async function openRepository(): Promise<AvciRepository> {
  if (typeof indexedDB === 'undefined') {
    // Never fall back silently to non-persistent memory.
    throw new Error('Bu tarayıcıda kalıcı depolama (IndexedDB) kullanılamıyor.');
  }
  // Best effort: ask the browser not to evict data under storage pressure.
  try {
    await navigator.storage?.persist?.();
  } catch {
    // Not fatal: data still persists unless the browser evicts it.
  }
  return createDocumentRepository(indexedDbStorage(indexedDB, 'avci'), 'IndexedDB (tarayıcıda)');
}
