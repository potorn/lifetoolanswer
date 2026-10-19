import { calculatePace, timeFromParts, paceFromParts } from './pace.js';

export function clock(seconds) {
  if (seconds > 0 && seconds < 0.5) return '1초 미만';
  const s = Math.round(seconds); return Math.floor(s / 3600) + ':' + String(Math.floor(s / 60) % 60).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
}
export function resolveRun({ mode, unit, distance, hours, minutes, seconds, paceMinutes, paceSeconds }) {
  const result = calculatePace({ mode, unit, distance,
    timeSeconds: mode === 'time' ? undefined : timeFromParts(hours, minutes, seconds),
    paceSeconds: mode === 'pace' ? undefined : paceFromParts(paceMinutes, paceSeconds)
  });
  return { distance: result.distanceKm, seconds: result.timeSeconds, pace: result.paceSeconds };
}
export function splitRows(distance, pace) {
  if (!Number.isFinite(distance) || distance <= 0 || distance > 100 || !Number.isFinite(pace) || pace <= 0) throw new Error('구간 입력 오류');
  const rows = []; for (let km = 1; km < distance; km++) rows.push({ distance: km, seconds: km * pace, segment: pace });
  rows.push({ distance, seconds: distance * pace, segment: (distance - (rows.length ? rows.at(-1).distance : 0)) * pace }); return rows;
}
export function localDate(date) { return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0'); }
export function validRun(r, today = localDate(new Date())) {
  if (!r || typeof r.id !== 'string' || !/^[a-zA-Z0-9-]{1,80}$/.test(r.id) || !['walk', 'run'].includes(r.kind) || typeof r.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(r.date)) return false;
  const date = new Date(r.date + 'T12:00:00');
  return Number.isFinite(date.getTime()) && localDate(date) === r.date && r.date >= '1900-01-01' && r.date <= today && Number.isFinite(r.distance) && r.distance > 0 && r.distance <= 2000 && Number.isFinite(r.seconds) && r.seconds > 0 && r.seconds <= 3600000;
}
export function cleanRuns(records) {
  if (!Array.isArray(records) || records.length > 10000 || !records.every(r => validRun(r))) throw new Error('기록 형식 오류');
  const ids = new Set(); return records.map(r => { if (ids.has(r.id)) throw new Error('중복 기록'); ids.add(r.id); return { id: r.id, date: r.date, kind: r.kind, distance: r.distance, seconds: r.seconds }; }).sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
}
