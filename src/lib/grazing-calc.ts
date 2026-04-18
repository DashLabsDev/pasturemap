/**
 * Grazing rotation calculator
 *
 * AU  = headCount × avgWeightLbs / 1000
 * DMI = AU × 26 lbs/day  (daily dry-matter intake for the herd)
 * Max days = (acreage × forageLbsPerAcrePerDay) / DMI
 *
 * Default forage yield:
 *   Growing season (Apr–Oct): 150 lbs/acre/day
 *   Dormant season (Nov–Mar): 50 lbs/acre/day
 */

export interface RotationInput {
  headCount: number;
  avgWeightLbs: number;
  acreage: number;
  foragePerAcrePerDay?: number; // override; otherwise uses season default
}

export interface RotationResult {
  animalUnits: number;
  dailyDMI: number;          // lbs/day total herd
  maxDays: number;
  foragePerAcrePerDay: number;
}

const DMI_LBS_PER_AU = 26;

export function isGrowingSeason(date: Date = new Date()): boolean {
  const month = date.getMonth(); // 0-indexed
  return month >= 3 && month <= 9; // Apr (3) through Oct (9)
}

export function defaultForageRate(date?: Date): number {
  return isGrowingSeason(date) ? 150 : 50;
}

export function calculateRotation(input: RotationInput): RotationResult {
  const { headCount, avgWeightLbs, acreage, foragePerAcrePerDay } = input;

  const forage = foragePerAcrePerDay ?? defaultForageRate();
  const animalUnits = (headCount * avgWeightLbs) / 1000;
  const dailyDMI = animalUnits * DMI_LBS_PER_AU;
  const maxDays = dailyDMI > 0 ? (acreage * forage) / dailyDMI : 0;

  return {
    animalUnits: Math.round(animalUnits * 100) / 100,
    dailyDMI: Math.round(dailyDMI * 100) / 100,
    maxDays: Math.round(maxDays * 10) / 10,
    foragePerAcrePerDay: forage,
  };
}

export function daysBetween(start: string, end: string): number {
  const a = new Date(start);
  const b = new Date(end);
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

export function daysSince(start: string): number {
  return daysBetween(start, new Date().toISOString().slice(0, 10));
}
