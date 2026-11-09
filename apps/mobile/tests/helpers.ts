/// <reference types="node" />
/** Shared test fixtures: a controllable clock and both real persistence backends. */
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { IDBFactory } from 'fake-indexeddb';

import { createDocumentRepository } from '@/data/document/document-repository';
import { indexedDbStorage } from '@/data/document/indexeddb-storage';
import { createSqliteRepository } from '@/data/sqlite/sqlite-repository';
import type { AvciRepository } from '@/data/types';
import type { CheckinInput } from '@/domain/training/readiness';
import type { Clock } from '@/services/avci-service';

import { nodeSqliteDriver } from './node-sqlite-driver';

export class FakeClock implements Clock {
  constructor(
    public instant: Date,
    public tz = 'Europe/Istanbul',
  ) {}
  now() {
    return new Date(this.instant);
  }
  timeZone() {
    return this.tz;
  }
  set(iso: string) {
    this.instant = new Date(iso);
  }
}

export interface Backend {
  name: string;
  setup(): void;
  open(): Promise<AvciRepository>;
  teardown(): void;
}

export const backends: Backend[] = [
  (() => {
    let dir = '';
    return {
      name: 'SQLite',
      setup: () => void (dir = mkdtempSync(join(tmpdir(), 'avci-'))),
      open: () => createSqliteRepository(nodeSqliteDriver(join(dir, 'avci.db')), 'test-sqlite'),
      teardown: () => rmSync(dir, { recursive: true, force: true }),
    };
  })(),
  (() => {
    let factory = new IDBFactory();
    return {
      name: 'IndexedDB',
      setup: () => void (factory = new IDBFactory()),
      open: () => createDocumentRepository(indexedDbStorage(factory, 'avci'), 'test-idb'),
      teardown: () => undefined,
    };
  })(),
];

export const goodCheckin: CheckinInput = { sleepHours: 7.5, energy: 4, fatigue: 2, soreness: 1, jointPain: 'no', illness: 'no' };
export const illCheckin: CheckinInput = { ...goodCheckin, illness: 'yes' };
