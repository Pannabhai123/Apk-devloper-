// Topic templates: Algebra, Coordinate Geometry
import { R, gcd, F, mkQ, wrongsFrom, retry, fixed } from './core.mjs';

export const ALGEBRA = [
  {
    name: 'identity-a2b2', base: 'Moderate',
    fn: (rng) => retry(() => {
      const s = R.int(rng, 5, 30); // a+b
      const p = R.int(rng, 6, 60); // ab
      const v = s * s - 2 * p; // a²+b²
      return mkQ(rng, {
        q: `यदि a + b = ${s} और ab = ${p} है, तो a² + b² का मान ज्ञात कीजिए।`,
        qEn: `If a + b = ${s} and ab = ${p}, find the value of a² + b².`,
        ans: String(v), wrong: wrongsFrom(rng, v, [s * s + 2 * p, s * s, s * s - p, v + 2 * s]),
        sol: [`सूत्र: (a + b)² = a² + b² + 2ab`, `a² + b² = (a + b)² − 2ab`, `= ${s}² − 2 × ${p}`, `= ${s * s} − ${2 * p} = ${v}`],
        fin: String(v), diff: 'Moderate', shortcut: 'a²+b² = (a+b)² − 2ab',
      });
    }),
  },
  {
    name: 'identity-x-1-over-x', base: 'Moderate',
    fn: (rng) => retry(() => {
      const k = R.int(rng, 3, 12);
      const v = k * k - 2;
      return mkQ(rng, {
        q: `यदि x + 1/x = ${k} है, तो x² + 1/x² का मान ज्ञात कीजिए।`,
        qEn: `If x + 1/x = ${k}, find the value of x² + 1/x².`,
        ans: String(v), wrong: wrongsFrom(rng, v, [k * k, k * k + 2, k * k - 4, v + 2 * k]),
        sol: [`(x + 1/x)² = x² + 1/x² + 2`, `x² + 1/x² = (x + 1/x)² − 2`, `= ${k}² − 2 = ${k * k} − 2 = ${v}`],
        fin: String(v), diff: 'Moderate', shortcut: 'x² + 1/x² = (x + 1/x)² − 2',
      });
    }),
  },
  {
    name: 'identity-x3-1-over-x3', base: 'Hard',
    fn: (rng) => retry(() => {
      const k = R.int(rng, 3, 10);
      const v = k * k * k - 3 * k;
      return mkQ(rng, {
        q: `यदि x + 1/x = ${k} है, तो x³ + 1/x³ का मान ज्ञात कीजिए।`,
        qEn: `If x + 1/x = ${k}, find the value of x³ + 1/x³.`,
        ans: String(v), wrong: wrongsFrom(rng, v, [k * k * k, k * k * k - 3, k * k * k + 3 * k, v + 3]),
        sol: [`सूत्र: x³ + 1/x³ = (x + 1/x)³ − 3(x + 1/x)`, `= ${k}³ − 3 × ${k}`, `= ${k * k * k} − ${3 * k} = ${v}`],
        fin: String(v), diff: 'Hard', shortcut: 'x³+1/x³ = (x+1/x)³ − 3(x+1/x)',
      });
    }),
  },
  {
    name: 'identity-sum-diff-product', base: 'Easy',
    fn: (rng) => retry(() => {
      const s = R.int(rng, 8, 40); const d = R.int(rng, 2, 6);
      const a = (s + d) / 2, b = (s - d) / 2;
      if (!Number.isInteger(a) || !Number.isInteger(b) || b <= 0) throw 0;
      const p = a * b;
      return mkQ(rng, {
        q: `दो संख्याओं का योग ${s} और अंतर ${d} है। उनका गुणनफल ज्ञात कीजिए।`,
        qEn: `The sum of two numbers is ${s} and their difference is ${d}. Find their product.`,
        ans: String(p), wrong: wrongsFrom(rng, p, [s * d, (s * s - d * d) / 2, s + d, Math.round(s * s / 4) + 1]),
        sol: [`संख्याएँ: a = (${s} + ${d})/2 = ${a}, b = (${s} − ${d})/2 = ${b}`, `गुणनफल = ${a} × ${b} = ${p}`, `सूत्र से: ab = [(a+b)² − (a−b)²]/4 = [${s * s} − ${d * d}]/4 = ${p}`],
        fin: String(p), diff: 'Easy', shortcut: 'ab = ((a+b)² − (a−b)²)/4',
      });
    }),
  },
  {
    name: 'identity-a3b3', base: 'Hard',
    fn: (rng) => retry(() => {
      const s = R.int(rng, 3, 12); const p = R.int(rng, 2, 20);
      // a³+b³ = (a+b)³ − 3ab(a+b)
      const v = s ** 3 - 3 * p * s;
      return mkQ(rng, {
        q: `यदि a + b = ${s} तथा ab = ${p} है, तो a³ + b³ का मान ज्ञात कीजिए।`,
        qEn: `If a + b = ${s} and ab = ${p}, find a³ + b³.`,
        ans: String(v), wrong: wrongsFrom(rng, v, [s ** 3, s ** 3 - 3 * p, s ** 3 + 3 * p * s, v + 3 * s]),
        sol: [`a³ + b³ = (a + b)³ − 3ab(a + b)`, `= ${s}³ − 3 × ${p} × ${s}`, `= ${s ** 3} − ${3 * p * s} = ${v}`],
        fin: String(v), diff: 'Hard', shortcut: 'a³+b³ = (a+b)³ − 3ab(a+b)',
      });
    }),
  },
  {
    name: 'linear-solve', base: 'Easy',
    fn: (rng) => retry(() => {
      const x = R.int(rng, 4, 40);
      const a = R.int(rng, 2, 9), b = R.int(rng, 1, 25);
      const c = a * x + b;
      return mkQ(rng, {
        q: `समीकरण ${a}x + ${b} = ${c} को हल कीजिए तथा x का मान ज्ञात कीजिए।`,
        qEn: `Solve the equation ${a}x + ${b} = ${c} for x.`,
        ans: String(x), wrong: wrongsFrom(rng, x, [x + 1, x - 1, (c + b) / a, c - b]),
        sol: [`${a}x + ${b} = ${c}`, `${a}x = ${c} − ${b} = ${a * x}`, `x = ${a * x}/${a} = ${x}`],
        fin: String(x), diff: 'Easy',
      });
    }),
  },
  {
    name: 'simultaneous', base: 'Moderate',
    fn: (rng) => retry(() => {
      const x = R.int(rng, 3, 30), y = R.int(rng, 3, 30);
      const s = x + y, d = x - y;
      if (d <= 0) throw 0;
      return mkQ(rng, {
        q: `यदि x + y = ${s} और x − y = ${d} है, तो x का मान ज्ञात कीजिए।`,
        qEn: `If x + y = ${s} and x − y = ${d}, find the value of x.`,
        ans: String(x), wrong: wrongsFrom(rng, x, [y, s, d, x + y]),
        sol: [`दोनों समीकरणों को जोड़ें:`, `2x = ${s} + ${d} = ${2 * x}`, `x = ${2 * x}/2 = ${x}`],
        fin: String(x), diff: 'Moderate', shortcut: 'x = (योग + अंतर)/2',
      });
    }),
  },
  {
    name: 'quadratic-roots', base: 'Moderate',
    fn: (rng) => retry(() => {
      const r1 = R.int(rng, 1, 12), r2 = R.int(rng, 1, 15);
      const s = r1 + r2, p = r1 * r2;
      if (r1 === r2) throw 0;
      return mkQ(rng, {
        q: `यदि द्विघात समीकरण x² − ${s}x + ${p} = 0 के मूल α और β हैं, तो α + β तथा αβ का मान क्रमशः क्या है?`,
        qEn: `If α and β are the roots of x² − ${s}x + ${p} = 0, find α + β and αβ respectively.`,
        ans: `${s} और ${p}`, wrong: [`${p} और ${s}`, `−${s} और ${p}`, `${s} और ${s + p}`, `${s} और ${p + 1}`].filter((w) => w !== `${s} और ${p}`).slice(0, 3),
        sol: [`x² − (मूलों का योग)x + (मूलों का गुणनफल) = 0`, `तुलना करने पर: α + β = ${s}, αβ = ${p}`, `(जाँच: मूल ${r1} और ${r2} हैं — ${r1} + ${r2} = ${s}, ${r1} × ${r2} = ${p})`],
        fin: `${s} और ${p}`, diff: 'Moderate', shortcut: 'ax²+bx+c=0 ⇒ योग = −b/a, गुणनफल = c/a',
      });
    }),
  },
  {
    name: 'quadratic-solve', base: 'Hard',
    fn: (rng) => retry(() => {
      const r1 = R.int(rng, 2, 12), r2 = R.int(rng, 2, 15);
      if (r1 === r2) throw 0;
      const s = r1 + r2, p = r1 * r2;
      const lo = Math.min(r1, r2), hi = Math.max(r1, r2);
      return mkQ(rng, {
        q: `द्विघात समीकरण x² − ${s}x + ${p} = 0 को हल कीजिए। x के मान क्या हैं?`,
        qEn: `Solve the quadratic equation x² − ${s}x + ${p} = 0. What are the values of x?`,
        ans: `${lo} और ${hi}`, wrong: [`${-lo} और ${-hi}`, `${lo} और ${-hi}`, `${s} और ${p}`, `${lo + 1} और ${hi}`].filter((w) => w !== `${lo} और ${hi}`).slice(0, 3),
        sol: [`x² − ${s}x + ${p} = 0`, `दो संख्याएँ ढूँढें जिनका योग ${s} और गुणनफल ${p} हो: ${lo} और ${hi}`, `x² − ${lo}x − ${hi}x + ${lo * hi} = 0 ⇒ (x − ${lo})(x − ${hi}) = 0`, `x = ${lo} या x = ${hi}`],
        fin: `${lo} और ${hi}`, diff: 'Hard', shortcut: 'मध्य पद विभाजित करें (x−α)(x−β) = 0',
      });
    }),
  },
  {
    name: 'expression-value-3var', base: 'Moderate',
    fn: (rng) => retry(() => {
      const a = R.int(rng, 2, 9), b = R.int(rng, 2, 9);
      // (a+b)² − (a−b)² = 4ab
      const v = 4 * a * b;
      return mkQ(rng, {
        q: `यदि a + b = ${a + b} तथा a − b = ${a - b} है, तो 4ab का मान ज्ञात कीजिए।`,
        qEn: `If a + b = ${a + b} and a − b = ${a - b}, find the value of 4ab.`,
        ans: String(v), wrong: wrongsFrom(rng, v, [(a + b) * (a - b), (a + b) ** 2 - (a - b), 2 * a * b, v / 2]),
        sol: [`(a + b)² − (a − b)² = 4ab`, `= ${a + b}² − ${a - b}²`, `= ${(a + b) ** 2} − ${(a - b) ** 2} = ${v}`],
        fin: String(v), diff: 'Moderate', shortcut: '(a+b)² − (a−b)² = 4ab',
      });
    }),
  },
  {
    name: 'remainder-theorem', base: 'Hard',
    fn: (rng) => retry(() => {
      const k = R.int(rng, 1, 6); const b = R.int(rng, 1, 12);
      // p(x) = x² + bx + c divisible by (x − k) ⇒ c = −k² − bk
      const c = -(k * k + b * k);
      return mkQ(rng, {
        q: `यदि बहुपद p(x) = x² + ${b}x + c, (x − ${k}) से पूर्णतः विभाज्य है, तो c का मान ज्ञात कीजिए।`,
        qEn: `If the polynomial p(x) = x² + ${b}x + c is exactly divisible by (x − ${k}), find the value of c.`,
        ans: String(c), wrong: wrongsFrom(rng, c, [k * k + b * k, -k * k, -b * k, c + k]),
        sol: [`शेषफल प्रमेय: (x − ${k}) से विभाज्यता के लिए p(${k}) = 0`, `p(${k}) = ${k}² + ${b} × ${k} + c = 0`, `${k * k} + ${b * k} + c = 0`, `c = −${k * k + b * k} = ${c}`],
        fin: String(c), diff: 'Hard', shortcut: '(x−k) से विभाज्य ⇒ p(k) = 0',
      });
    }),
  },
  {
    name: 'expand-product', base: 'Easy',
    fn: (rng) => retry(() => {
      const a = R.int(rng, 2, 12), b = R.int(rng, 2, 12);
      const s = a + b, p = a * b;
      return mkQ(rng, {
        q: `(x + ${a})(x + ${b}) का विस्तार (expansion) क्या है?`,
        qEn: `What is the expansion of (x + ${a})(x + ${b})?`,
        ans: `x² + ${s}x + ${p}`, wrong: [`x² + ${p}x + ${s}`, `x² − ${s}x + ${p}`, `x² + ${s}x − ${p}`, `x² + ${s}x + ${s + p}`].filter((w) => w !== `x² + ${s}x + ${p}`).slice(0, 3),
        sol: [`(x + a)(x + b) = x² + (a + b)x + ab`, `a = ${a}, b = ${b}`, `= x² + (${a} + ${b})x + ${a} × ${b}`, `= x² + ${s}x + ${p}`],
        fin: `x² + ${s}x + ${p}`, diff: 'Easy',
      });
    }),
  },
];

