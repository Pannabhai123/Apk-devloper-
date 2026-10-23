// Topic templates: Geometry, Mensuration, Trigonometry
import { R, gcd, F, Frac, mkQ, wrongsFrom, retry, TRIG, surdAdd, surdMul, surdStr, mtr, cm, pc, fixed, PYTHO } from './core.mjs';

const TRI_ANGLE_RATIOS = [[1, 2, 3], [2, 3, 4], [1, 1, 2], [3, 4, 5], [2, 3, 5], [1, 3, 5], [2, 1, 3], [3, 2, 4], [4, 3, 5], [5, 3, 7], [1, 2, 2], [2, 2, 3], [1, 4, 5], [3, 5, 7]];

export const GEOMETRY = [
  {
    name: 'triangle-angles-ratio', base: 'Easy',
    fn: (rng) => retry(() => {
      const [a, b, c] = R.pick(rng, TRI_ANGLE_RATIOS);
      const sum = a + b + c;
      if (180 % sum !== 0) throw 0;
      const k = 180 / sum;
      const A = a * k, B = b * k, C = c * k;
      return mkQ(rng, {
        q: `एक त्रिभुज के तीन कोण ${a} : ${b} : ${c} के अनुपात में हैं। सबसे बड़ा कोण ज्ञात कीजिए।`,
        qEn: `The angles of a triangle are in the ratio ${a}:${b}:${c}. Find the largest angle.`,
        ans: `${Math.max(A, B, C)}°`, wrong: [`${Math.min(A, B, C)}°`, `${k}°`, `${Math.max(A, B, C) / 2}°`, `${Math.max(A, B, C) + 2 * k}°`].filter((w) => w !== `${Math.max(A, B, C)}°`).slice(0, 3),
        sol: [`कोण योग प्रमेय: त्रिभुज के तीनों कोणों का योग = 180°`, `कुल भाग = ${a} + ${b} + ${c} = ${sum}`, `1 भाग = 180°/${sum} = ${k}°`, `कोण: ${A}°, ${B}°, ${C}° ⇒ सबसे बड़ा = ${Math.max(A, B, C)}°`],
        fin: `${Math.max(A, B, C)}°`, diff: 'Easy', shortcut: 'अनुपात के भागों का योग 180° से विभाजित करें',
      });
    }),
  },
  {
    name: 'triangle-two-angles', base: 'Easy',
    fn: (rng) => retry(() => {
      const A = R.int(rng, 25, 85); const B = R.int(rng, 25, 85);
      const C = 180 - A - B;
      if (C < 20) throw 0;
      return mkQ(rng, {
        q: `एक त्रिभुज के दो कोण ${A}° और ${B}° हैं। तीसरा कोण ज्ञात कीजिए।`,
        qEn: `Two angles of a triangle are ${A}° and ${B}°. Find the third angle.`,
        ans: `${C}°`, wrong: wrongsFrom(rng, C, [180 - A, 180 - B, A + B, 90]).map((x) => `${x}°`),
        sol: [`कोण योग प्रमेय: ∠A + ∠B + ∠C = 180°`, `${A} + ${B} + ∠C = 180°`, `∠C = 180° − ${A + B} = ${C}°`],
        fin: `${C}°`, diff: 'Easy',
      });
    }),
  },
  {
    name: 'pythagoras-hyp', base: 'Easy',
    fn: (rng) => retry(() => {
      const [a, b, c] = R.pick(rng, PYTHO);
      const k = R.pick(rng, [1, 2, 3]);
      const A = a * k, B = b * k, C = c * k;
      return mkQ(rng, {
        q: `एक समकोण त्रिभुज की दो भुजाएँ (लंब) ${A} सेमी और ${B} सेमी हैं। कर्ण (Hypotenuse) ज्ञात कीजिए।`,
        qEn: `Two legs of a right triangle are ${A} cm and ${B} cm. Find the hypotenuse.`,
        ans: cm(C), wrong: wrongsFrom(rng, C, [A + B, Math.abs(A - B), C + 2 * k, Math.round(Math.sqrt(A * B) * 2)]).map((x) => cm(x)),
        sol: [`पाइथागोरस प्रमेय: कर्ण² = लंब² + आधार²`, `कर्ण² = ${A}² + ${B}² = ${A * A} + ${B * B} = ${C * C}`, `कर्ण = √${C * C} = ${C} सेमी`],
        fin: cm(C), diff: 'Easy', shortcut: 'कर्ण² = लंब² + आधार²',
      });
    }),
  },
  {
    name: 'pythagoras-leg', base: 'Moderate',
    fn: (rng) => retry(() => {
      const [a, b, c] = R.pick(rng, PYTHO);
      const k = R.pick(rng, [1, 2, 3]);
      const A = a * k, B = b * k, C = c * k;
      return mkQ(rng, {
        q: `एक समकोण त्रिभुज का कर्ण ${C} सेमी है और एक भुजा ${A} सेमी है। तीसरी भुजा ज्ञात कीजिए।`,
        qEn: `The hypotenuse of a right triangle is ${C} cm and one leg is ${A} cm. Find the other leg.`,
        ans: cm(B), wrong: wrongsFrom(rng, B, [C - A, Math.round(Math.sqrt(C * A)), B + 2 * k, C + A]).map((x) => cm(x)),
        sol: [`कर्ण² = लंब² + आधार²`, `${C}² = ${A}² + भुजा²`, `भुजा² = ${C * C} − ${A * A} = ${B * B}`, `भुजा = ${B} सेमी`],
        fin: cm(B), diff: 'Moderate',
      });
    }),
  },
  {
    name: 'isosceles-vertex', base: 'Moderate',
    fn: (rng) => retry(() => {
      const base = R.pick(rng, [30, 40, 36, 50, 60, 70, 80]);
      const vertex = 180 - 2 * (base / 2);
      const halfBase = base / 2;
      return mkQ(rng, {
        q: `एक समद्विबाहु त्रिभुज (isosceles triangle) में प्रत्येक आधार कोण ${halfBase}° है। शीर्ष कोण ज्ञात कीजिए।`,
        qEn: `In an isosceles triangle, each base angle is ${halfBase}°. Find the vertex angle.`,
        ans: `${vertex}°`, wrong: wrongsFrom(rng, vertex, [180 - halfBase, 2 * halfBase, 90, vertex + 10]).map((x) => `${x}°`),
        sol: [`कोण योग: शीर्ष + ${halfBase} + ${halfBase} = 180°`, `शीर्ष = 180° − ${2 * halfBase} = ${vertex}°`],
        fin: `${vertex}°`, diff: 'Moderate',
      });
    }),
  },
  {
    name: 'parallelogram-angle', base: 'Easy',
    fn: (rng) => retry(() => {
      const a = R.int(rng, 50, 130);
      const b = 180 - a;
      return mkQ(rng, {
        q: `एक समांतर चतुर्भुज का एक कोण ${a}° है। इसके आसन्न (adjacent) कोण ज्ञात कीजिए।`,
        qEn: `One angle of a parallelogram is ${a}°. Find its adjacent angle.`,
        ans: `${b}°`, wrong: wrongsFrom(rng, b, [a, 180 - b, 90, 2 * a]).map((x) => `${x}°`),
        sol: [`समांतर चतुर्भुज में आसन्न कोण संपूरक होते हैं (योग 180°)।`, `आसन्न कोण = 180° − ${a}° = ${b}°`],
        fin: `${b}°`, diff: 'Easy', shortcut: 'आसन्न कोणों का योग = 180°',
      });
    }),
  },
  {
    name: 'similar-triangles', base: 'Moderate',
    fn: (rng) => retry(() => {
      const k = R.pick(rng, [2, 3, 4]);
      const p1 = R.pick(rng, [6, 8, 9, 10, 12, 15, 18, 20, 24]);
      const p2 = p1 * k;
      const s1 = R.pick(rng, [3, 4, 5, 6, 8]);
      const s2 = s1 * k;
      return mkQ(rng, {
        q: `दो समरूप त्रिभुजों (similar triangles) में पहले त्रिभुज की भुजाएँ ${p1} सेमी, ${s1} सेमी और ${p1 - s1 > 0 ? p1 - s1 : s1 + 2} सेमी हैं। यदि दूसरे त्रिभुज की सबसे लंबी भुजा ${p2} सेमी है, तो दूसरे त्रिभुज की ${s1} सेमी वाली भुजा के संगत वाली भुजा ज्ञात कीजिए।`,
        qEn: `Two similar triangles have sides in ratio 1:${k}. If a side of the smaller triangle is ${s1} cm, find the corresponding side of the larger triangle.`,
        ans: cm(s2), wrong: wrongsFrom(rng, s2, [s2 / 2, s1, s2 + k, s1 * k + 1]).map((x) => cm(x)),
        sol: [`समरूप त्रिभुजों में संगत भुजाओं का अनुपात समान होता है।`, `अनुपात = ${p1}/${p2} = 1/${k}`, `संगत भुजा = ${s1} × ${k} = ${s2} सेमी`],
        fin: cm(s2), diff: 'Moderate', shortcut: 'समरूप त्रिभुज: भुजाएँ समान अनुपात में',
      });
    }),
  },
  {
    name: 'similar-areas', base: 'Hard',
    fn: (rng) => retry(() => {
      const k = R.pick(rng, [2, 3, 4]);
      const area1 = R.pick(rng, [6, 8, 12, 15, 18, 20, 24, 30]);
      const area2 = area1 * k * k;
      return mkQ(rng, {
        q: `दो समरूप त्रिभुजों की संगत भुजाएँ ${k} : 1 के अनुपात में हैं। यदि बड़े त्रिभुज का क्षेत्रफल ${area2} वर्ग सेमी है, तो छोटे त्रिभुज का क्षेत्रफल ज्ञात कीजिए।`,
        qEn: `Corresponding sides of two similar triangles are in the ratio ${k}:1. If the larger triangle has area ${area2} cm², find the area of the smaller triangle.`,
        ans: `${area1} वर्ग सेमी`, wrong: wrongsFrom(rng, area1, [area2 / k, area1 * 2, area2 - area1, area1 / 2]).map((x) => `${x} वर्ग सेमी`),
        sol: [`समरूप आकृतियों में क्षेत्रफलों का अनुपात = भुजाओं के अनुपात का वर्ग`, `क्षेत्रफल अनुपात = ${k}² : 1 = ${k * k} : 1`, `छोटे का क्षेत्रफल = ${area2}/${k * k} = ${area1} वर्ग सेमी`],
        fin: `${area1} वर्ग सेमी`, diff: 'Hard', shortcut: 'क्षेत्रफल अनुपात = (भुजा अनुपात)²',
      });
    }),
  },
  {
    name: 'exterior-angle', base: 'Moderate',
    fn: (rng) => retry(() => {
      const a = R.int(rng, 35, 80), b = R.int(rng, 35, 80);
      const ext = a + b;
      if (ext >= 120 || ext <= 70) throw 0;
      return mkQ(rng, {
        q: `त्रिभुज के दो अंतः कोण ${a}° और ${b}° हैं। तीसरे कोण का बहिष्कोण (Exterior angle) ज्ञात कीजिए।`,
        qEn: `Two interior angles of a triangle are ${a}° and ${b}°. Find the exterior angle of the third angle.`,
        ans: `${ext}°`, wrong: wrongsFrom(rng, ext, [180 - ext, 180 - a, 180 - b, ext / 2]).map((x) => `${x}°`),
        sol: [`बहिष्कोण प्रमेय: बहिष्कोण = दो अंतर्विपरीत अंतःकोणों का योग`, `बहिष्कोण = ${a}° + ${b}° = ${ext}°`],
        fin: `${ext}°`, diff: 'Moderate', shortcut: 'बहिष्कोण = दो दूसरे अंतःकोणों का योग',
      });
    }),
  },
  {
    name: 'quadrilateral-angle', base: 'Moderate',
    fn: (rng) => retry(() => {
      const a = R.int(rng, 60, 110), b = R.int(rng, 60, 110), c = R.int(rng, 60, 110);
      const d = 360 - a - b - c;
      if (d < 40 || d > 160) throw 0;
      return mkQ(rng, {
        q: `एक चतुर्भुज के तीन कोण ${a}°, ${b}° और ${c}° हैं। चौथा कोण ज्ञात कीजिए।`,
        qEn: `Three angles of a quadrilateral are ${a}°, ${b}° and ${c}°. Find the fourth angle.`,
        ans: `${d}°`, wrong: wrongsFrom(rng, d, [360 - a, 180 - d, d / 2, 90]).map((x) => `${x}°`),
        sol: [`चतुर्भुज के कोणों का योग = 360°`, `चौथा कोण = 360° − (${a} + ${b} + ${c})`, `= 360° − ${a + b + c} = ${d}°`],
        fin: `${d}°`, diff: 'Moderate',
      });
    }),
  },
  {
    name: 'circle-chord-perp', base: 'Hard',
    fn: (rng) => retry(() => {
      const r = R.pick(rng, [5, 10, 13, 15, 17, 20, 25, 26]);
      const d = R.pick(rng, [3, 4, 6, 8, 9, 12]); // distance from centre
      if (d >= r) throw 0;
      const half = Math.sqrt(r * r - d * d);
      if (!Number.isInteger(half)) throw 0;
      const chord = 2 * half;
      return mkQ(rng, {
        q: `एक वृत्त की त्रिज्या ${r} सेमी है। केंद्र से ${d} सेमी की दूरी पर स्थित जीवा (chord) की लंबाई ज्ञात कीजिए।`,
        qEn: `The radius of a circle is ${r} cm. Find the length of a chord at a distance of ${d} cm from the centre.`,
        ans: cm(chord), wrong: wrongsFrom(rng, chord, [2 * d, r, chord / 2, r + d]).map((x) => cm(x)),
        sol: [`केंद्र से जीवा पर लंब, जीवा को समद्विभाजित करता है।`, `समकोण त्रिभुज: त्रिज्या² = दूरी² + (जीवा/2)²`, `${r}² = ${d}² + (जीवा/2)²`, `जीवा/2 = √(${r * r} − ${d * d}) = ${half}`, `जीवा = ${chord} सेमी`],
        fin: cm(chord), diff: 'Hard', shortcut: 'अर्धजीवा = √(r² − d²)',
      });
    }),
  },
];

