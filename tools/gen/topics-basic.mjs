// Topic templates: Number System, Simplification, BODMAS,
// Fractions & Decimals, Square & Cube Roots, HCF & LCM
import { R, gcd, lcm, lcm3, F, mkQ, wrongsFrom, retry, primeFactors, countFactors, unitDigitPow, isPrime, rs, pc, dys, mtr, inr, fixed } from './core.mjs';

// ---------- helpers ----------
function divCount(rng, a, b, d) { // count of multiples of d in [a,b]
  return Math.floor(b / d) - Math.floor((a - 1) / d);
}
const PERFECT_SQUARES = [];
for (let n = 24; n <= 99; n++) PERFECT_SQUARES.push([n * n, n]);
const PERFECT_CUBES = [];
for (let n = 9; n <= 26; n++) PERFECT_CUBES.push([n * n * n, n]);

export const NUMBER_SYSTEM = [
  {
    name: 'unit-digit-power', base: 'Moderate',
    fn: (rng) => retry(() => {
      const base = R.int(rng, 12, 99);
      const exp = R.int(rng, 13, 47);
      const u = unitDigitPow(base, exp);
      return mkQ(rng, {
        q: `${base}^${exp} की इकाई अंक (Unit Digit) क्या होगी?`,
        qEn: `Find the unit digit of ${base}^${exp}.`,
        ans: String(u), wrong: wrongsFrom(rng, u, [(u + 2) % 10, (u + 4) % 10, (u + 6) % 10, (u + 8) % 10, (u + 1) % 10]),
        sol: [`${base} का इकाई अंक = ${base % 10}`,
          `${base % 10} की घातों का चक्र (cycle): ${unitDigitPow(base, 1)}, ${unitDigitPow(base, 2)}, ${unitDigitPow(base, 3)}, ${unitDigitPow(base, 4)} — फिर दोहराता है (चक्र की लंबाई 4)`,
          `घात ${exp} को चक्र से देखें: ${exp} = 4 × ${Math.floor(exp / 4)} + ${exp % 4}`,
          `अतः ${base}^${exp} का इकाई अंक = ${u}`],
        fin: String(u), diff: 'Moderate',
        shortcut: 'इकाई अंक के लिए केवल अंतिम अंक की घातें लें; चक्र 4 पर दोहराता है।',
      });
    }),
  },
  {
    name: 'divisible-pick', base: 'Easy',
    fn: (rng) => retry(() => {
      const d = R.pick(rng, [3, 4, 6, 8, 9, 11]);
      const correct = R.int(rng, 12, 89) * d;
      let wrongs = [];
      while (wrongs.length < 3) {
        const w = correct + R.pick(rng, [-7, -5, -3, -2, -1, 1, 2, 3, 5, 7]);
        if (w > 0 && w % d !== 0 && !wrongs.includes(w) && String(w).length === String(correct).length) wrongs.push(w);
      }
      const rule = { 3: 'अंकों का योग 3 से विभाज्य', 4: 'अंतिम दो अंकों से बनी संख्या 4 से विभाज्य', 6: '2 और 3 दोनों से विभाज्य', 8: 'अंतिम तीन अंकों से बनी संख्या 8 से विभाज्य', 9: 'अंकों का योग 9 से विभाज्य', 11: 'विषम स्थान व सम स्थान के अंकों के योग का अंतर 11 से विभाज्य' }[d];
      const s = String(correct);
      const digitSum = [...s].reduce((a, c) => a + +c, 0);
      const sol = d === 3 || d === 9
        ? [`विभाज्यता नियम: ${rule}।`, `संख्या ${s} के अंकों का योग = ${digitSum}`, `${digitSum} ÷ ${d} = ${digitSum / d} (पूर्ण भाग जाता है)`, `अतः ${s}, ${d} से विभाज्य है।`]
        : d === 6
          ? [`विभाज्यता नियम: ${rule}।`, `${s} सम है (2 से विभाज्य) और अंकों का योग = ${digitSum}, जो 3 से विभाज्य है।`, `अतः ${s}, 6 से विभाज्य है।`]
          : d === 4 || d === 8
            ? [`विभाज्यता नियम: ${rule}।`, `संख्या ${s} के ${d === 4 ? 'अंतिम दो' : 'अंतिम तीन'} अंक = ${Number(s.slice(-(d === 4 ? 2 : 3)))}, जो ${d} से विभाज्य है।`, `अतः ${s}, ${d} से विभाज्य है।`]
            : [`विभाज्यता नियम: ${rule}।`, `संख्या ${s} में विषम स्थानों का योग − सम स्थानों का योग = ${(() => { let o = 0, e = 0; [...s].forEach((c, i) => (i % 2 === 0 ? (o += +c) : (e += +c))); return o - e; })()}, जो 11 से विभाज्य है।`, `अतः ${s}, 11 से विभाज्य है।`];
      return mkQ(rng, { q: `निम्न में से कौन-सी संख्या ${d} से पूर्णतः विभाज्य है?`, qEn: `Which of the following numbers is exactly divisible by ${d}?`, ans: s, wrong: wrongs.map(String), sol, fin: s, diff: 'Easy', shortcut: `विभाज्यता नियम: ${rule}।` });
    }),
  },
  {
    name: 'count-multiples', base: 'Easy',
    fn: (rng) => retry(() => {
      const a = R.int(rng, 100, 400), b = a + R.int(rng, 100, 500), d = R.pick(rng, [3, 4, 5, 6, 7, 8, 9, 11, 12, 13]);
      const n = divCount(rng, a, b, d);
      if (n < 4) throw 0;
      return mkQ(rng, {
        q: `${a} और ${b} के बीच (दोनों सम्मिलित) ${d} से विभाज्य कितनी संख्याएँ हैं?`,
        qEn: `How many numbers between ${a} and ${b} (both included) are divisible by ${d}?`,
        ans: String(n), wrong: wrongsFrom(rng, n, [n + 1, n - 1, n + 2, n - 2]),
        sol: [`${b} तक ${d} के गुणज = ${Math.floor(b / d)}`, `${a - 1} तक ${d} के गुणज = ${Math.floor((a - 1) / d)}`, `अभीष्ट संख्याएँ = ${Math.floor(b / d)} − ${Math.floor((a - 1) / d)} = ${n}`],
        fin: String(n), diff: 'Easy',
        shortcut: 'गिनती = ⌊b/d⌋ − ⌊(a−1)/d⌋',
      });
    }),
  },
  {
    name: 'sum-consecutive', base: 'Easy',
    fn: (rng) => retry(() => {
      const n1 = R.int(rng, 4, 40), n2 = n1 + R.int(rng, 10, 45);
      const sum = ((n1 + n2) * (n2 - n1 + 1)) / 2;
      const isNatural = R.bool(rng);
      return mkQ(rng, {
        q: isNatural ? `${n1} से ${n2} तक की सभी प्राकृत संख्याओं (दोनों सम्मिलित) का योग ज्ञात कीजिए।` : `${n1} से ${n2} तक की सभी संख्याओं (दोनों सम्मिलित) का योग ज्ञात कीजिए।`,
        qEn: `Find the sum of all numbers from ${n1} to ${n2} (both included).`,
        ans: String(sum), wrong: wrongsFrom(rng, sum, [sum + (n2 - n1 + 1), sum - (n2 - n1 + 1), n1 + n2, sum / 2]),
        sol: [`पहली संख्या a = ${n1}, अंतिम संख्या l = ${n2}`, `पदों की संख्या n = ${n2} − ${n1} + 1 = ${n2 - n1 + 1}`, `योग = n(a + l)/2 = ${n2 - n1 + 1} × (${n1} + ${n2})/2`, `योग = ${n2 - n1 + 1} × ${(n1 + n2) / 2} = ${sum}`],
        fin: String(sum), diff: 'Easy', shortcut: 'संख्याओं का योग = (पदों की संख्या) × (पहली + अंतिम)/2',
      });
    }),
  },
  {
    name: 'place-value', base: 'Easy',
    fn: (rng) => retry(() => {
      const digits = R.shuffle(rng, [1, 2, 3, 4, 5, 6, 7, 8, 9]).slice(0, 5);
      const num = digits.join('');
      const dig = R.pick(rng, [...new Set(digits)]);
      const place = { 4: 'हज़ार', 3: 'सैकड़ा', 2: 'दहाई', 1: 'इकाई' }[digits.indexOf(dig) === -1 ? 1 : digits.length - 1 - digits.indexOf(dig)];
      const idx = digits.indexOf(dig);
      const posFromRight = digits.length - 1 - idx; // 0=units
      const placeVal = dig * 10 ** posFromRight;
      const placeName = ['इकाई', 'दहाई', 'सैकड़ा', 'हज़ार', 'दस हज़ार'][posFromRight];
      if (posFromRight === 0) throw 0;
      return mkQ(rng, {
        q: `संख्या ${num} में अंक ${dig} का स्थानीय मान (Place Value) क्या है?`,
        qEn: `What is the place value of the digit ${dig} in the number ${num}?`,
        ans: inr(placeVal), wrong: [String(dig), inr(dig * 10), inr(dig * 100), inr(dig * 1000)].filter((x) => x !== inr(placeVal)).slice(0, 3),
        sol: [`संख्या ${num} में अंक ${dig} ${placeName} के स्थान पर है।`, `स्थानीय मान = अंक × स्थान का मान = ${dig} × ${10 ** posFromRight}`, `स्थानीय मान = ${inr(placeVal)}`],
        fin: inr(placeVal), diff: 'Easy',
        shortcut: 'स्थानीय मान = अंक × 10^(स्थान)',
      });
    }),
  },
  {
    name: 'greatest-number-remainders', base: 'Hard',
    fn: (rng) => retry(() => {
      const g = R.pick(rng, [12, 15, 16, 18, 20, 21, 24, 28, 30, 32, 36]);
      let m1 = R.int(rng, 3, 20), m2 = R.int(rng, 3, 20);
      while (gcd(m1, m2) !== 1 || m1 === m2) { m2 = R.int(rng, 3, 25); }
      const r1 = R.int(rng, 2, Math.min(g - 2, 9)), r2 = R.int(rng, 2, Math.min(g - 2, 9));
      if (r2 === r1) throw 0;
      const A = g * m1 + r1, B = g * m2 + r2;
      return mkQ(rng, {
        q: `वह बड़ी से बड़ी संख्या ज्ञात कीजिए जिससे ${A} को भाग देने पर ${r1} शेष बचता है और ${B} को भाग देने पर ${r2} शेष बचता है।`,
        qEn: `Find the greatest number which divides ${A} leaving remainder ${r1} and divides ${B} leaving remainder ${r2}.`,
        ans: String(g), wrong: wrongsFrom(rng, g, [g * 2, g - 1, Math.floor(g / 2), g + 1, g * m1]),
        sol: [`अभीष्ट संख्या N, (${A} − ${r1}) = ${A - r1} और (${B} − ${r2}) = ${B - r2} को पूर्णतः विभाजित करेगी।`, `अतः N = ${A - r1} और ${B - r2} का महत्तम समापवर्तक (HCF)`, `${A - r1} = ${g} × ${m1}`, `${B - r2} = ${g} × ${m2}`, `चूँकि ${m1} और ${m2} सह-अभाज्य हैं, HCF = ${g}`],
        fin: String(g), diff: 'Hard',
        shortcut: 'शेषफल घटाकर शेष बची संख्याओं का HCF निकालें।',
      });
    }),
  },
  {
    name: 'count-factors', base: 'Moderate',
    fn: (rng) => retry(() => {
      const p = R.pick(rng, [2, 3, 5, 7]), q = R.pick(rng, [2, 3, 5, 7, 11, 13].filter((x) => x !== p));
      const a = R.int(rng, 2, 4), b = R.int(rng, 1, 3);
      const N = p ** a * q ** b;
      const f = primeFactors(N);
      const cnt = (a + 1) * (b + 1);
      if (N < 100) throw 0;
      return mkQ(rng, {
        q: `संख्या ${N} के कुल कितने गुणनखंड (Factors) हैं?`,
        qEn: `How many factors does the number ${N} have?`,
        ans: String(cnt), wrong: wrongsFrom(rng, cnt, [cnt + 1, cnt - 1, cnt + 2, a * b + 2, (a + 1) * (b + 1) + 2]),
        sol: [`${N} = ${p}^${a} × ${q}^${b}`, 'गुणनखंड संख्या = (a+1)(b+1), जहाँ a, b अभाज्य घातें हैं', `गुणनखंड = (${a}+1) × (${b}+1) = ${a + 1} × ${b + 1} = ${cnt}`],
        fin: String(cnt), diff: 'Moderate',
        shortcut: 'N = p^a·q^b ⇒ गुणनखंड = (a+1)(b+1)',
      });
    }),
  },
  {
    name: 'remainder-question', base: 'Easy',
    fn: (rng) => retry(() => {
      const d = R.pick(rng, [6, 7, 8, 9, 11, 12, 13, 17]);
      const q1 = R.int(rng, 20, 400), r = R.int(rng, 1, d - 1);
      const n = d * q1 + r;
      return mkQ(rng, {
        q: `संख्या ${n} को ${d} से भाग देने पर शेषफल (Remainder) क्या बचेगा?`,
        qEn: `What is the remainder when ${n} is divided by ${d}?`,
        ans: String(r), wrong: wrongsFrom(rng, r, [r + 1, d - r, r - 1, r + 2].filter((x) => x >= 0 && x < d)),
        sol: [`${n} ÷ ${d} का भागफल = ${q1}, शेषफल = ${r}`, `जाँच: ${d} × ${q1} + ${r} = ${n}`, `अतः शेषफल = ${r}`],
        fin: String(r), diff: 'Easy',
      });
    }),
  },
];

