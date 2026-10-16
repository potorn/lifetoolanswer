// Run with Node.js 22+: node scripts/check-health-tools.mjs
import assert from 'node:assert/strict';
import { calculateEnergy, ACTIVITY_LEVELS } from '../js/bmr.js';
import { calculatePace, timeFromParts, paceFromParts, formatPace, formatDuration, KM_PER_MILE } from '../js/pace.js';

const near = (actual, expected) => assert.ok(Math.abs(actual - expected) <= Math.max(1, Math.abs(expected)) * 1e-10, `${actual} != ${expected}`);
const adult = { sex: 'male', age: 30, height: 175, weight: 70, activity: 1.4 };
const male = calculateEnergy(adult);
assert.equal(male.resting, 1648.75);
near(male.total, 2308.25);
assert.equal(Math.round(male.total), 2308, 'do not round resting calories before multiplying');
const female = calculateEnergy({ ...adult, sex: 'female', height: 165, weight: 60 });
assert.equal(female.resting, 1320.25);
near(female.total, 1848.35);
assert.equal(male.resting - calculateEnergy({ ...adult, sex: 'female' }).resting, 166);
assert.equal(male.estimates.length, 4);
for (const level of ACTIVITY_LEVELS) near(calculateEnergy({ ...adult, activity: level.factor }).total, 1648.75 * level.factor);
for (const sex of ['male', 'female']) for (const age of [18, 100]) for (const height of [100, 250]) for (const weight of [25, 350]) {
  const result = calculateEnergy({ ...adult, sex, age, height, weight });
  assert.ok(Number.isFinite(result.total) && result.resting > 0);
}
for (const invalid of [
  { sex: '' }, { sex: 'other' }, { age: 17 }, { age: 101 }, { age: 25.5 }, { age: NaN },
  { height: 99 }, { height: 251 }, { height: Infinity }, { weight: 0 }, { weight: 351 },
  { weight: NaN }, { activity: 0 }, { activity: 1.2 }, { activity: Infinity }
]) assert.throws(() => calculateEnergy({ ...adult, ...invalid }));
console.log('PASS: energy equations, sex coefficients, activity factors, unrounded totals and adult input limits');

const run = calculatePace({ mode: 'pace', unit: 'km', distance: 5, timeSeconds: 1800 });
assert.equal(run.paceSeconds, 360);
assert.equal(run.speedKmh, 10);
assert.equal(formatPace(run.paceSeconds), '6분 00초');
assert.equal(formatPace(run.milePaceSeconds), '9분 39초');
assert.equal(calculatePace({ mode: 'time', unit: 'km', distance: 10, paceSeconds: 300 }).timeSeconds, 3000);
assert.equal(calculatePace({ mode: 'distance', unit: 'km', timeSeconds: 1800, paceSeconds: 360 }).distanceKm, 5);
const mile = calculatePace({ mode: 'pace', unit: 'mi', distance: 1, timeSeconds: 600 });
assert.equal(mile.distanceKm, KM_PER_MILE);
near(mile.milePaceSeconds, 600);
near(mile.speedKmh, 9.656064);

let roundTrips = 0;
for (const unit of ['km', 'mi']) for (const distance of [0.1, 1, 5, 21.0975, 42.195, 100]) for (const timeSeconds of [60, 1800, 3600]) {
  const result = calculatePace({ mode: 'pace', unit, distance, timeSeconds });
  near(calculatePace({ mode: 'time', unit, distance, paceSeconds: result.paceSeconds }).timeSeconds, timeSeconds);
  near(calculatePace({ mode: 'distance', unit, timeSeconds, paceSeconds: result.paceSeconds }).distanceKm, result.distanceKm);
  near(result.speedKmh * timeSeconds / 3600, result.distanceKm);
  roundTrips++;
}
assert.equal(timeFromParts(1, 30, 0), 5400);
assert.equal(timeFromParts(0, 0, 0), 0);
assert.equal(paceFromParts(5, 30), 330);
for (const args of [[-1, 0, 0], [1000, 0, 0], [0, 60, 0], [0, 0, 60], [0, 1.5, 0], [0, NaN, 0]]) assert.throws(() => timeFromParts(...args));
for (const args of [[-1, 0], [1000, 0], [5, 60], [5.5, 0]]) assert.throws(() => paceFromParts(...args));
assert.equal(formatDuration(59.6), '00:01:00');
assert.equal(formatDuration(3599.6), '01:00:00');
assert.equal(formatDuration(360000), '100:00:00');
assert.equal(formatDuration(0.01), '1초 미만');
assert.equal(formatPace(359.6), '6분 00초');
assert.equal(formatPace(0.01), '1초 미만');
for (const invalid of [
  { mode: 'invalid' }, { unit: 'invalid' }, { distance: 0 }, { distance: -1 }, { distance: 1001 },
  { distance: NaN }, { timeSeconds: 0 }, { timeSeconds: Infinity }, { timeSeconds: 3600000 }
]) assert.throws(() => calculatePace({ mode: 'pace', unit: 'km', distance: 5, timeSeconds: 1800, ...invalid }));
for (const paceSeconds of [0, -1, NaN, Infinity, 60000]) assert.throws(() => calculatePace({ mode: 'time', unit: 'km', distance: 5, paceSeconds }));
console.log(`PASS: ${roundTrips} pace/time/distance round trips, mile conversion, clock validation and rounding carry`);
