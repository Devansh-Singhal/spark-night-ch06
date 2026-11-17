import { openDB, DBSchema, IDBPDatabase } from 'idb';
import {
  Action,
  BaselineVersion,
  DispositionRecord,
  Finding,
  InspectionRecord,
  PartAttempt,
  RecipeVersion,
  StationConfig,
} from '../domain/types';
import { INITIAL_RECIPES } from '../domain/recipes';
import { INITIAL_BASELINES } from '../domain/baseline';

export const INITIAL_STATION: StationConfig = {
  id: 'station-02',
  name: 'Station 02',
  workshopName: 'North Bay Assembly',
  sector: 'Automotive components & General fabrication',
  timezone: 'UTC+05:30',
  activeRecipeId: 'recipe-rsb417-v3',
  activeRecipeVersion: 'r3',
  inputMode: 'synthetic',
  createdAt: '2026-11-17T08:00:00.000Z',
  updatedAt: '2026-11-17T08:00:00.000Z',
};

interface NabzDB extends DBSchema {
  stations: {
    key: string;
    value: StationConfig;
  };
  recipes: {
    key: string;
    value: RecipeVersion;
    indexes: { 'by-job': string };
  };
  baselines: {
    key: string;
    value: BaselineVersion;
    indexes: { 'by-recipe': string };
  };
  parts: {
    key: string;
    value: PartAttempt;
    indexes: {
      'by-display': string;
      'by-station': string;
      'by-start': string;
      'by-rule': string;
      'by-disposition': string;
      'by-session': string;
    };
  };
  findings: {
    key: string;
    value: Finding;
    indexes: {
      'by-part': string;
      'by-station': string;
      'by-status': string;
      'by-kind': string;
    };
  };
  actions: {
    key: string;
    value: Action;
    indexes: {
      'by-part': string;
      'by-finding': string;
      'by-time': string;
    };
  };
  inspections: {
    key: string;
    value: InspectionRecord;
    indexes: { 'by-part': string };
  };
  dispositions: {
    key: string;
    value: DispositionRecord;
    indexes: { 'by-part': string };
  };
}

const DB_NAME = 'nabz-pwa-db';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<NabzDB>> | null = null;

export function getDb(): Promise<IDBPDatabase<NabzDB>> {
  if (!dbPromise) {
    dbPromise = openDB<NabzDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('stations')) {
          db.createObjectStore('stations', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('recipes')) {
          const s = db.createObjectStore('recipes', { keyPath: 'id' });
          s.createIndex('by-job', 'jobId');
        }
        if (!db.objectStoreNames.contains('baselines')) {
          const s = db.createObjectStore('baselines', { keyPath: 'id' });
          s.createIndex('by-recipe', 'recipeId');
        }
        if (!db.objectStoreNames.contains('parts')) {
          const s = db.createObjectStore('parts', { keyPath: 'id' });
          s.createIndex('by-display', 'displayId');
          s.createIndex('by-station', 'stationId');
          s.createIndex('by-start', 'startedAt');
          s.createIndex('by-rule', 'ruleFinding');
          s.createIndex('by-disposition', 'dispositionStatus');
          s.createIndex('by-session', 'sessionId');
        }
        if (!db.objectStoreNames.contains('findings')) {
          const s = db.createObjectStore('findings', { keyPath: 'id' });
          s.createIndex('by-part', 'partAttemptId');
          s.createIndex('by-station', 'stationId');
          s.createIndex('by-status', 'status');
          s.createIndex('by-kind', 'kind');
        }
        if (!db.objectStoreNames.contains('actions')) {
          const s = db.createObjectStore('actions', { keyPath: 'id' });
          s.createIndex('by-part', 'partAttemptId');
          s.createIndex('by-finding', 'findingId');
          s.createIndex('by-time', 'timestamp');
        }
        if (!db.objectStoreNames.contains('inspections')) {
          const s = db.createObjectStore('inspections', { keyPath: 'id' });
          s.createIndex('by-part', 'partAttemptId');
        }
        if (!db.objectStoreNames.contains('dispositions')) {
          const s = db.createObjectStore('dispositions', { keyPath: 'id' });
          s.createIndex('by-part', 'partAttemptId');
        }
      },
    });
  }
  return dbPromise;
}

/**
 * Seed initial records if empty
 */