export const SIMPLIFICATION = [
  {
    name: 'expression-value', base: 'Easy',
    fn: (rng) => retry(() => {
      const b = R.pick(rng, [4, 5, 6, 8]); const c = R.pick(rng, [3, 6, 9, 12]);
      const a = R.int(rng, 20, 90) * b; // a ÷ b exact
      const t = (a / b) * c; // term1
      const e = R.int(rng, 3, 12); const d2 = R.int(rng, 4, 15);
      const val = t + d2 * d2 - e;
      if (val <= 0) throw 0;
      return mkQ(rng, {
        q: `${a} ÷ ${b} × ${c} + ${d2}² − ${e} का मान ज्ञात कीजिए।`,
        qEn: `Simplify: ${a} ÷ ${b} × ${c} + ${d2}² − ${e}`,
        ans: String(val), wrong: wrongsFrom(rng, val, [t + 2 * d2 - e, val + e, val - d2, Math.round(((a / (b * c)) + d2 * d2 - e))]),
        sol: [`पहले भाग और गुणा (बाएँ से दाएँ): ${a} ÷ ${b} = ${a / b}`, `${a / b} × ${c} = ${t}`, `${d2}² = ${d2 * d2}`, `अब क्रमशः जोड़ें/घटाएँ: ${t} + ${d2 * d2} − ${e} = ${val}`],
        fin: String(val), diff: 'Easy',
        shortcut: 'BODMAS: वर्ग → भाग/गुणा → जोड़/घटाव',
      });
    }),
  },
  {
    name: 'find-x-linear', base: 'Easy',
    fn: (rng) => retry(() => {
      const x = R.int(rng, 8, 60); const a = R.int(rng, 2, 9); const b = R.int(rng, 1, 30);
      const c = a * x + b;
      return mkQ(rng, {
        q: `यदि ${a}x + ${b} = ${c} है, तो x का मान ज्ञात कीजिए।`,
        qEn: `If ${a}x + ${b} = ${c}, find the value of x.`,
        ans: String(x), wrong: wrongsFrom(rng, x, [x + 1, x - 2, c - b, x + a, x * a]),
        sol: [`${a}x + ${b} = ${c}`, `两边 से ${b} घटाएँ: ${a}x = ${c} − ${b} = ${a * x}`, `दोनों पक्षों को ${a} से भाग दें: x = ${x}`].map((s) => s.replace('两边', 'दोनों पक्षों')),
        fin: String(x), diff: 'Easy',
      });
    }),
  },
  {
    name: 'fraction-equation', base: 'Moderate',
    fn: (rng) => retry(() => {
      const a = R.pick(rng, [2, 3, 4, 5, 6]), b = R.pick(rng, [2, 3, 4, 6, 8, 12].filter((x) => x !== a));
      const x = R.int(rng, 6, 40);
      const rhs = F(x, a).add(F(x, b));
      if (!rhs.isInt()) throw 0;
      return mkQ(rng, {
        q: `x/${a} + x/${b} = ${rhs.n} है, तो x का मान क्या है?`,
        qEn: `If x/${a} + x/${b} = ${rhs.n}, find x.`,
        ans: String(x), wrong: wrongsFrom(rng, x, [rhs.n, x / 2, x + a + b, x - a]),
        sol: [`x/${a} + x/${b} = ${rhs.n}`, `x(1/${a} + 1/${b}) = ${rhs.n}`, `1/${a} + 1/${b} = ${F(1, a).add(F(1, b)).str()}`, `x × ${F(1, a).add(F(1, b)).str()} = ${rhs.n}`, `x = ${rhs.n} ÷ ${F(1, a).add(F(1, b)).str()} = ${x}`],
        fin: String(x), diff: 'Moderate',
        shortcut: 'x(1/a + 1/b) = दायाँ पक्ष',
      });
    }),
  },
  {
    name: 'percent-chain', base: 'Easy',
    fn: (rng) => retry(() => {
      const p1 = R.pick(rng, [10, 15, 20, 25, 40]), n1 = R.pick(rng, [200, 240, 300, 360, 400, 500, 600]);
      const p2 = R.pick(rng, [10, 20, 25, 50]);
      const n2 = R.pick(rng, [120, 150, 180, 200, 300]);
      const val = F(n1 * p1, 100).add(F(n2 * p2, 100));
      if (!val.isInt()) throw 0;
      return mkQ(rng, {
        q: `${p1}% of ${n1} + ${p2}% of ${n2} = ?`,
        qEn: `Find the value of ${p1}% of ${n1} + ${p2}% of ${n2}.`,
        ans: String(val.n), wrong: wrongsFrom(rng, val.n, [val.n / 2, val.n + 10, val.n - 5, (p1 + p2) * 5, val.n * 2]),
        sol: [`${p1}% of ${n1} = ${n1} × ${p1}/100 = ${(n1 * p1) / 100}`, `${p2}% of ${n2} = ${n2} × ${p2}/100 = ${(n2 * p2) / 100}`, `योग = ${(n1 * p1) / 100} + ${(n2 * p2) / 100} = ${val.n}`],
        fin: String(val.n), diff: 'Easy',
        shortcut: 'x% of n = n × x/100',
      });
    }),
  },
  {
    name: 'continued-fraction', base: 'Hard',
    fn: (rng) => retry(() => {
      const k = R.int(rng, 2, 9), m = R.int(rng, 2, 9);
      // value of 1/(1 + 1/m) = m/(m+1)
      const v = F(m, m + 1);
      const val = v.add(F(k));
      const shown = `1/(1 + 1/${m}) + ${k}`;
      return mkQ(rng, {
        q: `${shown} का मान क्या है?`,
        qEn: `Find the value of ${shown}.`,
        ans: val.str(), wrong: [F(k + 1).str(), F(m + k).str(), F(k).add(F(1, m + 1)).str(), F(k).add(F(1, m)).str()].filter((s) => s !== val.str()).slice(0, 3),
        sol: [`आंतरिक भिन्न: 1 + 1/${m} = ${F(m + 1, m).str()}`, `1 ÷ ${F(m + 1, m).str()} = ${v.str()}`, `अतः ${shown} = ${v.str()} + ${k} = ${val.str()}`],
        fin: val.str(), diff: 'Hard',
      });
    }),
  },
];

