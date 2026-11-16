import { RecipeVersion } from './types';

export const AUTOMOTIVE_RECIPE_RSB417: RecipeVersion = {
  id: 'recipe-rsb417-v3',
  jobId: 'RSB-417',
  revision: 'r3',
  name: 'Rear suspension bracket',
  sector: 'Automotive components',
  process: 'MIG (GMAW), short-circuit transfer',
  material: 'Mild steel',
  thickness: '2.5 mm',
  wire: '0.9 mm ER70S-6',
  gas: 'Ar/CO₂ 82/18',
  cycleSec: 48,
  durTolerance: 0.20, // minimum duration is 80% of nominal
  welds: [
    {
      id: 'W1',
      name: 'Left gusset',
      start: 9.0,
      dur: 3.2,
      minDur: 2.56,
      amps: 165,
      coordinates: { x1: 20, y1: 70, x2: 35, y2: 35 },
    },
    {
      id: 'W2',
      name: 'Right gusset',
      start: 15.0,
      dur: 3.2,
      minDur: 2.56,
      amps: 165,
      coordinates: { x1: 80, y1: 70, x2: 65, y2: 35 },
    },
    {
      id: 'W3',
      name: 'Tube collar',
      start: 22.0,
      dur: 4.4,
      minDur: 3.52,
      amps: 180,
      coordinates: { x1: 38, y1: 30, x2: 62, y2: 30 },
    },
    {
      id: 'W4',
      name: 'Tab fillet',
      start: 30.5,
      dur: 2.4,
      minDur: 1.92,
      amps: 150,
      coordinates: { x1: 45, y1: 75, x2: 55, y2: 75 },
    },
  ],
  boundaryMethod: 'manual',
  sequencePolicy: 'fixed_ordered',
  restartPolicy: 'exclude_spikes',
  detectorConfig: {
    ampsOn: 40,
    ampsOff: 20,
    minDwell: 0.3,
    sampleHz: 50,
    window: 6,
    watchK: 2,
    adviseK: 4,
    checkMinutes: 3,
  },
  baselineReference: 'baseline-rsb417-v3',
  inspectionReference: 'QA-WPS-417-Rev4 (Visual & Macro 1 in 100)',
  isDraft: false,
  isActive: true,
  activatedAt: '2026-11-17T08:00:00.000Z',
  activatedBy: 'Quality lead',
};

export const FABRICATION_RECIPE_FAB206: RecipeVersion = {
  id: 'recipe-fab206-r1',
  jobId: 'FAB-206',
  revision: 'r1',
  name: 'Equipment mounting frame',
  sector: 'General fabrication',
  process: 'MIG (GMAW), single-pass spray/globular',
  material: 'Mild structural steel S275',
  thickness: '4.0 mm',
  wire: '1.2 mm ER70S-6',
  gas: 'Ar/CO₂ 80/20',
  cycleSec: 60,
  durTolerance: 0.20, // 80% minimum
  welds: [
    {
      id: 'W1',
      name: 'Base left',
      start: 8.0,
      dur: 3.0,
      minDur: 2.4,
      amps: 170,
      coordinates: { x1: 15, y1: 85, x2: 35, y2: 85 },
    },
    {
      id: 'W2',
      name: 'Base right',
      start: 14.0,
      dur: 3.0,
      minDur: 2.4,
      amps: 170,
      coordinates: { x1: 65, y1: 85, x2: 85, y2: 85 },
    },
    {
      id: 'W3',
      name: 'Cross strut',
      start: 21.0,
      dur: 4.0,
      minDur: 3.2,
      amps: 185,
      coordinates: { x1: 20, y1: 50, x2: 80, y2: 50 },
    },
    {
      id: 'W4',
      name: 'Top diagonal',
      start: 30.0,
      dur: 3.0,
      minDur: 2.4,
      amps: 170,
      coordinates: { x1: 25, y1: 25, x2: 50, y2: 50 },
    },
    {
      id: 'W5',
      name: 'Guard tab',
      start: 36.0,
      dur: 3.0,
      minDur: 2.4,
      amps: 160,
      coordinates: { x1: 75, y1: 25, x2: 50, y2: 50 },
    },
    {
      id: 'W6',
      name: 'Corner brace',
      start: 43.0,
      dur: 4.0,
      minDur: 3.2,
      amps: 185,
      coordinates: { x1: 40, y1: 20, x2: 60, y2: 20 },
    },
  ],
  boundaryMethod: 'manual',
  sequencePolicy: 'fixed_ordered',
  restartPolicy: 'exclude_spikes',
  detectorConfig: {
    ampsOn: 45,
    ampsOff: 25,
    minDwell: 0.35,
    sampleHz: 50,
    window: 6,
    watchK: 2,
    adviseK: 4,
    checkMinutes: 3,
  },
  baselineReference: 'baseline-fab206-r1',
  inspectionReference: 'GF-FAB-WPS-206 (Visual 100%, 1 per shift dye penetrant)',
  isDraft: false,
  isActive: false,
  activatedAt: '2026-11-17T08:00:00.000Z',
  activatedBy: 'Quality lead',
};

export const INITIAL_RECIPES: RecipeVersion[] = [
  AUTOMOTIVE_RECIPE_RSB417,
  FABRICATION_RECIPE_FAB206,
];

export function validateRecipe(recipe: Partial<RecipeVersion>): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!recipe.jobId?.trim()) errors.push('Job ID is required');
  if (!recipe.name?.trim()) errors.push('Workpiece name is required');
  if (!recipe.cycleSec || recipe.cycleSec <= 0) errors.push('Cycle time must be positive');
  if (!recipe.welds || recipe.welds.length === 0) {
    errors.push('At least one weld slot is required');
  } else {
    const ids = new Set<string>();
    recipe.welds.forEach((w, idx) => {
      if (!w.id?.trim()) errors.push(`Weld #${idx + 1} requires an ID`);
      if (ids.has(w.id)) errors.push(`Duplicate weld ID: ${w.id}`);
      ids.add(w.id);
      if (w.dur <= 0) errors.push(`Weld ${w.id} nominal duration must be positive`);
      if (w.minDur > w.dur) errors.push(`Weld ${w.id} minimum duration cannot exceed nominal duration`);
    });
  }
  return { valid: errors.length === 0, errors };
}