export async function initDb(): Promise<void> {
  const db = await getDb();
  const tx = db.transaction(['stations', 'recipes', 'baselines'], 'readwrite');

  const existingStation = await tx.objectStore('stations').get(INITIAL_STATION.id);
  if (!existingStation) {
    await tx.objectStore('stations').put(INITIAL_STATION);
  }

  for (const recipe of INITIAL_RECIPES) {
    const existing = await tx.objectStore('recipes').get(recipe.id);
    if (!existing) {
      await tx.objectStore('recipes').put(recipe);
    }
  }

  for (const base of INITIAL_BASELINES) {
    const existing = await tx.objectStore('baselines').get(base.id);
    if (!existing) {
      await tx.objectStore('baselines').put(base);
    }
  }

  await tx.done;
}

/**
 * Save part attempt and associated findings atomically
 */
export async function savePartFinalResult(
  part: PartAttempt,
  findings: Finding[] = [],
  action?: Action
): Promise<void> {
  const db = await getDb();
  const tx = db.transaction(['parts', 'findings', 'actions'], 'readwrite');

  await tx.objectStore('parts').put(part);

  for (const finding of findings) {
    await tx.objectStore('findings').put(finding);
  }

  if (action) {
    await tx.objectStore('actions').put(action);
  }

  await tx.done;
}

export async function getStation(stationId = 'station-02'): Promise<StationConfig> {
  const db = await getDb();
  const st = await db.get('stations', stationId);
  return st || INITIAL_STATION;
}

export async function updateStation(st: StationConfig): Promise<void> {
  const db = await getDb();
  await db.put('stations', { ...st, updatedAt: new Date().toISOString() });
}

export async function getAllRecipes(): Promise<RecipeVersion[]> {
  const db = await getDb();
  return db.getAll('recipes');
}

export async function getRecipeById(id: string): Promise<RecipeVersion | undefined> {
  const db = await getDb();
  return db.get('recipes', id);
}

export async function saveRecipe(recipe: RecipeVersion): Promise<void> {
  const db = await getDb();
  await db.put('recipes', recipe);
}

export async function getAllBaselines(): Promise<BaselineVersion[]> {
  const db = await getDb();
  return db.getAll('baselines');
}

export async function getBaselineById(id: string): Promise<BaselineVersion | undefined> {
  const db = await getDb();
  return db.get('baselines', id);
}

export async function getAllParts(): Promise<PartAttempt[]> {
  const db = await getDb();
  const parts = await db.getAll('parts');
  // Sort descending by startedAt
  return parts.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
}

export async function getPartById(id: string): Promise<
  | {
      part: PartAttempt;
      findings: Finding[];
      actions: Action[];
      inspection?: InspectionRecord;
      disposition?: DispositionRecord;
    }
  | undefined
> {
  const db = await getDb();
  const part = await db.get('parts', id);
  if (!part) return undefined;

  const findings = await db.getAllFromIndex('findings', 'by-part', id);
  const actions = await db.getAllFromIndex('actions', 'by-part', id);
  const inspections = await db.getAllFromIndex('inspections', 'by-part', id);
  const dispositions = await db.getAllFromIndex('dispositions', 'by-part', id);

  actions.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  return {
    part,
    findings,
    actions,
    inspection: inspections[0],
    disposition: dispositions[0],
  };
}

export async function getUnresolvedFindings(): Promise<Finding[]> {
  const db = await getDb();
  const all = await db.getAll('findings');
  return all.filter((f) => f.status === 'unresolved' || f.status === 'acknowledged');
}

export async function recordAction(action: Action): Promise<void> {
  const db = await getDb();
  const tx = db.transaction(['actions', 'findings'], 'readwrite');
  await tx.objectStore('actions').put(action);

  if (action.findingId) {
    const finding = await tx.objectStore('findings').get(action.findingId);
    if (finding) {
      if (action.actionType === 'acknowledge') {
        finding.status = 'acknowledged';
        finding.acknowledgedAt = action.timestamp;
        finding.acknowledgedBy = action.actor;
      } else if (action.actionType === 'complete_setup_check' || action.actionType === 'record_disposition') {
        finding.status = 'resolved';
        finding.resolvedAt = action.timestamp;
      }
      await tx.objectStore('findings').put(finding);
    }
  }

  await tx.done;
}

export async function recordInspection(inspection: InspectionRecord): Promise<void> {
  const db = await getDb();
  const tx = db.transaction(['inspections', 'parts', 'actions'], 'readwrite');

  await tx.objectStore('inspections').put(inspection);

  const part = await tx.objectStore('parts').get(inspection.partAttemptId);
  if (part) {
    part.inspectionStatus = inspection.result;
    await tx.objectStore('parts').put(part);
  }

  const action: Action = {
    id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    partAttemptId: inspection.partAttemptId,
    actionType: 'record_inspection',
    actor: inspection.actor,
    actorRole: 'supervisor',
    timestamp: inspection.createdAt,
    details: {
      method: inspection.method,
      result: inspection.result,
      defectType: inspection.defectType,
      notes: inspection.notes,
    },
  };
  await tx.objectStore('actions').put(action);

  await tx.done;
}