export const BODMAS = [
  {
    name: 'bracket-chain', base: 'Easy',
    fn: (rng) => retry(() => {
      const x1 = R.int(rng, 1, 9); const x2 = R.int(rng, x1 + 1, x1 + 15);
      const x3 = R.int(rng, x2 + 1, x2 + 20); const res = R.int(rng, 2, 30);
      const a = res + x3, b = x3 + x2, c = x2 + x1;
      const d = R.int(rng, x1 + 1, x1 + 30); const e = d - x1;
      return mkQ(rng, {
        q: `${a} − [${b} − {${c} − (${d} − ${e})}] का मान ज्ञात कीजिए।`,
        qEn: `Simplify: ${a} − [${b} − {${c} − (${d} − ${e})}]`,
        ans: String(res), wrong: wrongsFrom(rng, res, [res + 2 * x1, a - b - c, res + x1, res - x1]),
        sol: [`सबसे छोटा कोष्ठक: (${d} − ${e}) = ${x1}`, `इसके बाद { }: ${c} − ${x1} = ${x2}`, `फिर [ ]: ${b} − ${x2} = ${x3}`, `अंत में: ${a} − ${x3} = ${res}`],
        fin: String(res), diff: 'Easy',
        shortcut: 'कोष्ठकों को अंदर से बाहर की ओर हल करें: ( ) → { } → [ ]',
      });
    }),
  },
  {
    name: 'bodmas-mixed', base: 'Moderate',
    fn: (rng) => retry(() => {
      const b = R.pick(rng, [3, 4, 5, 6]); const a = R.int(rng, 30, 120) * b;
      const c = R.pick(rng, [2, 3, 4, 5]); const t1 = (a / b) * c;
      const sq = R.pick(rng, [3, 4, 5, 6, 7, 8, 9]); // squared
      const halfBase = R.pick(rng, [10, 12, 14, 16, 18, 20, 22, 24]);
      const val = t1 + sq * sq - halfBase / 2;
      if (!Number.isInteger(val) || val <= 0) throw 0;
      return mkQ(rng, {
        q: `${a} ÷ ${b} × ${c} + ${sq}² − ${halfBase}/2 का मान ज्ञात कीजिए।`,
        qEn: `Simplify: ${a} ÷ ${b} × ${c} + ${sq}² − ${halfBase}/2`,
        ans: String(val), wrong: wrongsFrom(rng, val, [val + halfBase / 2, t1 + 2 * sq * sq - halfBase / 2, val + sq, Math.round(a / (b * c) + sq * sq - halfBase / 2)]),
        sol: [`BODMAS क्रम: पहले Of/वर्ग, फिर ÷ और ×, फिर + और −`, `${a} ÷ ${b} = ${a / b}; ${a / b} × ${c} = ${t1}`, `${sq}² = ${sq * sq}; ${halfBase}/2 = ${halfBase / 2}`, `कुल मान = ${t1} + ${sq * sq} − ${halfBase / 2} = ${val}`],
        fin: String(val), diff: 'Moderate',
      });
    }),
  },
  {
    name: 'bodmas-of-and', base: 'Moderate',
    fn: (rng) => retry(() => {
      const p = R.pick(rng, [20, 25, 40, 50, 60]); const n1 = R.pick(rng, [80, 120, 160, 200, 240, 400]);
      const t1 = (p / 100) * n1; // "p% of n1"
      const k = R.int(rng, 2, 6); const t2 = t1 / k;
      if (!Number.isInteger(t2)) throw 0;
      const val = t1 + t2;
      return mkQ(rng, {
        q: `${p}% of ${n1} + ${t1} ÷ ${k} का मान ज्ञात कीजिए।`,
        qEn: `Simplify: ${p}% of ${n1} + ${t1} ÷ ${k}`,
        ans: String(val), wrong: wrongsFrom(rng, val, [t1, t1 - t2, val * 2, t1 * 2]),
        sol: [`'of' का अर्थ गुणा है: ${p}% of ${n1} = ${n1} × ${p}/100 = ${t1}`, `भाग: ${t1} ÷ ${k} = ${t2}`, `योग = ${t1} + ${t2} = ${val}`],
        fin: String(val), diff: 'Moderate',
        shortcut: 'BODMAS में of (= ×) को ÷ और × से पहले लगाते हैं।',
      });
    }),
  },
];

