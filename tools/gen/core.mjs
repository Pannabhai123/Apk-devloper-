// ============================================================
// Core helpers for the question-bank generator.
// Every answer is COMPUTED from the mathematics of the template,
// then distractors are built from realistic error models.
// ============================================================

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const R = {
  int: (rng, a, b) => a + Math.floor(rng() * (b - a + 1)),
  pick: (rng, arr) => arr[Math.floor(rng() * arr.length)],
  bool: (rng, p = 0.5) => rng() < p,
  shuffle: (rng, arr) => {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  },
};

export function gcd(a, b) { a = Math.abs(a); b = Math.abs(b); while (b) { [a, b] = [b, a % b]; } return a || 1; }
export function lcm(a, b) { return Math.abs(a * b) / gcd(a, b); }
export function lcm3(a, b, c) { return lcm(lcm(a, b), c); }

// ---------- exact rational arithmetic ----------
export class Frac {
  constructor(n, d = 1) {
    if (d === 0) throw new Error('div0');
    if (d < 0) { n = -n; d = -d; }
    const g = gcd(Math.abs(n), d);
    this.n = n / g; this.d = d / g;
  }
  add(o) { return new Frac(this.n * o.d + o.n * this.d, this.d * o.d); }
  sub(o) { return new Frac(this.n * o.d - o.n * this.d, this.d * o.d); }
  mul(o) { return new Frac(this.n * o.n, this.d * o.d); }
  div(o) { return new Frac(this.n * o.d, this.d * o.n); }
  pow(k) {
    let r = new Frac(1);
    for (let i = 0; i < k; i++) r = r.mul(this);
    return r;
  }
  neg() { return new Frac(-this.n, this.d); }
  isInt() { return this.d === 1; }
  toNum() { return this.n / this.d; }
  str() { return this.d === 1 ? String(this.n) : `${this.n}/${this.d}`; }
  eq(o) { return this.n === o.n && this.d === o.d; }
}
export const F = (n, d = 1) => new Frac(n, d);

// ---------- formatting ----------
export function inr(n) { // Indian digit grouping e.g. 1,25,000
  const neg = n < 0 ? '-' : '';
  let s = String(Math.abs(Math.round(n)));
  if (s.length <= 3) return neg + s;
  const last3 = s.slice(-3); s = s.slice(0, -3);
  s = s.replace(/\B(?=(\d{2})+(?!\d))/g, ',');
  return `${neg}${s},${last3}`;
}
export const rs = (n) => `₹${inr(n)}`;        // rupees
export const pc = (n) => (String(n).endsWith('%') ? String(n) : `${n}%`); // percent
export const kmph = (n) => `${n} किमी/घंटा`;
export const mps = (n) => `${n} मी/से`;
export const mins = (n) => `${n} मिनट`;
export const hrs = (n) => `${n} घंटे`;
export const dys = (n) => `${n} दिन`;
export const yr = (n) => `${n} वर्ष`;
export const mtr = (n) => `${n} मीटर`;
export const cm = (n) => `${n} सेमी`;
export const sq = (n, unit = 'वर्ग मीटर') => `${n} ${unit}`;
export const kg = (n) => `${n} किग्रा`;
export const L = (n) => `${n} लीटर`;

export function fixed(n, places = 2) {
  const s = n.toFixed(places);
  return s.replace(/\.?0+$/, '') || '0';
}

// ---------- option assembly ----------
// Builds A-D options by shuffling [correct, w1, w2, w3]; throws when
// values collide so the caller retries with fresh parameters.
export function mkQ(rng, o) {
  const vals = [String(o.ans), ...o.wrong.map(String)];
  if (new Set(vals).size !== 4) throw new Error('duplicate options');
  if (vals.some((v) => v.length > 60)) throw new Error('option too long');
  const letters = R.shuffle(rng, ['A', 'B', 'C', 'D']);
  const options = {};
  letters.forEach((L, i) => { options[L] = vals[i]; });
  return {
    question: o.q,
    questionEn: o.qEn,
    options,
    correctAnswer: letters[0],
    solution: o.sol,
    finalAnswer: String(o.fin ?? o.ans),
    shortcut: o.shortcut || '',
    difficulty: o.diff,
  };
}

// Distinct wrong values from an error-model list; drops NaN/undefined/dupes.
// Returns NUMBERS (floats rounded to 2 dp) so callers can format with units.
export function wrongsFrom(rng, correct, models, unit = '') {
  void unit;
  const c = typeof correct === 'number' ? correct : parseFloat(correct);
  const out = [];
  for (const m of R.shuffle(rng, models)) {
    let v = typeof m === 'function' ? m(c) : m;
    if (v === null || v === undefined || Number.isNaN(v)) continue;
    if (!Number.isFinite(v)) continue;
    if (Math.abs(v - c) < 1e-9) continue;
    if (out.some((x) => Math.abs(x - v) < 1e-9)) continue;
    out.push(v);
    if (out.length === 3) break;
  }
  if (out.length < 3) throw new Error('not enough distractors');
  return out.map((v) => (Number.isInteger(v) ? v : Math.round(v * 100) / 100));
}