export async function recordDisposition(disposition: DispositionRecord): Promise<void> {
  const db = await getDb();
  const tx = db.transaction(['dispositions', 'parts', 'findings', 'actions'], 'readwrite');

  await tx.objectStore('dispositions').put(disposition);

  const part = await tx.objectStore('parts').get(disposition.partAttemptId);
  if (part) {
    part.dispositionStatus = disposition.decision;
    await tx.objectStore('parts').put(part);
  }

  // Close unresolved findings for this part
  const findings = await tx.objectStore('findings').index('by-part').getAll(disposition.partAttemptId);
  for (const f of findings) {
    if (f.status !== 'resolved') {
      f.status = 'resolved';
      f.resolvedAt = disposition.createdAt;
      await tx.objectStore('findings').put(f);
    }
  }

  const action: Action = {
    id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    partAttemptId: disposition.partAttemptId,
    actionType: 'record_disposition',
    actor: disposition.actor,
    actorRole: 'supervisor',
    timestamp: disposition.createdAt,
    details: {
      decision: disposition.decision,
      reason: disposition.reason,
      inspectionRef: disposition.inspectionRef,
    },
  };
  await tx.objectStore('actions').put(action);

  await tx.done;
}

/**
 * Scoped demo reset: deletes only records created under the demo session.
 * Preserves stations, recipes, baselines, and non-demo records.
 */
export async function resetDemoSession(sessionId: string): Promise<{ deletedParts: number }> {
  const db = await getDb();
  const tx = db.transaction(['parts', 'findings', 'actions', 'inspections', 'dispositions'], 'readwrite');

  const parts = await tx.objectStore('parts').index('by-session').getAll(sessionId);
  let deletedCount = 0;

  for (const p of parts) {
    await tx.objectStore('parts').delete(p.id);
    deletedCount++;

    const findings = await tx.objectStore('findings').index('by-part').getAll(p.id);
    for (const f of findings) await tx.objectStore('findings').delete(f.id);

    const actions = await tx.objectStore('actions').index('by-part').getAll(p.id);
    for (const a of actions) await tx.objectStore('actions').delete(a.id);

    const inspections = await tx.objectStore('inspections').index('by-part').getAll(p.id);
    for (const i of inspections) await tx.objectStore('inspections').delete(i.id);

    const dispositions = await tx.objectStore('dispositions').index('by-part').getAll(p.id);
    for (const d of dispositions) await tx.objectStore('dispositions').delete(d.id);
  }

  await tx.done;
  return { deletedParts: deletedCount };
}

/**
 * Full JSON backup export
 */
export async function exportJsonBackup(): Promise<string> {
  const db = await getDb();
  const backup = {
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    stations: await db.getAll('stations'),
    recipes: await db.getAll('recipes'),
    baselines: await db.getAll('baselines'),
    parts: await db.getAll('parts'),
    findings: await db.getAll('findings'),
    actions: await db.getAll('actions'),
    inspections: await db.getAll('inspections'),
    dispositions: await db.getAll('dispositions'),
  };
  return JSON.stringify(backup, null, 2);
}

/**
 * Full JSON backup restore with schema validation
 */
export async function importJsonBackup(jsonStr: string): Promise<{ success: boolean; message: string }> {
  try {
    const data = JSON.parse(jsonStr);
    if (!data.schemaVersion || !Array.isArray(data.parts) || !Array.isArray(data.recipes)) {
      return { success: false, message: 'Invalid backup format: missing schemaVersion or core entities.' };
    }

    const db = await getDb();
    const tx = db.transaction(
      ['stations', 'recipes', 'baselines', 'parts', 'findings', 'actions', 'inspections', 'dispositions'],
      'readwrite'
    );

    for (const r of data.recipes) await tx.objectStore('recipes').put(r);
    for (const b of data.baselines) await tx.objectStore('baselines').put(b);
    for (const s of data.stations) await tx.objectStore('stations').put(s);
    for (const p of data.parts) await tx.objectStore('parts').put(p);
    for (const f of data.findings) await tx.objectStore('findings').put(f);
    for (const a of data.actions) await tx.objectStore('actions').put(a);
    for (const i of data.inspections) await tx.objectStore('inspections').put(i);
    for (const d of data.dispositions) await tx.objectStore('dispositions').put(d);

    await tx.done;
    return { success: true, message: `Backup restored successfully: ${data.parts.length} parts imported.` };
  } catch (err: any) {
    return { success: false, message: `Failed to restore backup: ${err.message}` };
  }
}