export const FRACTIONS_DECIMALS = [
  {
    name: 'largest-fraction', base: 'Moderate',
    fn: (rng) => retry(() => {
      const pool = ['2/3', '3/4', '4/5', '5/6', '3/5', '2/5', '5/8', '7/8', '5/9', '7/9', '4/7', '5/7', '3/8', '7/10', '9/10', '8/9', '2/7', '3/7'];
      const set = R.shuffle(rng, pool).slice(0, 4);
      const values = set.map((s) => { const [n, d] = s.split('/').map(Number); return F(n, d); });
      const maxI = values.reduce((mi, v, i) => (v.toNum() > values[mi].toNum() ? i : mi), 0);
      if (values.filter((v) => v.eq(values[maxI])).length > 1) throw 0;
      const wrong = set.filter((_, i) => i !== maxI);
      return mkQ(rng, {
        q: `निम्नलिखित में से सबसे बड़ी भिन्न कौन-सी है? (Which is the largest fraction?)`,
        qEn: `Which of the following is the largest fraction?`,
        ans: set[maxI], wrong,
        sol: [`भिन्नों की तुलना करने के लिए हर (denominators) समान करें या दशमलव में बदलें।`, ...set.map((s, i) => `${s} = ${fixed(values[i].toNum(), 3)}`), `सबसे बड़ा दशमलव मान ${fixed(values[maxI].toNum(), 3)} है, अतः सबसे बड़ी भिन्न = ${set[maxI]}`],
        fin: set[maxI], diff: 'Moderate',
        shortcut: 'समान अंतर वाली भिन्नों में छोटा हर बड़ा मान देता है; अन्यथा LCM से हर समान करें।',
      });
    }),
  },
  {
    name: 'recurring-decimal', base: 'Hard',
    fn: (rng) => retry(() => {
      const items = [
        { d: '0.333...', n: 3, den: 9, f: '1/3' }, { d: '0.666...', n: 6, den: 9, f: '2/3' },
        { d: '0.444...', n: 4, den: 9, f: '4/9' }, { d: '0.555...', n: 5, den: 9, f: '5/9' },
        { d: '0.777...', n: 7, den: 9, f: '7/9' }, { d: '0.888...', n: 8, den: 9, f: '8/9' },
        { d: '0.272727...', n: 27, den: 99, f: '3/11' }, { d: '0.363636...', n: 36, den: 99, f: '4/11' },
        { d: '0.181818...', n: 18, den: 99, f: '2/11' }, { d: '0.545454...', n: 54, den: 99, f: '6/11' },
        { d: '0.454545...', n: 45, den: 99, f: '5/11' }, { d: '0.727272...', n: 72, den: 99, f: '8/11' },
      ];
      const it = R.pick(rng, items);
      const others = R.shuffle(rng, items.filter((x) => x.f !== it.f)).slice(0, 3).map((x) => x.f);
      const gcdv = gcd(it.n, it.den);
      return mkQ(rng, {
        q: `पुनरावृत्त (recurring) दशमलव ${it.d} को सरलतम भिन्न में बदलें।`,
        qEn: `Convert the recurring decimal ${it.d} into a simple fraction.`,
        ans: it.f, wrong: others,
        sol: [`मान लीजिए x = ${it.d}`, `दोनों पक्षों को ${it.n < 10 ? '10' : '100'} से गुणा करें: ${it.n < 10 ? '10' : '100'}x = ${it.d.replace('...', '')}...`, `घटाने पर: ${it.n < 10 ? '9' : '99'}x = ${it.n}`, `x = ${it.n}/${it.den} = ${it.f}`],
        fin: it.f, diff: 'Hard',
        shortcut: 'शुद्ध पुनरावृत्त दशमलव 0.ab̄ = ab/99, 0.ā = a/9',
      });
    }),
  },
  {
    name: 'decimal-ops', base: 'Easy',
    fn: (rng) => retry(() => {
      const a = R.pick(rng, [0.2, 0.4, 0.5, 0.25, 0.05, 0.08]);
      const b = R.pick(rng, [0.1, 0.2, 0.5, 0.02, 0.04]);
      const op = R.pick(rng, ['x', '+']);
      if (op === 'x') {
        const v = a * b;
        const vs = String(+(v.toFixed(4)));
        return mkQ(rng, {
          q: `${a} × ${b} का मान क्या है?`, qEn: `Find the value of ${a} × ${b}.`,
          ans: vs, wrong: [String(+(a + b)), String(+(v * 10)), String(+(a - b + 0.01)), String(+(v / 10))].filter((s) => s !== vs).slice(0, 3),
          sol: [`${a} = ${a.toString().split('.')[1].length} दशमलव स्थान, ${b} = ${b.toString().split('.')[1].length} दशमलव स्थान`, `गुणा करने पर उत्तर में ${a.toString().split('.')[1].length + b.toString().split('.')[1].length} दशमलव स्थान होंगे`, `${a} × ${b} = ${vs}`],
          fin: vs, diff: 'Easy',
        });
      } else {
        const v = a + b;
        const vs = String(+(v.toFixed(4)));
        return mkQ(rng, {
          q: `${a} + ${b} − 0.01 का मान क्या है?`, qEn: `Find the value of ${a} + ${b} − 0.01.`,
          ans: vs, wrong: [String(+(a * b)), String(+(v + 0.01)), String(+(v - 0.1)), String(+(v + 0.09))].filter((s) => s !== vs).slice(0, 3),
          sol: [`${a} + ${b} = ${String(+(v.toFixed(4)))}`, `${String(+(v.toFixed(4)))} − 0.01 = ${vs}`],
          fin: vs, diff: 'Easy',
        });
      }
    }),
  },
  {
    name: 'fraction-of-number', base: 'Easy',
    fn: (rng) => retry(() => {
      const den = R.pick(rng, [3, 4, 5, 6, 7, 8, 9]);
      const num = R.int(rng, 2, den - 1);
      const k = R.int(rng, 3, 30);
      const whole = den * k;
      const val = num * k;
      return mkQ(rng, {
        q: `${num}/${den} × ${inr(whole)} × 2 = ?`,
        qEn: `Find the value of ${num}/${den} of ${inr(whole)} × 2.`,
        ans: String(val * 2), wrong: wrongsFrom(rng, val * 2, [val, whole - val, val * 3, whole / 2]),
        sol: [`${inr(whole)} का ${num}/${den} = ${whole} × ${num}/${den} = ${inr(val)}`, `अब ${inr(val)} × 2 = ${inr(val * 2)}`],
        fin: String(val * 2), diff: 'Easy',
      });
    }),
  },
];