// retry helper: run fn until it returns a truthy value (max tries)
export let LAST_RETRY_ERR = '';
export function retry(fn, tries = 60) {
  for (let i = 0; i < tries; i++) {
    try {
      const v = fn();
      if (v) return v;
    } catch (e) { LAST_RETRY_ERR = `${e.message}`; /* regenerate */ }
  }
  throw new Error(`retry exhausted: ${LAST_RETRY_ERR}`);
}

export function primeFactors(n) {
  const f = {};
  let x = Math.abs(n);
  for (let p = 2; p * p <= x; p++) while (x % p === 0) { f[p] = (f[p] || 0) + 1; x /= p; }
  if (x > 1) f[x] = (f[x] || 0) + 1;
  return f;
}
export function countFactors(n) {
  const f = primeFactors(n);
  return Object.values(f).reduce((a, e) => a * (e + 1), 1);
}
export function unitDigitPow(base, exp) {
  const d = base % 10;
  if (exp === 0) return 1;
  const cycles = { 0: [0], 1: [1], 2: [2, 4, 8, 6], 3: [3, 9, 7, 1], 4: [4, 6], 5: [5], 6: [6], 7: [7, 9, 3, 1], 8: [8, 4, 2, 6], 9: [9, 1] };
  const c = cycles[d];
  return c[(exp - 1) % c.length];
}
export function isPrime(n) {
  if (n < 2) return false;
  for (let p = 2; p * p <= n; p++) if (n % p === 0) return false;
  return true;
}

// Pythagorean triples with integer legs
export const PYTHO = [
  [3, 4, 5], [6, 8, 10], [5, 12, 13], [9, 12, 15], [8, 15, 17],
  [12, 16, 20], [7, 24, 25], [10, 24, 26], [20, 21, 29], [18, 24, 30],
  [16, 30, 34], [9, 40, 41], [15, 36, 39], [24, 32, 40], [14, 48, 50],
];

// exact trig values as {c: Frac coefficient, r: 0|2|3}  meaning c·√r
export const TRIG = {
  'sin 0°': { c: F(0), r: 0 }, 'cos 0°': { c: F(1), r: 0 }, 'tan 0°': { c: F(0), r: 0 },
  'sin 30°': { c: F(1, 2), r: 0 }, 'cos 30°': { c: F(1, 2), r: 3 }, 'tan 30°': { c: F(1, 3), r: 3 },
  'sin 45°': { c: F(1, 2), r: 2 }, 'cos 45°': { c: F(1, 2), r: 2 }, 'tan 45°': { c: F(1), r: 0 },
  'sin 60°': { c: F(1, 2), r: 3 }, 'cos 60°': { c: F(1, 2), r: 0 }, 'tan 60°': { c: F(1), r: 3 },
  'sin 90°': { c: F(1), r: 0 }, 'cos 90°': { c: F(0), r: 0 },
  'cosec 30°': { c: F(2), r: 0 }, 'sec 30°': { c: F(2, 3), r: 3 }, 'cot 30°': { c: F(1), r: 3 },
  'cosec 45°': { c: F(2, 2), r: 2 }, 'sec 45°': { c: F(2, 2), r: 2 }, 'cot 45°': { c: F(1), r: 0 },
  'cosec 60°': { c: F(2, 3), r: 3 }, 'sec 60°': { c: F(2), r: 0 }, 'cot 60°': { c: F(1, 3), r: 3 },
};

// add two surd values c·√r (roots must match unless a coefficient is 0)
export function surdAdd(a, b) {
  if (a.c.n === 0) return b;
  if (b.c.n === 0) return a;
  if (a.r !== b.r) throw new Error('root mismatch');
  return { c: a.c.add(b.c), r: a.r };
}
export function surdMul(a, b) {
  const n = a.c.mul(b.c);
  if (a.r === 0 || b.r === 0) return { c: n, r: a.r + b.r };
  if (a.r === b.r) return { c: n.mul(F(a.r)), r: 0 };
  throw new Error('sqrt6');
}
export function surdStr(v) {
  if (v.c.n === 0) return '0';
  if (v.r === 0) return v.c.str();
  const n = v.c.n, d = v.c.d;
  const root = `√${v.r}`;
  if (d === 1) {
    if (n === 1) return root;
    if (n === -1) return `-${root}`;
    return `${n}${root}`;
  }
  const num = (n === 1 ? '' : n === -1 ? '-' : n) + root;
  return `${num}/${d}`;
}