export const COORDINATE_GEOMETRY = [
  {
    name: 'distance-two-points', base: 'Easy',
    fn: (rng) => retry(() => {
      const [a, b, c] = R.pick(rng, [[3, 4, 5], [6, 8, 10], [5, 12, 13], [8, 15, 17], [9, 12, 15], [12, 16, 20], [7, 24, 25], [10, 24, 26], [20, 21, 29]]);
      const x1 = R.int(rng, -6, 6), y1 = R.int(rng, -6, 6);
      const sx = R.bool(rng), sy = R.bool(rng);
      const x2 = x1 + (sx ? a : -a), y2 = y1 + (sy ? b : -b);
      const p = (v) => (v < 0 ? `(−${Math.abs(v)})` : `${v}`);
      return mkQ(rng, {
        q: `बिंदुओं (${x1}, ${y1}) और (${x2}, ${y2}) के बीच की दूरी ज्ञात कीजिए।`,
        qEn: `Find the distance between the points (${x1}, ${y1}) and (${x2}, ${y2}).`,
        ans: `${c} इकाई`, wrong: wrongsFrom(rng, c, [a + b, Math.abs(a - b), c * 2, a * b]).map((x) => `${x} इकाई`),
        sol: [`दूरी = √[(x₂ − x₁)² + (y₂ − y₁)²]`, `x₂ − x₁ = ${x2 - x1}, y₂ − y₁ = ${y2 - y1}`, `दूरी = √(${(x2 - x1) ** 2} + ${(y2 - y1) ** 2}) = √${(x2 - x1) ** 2 + (y2 - y1) ** 2} = ${c} इकाई`],
        fin: `${c} इकाई`, diff: 'Easy', shortcut: 'दूरी सूत्र = √(Δx² + Δy²)',
      });
    }),
  },
  {
    name: 'midpoint', base: 'Easy',
    fn: (rng) => retry(() => {
      const x1 = R.int(rng, -10, 10) * 2, y1 = R.int(rng, -10, 10) * 2;
      const x2 = R.int(rng, -10, 10) * 2, y2 = R.int(rng, -10, 10) * 2;
      if (x1 === x2 && y1 === y2) throw 0;
      const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
      return mkQ(rng, {
        q: `बिंदुओं (${x1}, ${y1}) और (${x2}, ${y2}) को जोड़ने वाले रेखाखंड का मध्य-बिंदु (Midpoint) ज्ञात कीजिए।`,
        qEn: `Find the midpoint of the line segment joining (${x1}, ${y1}) and (${x2}, ${y2}).`,
        ans: `(${mx}, ${my})`, wrong: [`(${x1 + x2}, ${y1 + y2})`, `(${(x2 - x1) / 2}, ${(y2 - y1) / 2})`, `(${my}, ${mx})`, `(${mx + 1}, ${my})`].filter((w) => w !== `(${mx}, ${my})`).slice(0, 3),
        sol: [`मध्य-बिंदु = ((x₁ + x₂)/2, (y₁ + y₂)/2)`, `= ((${x1} + ${x2})/2, (${y1} + ${y2})/2)`, `= (${x1 + x2}/2, ${y1 + y2}/2) = (${mx}, ${my})`],
        fin: `(${mx}, ${my})`, diff: 'Easy', shortcut: 'मध्य-बिंदु = निर्देशांकों का औसत',
      });
    }),
  },
  {
    name: 'slope', base: 'Moderate',
    fn: (rng) => retry(() => {
      const x1 = R.int(rng, -8, 8), y1 = R.int(rng, -8, 8);
      const dx = R.int(rng, -6, 6), dy = R.int(rng, -6, 6);
      if (dx === 0 || dy === 0) throw 0;
      const x2 = x1 + dx, y2 = y1 + dy;
      const g = gcd(Math.abs(dy), Math.abs(dx));
      const slope = F(dy, dx);
      return mkQ(rng, {
        q: `बिंदुओं (${x1}, ${y1}) और (${x2}, ${y2}) से होकर जाने वाली रेखा की प्रवणता (Slope) ज्ञात कीजिए।`,
        qEn: `Find the slope of the line passing through (${x1}, ${y1}) and (${x2}, ${y2}).`,
        ans: slope.str(), wrong: [F(dx, dy).str(), F(-dy, dx).str(), F(dy + 1, dx).str(), F(dy, dx + 1).str()].filter((w) => w !== slope.str()).slice(0, 3),
        sol: [`प्रवणता m = (y₂ − y₁)/(x₂ − x₁)`, `= (${y2} − ${y1})/(${x2} − ${x1})`, `= ${dy}/${dx} = ${slope.str()}`],
        fin: slope.str(), diff: 'Moderate', shortcut: 'm = Δy/Δx',
      });
    }),
  },
  {
    name: 'quadrant', base: 'Easy',
    fn: (rng) => retry(() => {
      const x = R.int(rng, 2, 15) * (R.bool(rng) ? 1 : -1);
      const y = R.int(rng, 2, 15) * (R.bool(rng) ? 1 : -1);
      const q = x > 0 ? (y > 0 ? 'प्रथम (I)' : 'चतुर्थ (IV)') : (y > 0 ? 'द्वितीय (II)' : 'तृतीय (III)');
      return mkQ(rng, {
        q: `बिंदु (${x}, ${y}) किस चतुर्थांश (Quadrant) में स्थित है?`,
        qEn: `In which quadrant does the point (${x}, ${y}) lie?`,
        ans: q, wrong: ['प्रथम (I)', 'द्वितीय (II)', 'तृतीय (III)', 'चतुर्थ (IV)'].filter((w) => w !== q).slice(0, 3),
        sol: [`बिंदु (${x}, ${y}) में x-निर्देशांक ${x > 0 ? 'धनात्मक' : 'ऋणात्मक'} तथा y-निर्देशांक ${y > 0 ? 'धनात्मक' : 'ऋणात्मक'} है।`, `${x > 0 && y > 0 ? 'दोनों धनात्मक ⇒ प्रथम चतुर्थांश' : x < 0 && y > 0 ? 'x ऋणात्मक, y धनात्मक ⇒ द्वितीय चतुर्थांश' : x < 0 && y < 0 ? 'दोनों ऋणात्मक ⇒ तृतीय चतुर्थांश' : 'x धनात्मक, y ऋणात्मक ⇒ चतुर्थ चतुर्थांश'}`],
        fin: q, diff: 'Easy',
      });
    }),
  },
  {
    name: 'point-on-axis-distance', base: 'Moderate',
    fn: (rng) => retry(() => {
      const a = R.int(rng, 3, 12); const y = R.int(rng, 2, 10);
      const x = R.bool(rng) ? a : -a;
      return mkQ(rng, {
        q: `बिंदु (${x}, ${y}) की y-अक्ष से दूरी ज्ञात कीजिए।`,
        qEn: `Find the distance of the point (${x}, ${y}) from the y-axis.`,
        ans: `${Math.abs(x)} इकाई`, wrong: [`${Math.abs(y)} इकाई`, `${Math.abs(x) + Math.abs(y)} इकाई`, `${Math.round(Math.sqrt(x * x + y * y))} इकाई`, `${Math.abs(x) + 1} इकाई`].filter((w) => w !== `${Math.abs(x)} इकाई`).slice(0, 3),
        sol: [`y-अक्ष से दूरी = |x-निर्देशांक|`, `= |${x}| = ${Math.abs(x)} इकाई`],
        fin: `${Math.abs(x)} इकाई`, diff: 'Moderate', shortcut: 'y-अक्ष से दूरी = |x|; x-अक्ष से दूरी = |y|',
      });
    }),
  },
  {
    name: 'area-triangle-coord', base: 'Hard',
    fn: (rng) => retry(() => {
      // right triangle with axis-parallel legs through common vertex
      const w = R.pick(rng, [4, 6, 8, 10, 12]), h = R.pick(rng, [3, 5, 6, 9, 10, 15]);
      if ((w * h) % 2 !== 0) throw 0;
      const x0 = R.int(rng, -5, 5), y0 = R.int(rng, -5, 5);
      const A = [x0, y0], B = [x0 + w, y0], C = [x0, y0 + h];
      const area = (w * h) / 2;
      return mkQ(rng, {
        q: `बिंदुओं (${A[0]}, ${A[1]}), (${B[0]}, ${B[1]}) और (${C[0]}, ${C[1]}) से बने त्रिभुज का क्षेत्रफल ज्ञात कीजिए।`,
        qEn: `Find the area of the triangle formed by the points (${A[0]}, ${A[1]}), (${B[0]}, ${B[1]}) and (${C[0]}, ${C[1]}).`,
        ans: `${area} वर्ग इकाई`, wrong: wrongsFrom(rng, area, [w * h, w + h, area / 2, area + 2]).map((x) => `${x} वर्ग इकाई`),
        sol: [`शोलेस (Shoelace) सूत्र: क्षेत्रफल = ½|x₁(y₂ − y₃) + x₂(y₃ − y₁) + x₃(y₁ − y₂)|`, `= ½|${A[0]}(${B[1]} − ${C[1]}) + ${B[0]}(${C[1]} − ${A[1]}) + ${C[0]}(${A[1]} − ${B[1]})|`, `= ½|${A[0] * (B[1] - C[1]) + B[0] * (C[1] - A[1]) + C[0] * (A[1] - B[1])}| = ½ × ${2 * area} = ${area} वर्ग इकाई`, `(ज्यामितीय जाँच: इस त्रिभुज की भुजाएँ ${w} और ${h} हैं ⇒ ½ × ${w} × ${h} = ${area})`],
        fin: `${area} वर्ग इकाई`, diff: 'Hard', shortcut: 'शोलेस (Shoelace) सूत्र से क्षेत्रफल',
      });
    }),
  },
];