export const SQUARE_CUBE_ROOTS = [
  {
    name: 'sqrt-perfect', base: 'Easy',
    fn: (rng) => retry(() => {
      const [n, root] = R.pick(rng, PERFECT_SQUARES.filter((x) => x[0] >= 576));
      return mkQ(rng, {
        q: `√${n} का मान ज्ञात कीजिए।`, qEn: `Find the value of √${n}.`,
        ans: String(root), wrong: wrongsFrom(rng, root, [root + 1, root - 1, root + 2, root + 3]),
        sol: [`${n} को अभाज्य गुणनखंडों में लिखें`, `${n} = ${Object.entries(primeFactors(n)).map(([p, e]) => `${p}^${e}`).join(' × ')}`, `√${n} = ${Object.entries(primeFactors(n)).map(([p, e]) => (e % 2 ? `${p}^${e / 2}` : `${p}^${e / 2}`)).map((s) => s.replace(/\^1$/, '')).join(' × ')} = ${root}`],
        fin: String(root), diff: 'Easy',
        shortcut: `${root}² = ${n} — अंतिम अंक देखकर संभावित मूल चुनें।`,
      });
    }),
  },
  {
    name: 'cbrt-perfect', base: 'Moderate',
    fn: (rng) => retry(() => {
      const [n, root] = R.pick(rng, PERFECT_CUBES.filter((x) => x[0] >= 729));
      return mkQ(rng, {
        q: `∛${n} का मान ज्ञात कीजिए।`, qEn: `Find the value of ∛${n}.`,
        ans: String(root), wrong: wrongsFrom(rng, root, [root + 1, root - 1, root + 2, root * 2]),
        sol: [`${n} = ${Object.entries(primeFactors(n)).map(([p, e]) => `${p}^${e}`).join(' × ')}`, `घनमूल के लिए प्रत्येक घात को 3 से भाग दें`, `∛${n} = ${Object.entries(primeFactors(n)).map(([p, e]) => `${p}^${e / 3}`).map((s) => s.replace(/\^1$/, '')).join(' × ')} = ${root}`],
        fin: String(root), diff: 'Moderate',
      });
    }),
  },
  {
    name: 'sqrt-fraction', base: 'Moderate',
    fn: (rng) => retry(() => {
      const a = R.int(rng, 6, 30), b = R.int(rng, 6, 30);
      const N = a * a, D = b * b;
      return mkQ(rng, {
        q: `√(${N}/${D}) का मान ज्ञात कीजिए।`, qEn: `Find the value of √(${N}/${D}).`,
        ans: F(a, b).str(), wrong: [F(a * b).str(), F(b, a).str(), F(a * a, b).str(), F(a, b * b).str()].filter((s) => s !== F(a, b).str()).slice(0, 3),
        sol: [`√(${N}/${D}) = √${N} / √${D}`, `√${N} = ${a}, √${D} = ${b}`, `अतः मान = ${F(a, b).str()}`],
        fin: F(a, b).str(), diff: 'Moderate',
        shortcut: '√(a/b) = √a/√b',
      });
    }),
  },
  {
    name: 'sqrt-decimal', base: 'Moderate',
    fn: (rng) => retry(() => {
      const r = R.pick(rng, [0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.4, 1.5, 2.5, 3.5]);
      const n = +(r * r).toFixed(4);
      return mkQ(rng, {
        q: `√${n} का मान ज्ञात कीजिए।`, qEn: `Find the value of √${n}.`,
        ans: String(r), wrong: [String(r / 2), String(r * 2), String(+(r * r).toFixed(2)), String(r + 0.5)].filter((s) => s !== String(r)).slice(0, 3),
        sol: [`${n} = ${r} × ${r} = ${String(r).replace('.', '')}/${10 ** String(r).split('.')[1].length} के बराबर भिन्न`, `अतः √${n} = ${r}`],
        fin: String(r), diff: 'Moderate',
      });
    }),
  },
  {
    name: 'sqrt-product', base: 'Easy',
    fn: (rng) => retry(() => {
      const a = R.int(rng, 4, 20), b = R.int(rng, 4, 20);
      return mkQ(rng, {
        q: `√${a * a} × √${b * b} + ${a + b} का मान ज्ञात कीजिए।`, qEn: `Find √${a * a} × √${b * b} + ${a + b}.`,
        ans: String(a * b + a + b), wrong: wrongsFrom(rng, a * b + a + b, [a * b, a + b, a * b + a, a * b + b]),
        sol: [`√${a * a} = ${a}, √${b * b} = ${b}`, `${a} × ${b} = ${a * b}`, `${a * b} + ${a + b} = ${a * b + a + b}`],
        fin: String(a * b + a + b), diff: 'Easy',
        shortcut: '√a × √b = √(ab)',
      });
    }),
  },
  {
    name: 'sqrt-sum', base: 'Hard',
    fn: (rng) => retry(() => {
      const a = R.int(rng, 3, 15), b = R.int(rng, 2, 12);
      const inner = a * a + b * b * 0; // keep integer: question √(a²·k) style
      const k = R.pick(rng, [4, 9, 16, 25]);
      const val = a * Math.sqrt(k);
      const vs = `${a}√${k}`;
      const kk = k;
      return mkQ(rng, {
        q: `√(${a * a * kk}) + ${b} का मान ज्ञात कीजिए।`, qEn: `Find the value of √(${a * a * kk}) + ${b}.`,
        ans: `${a * Math.sqrt(kk) + b}`, wrong: [`${a * kk + b}`, `${a + b}`, `${a * Math.sqrt(kk) - b}`, `${a * Math.sqrt(kk) + b + 1}`].filter((s) => s !== String(a * Math.sqrt(kk) + b)).slice(0, 3),
        sol: [`${a * a * kk} = ${a * a} × ${kk}`, `√(${a * a} × ${kk}) = ${a} × √${kk} = ${a}√${kk} = ${a * Math.sqrt(kk)}`, `${a * Math.sqrt(kk)} + ${b} = ${a * Math.sqrt(kk) + b}`],
        fin: String(a * Math.sqrt(kk) + b), diff: 'Hard',
        shortcut: `√(a²·k) = a√k`,
      });
    }),
  },
];