export const MENSURATION = [
  {
    name: 'rectangle-area-perimeter', base: 'Easy',
    fn: (rng) => retry(() => {
      const l = R.int(rng, 8, 40), w = R.int(rng, 5, 30);
      const area = l * w, per = 2 * (l + w);
      const askArea = R.bool(rng);
      return mkQ(rng, {
        q: askArea ? `एक आयत की लंबाई ${l} सेमी और चौड़ाई ${w} सेमी है। उसका क्षेत्रफल ज्ञात कीजिए।` : `एक आयत की लंबाई ${l} सेमी और चौड़ाई ${w} सेमी है। उसका परिमाप ज्ञात कीजिए।`,
        qEn: askArea ? `A rectangle is ${l} cm long and ${w} cm wide. Find its area.` : `A rectangle is ${l} cm long and ${w} cm wide. Find its perimeter.`,
        ans: askArea ? `${area} वर्ग सेमी` : `${per} सेमी`,
        wrong: askArea ? wrongsFrom(rng, area, [per, l + w, area / 2, area + l]).map((x) => `${x} वर्ग सेमी`) : wrongsFrom(rng, per, [area, l * w, per / 2, per + 2]).map((x) => `${x} सेमी`),
        sol: askArea ? [`आयत का क्षेत्रफल = लंबाई × चौड़ाई`, `= ${l} × ${w} = ${area} वर्ग सेमी`] : [`आयत का परिमाप = 2(लंबाई + चौड़ाई)`, `= 2 × (${l} + ${w}) = 2 × ${l + w} = ${per} सेमी`],
        fin: askArea ? `${area} वर्ग सेमी` : `${per} सेमी`, diff: 'Easy',
      });
    }),
  },
  {
    name: 'square-diagonal', base: 'Moderate',
    fn: (rng) => retry(() => {
      const side = R.pick(rng, [4, 6, 8, 10, 12, 14, 16, 20, 24, 28, 32]);
      const area = side * side;
      const diag = `√${2 * side * side}`;
      const diagVal = side * Math.SQRT2;
      return mkQ(rng, {
        q: `एक वर्ग का विकर्ण ${diagVal.toFixed(2)} सेमी है (√2 ≈ 1.414)। वर्ग का क्षेत्रफल ज्ञात कीजिए।`,
        qEn: `The diagonal of a square is ${diagVal.toFixed(2)} cm. Find its area.`,
        ans: `${area} वर्ग सेमी`, wrong: wrongsFrom(rng, area, [area * 2, area / 2, side * 4, area + side]).map((x) => `${x} वर्ग सेमी`),
        sol: [`विकर्ण d = √2 × भुजा`, `भुजा = d/√2 = ${side} सेमी`, `क्षेत्रफल = भुजा² = ${side}² = ${area} वर्ग सेमी`, `(सीधा सूत्र: क्षेत्रफल = d²/2 = ${2 * side * side}/2 = ${area})`],
        fin: `${area} वर्ग सेमी`, diff: 'Moderate', shortcut: 'वर्ग का क्षेत्रफल = विकर्ण²/2',
      });
    }),
  },
  {
    name: 'circle-area', base: 'Easy',
    fn: (rng) => retry(() => {
      const r = R.pick(rng, [7, 14, 21, 28, 35, 3.5, 10.5]);
      const area = (22 / 7) * r * r;
      if (Math.abs(area - Math.round(area)) > 1e-9) throw 0;
      return mkQ(rng, {
        q: `एक वृत्त की त्रिज्या ${r} सेमी है। उसका क्षेत्रफल ज्ञात कीजिए (π = 22/7)।`,
        qEn: `The radius of a circle is ${r} cm. Find its area (π = 22/7).`,
        ans: `${area} वर्ग सेमी`, wrong: wrongsFrom(rng, area, [(44 / 7) * r, 2 * (22 / 7) * r, area / 2, area * 2]).map((x) => `${fixed(x, 2)} वर्ग सेमी`),
        sol: [`क्षेत्रफल = πr²`, `= 22/7 × ${r} × ${r}`, `= 22/7 × ${fixed(r * r, 1)} = ${fixed(area, 2)} वर्ग सेमी`],
        fin: `${area} वर्ग सेमी`, diff: 'Easy',
      });
    }),
  },
  {
    name: 'circle-circumference', base: 'Easy',
    fn: (rng) => retry(() => {
      const r = R.pick(rng, [7, 14, 21, 28, 35, 3.5, 10.5]);
      const c = 2 * (22 / 7) * r;
      if (Math.abs(c - Math.round(c)) > 1e-9) throw 0;
      return mkQ(rng, {
        q: `एक वृत्त की त्रिज्या ${r} सेमी है। उसकी परिधी (Circumference) ज्ञात कीजिए (π = 22/7)।`,
        qEn: `The radius of a circle is ${r} cm. Find its circumference (π = 22/7).`,
        ans: `${c} सेमी`, wrong: wrongsFrom(rng, c, [(22 / 7) * r * r, (22 / 7) * r, c / 2, c * 2]).map((x) => `${fixed(x, 2)} सेमी`),
        sol: [`परिधी = 2πr`, `= 2 × 22/7 × ${r} = ${c} सेमी`],
        fin: `${c} सेमी`, diff: 'Easy',
      });
    }),
  },
  {
    name: 'ring-area', base: 'Hard',
    fn: (rng) => retry(() => {
      const Rr = R.pick(rng, [14, 21, 28, 35]);
      const rr = R.pick(rng, [7, 14, 3.5, 10.5]);
      if (rr >= Rr) throw 0;
      const area = (22 / 7) * (Rr * Rr - rr * rr);
      if (Math.abs(area - Math.round(area)) > 1e-9) throw 0;
      return mkQ(rng, {
        q: `एक वलय (ring) की बाहरी और भीतरी त्रिज्याएँ क्रमशः ${Rr} सेमी और ${rr} सेमी हैं। वलय का क्षेत्रफल ज्ञात कीजिए (π = 22/7)।`,
        qEn: `The outer and inner radii of a ring are ${Rr} cm and ${rr} cm. Find the area of the ring (π = 22/7).`,
        ans: `${area} वर्ग सेमी`, wrong: wrongsFrom(rng, area, [(22 / 7) * (Rr * Rr + rr * rr), (22 / 7) * Rr * Rr, (22 / 7) * rr * rr, area * 2]).map((x) => `${fixed(x, 2)} वर्ग सेमी`),
        sol: [`वलय का क्षेत्रफल = π(R² − r²)`, `= 22/7 × (${Rr}² − ${rr}²)`, `= 22/7 × (${Rr * Rr} − ${rr * rr}) = 22/7 × ${fixed(Rr * Rr - rr * rr, 1)}`, `= ${fixed(area, 2)} वर्ग सेमी`],
        fin: `${area} वर्ग सेमी`, diff: 'Hard', shortcut: 'वलय = π(R² − r²)',
      });
    }),
  },
  {
    name: 'triangle-area', base: 'Easy',
    fn: (rng) => retry(() => {
      const b = R.pick(rng, [10, 12, 14, 16, 18, 20, 24, 28, 30]);
      const h = R.pick(rng, [8, 9, 10, 12, 15, 16, 18, 20, 24]);
      const area = (b * h) / 2;
      if (!Number.isInteger(area)) throw 0;
      return mkQ(rng, {
        q: `एक त्रिभुज का आधार ${b} सेमी और ऊँचाई ${h} सेमी है। उसका क्षेत्रफल ज्ञात कीजिए।`,
        qEn: `A triangle has base ${b} cm and height ${h} cm. Find its area.`,
        ans: `${area} वर्ग सेमी`, wrong: wrongsFrom(rng, area, [b * h, (b + h) / 2, area * 2, area + b]).map((x) => `${x} वर्ग सेमी`),
        sol: [`क्षेत्रफल = ½ × आधार × ऊँचाई`, `= ½ × ${b} × ${h} = ${area} वर्ग सेमी`],
        fin: `${area} वर्ग सेमी`, diff: 'Easy',
      });
    }),
  },
  {
    name: 'equilateral-area', base: 'Moderate',
    fn: (rng) => retry(() => {
      const a = R.pick(rng, [2, 4, 6, 8, 10, 12, 14, 16, 20]);
      const k = (a * a) / 4; // area = k√3
      return mkQ(rng, {
        q: `एक समबाहु त्रिभुज (equilateral triangle) की भुजा ${a} सेमी है। उसका क्षेत्रफल ज्ञात कीजिए।`,
        qEn: `Find the area of an equilateral triangle with side ${a} cm.`,
        ans: `${k}√3 वर्ग सेमी`, wrong: [`${a * a}√3 वर्ग सेमी`, `${k / 2}√3 वर्ग सेमी`, `${2 * k}√3 वर्ग सेमी`, `${k}√2 वर्ग सेमी`].filter((w) => w !== `${k}√3 वर्ग सेमी`).slice(0, 3),
        sol: [`समबाहु त्रिभुज का क्षेत्रफल = (√3/4) × भुजा²`, `= (√3/4) × ${a}²`, `= (√3/4) × ${a * a} = ${k}√3 वर्ग सेमी`],
        fin: `${k}√3 वर्ग सेमी`, diff: 'Moderate', shortcut: 'समबाहु क्षेत्रफल = (√3/4)a²',
      });
    }),
  },
  {
    name: 'cube-surface-volume', base: 'Moderate',
    fn: (rng) => retry(() => {
      const a = R.pick(rng, [2, 3, 4, 5, 6, 7, 8, 9, 10, 12]);
      const askVol = R.bool(rng);
      const vol = a ** 3, tsa = 6 * a * a;
      return mkQ(rng, {
        q: askVol ? `एक घन (cube) की भुजा ${a} सेमी है। उसका आयतन ज्ञात कीजिए।` : `एक घन (cube) की भुजा ${a} सेमी है। उसका कुल पृष्ठीय क्षेत्रफल ज्ञात कीजिए।`,
        qEn: askVol ? `Find the volume of a cube of edge ${a} cm.` : `Find the total surface area of a cube of edge ${a} cm.`,
        ans: askVol ? `${vol} घन सेमी` : `${tsa} वर्ग सेमी`,
        wrong: askVol ? wrongsFrom(rng, vol, [6 * a * a, a * a, 4 * a * a, vol * 2]).map((x) => `${x} घन सेमी`) : wrongsFrom(rng, tsa, [a ** 3, a * a, tsa / 2, 2 * tsa]).map((x) => `${x} वर्ग सेमी`),
        sol: askVol ? [`घन का आयतन = भुजा³`, `= ${a}³ = ${vol} घन सेमी`] : [`घन का कुल पृष्ठ = 6 × भुजा²`, `= 6 × ${a}² = 6 × ${a * a} = ${tsa} वर्ग सेमी`],
        fin: askVol ? `${vol} घन सेमी` : `${tsa} वर्ग सेमी`, diff: 'Moderate',
      });
    }),
  },
  {
    name: 'cuboid-volume', base: 'Easy',
    fn: (rng) => retry(() => {
      const l = R.int(rng, 5, 25), w = R.int(rng, 4, 20), h = R.int(rng, 3, 15);
      const vol = l * w * h;
      return mkQ(rng, {
        q: `एक घनाभ (cuboid) की लंबाई ${l} सेमी, चौड़ाई ${w} सेमी और ऊँचाई ${h} सेमी है। उसका आयतन ज्ञात कीजिए।`,
        qEn: `A cuboid is ${l} cm × ${w} cm × ${h} cm. Find its volume.`,
        ans: `${vol} घन सेमी`, wrong: wrongsFrom(rng, vol, [2 * (l * w + w * h + l * h), l + w + h, vol / 2, 4 * l * w]).map((x) => `${x} घन सेमी`),
        sol: [`आयतन = लंबाई × चौड़ाई × ऊँचाई`, `= ${l} × ${w} × ${h} = ${vol} घन सेमी`],
        fin: `${vol} घन सेमी`, diff: 'Easy',
      });
    }),
  },
  {
    name: 'cylinder-volume', base: 'Moderate',
    fn: (rng) => retry(() => {
      const r = R.pick(rng, [7, 14, 21, 3.5, 10.5]);
      const h = R.pick(rng, [10, 20, 30, 5, 15, 25, 2, 40]);
      const vol = (22 / 7) * r * r * h;
      if (Math.abs(vol - Math.round(vol)) > 1e-9) throw 0;
      return mkQ(rng, {
        q: `एक बेलन (cylinder) की त्रिज्या ${r} सेमी और ऊँचाई ${h} सेमी है। उसका आयतन ज्ञात कीजिए (π = 22/7)।`,
        qEn: `Find the volume of a cylinder with radius ${r} cm and height ${h} cm (π = 22/7).`,
        ans: `${vol} घन सेमी`, wrong: wrongsFrom(rng, vol, [2 * (22 / 7) * r * h, (22 / 7) * r * r, vol * 3, vol / 3]).map((x) => `${fixed(x, 2)} घन सेमी`),
        sol: [`आयतन = πr²h`, `= 22/7 × ${r}² × ${h}`, `= 22/7 × ${fixed(r * r, 1)} × ${h} = ${fixed(vol, 2)} घन सेमी`],
        fin: `${vol} घन सेमी`, diff: 'Moderate',
      });
    }),
  },
  {
    name: 'cylinder-csa', base: 'Moderate',
    fn: (rng) => retry(() => {
      const r = R.pick(rng, [7, 14, 21, 3.5, 10.5]);
      const h = R.pick(rng, [10, 20, 30, 5, 15, 25, 40]);
      const csa = 2 * (22 / 7) * r * h;
      if (Math.abs(csa - Math.round(csa)) > 1e-9) throw 0;
      return mkQ(rng, {
        q: `एक बेलन की त्रिज्या ${r} सेमी और ऊँचाई ${h} सेमी है। उसका वक्र पृष्ठीय क्षेत्रफल (CSA) ज्ञात कीजिए (π = 22/7)।`,
        qEn: `Find the curved surface area of a cylinder with radius ${r} cm and height ${h} cm (π = 22/7).`,
        ans: `${csa} वर्ग सेमी`, wrong: wrongsFrom(rng, csa, [(22 / 7) * r * r * h, 2 * (22 / 7) * r * (r + h), csa / 2, csa * 2]).map((x) => `${fixed(x, 2)} वर्ग सेमी`),
        sol: [`CSA = 2πrh`, `= 2 × 22/7 × ${r} × ${h} = ${fixed(csa, 2)} वर्ग सेमी`],
        fin: `${csa} वर्ग सेमी`, diff: 'Moderate', shortcut: 'बेलन CSA = 2πrh',
      });
    }),
  },
  {
    name: 'cone-volume', base: 'Hard',
    fn: (rng) => retry(() => {
      const r = R.pick(rng, [7, 14, 21]);
      const h = R.pick(rng, [24, 3, 6, 12, 9]); // h multiple of 3 for /3
      const vol = (1 / 3) * (22 / 7) * r * r * h;
      if (Math.abs(vol - Math.round(vol)) > 1e-9) throw 0;
      return mkQ(rng, {
        q: `एक शंकु (cone) की त्रिज्या ${r} सेमी और ऊँचाई ${h} सेमी है। उसका आयतन ज्ञात कीजिए (π = 22/7)।`,
        qEn: `Find the volume of a cone with radius ${r} cm and height ${h} cm (π = 22/7).`,
        ans: `${vol} घन सेमी`, wrong: wrongsFrom(rng, vol, [(22 / 7) * r * r * h, (1 / 3) * (22 / 7) * r * h, vol * 3, vol / 3]).map((x) => `${fixed(x, 2)} घन सेमी`),
        sol: [`शंकु का आयतन = (1/3)πr²h`, `= (1/3) × 22/7 × ${r}² × ${h}`, `= (1/3) × 22/7 × ${r * r} × ${h} = ${fixed(vol, 2)} घन सेमी`],
        fin: `${vol} घन सेमी`, diff: 'Hard', shortcut: 'शंकु आयतन = (1/3)πr²h',
      });
    }),
  },
  {
    name: 'sphere-volume', base: 'Hard',
    fn: (rng) => retry(() => {
      const r = R.pick(rng, [21, 42, 7, 14, 3.5]);
      const vol = (4 / 3) * (22 / 7) * r ** 3;
      if (Math.abs(vol - Math.round(vol)) > 1e-9) throw 0;
      return mkQ(rng, {
        q: `एक गोले (sphere) की त्रिज्या ${r} सेमी है। उसका आयतन ज्ञात कीजिए (π = 22/7)।`,
        qEn: `Find the volume of a sphere of radius ${r} cm (π = 22/7).`,
        ans: `${vol} घन सेमी`, wrong: wrongsFrom(rng, vol, [(4 / 3) * (22 / 7) * r * r, 4 * (22 / 7) * r * r, vol / 2, vol * 2]).map((x) => `${fixed(x, 2)} घन सेमी`),
        sol: [`गोले का आयतन = (4/3)πr³`, `= (4/3) × 22/7 × ${r}³`, `= (4/3) × 22/7 × ${fixed(r ** 3, 1)} = ${fixed(vol, 2)} घन सेमी`],
        fin: `${vol} घन सेमी`, diff: 'Hard',
      });
    }),
  },
  {
    name: 'trapezium-area', base: 'Hard',
    fn: (rng) => retry(() => {
      const a = R.pick(rng, [10, 12, 14, 16, 18, 20, 24]);
      const b = R.pick(rng, [6, 8, 10, 12, 14]);
      const h = R.pick(rng, [4, 5, 6, 8, 10, 12]);
      const area = ((a + b) / 2) * h;
      if (!Number.isInteger(area)) throw 0;
      return mkQ(rng, {
        q: `एक समलंब (trapezium) की समांतर भुजाएँ ${a} सेमी और ${b} सेमी हैं तथा ऊँचाई ${h} सेमी है। क्षेत्रफल ज्ञात कीजिए।`,
        qEn: `The parallel sides of a trapezium are ${a} cm and ${b} cm and its height is ${h} cm. Find its area.`,
        ans: `${area} वर्ग सेमी`, wrong: wrongsFrom(rng, area, [(a + b) * h, (a * b) / 2, a + b + h, area / 2]).map((x) => `${x} वर्ग सेमी`),
        sol: [`समलंब क्षेत्रफल = ½ × (समांतर भुजाओं का योग) × ऊँचाई`, `= ½ × (${a} + ${b}) × ${h}`, `= ½ × ${a + b} × ${h} = ${area} वर्ग सेमी`],
        fin: `${area} वर्ग सेमी`, diff: 'Hard',
      });
    }),
  },
  {
    name: 'area-change-side', base: 'Moderate',
    fn: (rng) => retry(() => {
      const p = R.pick(rng, [10, 20, 25, 50]);
      // square side increased by p% → area increases (2p + p²/100)%
      const inc = 2 * p + (p * p) / 100;
      return mkQ(rng, {
        q: `एक वर्ग की भुजा ${p}% बढ़ा दी जाती है। उसके क्षेत्रफल में प्रतिशत वृद्धि ज्ञात कीजिए।`,
        qEn: `The side of a square is increased by ${p}%. Find the percentage increase in its area.`,
        ans: pc(`${inc}%`), wrong: [pc(`${2 * p}%`), pc(`${inc + 5}%`), pc(`${p}%`), pc(`${inc / 2}%`)].filter((w) => w !== pc(`${inc}%`)).slice(0, 3),
        sol: [`मान लीजिए भुजा = 100 ⇒ क्षेत्रफल = 10000`, `नई भुजा = ${100 + p} ⇒ नया क्षेत्रफल = ${(100 + p) ** 2}`, `वृद्धि = ${(100 + p) ** 2} − 10000 = ${((100 + p) ** 2 - 10000)}`, `वृद्धि% = ${((100 + p) ** 2 - 10000) / 100}% = ${inc}%`],
        fin: pc(`${inc}%`), diff: 'Moderate', shortcut: 'क्षेत्रफल वृद्धि% = 2p + p²/100',
      });
    }),
  },
];