export const HCF_LCM = [
  {
    name: 'lcm-basic', base: 'Easy',
    fn: (rng) => retry(() => {
      const a = R.pick(rng, [12, 14, 15, 16, 18, 20, 21, 24, 27, 28, 30, 32, 36, 40, 45]);
      const b = R.pick(rng, [10, 15, 18, 20, 24, 25, 30, 35, 40, 42, 48, 54, 60]);
      const l = lcm(a, b), h = gcd(a, b);
      if (l === a || l === b) throw 0;
      return mkQ(rng, {
        q: `${a} और ${b} का लघुत्तम समापवर्त्य (LCM) ज्ञात कीजिए।`, qEn: `Find the LCM of ${a} and ${b}.`,
        ans: String(l), wrong: wrongsFrom(rng, l, [a * b, h, l * 2, l / 2, a + b]),
        sol: [`${a} = ${Object.entries(primeFactors(a)).map(([p, e]) => `${p}^${e}`).join(' × ')}`, `${b} = ${Object.entries(primeFactors(b)).map(([p, e]) => `${p}^${e}`).join(' × ')}`, `LCM = सभी अभाज्य गुणनखंडों की सबसे बड़ी घातें = ${l}`],
        fin: String(l), diff: 'Easy', shortcut: 'HCF × LCM = दोनों संख्याओं का गुणनफल',
      });
    }),
  },
  {
    name: 'hcf-basic', base: 'Easy',
    fn: (rng) => retry(() => {
      const g = R.pick(rng, [4, 6, 8, 9, 10, 12, 14, 15, 16, 18, 20, 21, 24]);
      let m1 = R.int(rng, 2, 12), m2 = R.int(rng, 2, 12);
      while (gcd(m1, m2) !== 1) { m2 = R.int(rng, 2, 14); }
      const a = g * m1, b = g * m2;
      return mkQ(rng, {
        q: `${a} और ${b} का महत्तम समापवर्तक (HCF) ज्ञात कीजिए।`, qEn: `Find the HCF of ${a} and ${b}.`,
        ans: String(g), wrong: wrongsFrom(rng, g, [gcd(a, b) * 2, lcm(a, b), g * 2, Math.floor(g / 2), 1]),
        sol: [`${a} = ${g} × ${m1}, ${b} = ${g} × ${m2}`, `${m1} और ${m2} सह-अभाज्य हैं`, `अतः HCF = ${g}`],
        fin: String(g), diff: 'Easy',
      });
    }),
  },
  {
    name: 'hcf-lcm-relation', base: 'Moderate',
    fn: (rng) => retry(() => {
      const a = R.pick(rng, [12, 15, 18, 20, 24, 36, 40, 42, 45, 48]);
      const b = R.pick(rng, [10, 16, 18, 25, 27, 30, 35, 50]);
      const h = gcd(a, b), l = lcm(a, b);
      return mkQ(rng, {
        q: `दो संख्याओं ${a} और ${b} का गुणनफल उनके HCF और LCM के गुणनफल के बराबर है। यदि HCF = ${h} है, तो LCM ज्ञात कीजिए।`,
        qEn: `For two numbers ${a} and ${b}, if HCF = ${h}, find the LCM.`,
        ans: String(l), wrong: wrongsFrom(rng, l, [a * b / (h * h), h, a + b, l / h]),
        sol: [`सूत्र: a × b = HCF × LCM`, `${a} × ${b} = ${h} × LCM`, `${a * b} = ${h} × LCM`, `LCM = ${a * b} / ${h} = ${l}`],
        fin: String(l), diff: 'Moderate', shortcut: 'LCM = (a×b)/HCF',
      });
    }),
  },
  {
    name: 'bells-together', base: 'Moderate',
    fn: (rng) => retry(() => {
      const a = R.pick(rng, [2, 3, 4, 5, 6]); const b = R.pick(rng, [4, 6, 8, 9, 10, 12].filter((x) => x !== a));
      const c = R.pick(rng, [5, 8, 10, 12, 15, 18, 20]);
      const l = lcm3(a, b, c);
      if (l < 12 || l > 240) throw 0;
      return mkQ(rng, {
        q: `चार घंटियाँ क्रमशः ${a}, ${b}, ${c} और ${l} मिनट के अंतराल पर बजती हैं। यदि वे एक साथ बजती हैं, तो पुनः कितने मिनट बाद एक साथ बजेंगी?`,
        qEn: `Four bells ring at intervals of ${a}, ${b}, ${c} and ${l} minutes. If they ring together now, after how many minutes will they ring together again?`,
        ans: `${l} मिनट`, wrong: [`${a * b * c * l} मिनट`, `${l / 2} मिनट`, `${l + a} मिनट`, `${l * 2} मिनट`].filter((s) => s !== `${l} मिनट`).slice(0, 3),
        sol: [`सभी घंियाँ पुनः तब एक साथ बजेंगी जब समय अंतरालों का LCM बीत जाए।`, `LCM(${a}, ${b}, ${c}, ${l}) = ${l}`, `अतः ${l} मिनट बाद सभी घंटियाँ पुनः एक साथ बजेंगी।`],
        fin: `${l} मिनट`, diff: 'Moderate', shortcut: 'एक साथ बजने का समय = अंतरालों का LCM',
      });
    }),
  },
  {
    name: 'least-number-remainder-same', base: 'Hard',
    fn: (rng) => retry(() => {
      const a = R.pick(rng, [3, 4, 5, 6]), b = R.pick(rng, [4, 5, 6, 8, 9, 10]), c = R.pick(rng, [5, 6, 8, 10, 12, 15]);
      const l = lcm3(a, b, c);
      const r = R.int(rng, 1, Math.min(a, b, c) - 1);
      const n = l + r;
      if (l < 10) throw 0;
      return mkQ(rng, {
        q: `वह छोटी से छोटी संख्या ज्ञात कीजिए जिसे ${a}, ${b} और ${c} से भाग देने पर प्रत्येक स्थिति में ${r} शेष बचता है।`,
        qEn: `Find the least number which when divided by ${a}, ${b} and ${c} leaves remainder ${r} in each case.`,
        ans: String(n), wrong: wrongsFrom(rng, n, [l, l - r, n + a, l * 2 + r]),
        sol: [`जब प्रत्येक बार शेषफल ${r} बचता है, तो (संख्या − ${r}) प्रत्येक से पूर्ण विभाज्य है।`, `LCM(${a}, ${b}, ${c}) = ${l}`, `अभीष्ट न्यूनतम संख्या = ${l} + ${r} = ${n}`],
        fin: String(n), diff: 'Hard', shortcut: 'न्यूनतम संख्या = LCM + शेषफल (समान शेषफल की स्थिति में)',
      });
    }),
  },
  {
    name: 'runners-meet', base: 'Hard',
    fn: (rng) => retry(() => {
      const a = R.pick(rng, [8, 10, 12, 15, 18, 20]); const b = R.pick(rng, [12, 15, 16, 20, 24, 25, 30].filter((x) => x !== a));
      const l = lcm(a, b);
      if (l > 300) throw 0;
      return mkQ(rng, {
        q: `दो धावक एक वृत्ताकार पथ पर क्रमशः ${a} सेकंड और ${b} सेकंड में एक चक्कर पूरा करते हैं। यदि वे एक साथ एक ही बिंदु से दौड़ना शुरू करें, तो कितने सेकंड बाद वे पुनः उसी बिंदु पर मिलेंगे?`,
        qEn: `Two runners complete one round of a circular track in ${a} s and ${b} s. Starting together, after how many seconds will they meet at the starting point again?`,
        ans: `${l} सेकंड`, wrong: [`${a * b} सेकंड`, `${l / 2} सेकंड`, `${Math.abs(a - b)} सेकंड`, `${l + b} सेकंड`].filter((s) => s !== `${l} सेकंड`).slice(0, 3),
        sol: [`वे पुनः प्रारंभिक बिंदु पर तब मिलेंगे जब समय दोनों चक्कर-समयों का सार्व गुणज हो।`, `LCM(${a}, ${b}) = ${l}`, `अतः ${l} सेकंड बाद।`],
        fin: `${l} सेकंड`, diff: 'Hard',
      });
    }),
  },
];