export const TRIGONOMETRY = [
  {
    name: 'std-values', base: 'Easy',
    fn: (rng) => retry(() => {
      const combos = [
        { e: ['sin 30°', 'cos 60°'], r: F(1) }, { e: ['tan 45°', 'cot 45°'], r: F(2) },
        { e: ['sin 45°', 'cos 45°'], r: { c: F(1), r: 2 } }, { e: ['sin 60°', 'cos 30°'], r: { c: F(1), r: 3 } },
        { e: ['tan 30°', 'tan 60°'], r: F(1) }, { e: ['sec 45°', 'cosec 45°'], r: F(4) },
        { e: ['sin 90°', 'cos 0°'], r: F(2) }, { e: ['cot 30°', 'tan 30°'], r: { c: F(4, 3), r: 3 } },
        { e: ['cos 60°', 'sec 60°'], r: F(1) }, { e: ['sin 30°', 'cosec 30°'], r: F(1) },
        { e: ['tan 45°', 'sec 60°'], r: F(3) }, { e: ['sin 30°', 'tan 45°'], r: F(3, 2) },
        { e: ['cos 30°', 'sin 30°'], r: { c: F(1), r: 3 } }, { e: ['cosec 30°', 'cot 45°'], r: F(3) },
      ];
      const it = R.pick(rng, combos);
      const [v1, v2] = [TRIG[it.e[0]], TRIG[it.e[1]]];
      const isFrac = it.r instanceof Frac;
      let val, valStr;
      if (isFrac) { val = it.r; valStr = val.str(); } else { val = it.r; valStr = surdStr(val); }
      const t1 = v1.r === 0 ? v1.c.str() : surdStr(v1);
      const t2 = v2.r === 0 ? v2.c.str() : surdStr(v2);
      // distractor pool of plausible exact values (deduped, correct removed)
      const pool = ['0', '1', '2', '3', '4', '1/2', '3/2', '5/2', '1/4', '3/4', '√2', '√3', '2√2', '2√3', '√3/2', '1/√2', '√2/2'];
      const wrongs = R.shuffle(rng, pool.filter((w) => w !== valStr)).slice(0, 3);
      return mkQ(rng, {
        q: `${it.e[0]} + ${it.e[1]} का मान ज्ञात कीजिए।`,
        qEn: `Find the value of ${it.e[0]} + ${it.e[1]}.`,
        ans: valStr, wrong: wrongs.filter((w) => w !== valStr).slice(0, 3),
        sol: [`${it.e[0]} = ${t1}`, `${it.e[1]} = ${t2}`, `योग = ${t1} + ${t2} = ${valStr}`],
        fin: valStr, diff: 'Easy',
        shortcut: 'मानक कोणों के मान याद रखें: sin30 = 1/2, cos60 = 1/2, tan45 = 1, √2 ≈ 1.414, √3 ≈ 1.732',
      });
    }),
  },
  {
    name: 'identity-sec2-tan2', base: 'Easy',
    fn: (rng) => retry(() => {
      const angle = R.pick(rng, ['30°', '45°', '60°']);
      const tanv = { '30°': F(1, 3).mul(F(1)) , '45°': F(1), '60°': F(1) }; // tan30=1/√3 handled as approx
      // use sec²θ − tan²θ = 1 for any θ — simple identity question
      return mkQ(rng, {
        q: `θ = ${angle} है। sec²θ − tan²θ का मान ज्ञात कीजिए।`,
        qEn: `If θ = ${angle}, find the value of sec²θ − tan²θ.`,
        ans: '1', wrong: ['0', '2', '√3', '1/2'].filter((w) => w !== '1').slice(0, 3),
        sol: [`यह एक मूलभूत सर्वसमिका (identity) है:`, `sec²θ − tan²θ = 1 (प्रत्येक θ के लिए, जहाँ परिभाषित हो)`, `अतः θ = ${angle} के लिए भी मान = 1`],
        fin: '1', diff: 'Easy', shortcut: 'sec²θ − tan²θ = 1; sin²θ + cos²θ = 1; cosec²θ − cot²θ = 1',
      });
    }),
  },
  {
    name: 'tan-given-find-sin', base: 'Moderate',
    fn: (rng) => retry(() => {
      const [a, b, c] = R.pick(rng, [[3, 4, 5], [5, 12, 13], [8, 15, 17], [7, 24, 25], [9, 40, 41], [20, 21, 29]]);
      const k = R.pick(rng, [1, 2]);
      const A = a * k, B = b * k, C = c * k;
      return mkQ(rng, {
        q: `यदि tanθ = ${A}/${B} है (θ न्यूनकोण), तो sinθ का मान ज्ञात कीजिए।`,
        qEn: `If tanθ = ${A}/${B} (θ acute), find the value of sinθ.`,
        ans: `${A}/${C}`, wrong: [`${B}/${C}`, `${A}/${B}`, `${C}/${B}`, `${B}/${A}`].filter((w) => w !== `${A}/${C}`).slice(0, 3),
        sol: [`tanθ = लंब/आधार = ${A}/${B}`, `लंब = ${A}, आधार = ${B}`, `कर्ण = √(${A}² + ${B}²) = √(${A * A} + ${B * B}) = ${C}`, `sinθ = लंब/कर्ण = ${A}/${C}`],
        fin: `${A}/${C}`, diff: 'Moderate', shortcut: 'tanθ = p/b दिए जाने पर पाइथागोरस से कर्ण निकालें।',
      });
    }),
  },
  {
    name: 'sin-given-find-cot', base: 'Moderate',
    fn: (rng) => retry(() => {
      const [a, b, c] = R.pick(rng, [[3, 4, 5], [5, 12, 13], [8, 15, 17], [7, 24, 25], [20, 21, 29]]);
      return mkQ(rng, {
        q: `यदि sinθ = ${a}/${c} है (θ न्यूनकोण), तो cotθ का मान ज्ञात कीजिए।`,
        qEn: `If sinθ = ${a}/${c} (θ acute), find the value of cotθ.`,
        ans: `${b}/${a}`, wrong: [`${a}/${b}`, `${c}/${b}`, `${b}/${c}`, `${a}/${c}`].filter((w) => w !== `${b}/${a}`).slice(0, 3),
        sol: [`sinθ = लंब/कर्ण = ${a}/${c} ⇒ लंब = ${a}, कर्ण = ${c}`, `आधार = √(${c}² − ${a}²) = √(${c * c} − ${a * a}) = ${b}`, `cotθ = आधार/लंब = ${b}/${a}`],
        fin: `${b}/${a}`, diff: 'Moderate',
      });
    }),
  },
  {
    name: 'sin2-plus-cos2', base: 'Easy',
    fn: (rng) => retry(() => {
      const angle = R.pick(rng, ['30°', '45°', '60°', '0°', '90°']);
      return mkQ(rng, {
        q: `θ = ${angle} पर sin²θ + cos²θ का मान क्या है?`,
        qEn: `What is the value of sin²θ + cos²θ at θ = ${angle}?`,
        ans: '1', wrong: ['0', '2', '1/2', '√2'].filter((w) => w !== '1').slice(0, 3),
        sol: [`मूलभूत सर्वसमिका: sin²θ + cos²θ = 1`, `यह प्रत्येक कोण θ के लिए सत्य है।`, `अतः θ = ${angle} पर मान = 1`],
        fin: '1', diff: 'Easy', shortcut: 'sin²θ + cos²θ = 1',
      });
    }),
  },
  {
    name: 'complementary', base: 'Moderate',
    fn: (rng) => retry(() => {
      const items = [
        { eq: 'sinθ = cos(90° − θ)', x: 'θ = 30°, sin30° = cos60°', q: 'यदि sinθ = cos60° है, तो θ का मान ज्ञात कीजिए।', ans: '30°', en: 'If sinθ = cos60°, find θ.' },
        { eq: 'cosθ = sin(90° − θ)', x: 'θ = 45°', q: 'यदि cosθ = sin45° है, तो θ का मान ज्ञात कीजिए।', ans: '45°', en: 'If cosθ = sin45°, find θ.' },
        { eq: 'tanθ = cot(90° − θ)', x: 'θ = 30°', q: 'यदि tanθ = cot60° है, तो θ का मान ज्ञात कीजिए।', ans: '30°', en: 'If tanθ = cot60°, find θ.' },
        { eq: 'tanθ = cot(90° − θ)', x: 'θ = 20°', q: 'यदि tanθ = cot20° है, तो θ का मान ज्ञात कीजिए।', ans: '70°', en: 'If tanθ = cot20°, find θ.' },
        { eq: 'sinθ = cos(90° − θ)', x: 'θ = 25°', q: 'यदि sinθ = cos65° है, तो θ का मान ज्ञात कीजिए।', ans: '25°', en: 'If sinθ = cos65°, find θ.' },
        { eq: 'secθ = cosec(90° − θ)', x: 'θ = 35°', q: 'यदि secθ = cosec55° है, तो θ का मान ज्ञात कीजिए।', ans: '35°', en: 'If secθ = cosec55°, find θ.' },
      ];
      const it = R.pick(rng, items);
      return mkQ(rng, {
        q: it.q, qEn: it.en,
        ans: it.ans, wrong: [`${90 - parseInt(it.ans)}°`, '45°', '60°', '90°'].filter((w) => w !== it.ans).slice(0, 3),
        sol: [`पूरक कोण सर्वसमिका: ${it.eq}`, `अतः θ = 90° − दिया गया कोण`, `θ = ${it.ans}`],
        fin: it.ans, diff: 'Moderate', shortcut: 'sinθ = cos(90−θ), tanθ = cot(90−θ), secθ = cosec(90−θ)',
      });
    }),
  },
  {
    name: 'height-distance-45', base: 'Moderate',
    fn: (rng) => retry(() => {
      const h = R.pick(rng, [10, 15, 20, 25, 30, 40, 50, 60]);
      return mkQ(rng, {
        q: `एक मीनार के पाद से ${h} मीटर की दूरी पर स्थित बिंदु से मीनार के शिखर का उन्नयन कोण (angle of elevation) 45° है। मीनार की ऊँचाई ज्ञात कीजिए।`,
        qEn: `The angle of elevation of the top of a tower from a point ${h} m from its foot is 45°. Find the height of the tower.`,
        ans: mtr(h), wrong: wrongsFrom(rng, h, [h * 2, Math.round(h * 1.732), h / 2, h + 5]).map((x) => mtr(x)),
        sol: [`tan45° = ऊँचाई/क्षैतिज दूरी`, `1 = ऊँचाई/${h}`, `ऊँचाई = ${h} मीटर`],
        fin: mtr(h), diff: 'Moderate', shortcut: '45° पर ऊँचाई = दूरी',
      });
    }),
  },
  {
    name: 'height-distance-30-60', base: 'Hard',
    fn: (rng) => retry(() => {
      const h = R.pick(rng, [10, 20, 30, 40, 50, 60, 80]);
      const use30 = R.bool(rng);
      // elevation 30° at distance d: tan30 = h/d => d = h√3
      const dStr = use30 ? `${h}√3` : `${h}/√3`;
      return mkQ(rng, {
        q: `एक मीनार की ऊँचाई ${h} मीटर है। मीनार के पाद से कितनी दूरी पर स्थित बिंदु से शिखर का उन्नयन कोण ${use30 ? '30°' : '60°'} होगा?`,
        qEn: `A tower is ${h} m high. At what distance from its foot will the angle of elevation of the top be ${use30 ? '30°' : '60°'}?`,
        ans: `${dStr} मीटर`, wrong: [`${h} मीटर`, `${use30 ? `${h}/√3` : `${h}√3`} मीटर`, `${h * 2} मीटर`, `${h}/2 मीटर`].filter((w) => w !== `${dStr} मीटर`).slice(0, 3),
        sol: [`tan${use30 ? '30°' : '60°'} = ऊँचाई/दूरी`, `${use30 ? '1/√3' : '√3'} = ${h}/दूरी`, `दूरी = ${h} × ${use30 ? '√3' : '1/√3'} = ${dStr} मीटर`],
        fin: `${dStr} मीटर`, diff: 'Hard', shortcut: 'tan30 = 1/√3, tan60 = √3, tan45 = 1',
      });
    }),
  },
  {
    name: 'trig-expression-square', base: 'Hard',
    fn: (rng) => retry(() => {
      const items = [
        { e: 'sin²30° + cos²60°', v: '1/2', sol: ['sin30° = 1/2 ⇒ sin²30° = 1/4', 'cos60° = 1/2 ⇒ cos²60° = 1/4', '1/4 + 1/4 = 1/2'] },
        { e: 'sin²45° + cos²45°', v: '1', sol: ['sin45° = cos45° = 1/√2', 'वर्ग करने पर प्रत्येक = 1/2', '1/2 + 1/2 = 1'] },
        { e: 'tan²45° + cot²45°', v: '2', sol: ['tan45° = 1, cot45° = 1', '1 + 1 = 2'] },
        { e: 'sin²60° + cos²30°', v: '3/2', sol: ['sin60° = cos30° = √3/2', 'वर्ग = 3/4 (प्रत्येक)', '3/4 + 3/4 = 3/2'] },
        { e: 'sec²45° − tan²45°', v: '1', sol: ['sec45° = √2 ⇒ sec²45° = 2', 'tan²45° = 1', '2 − 1 = 1'] },
        { e: 'cosec²30° − cot²30°', v: '1', sol: ['cosec30° = 2 ⇒ cosec²30° = 4', 'cot30° = √3 ⇒ cot²30° = 3', '4 − 3 = 1'] },
        { e: '2sin²30° + 2cos²60°', v: '1', sol: ['sin30° = cos60° = 1/2', '2 × 1/4 + 2 × 1/4 = 1/2 + 1/2 = 1'] },
      ];
      const it = R.pick(rng, items);
      return mkQ(rng, {
        q: `${it.e} का मान ज्ञात कीजिए।`,
        qEn: `Find the value of ${it.e}.`,
        ans: it.v, wrong: ['0', '1/2', '1', '2', '3/2', '3/4', '√2', '1/4'].filter((w) => w !== it.v).slice(0, 3),
        sol: it.sol.concat([`अतः मान = ${it.v}`]),
        fin: it.v, diff: 'Hard',
      });
    }),
  },
];
