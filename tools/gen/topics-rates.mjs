// Topic templates: Time & Work, Pipes & Cisterns, Time-Speed-Distance,
// Train Problems, Boat & Stream
import { R, gcd, lcm, F, mkQ, wrongsFrom, retry, hrs, dys, mins, kmph, mps, mtr, fixed } from './core.mjs';

// pairs (a,b) whose combined time ab/(a+b) is an integer
const WORK_PAIRS = [[10, 15], [12, 24], [15, 20], [20, 30], [6, 12], [8, 24], [9, 18], [10, 40], [5, 20], [12, 36], [18, 36], [30, 20], [24, 8], [40, 60], [60, 30], [14, 35], [21, 28], [36, 18]];
const WORK_TRIPLES = [[10, 12, 15], [12, 15, 20], [15, 20, 30], [20, 30, 60], [6, 8, 24], [10, 15, 30], [12, 20, 30], [24, 40, 60], [18, 24, 36], [8, 12, 24]];
const PIPE_TRIPLES = [[10, 15, 30], [12, 20, 30], [15, 20, 60], [20, 30, 12], [6, 12, 4], [10, 20, 5], [12, 15, 20], [20, 24, 30], [15, 30, 10], [8, 12, 24]];

export const TIME_WORK = [
  {
    name: 'two-workers', base: 'Easy',
    fn: (rng) => retry(() => {
      const [a, b] = R.pick(rng, WORK_PAIRS);
      const t = (a * b) / (a + b);
      return mkQ(rng, {
        q: `A एक कार्य को ${a} दिन में और B उसी कार्य को ${b} दिन में कर सकता है। दोनों मिलकर कार्य कितने दिन में पूरा करेंगे?`,
        qEn: `A can do a work in ${a} days and B in ${b} days. In how many days will they complete the work together?`,
        ans: dys(t), wrong: wrongsFrom(rng, t, [(a + b) / 2, a + b, t / 2, t + 1, Math.abs(a - b)]).map((x) => dys(x)),
        sol: [`A का 1 दिन का कार्य = 1/${a}`, `B का 1 दिन का कार्य = 1/${b}`, `साथ में 1 दिन का कार्य = 1/${a} + 1/${b} = ${F(1, a).add(F(1, b)).str()}`, `अभीष्ट समय = ${a}×${b}/(${a}+${b}) = ${t} दिन`],
        fin: dys(t), diff: 'Easy', shortcut: 'एक साथ: ab/(a+b) दिन',
      });
    }),
  },
  {
    name: 'three-workers', base: 'Moderate',
    fn: (rng) => retry(() => {
      const [a, b, c] = R.pick(rng, WORK_TRIPLES);
      const L = lcm(lcm(a, b), c);
      const rate = L / a + L / b + L / c;
      if (L % rate !== 0) throw 0;
      const t = L / rate;
      return mkQ(rng, {
        q: `A, B और C एक कार्य को क्रमशः ${a}, ${b} और ${c} दिन में कर सकते हैं। तीनों मिलकर कार्य कितने दिन में पूरा करेंगे?`,
        qEn: `A, B and C can do a work in ${a}, ${b} and ${c} days respectively. In how many days will they finish it together?`,
        ans: dys(t), wrong: wrongsFrom(rng, t, [(a + b + c) / 3, Math.min(a, b, c), t / 2, t + 1]).map((x) => dys(Number.isInteger(x) ? x : fixed(x, 1))),
        sol: [`कार्य का LCM = ${L} इकाई मान लें।`, `A = ${L}/${a} = ${L / a} इकाई/दिन, B = ${L / b} = ${L / b} इकाई/दिन, C = ${L / c} = ${L / c} इकाई/दिन`, `कुल = ${L / a} + ${L / b} + ${L / c} = ${rate} इकाई/दिन`, `समय = ${L}/${rate} = ${t} दिन`],
        fin: dys(t), diff: 'Moderate', shortcut: 'LCM पद्धति से दरें जोड़ें।',
      });
    }),
  },
  {
    name: 'together-and-one', base: 'Moderate',
    fn: (rng) => retry(() => {
      const [a, b] = R.pick(rng, WORK_PAIRS);
      const together = (a * b) / (a + b);
      return mkQ(rng, {
        q: `A और B मिलकर एक कार्य ${together} दिन में पूरा करते हैं। A अकेला वही कार्य ${a} दिन में करता है। B अकेला उस कार्य को कितने दिन में करेगा?`,
        qEn: `A and B together complete a work in ${together} days. A alone takes ${a} days. How long will B alone take?`,
        ans: dys(b), wrong: wrongsFrom(rng, b, [together, a - together, b / 2, b + together]).map((x) => dys(x)),
        sol: [`(A + B) का 1 दिन का कार्य = 1/${together}`, `A का 1 दिन का कार्य = 1/${a}`, `B का 1 दिन का कार्य = 1/${together} − 1/${a} = ${F(1, together).sub(F(1, a)).str()} = 1/${b}`, `B अकेला = ${b} दिन`],
        fin: dys(b), diff: 'Moderate',
      });
    }),
  },
  {
    name: 'efficiency-ratio', base: 'Moderate',
    fn: (rng) => retry(() => {
      const k = R.pick(rng, [2, 3]);
      const b = R.pick(rng, [6, 9, 10, 12, 15, 18, 20, 24, 30]);
      const a = b * k; // A is k times efficient → A takes 1/k time... careful: efficiency k ⇒ time 1/k
      const together = (a * b) / (a + b);
      if (!Number.isInteger(together)) throw 0;
      return mkQ(rng, {
        q: `A, B की तुलना में ${k} गुना कुशल (efficient) है और B अकेला एक कार्य ${b} दिन में करता है। A और B मिलकर वह कार्य कितने दिन में पूरा करेंगे?`,
        qEn: `A is ${k} times as efficient as B, and B alone can do a work in ${b} days. In how many days will A and B finish the work together?`,
        ans: dys(together), wrong: wrongsFrom(rng, together, [b / (k + 1), b, b / k, together + 1]).map((x) => dys(Number.isInteger(x) ? x : fixed(x, 1))),
        sol: [`B का समय = ${b} दिन ⇒ A का समय = ${b}/${k} = ${a / k} दिन`, `A का 1 दिन कार्य = ${k}/${b}, B का = 1/${b}`, `साथ में = (${k} + 1)/${b} = ${k + 1}/${b} प्रतिदिन`, `समय = ${b}/${k + 1} = ${together} दिन`],
        fin: dys(together), diff: 'Moderate', shortcut: 'कुशलता k गुना ⇒ समय 1/k गुना',
      });
    }),
  },
  {
    name: 'men-days', base: 'Moderate',
    fn: (rng) => retry(() => {
      const m1 = R.pick(rng, [12, 15, 16, 18, 20, 24, 25, 30]);
      const d1 = R.pick(rng, [12, 15, 16, 18, 20, 24, 30]);
      const m2 = R.pick(rng, [m1 + 4, m1 + 6, m1 + 10, Math.floor(m1 / 2), m1 * 2]);
      const d2 = (m1 * d1) / m2;
      if (!Number.isInteger(d2) || d2 === d1) throw 0;
      return mkQ(rng, {
        q: `${m1} आदमी एक कार्य ${d1} दिन में पूरा करते हैं। ${m2} आदमी वही कार्य कितने दिन में पूरा करेंगे?`,
        qEn: `${m1} men complete a work in ${d1} days. In how many days will ${m2} men complete the same work?`,
        ans: dys(d2), wrong: wrongsFrom(rng, d2, [d1, d2 * 2, Math.round(d2 / 2), d2 + 2]).map((x) => dys(x)),
        sol: [`M₁ × D₁ = M₂ × D₂ (कार्य समान)`, `${m1} × ${d1} = ${m2} × D₂`, `D₂ = ${m1 * d1}/${m2} = ${d2} दिन`],
        fin: dys(d2), diff: 'Moderate', shortcut: 'M₁D₁ = M₂D₂',
      });
    }),
  },
  {
    name: 'work-leave', base: 'Hard',
    fn: (rng) => retry(() => {
      const [a, b] = R.pick(rng, WORK_PAIRS);
      const t = (a * b) / (a + b);
      const x = R.int(rng, 1, Math.max(1, t - 1)); // days they work together
      const rem = 1 - x / t;
      const bTime = rem * b; // B alone finishes the rest
      if (!Number.isInteger(bTime) || x >= t) throw 0;
      return mkQ(rng, {
        q: `A और B मिलकर एक कार्य ${t} दिन में पूरा कर सकते हैं और A अकेला उसी कार्य को ${a} दिन में करता है। वे एक साथ कार्य शुरू करते हैं, परंतु ${x} दिन बाद A कार्य छोड़ देता है। शेष कार्य B अकेला कितने दिन में पूरा करेगा?`,
        qEn: `A and B together can do a work in ${t} days, and A alone can do it in ${a} days. They start together, but A leaves after ${x} days. In how many days will B alone finish the remaining work?`,
        ans: dys(bTime), wrong: wrongsFrom(rng, bTime, [t - x, b, Math.round((t - x) / 2), bTime + 1]).map((x2) => dys(x2)),
        sol: [`A और B की संयुक्त दर = 1/${t} प्रतिदिन`, `${x} दिन में पूर्ण कार्य = ${x}/${t} = ${F(x, t).str()}`, `शेष कार्य = 1 − ${F(x, t).str()} = ${F(t - x, t).str()}`, `B का अकेला समय = ${b} दिन (∵ A अकेला ${a} दिन में करता है, संयुक्त ${t} दिन)`, `शेष कार्य का समय = ${F(t - x, t).str()} × ${b} = ${bTime} दिन`],
        fin: dys(bTime), diff: 'Hard',
      });
    }),
  },
  {
    name: 'wages-share', base: 'Moderate',
    fn: (rng) => retry(() => {
      const [a, b] = R.pick(rng, WORK_PAIRS);
      const t = (a * b) / (a + b);
      const total = R.pick(rng, [1200, 1800, 2100, 2400, 3000, 3600, 4200, 4800, 5400, 6000, 7200, 8400]);
      const g = gcd(a, b);
      const shareB = (total * (1 / b)) / (1 / a + 1 / b);
      if (!Number.isInteger(shareB)) throw 0;
      return mkQ(rng, {
        q: `A एक कार्य ${a} दिन में तथा B ${b} दिन में करता है। दोनों मिलकर कार्य पूरा करते हैं और ${total} रुपये मज़दूरी मिलती है। B को कितनी मज़दूरी मिलेगी?`,
        qEn: `A does a work in ${a} days and B in ${b} days. They finish it together and receive ₹${total} as wages. How much does B receive?`,
        ans: `₹${shareB}`, wrong: wrongsFrom(rng, shareB, [total / 2, total - shareB, (total * a) / (a + b), shareB / 2]).map((x) => `₹${Math.round(x)}`),
        sol: [`मज़दूरी ∞ कार्य-दर (1/समय)`, `A : B की दरें = 1/${a} : 1/${b} = ${b} : ${a}`, `B का हिस्सा = ${total} × ${a}/(${a} + ${b}) = ₹${shareB}`],
        fin: `₹${shareB}`, diff: 'Moderate', shortcut: 'मज़दूरी अनुपात = दक्षता अनुपात',
      });
    }),
  },
];

export const PIPES_CISTERNS = [
  {
    name: 'two-fill-pipes', base: 'Easy',
    fn: (rng) => retry(() => {
      const [a, b] = R.pick(rng, WORK_PAIRS);
      const t = (a * b) / (a + b);
      return mkQ(rng, {
        q: `दो पाइप A और B एक टंकी को क्रमशः ${a} घंटे और ${b} घंटे में भरते हैं। दोनों पाइप एक साथ खोलने पर टंकी कितने घंटे में भरेगी?`,
        qEn: `Two pipes A and B can fill a tank in ${a} hours and ${b} hours respectively. How long will the tank take to fill if both pipes are opened together?`,
        ans: hrs(t), wrong: wrongsFrom(rng, t, [(a + b) / 2, a + b, t / 2, Math.abs(a - b)]).map((x) => hrs(Number.isInteger(x) ? x : fixed(x, 1))),
        sol: [`A की दर = 1/${a} टंकी/घंटा`, `B की दर = 1/${b} टंकी/घंटा`, `संयुक्त दर = 1/${a} + 1/${b} = ${F(1, a).add(F(1, b)).str()} टंकी/घंटा`, `समय = ${a}×${b}/(${a}+${b}) = ${t} घंटे`],
        fin: hrs(t), diff: 'Easy', shortcut: 'दोनों पाइप: ab/(a+b)',
      });
    }),
  },
  {
    name: 'fill-and-drain', base: 'Moderate',
    fn: (rng) => retry(() => {
      const [f1, f2, e] = R.pick(rng, PIPE_TRIPLES);
      const L = lcm(lcm(f1, f2), e);
      const rate = L / f1 + L / f2 - L / e;
      if (rate <= 0 || L % rate !== 0) throw 0;
      const t = L / rate;
      return mkQ(rng, {
        q: `पाइप A और B एक टंकी को क्रमशः ${f1} और ${f2} घंटे में भरते हैं, जबकि तीसरा पाइप C उसे ${e} घंटे में खाली करता है। तीनों पाइप एक साथ खोलने पर टंकी कितने घंटे में भरेगी?`,
        qEn: `Pipes A and B fill a tank in ${f1} and ${f2} hours, while pipe C empties it in ${e} hours. If all three are opened together, how long will the tank take to fill?`,
        ans: hrs(t), wrong: wrongsFrom(rng, t, [(f1 * f2) / (f1 + f2), e, t / 2, t + 1]).map((x) => hrs(Number.isInteger(x) ? x : fixed(x, 1))),
        sol: [`टंकी = ${L} इकाई मानें।`, `A = +${L / f1}, B = +${L / f2}, C = −${L / e} इकाई/घंटा`, `शुद्ध दर = ${L / f1} + ${L / f2} − ${L / e} = ${rate} इकाई/घंटा`, `समय = ${L}/${rate} = ${t} घंटे`],
        fin: hrs(t), diff: 'Moderate', shortcut: 'शुद्ध दर = भरने की दर − खाली करने की दर',
      });
    }),
  },
  {
    name: 'one-fills-one-empties', base: 'Easy',
    fn: (rng) => retry(() => {
      const a = R.pick(rng, [4, 6, 8, 10, 12, 15]);
      const b = a + R.pick(rng, [2, 3, 4, 6]);
      const t = (a * b) / (b - a);
      if (!Number.isInteger(t)) throw 0;
      return mkQ(rng, {
        q: `एक पाइप टंकी को ${a} घंटे में भरता है और दूसरा पाइप उसे ${b} घंटे में खाली करता है। दोनों एक साथ खुले होने पर खाली टंकी कितने घंटे में भरेगी?`,
        qEn: `One pipe fills a tank in ${a} hours and another empties it in ${b} hours. If both are opened together, how long will the empty tank take to fill?`,
        ans: hrs(t), wrong: wrongsFrom(rng, t, [(a * b) / (a + b), b, t / 2, b - a]).map((x) => hrs(Number.isInteger(x) ? x : fixed(x, 1))),
        sol: [`भरने की दर = 1/${a}, खाली करने की दर = 1/${b}`, `शुद्ध दर = 1/${a} − 1/${b} = ${F(1, a).sub(F(1, b)).str()} टंकी/घंटा`, `समय = ${a}×${b}/(${b} − ${a}) = ${t} घंटे`],
        fin: hrs(t), diff: 'Easy',
      });
    }),
  },
  {
    name: 'pipes-together-find-one', base: 'Moderate',
    fn: (rng) => retry(() => {
      const [a, b] = R.pick(rng, WORK_PAIRS);
      const t = (a * b) / (a + b);
      return mkQ(rng, {
        q: `दो पाइप एक साथ खोलने पर टंकी ${t} घंटे में भर जाती है। यदि एक पाइप अकेला टंकी ${a} घंटे में भरता है, तो दूसरा पाइप अकेला कितने घंटे में भरेगा?`,
        qEn: `Two pipes together fill a tank in ${t} hours. If one pipe alone fills it in ${a} hours, how long will the other pipe take alone?`,
        ans: hrs(b), wrong: wrongsFrom(rng, b, [t, a - t, b / 2, b + t]).map((x) => hrs(x)),
        sol: [`संयुक्त दर = 1/${t}`, `पहले पाइप की दर = 1/${a}`, `दूसरे पाइप की दर = 1/${t} − 1/${a} = ${F(1, t).sub(F(1, a)).str()} = 1/${b}`, `दूसरा पाइप = ${b} घंटे`],
        fin: hrs(b), diff: 'Moderate',
      });
    }),
  },
  {
    name: 'pipe-late-close', base: 'Hard',
    fn: (rng) => retry(() => {
      const [a, b] = R.pick(rng, WORK_PAIRS);
      const t = (a * b) / (a + b);
      const x = R.int(rng, 1, Math.max(1, t - 1));
      // both open x hrs, then B closed; A finishes
      const doneBoth = x / t;
      const rem = 1 - doneBoth;
      const aTime = rem * a;
      if (!Number.isInteger(aTime) || x >= t) throw 0;
      const total = x + aTime;
      return mkQ(rng, {
        q: `दो पाइप A और B एक साथ खोले जाते हैं और एक साथ टंकी ${t} घंटे में भर सकते हैं। ${x} घंटे बाद पाइप B बंद कर दिया जाता है, जिसके बाद A अकेला शेष टंकी भरता है (A अकेला ${a} घंटे में भरता है)। टंकी भरने में कुल कितना समय लगा?`,
        qEn: `Pipes A and B together can fill a tank in ${t} hours. After ${x} hours together, B is closed and A (which alone fills in ${a} hours) fills the rest. What is the total time taken to fill the tank?`,
        ans: hrs(total), wrong: wrongsFrom(rng, total, [t, x + a, aTime, total + 1]).map((x2) => hrs(x2)),
        sol: [`संयुक्त दर = 1/${t}; ${x} घंटे में भरा = ${x}/${t} = ${F(x, t).str()}`, `शेष = 1 − ${F(x, t).str()} = ${F(t - x, t).str()}`, `A की दर = 1/${a} ⇒ शेष समय = ${F(t - x, t).str()} × ${a} = ${aTime} घंटे`, `कुल समय = ${x} + ${aTime} = ${total} घंटे`],
        fin: hrs(total), diff: 'Hard',
      });
    }),
  },
];

export const TIME_SPEED_DISTANCE = [
  {
    name: 'basic-distance', base: 'Easy',
    fn: (rng) => retry(() => {
      const s = R.pick(rng, [36, 45, 54, 60, 72, 90]);
      const t = R.pick(rng, [2, 3, 4, 5, 6]);
      const d = s * t;
      return mkQ(rng, {
        q: `एक कार ${s} किमी/घंटा की एक समान चाल से ${t} घंटे चलती है। उसके द्वारा तय की गई दूरी ज्ञात कीजिए।`,
        qEn: `A car travels at a uniform speed of ${s} km/h for ${t} hours. Find the distance covered.`,
        ans: `${d} किमी`, wrong: wrongsFrom(rng, d, [s + t, d / 2, s * 2, d + s]).map((x) => `${x} किमी`),
        sol: [`दूरी = चाल × समय`, `दूरी = ${s} × ${t} = ${d} किमी`],
        fin: `${d} किमी`, diff: 'Easy', shortcut: 'दूरी = चाल × समय',
      });
    }),
  },
  {
    name: 'avg-speed-equal-dist', base: 'Moderate',
    fn: (rng) => retry(() => {
      const s1 = R.pick(rng, [20, 30, 40, 45, 60]);
      const s2 = R.pick(rng, [60, 90, 120, 80, 30, 20].filter((x) => x !== s1));
      const avg = (2 * s1 * s2) / (s1 + s2);
      if (!Number.isInteger(avg)) throw 0;
      return mkQ(rng, {
        q: `एक व्यक्ति समान दूरी के लिए जाते समय ${s1} किमी/घंटा और लौटते समय ${s2} किमी/घंटा की चाल से चलता है। पूरी यात्रा की औसत चाल ज्ञात कीजिए।`,
        qEn: `A person travels a certain distance at ${s1} km/h and returns at ${s2} km/h. Find the average speed for the whole journey.`,
        ans: kmph(avg), wrong: wrongsFrom(rng, avg, [(s1 + s2) / 2, s1, s2, avg + 5]).map((x) => kmph(Number.isInteger(x) ? x : fixed(x, 2))),
        sol: [`समान दूरी पर औसत चाल = 2s₁s₂/(s₁ + s2)`, `= 2 × ${s1} × ${s2}/(${s1} + ${s2})`, `= ${2 * s1 * s2}/${s1 + s2} = ${avg} किमी/घंटा`],
        fin: kmph(avg), diff: 'Moderate', shortcut: 'औसत चाल = 2ab/(a+b) (समान दूरी)',
      });
    }),
  },
  {
    name: 'speed-change-time', base: 'Hard',
    fn: (rng) => retry(() => {
      // walking at (v+a): t1 early; at (v): t2 late; find distance
      const v = R.pick(rng, [3, 4, 5, 6]);
      const a = R.pick(rng, [1, 2]);
      const diffMin = R.pick(rng, [20, 30, 40, 60]);
      const d = (diffMin / 60) / (1 / v - 1 / (v + a));
      if (!Number.isInteger(d) || d <= 0) throw 0;
      const early = (d / v - d / (v + a)) * 60;
      return mkQ(rng, {
        q: `एक व्यक्ति किसी स्थान तक पहुँचने के लिए ${v + a} किमी/घंटा की चाल से चलता है और नियत समय से ${Math.round(early / 2)} मिनट पहले पहुँच जाता है। यदि वह ${v} किमी/घंटा से चलता तो ${Math.round(early / 2)} मिनट देर से पहुँचता। स्थान की दूरी ज्ञात कीजिए।`,
        qEn: `A person walking at ${v + a} km/h reaches his destination ${Math.round(early / 2)} minutes early; walking at ${v} km/h he would be ${Math.round(early / 2)} minutes late. Find the distance.`,
        ans: `${d} किमी`, wrong: wrongsFrom(rng, d, [v * (diffMin / 60), d / 2, d + v, (v + a) * 2]).map((x) => `${fixed(x, 1)} किमी`),
        sol: [`समय अंतर = ${Math.round(early / 2)} + ${Math.round(early / 2)} = ${Math.round(early)} मिनट = ${fixed(early / 60, 3)} घंटे`, `d/${v} − d/${v + a} = ${fixed(early / 60, 3)}`, `d × (${v + a} − ${v})/(${v} × ${v + a}) = ${fixed(early / 60, 3)}`, `d = ${fixed(early / 60, 3)} × ${v * (v + a)}/${a} = ${d} किमी`],
        fin: `${d} किमी`, diff: 'Hard',
      });
    }),
  },
  {
    name: 'two-persons-meet', base: 'Moderate',
    fn: (rng) => retry(() => {
      const s1 = R.pick(rng, [3, 4, 5, 6, 8]);
      const s2 = R.pick(rng, [4, 5, 6, 7, 9, 10].filter((x) => x !== s1));
      const d = (s1 + s2) * R.pick(rng, [2, 3, 4, 5, 6, 8]);
      const t = d / (s1 + s2);
      return mkQ(rng, {
        q: `दो स्थानों A और B के बीच की दूरी ${d} किमी है। दो व्यक्ति एक साथ क्रमशः ${s1} किमी/घंटा और ${s2} किमी/घंटा की चाल से A और B से एक-दूसरे की ओर चलते हैं। वे कितने घंटे बाद मिलेंगे?`,
        qEn: `Two places A and B are ${d} km apart. Two persons start simultaneously from A and B towards each other at ${s1} km/h and ${s2} km/h. After how many hours will they meet?`,
        ans: hrs(t), wrong: wrongsFrom(rng, t, [d / s1, d / s2, t / 2, t + 1]).map((x) => hrs(Number.isInteger(x) ? x : fixed(x, 1))),
        sol: [`सापेक्ष चाल = ${s1} + ${s2} = ${s1 + s2} किमी/घंटा (विपरीत दिशाएँ)`, `मिलने का समय = ${d}/${s1 + s2} = ${t} घंटे`],
        fin: hrs(t), diff: 'Moderate', shortcut: 'मिलने का समय = दूरी ÷ (चालों का योग)',
      });
    }),
  },
  {
    name: 'catch-up', base: 'Moderate',
    fn: (rng) => retry(() => {
      const s1 = R.pick(rng, [10, 12, 15, 18, 20]);
      const s2 = s1 - R.pick(rng, [2, 3, 5]);
      const headStart = R.pick(rng, [1, 2, 3]); // hours
      const gap = s2 * headStart;
      const t = gap / (s1 - s2);
      if (!Number.isInteger(t)) throw 0;
      return mkQ(rng, {
        q: `एक चोर ${s2} किमी/घंटा की चाल से चलता है। ${headStart} घंटे बाद पुलिस ${s1} किमी/घंटा की चाल से उसका पीछा करती है। पुलिस चोर को कितने घंटे में पकड़ लेगी? (पीछा शुरू करने के बाद से)`,
        qEn: `A thief walks at ${s2} km/h. After ${headStart} hours, the police chase him at ${s1} km/h. In how many hours after starting will the police catch the thief?`,
        ans: hrs(t), wrong: wrongsFrom(rng, t, [headStart, (s2 * headStart) / s1, t / 2, t + 1]).map((x) => hrs(Number.isInteger(x) ? x : fixed(x, 1))),
        sol: [`${headStart} घंटे में चोर आगे निकल गया = ${s2} × ${headStart} = ${gap} किमी`, `सापेक्ष चाल = ${s1} − ${s2} = ${s1 - s2} किमी/घंटा`, `पकड़ने का समय = ${gap}/${s1 - s2} = ${t} घंटे`],
        fin: hrs(t), diff: 'Moderate', shortcut: 'पीछा: समय = अंतर ÷ चालों का अंतर',
      });
    }),
  },
  {
    name: 'find-speed', base: 'Easy',
    fn: (rng) => retry(() => {
      const s = R.pick(rng, [40, 45, 50, 54, 60, 72, 80, 90]);
      const t = R.pick(rng, [2, 3, 4, 5, 6]);
      const d = s * t;
      return mkQ(rng, {
        q: `एक बस ${d} किमी की दूरी ${t} घंटे में तय करती है। बस की चाल ज्ञात कीजिए।`,
        qEn: `A bus covers a distance of ${d} km in ${t} hours. Find its speed.`,
        ans: kmph(s), wrong: wrongsFrom(rng, s, [d / (t + 1), s / 2, s + 10, t * 10]).map((x) => kmph(Number.isInteger(x) ? x : fixed(x, 1))),
        sol: [`चाल = दूरी/समय`, `चाल = ${d}/${t} = ${s} किमी/घंटा`],
        fin: kmph(s), diff: 'Easy',
      });
    }),
  },
];

export const TRAINS = [
  {
    name: 'train-pole', base: 'Easy',
    fn: (rng) => retry(() => {
      const s = R.pick(rng, [36, 54, 72, 90]); // km/h → m/s integer
      const ms = (s * 5) / 18;
      const t = R.pick(rng, [8, 10, 12, 15, 18, 20, 24]);
      const len = ms * t;
      return mkQ(rng, {
        q: `एक ${len} मीटर लंबी रेलगाड़ी ${s} किमी/घंटा की चाल से एक खंभे को कितने सेकंड में पार करेगी?`,
        qEn: `How long will a train ${len} m long take to pass a pole at ${s} km/h?`,
        ans: `${t} सेकंड`, wrong: wrongsFrom(rng, t, [len / s, t / 2, t + 5, Math.round(len / 100)]).map((x) => `${fixed(x, 1)} सेकंड`),
        sol: [`चाल = ${s} किमी/घंटा = ${s} × 5/18 = ${ms} मी/से`, `खंभा बिंदु है ⇒ तय दूरी = रेलगाड़ी की लंबाई = ${len} मी`, `समय = ${len}/${ms} = ${t} सेकंड`],
        fin: `${t} सेकंड`, diff: 'Easy', shortcut: 'किमी/घंटा → मी/से: × 5/18',
      });
    }),
  },
  {
    name: 'train-pole-find-length', base: 'Easy',
    fn: (rng) => retry(() => {
      const s = R.pick(rng, [36, 54, 72, 90]);
      const ms = (s * 5) / 18;
      const t = R.pick(rng, [10, 12, 15, 18, 20, 24, 30]);
      const len = ms * t;
      return mkQ(rng, {
        q: `${s} किमी/घंटा की चाल से चलती एक रेलगाड़ी एक खंभे को ${t} सेकंड में पार करती है। रेलगाड़ी की लंबाई ज्ञात कीजिए।`,
        qEn: `A train running at ${s} km/h passes a pole in ${t} seconds. Find the length of the train.`,
        ans: mtr(len), wrong: wrongsFrom(rng, len, [len / 2, s * t, len + 50, ms]).map((x) => `${Math.round(x)} मीटर`),
        sol: [`चाल = ${s} × 5/18 = ${ms} मी/से`, `लंबाई = चाल × समय = ${ms} × ${t} = ${len} मीटर`],
        fin: mtr(len), diff: 'Easy',
      });
    }),
  },
  {
    name: 'train-platform', base: 'Moderate',
    fn: (rng) => retry(() => {
      const s = R.pick(rng, [36, 54, 72, 90]);
      const ms = (s * 5) / 18;
      const t = R.pick(rng, [15, 20, 24, 25, 30, 36, 40]);
      const total = ms * t;
      const train = R.pick(rng, [100, 120, 150, 180, 200, 240]);
      const platform = total - train;
      if (platform <= 0) throw 0;
      return mkQ(rng, {
        q: `एक ${train} मीटर लंबी रेलगाड़ी ${s} किमी/घंटा की चाल से चलकर एक प्लेटफार्म को ${t} सेकंड में पार करती है। प्लेटफार्म की लंबाई ज्ञात कीजिए।`,
        qEn: `A ${train} m long train running at ${s} km/h crosses a platform in ${t} seconds. Find the length of the platform.`,
        ans: mtr(platform), wrong: wrongsFrom(rng, platform, [total, train, platform + 50, platform / 2]).map((x) => `${Math.round(x)} मीटर`),
        sol: [`चाल = ${ms} मी/से`, `कुल तय दूरी = ${ms} × ${t} = ${total} मीटर`, `कुल दूरी = रेलगाड़ी + प्लेटफार्म`, `प्लेटफार्म = ${total} − ${train} = ${platform} मीटर`],
        fin: mtr(platform), diff: 'Moderate', shortcut: 'प्लेटफार्म = चाल×समय − रेलगाड़ी की लंबाई',
      });
    }),
  },
  {
    name: 'two-trains-opposite', base: 'Moderate',
    fn: (rng) => retry(() => {
      const s1 = R.pick(rng, [36, 54, 72]);
      const s2 = R.pick(rng, [36, 45, 54, 72]);
      const w1 = (s1 * 5) / 18, w2 = (s2 * 5) / 18;
      const t = R.pick(rng, [6, 8, 10, 12, 15]);
      const total = (w1 + w2) * t;
      const l1 = R.pick(rng, [80, 100, 120, 140, 150]);
      const l2 = total - l1;
      if (l2 < 50) throw 0;
      return mkQ(rng, {
        q: `${l1} मीटर और ${l2} मीटर लंबी दो रेलगाड़ियाँ क्रमशः ${s1} किमी/घंटा और ${s2} किमी/घंटा की चाल से एक-दूसरे के विपरीत दिशा में चल रही हैं। वे एक-दूसरे को कितने सेकंड में पार करेंगी?`,
        qEn: `Two trains of lengths ${l1} m and ${l2} m run at ${s1} km/h and ${s2} km/h in opposite directions. In how many seconds will they cross each other?`,
        ans: `${t} सेकंड`, wrong: wrongsFrom(rng, t, [(l1 + l2) / Math.abs(w1 - w2), t / 2, t * 2, t + 3]).map((x) => `${fixed(x, 1)} सेकंड`),
        sol: [`सापेक्ष चाल = ${s1} + ${s2} = ${s1 + s2} किमी/घंटा = ${w1 + w2} मी/से`, `कुल लंबाई = ${l1} + ${l2} = ${total} मीटर`, `समय = ${total}/${w1 + w2} = ${t} सेकंड`],
        fin: `${t} सेकंड`, diff: 'Moderate', shortcut: 'विपरीत दिशा: चालें जुड़ती हैं',
      });
    }),
  },
  {
    name: 'two-trains-same-dir', base: 'Hard',
    fn: (rng) => retry(() => {
      const s1 = R.pick(rng, [54, 72, 90]);
      const s2 = s1 - R.pick(rng, [18, 36]);
      const w1 = (s1 * 5) / 18, w2 = (s2 * 5) / 18;
      const rel = w1 - w2;
      const t = R.pick(rng, [30, 40, 45, 60]);
      const total = rel * t;
      const l1 = R.pick(rng, [100, 120, 150, 200]);
      const l2 = total - l1;
      if (l2 < 80) throw 0;
      return mkQ(rng, {
        q: `${l1} मीटर और ${l2} मीटर लंबी दो रेलगाड़ियाँ क्रमशः ${s1} किमी/घंटा और ${s2} किमी/घंटा की चाल से एक ही दिशा में समांतर पटरियों पर चल रही हैं। तेज़ रेलगाड़ी धीमी को कितने सेकंड में पार करेगी?`,
        qEn: `Two trains of lengths ${l1} m and ${l2} m run at ${s1} km/h and ${s2} km/h in the same direction. How long will the faster train take to pass the slower one?`,
        ans: `${t} सेकंड`, wrong: wrongsFrom(rng, t, [(l1 + l2) / (w1 + w2), t / 2, t * 2]).map((x) => `${fixed(x, 1)} सेकंड`),
        sol: [`सापेक्ष चाल = ${s1} − ${s2} = ${s1 - s2} किमी/घंटा = ${rel} मी/से`, `कुल लंबाई = ${l1} + ${l2} = ${total} मीटर`, `समय = ${total}/${rel} = ${t} सेकंड`],
        fin: `${t} सेकंड`, diff: 'Hard', shortcut: 'समान दिशा: चालों का अंतर',
      });
    }),
  },
  {
    name: 'train-speed-from-pole', base: 'Moderate',
    fn: (rng) => retry(() => {
      const s = R.pick(rng, [36, 45, 54, 63, 72, 90]);
      const ms = (s * 5) / 18;
      const t = R.pick(rng, [9, 10, 12, 15, 18]);
      const len = ms * t;
      if (len < 100) throw 0;
      return mkQ(rng, {
        q: `एक ${len} मीटर लंबी रेलगाड़ी एक खंभे को ${t} सेकंड में पार करती है। रेलगाड़ी की चाल किमी/घंटा में ज्ञात कीजिए।`,
        qEn: `A train ${len} m long passes a pole in ${t} seconds. Find its speed in km/h.`,
        ans: kmph(s), wrong: wrongsFrom(rng, s, [s / 2, s * 2, s + 9, ms]).map((x) => kmph(Number.isInteger(x) ? x : fixed(x, 1))),
        sol: [`चाल = ${len}/${t} = ${ms} मी/से`, `किमी/घंटा में = ${ms} × 18/5 = ${s} किमी/घंटा`],
        fin: kmph(s), diff: 'Moderate', shortcut: 'मी/से → किमी/घंटा: × 18/5',
      });
    }),
  },
];

export const BOAT_STREAM = [
  {
    name: 'boat-find-speeds', base: 'Easy',
    fn: (rng) => retry(() => {
      const u = R.pick(rng, [8, 10, 12, 15, 16, 18, 20]);
      const v = R.pick(rng, [2, 3, 4, 5]);
      const d = u + v, up = u - v;
      return mkQ(rng, {
        q: `एक नाव की धारा के साथ (downstream) चाल ${d} किमी/घंटा और धारा के विपरीत (upstream) चाल ${up} किमी/घंटा है। स्थिर जल में नाव की चाल ज्ञात कीजिए।`,
        qEn: `A boat's downstream speed is ${d} km/h and upstream speed is ${up} km/h. Find the speed of the boat in still water.`,
        ans: kmph(u), wrong: wrongsFrom(rng, u, [v, d, up, (d + up) / 4]).map((x) => kmph(Number.isInteger(x) ? x : fixed(x, 1))),
        sol: [`स्थिर जल की चाल = (downstream + upstream)/2`, `= (${d} + ${up})/2 = ${d + up}/2 = ${u} किमी/घंटा`],
        fin: kmph(u), diff: 'Easy', shortcut: 'नाव = (D + U)/2, धारा = (D − U)/2',
      });
    }),
  },
  {
    name: 'stream-find-speed', base: 'Easy',
    fn: (rng) => retry(() => {
      const u = R.pick(rng, [8, 10, 12, 15, 16, 18, 20, 24]);
      const v = R.pick(rng, [2, 3, 4, 5, 6]);
      const d = u + v, up = u - v;
      return mkQ(rng, {
        q: `एक नाव की धारा के साथ चाल ${d} किमी/घंटा तथा धारा के विपरीत चाल ${up} किमी/घंटा है। धारा की चाल ज्ञात कीजिए।`,
        qEn: `A boat's downstream speed is ${d} km/h and upstream speed is ${up} km/h. Find the speed of the stream.`,
        ans: kmph(v), wrong: wrongsFrom(rng, v, [u, d, up, (d + up) / 2]).map((x) => kmph(Number.isInteger(x) ? x : fixed(x, 1))),
        sol: [`धारा की चाल = (downstream − upstream)/2`, `= (${d} − ${up})/2 = ${2 * v}/2 = ${v} किमी/घंटा`],
        fin: kmph(v), diff: 'Easy',
      });
    }),
  },
  {
    name: 'boat-distance-time', base: 'Moderate',
    fn: (rng) => retry(() => {
      const u = R.pick(rng, [6, 8, 9, 10, 12]);
      const v = R.pick(rng, [2, 3, 4]);
      const d = u + v;
      const dist = d * R.pick(rng, [2, 3, 4]);
      const t = dist / d;
      return mkQ(rng, {
        q: `एक नाव स्थिर जल में ${u} किमी/घंटा से चलती है और धारा की चाल ${v} किमी/घंटा है। ${dist} किमी धारा के साथ जाने में नाव को कितना समय लगेगा?`,
        qEn: `A boat travels at ${u} km/h in still water and the stream flows at ${v} km/h. How long will it take to go ${dist} km downstream?`,
        ans: hrs(t), wrong: wrongsFrom(rng, t, [dist / u, dist / (u - v), t / 2, t + 1]).map((x) => hrs(Number.isInteger(x) ? x : fixed(x, 1))),
        sol: [`धारा के साथ चाल = ${u} + ${v} = ${d} किमी/घंटा`, `समय = ${dist}/${d} = ${t} घंटे`],
        fin: hrs(t), diff: 'Moderate',
      });
    }),
  },
  {
    name: 'boat-upstream-time', base: 'Moderate',
    fn: (rng) => retry(() => {
      const u = R.pick(rng, [8, 10, 12, 15]);
      const v = R.pick(rng, [2, 3, 5]);
      const up = u - v;
      const dist = up * R.pick(rng, [2, 3, 4]);
      const t = dist / up;
      return mkQ(rng, {
        q: `स्थिर जल में नाव की चाल ${u} किमी/घंटा तथा धारा की चाल ${v} किमी/घंटा है। ${dist} किमी धारा के विपरीत जाने में कितना समय लगेगा?`,
        qEn: `The speed of a boat in still water is ${u} km/h and the stream speed is ${v} km/h. How long will it take to travel ${dist} km upstream?`,
        ans: hrs(t), wrong: wrongsFrom(rng, t, [dist / u, dist / (u + v), t / 2, t + 1]).map((x) => hrs(Number.isInteger(x) ? x : fixed(x, 1))),
        sol: [`धारा के विपरीत चाल = ${u} − ${v} = ${up} किमी/घंटा`, `समय = ${dist}/${up} = ${t} घंटे`],
        fin: hrs(t), diff: 'Moderate',
      });
    }),
  },
  {
    name: 'boat-equal-distance', base: 'Hard',
    fn: (rng) => retry(() => {
      const u = R.pick(rng, [6, 9, 12]);
      const v = R.pick(rng, [3]);
      const d = u + v, up = u - v;
      const dist = lcm(d, up) * R.pick(rng, [1, 2]);
      const total = dist / d + dist / up;
      const avg = (2 * dist) / total;
      const t1 = dist / d, t2 = dist / up;
      return mkQ(rng, {
        q: `एक नाव स्थिर जल में ${u} किमी/घंटा से चलती है। धारा की चाल ${v} किमी/घंटा है। नाव ${dist} किमी धारा के साथ जाकर उतनी ही दूरी धारा के विपरीत लौटती है। कुल यात्रा में नाव की औसत चाल ज्ञात कीजिए।`,
        qEn: `A boat travels ${u} km/h in still water; the stream flows at ${v} km/h. It goes ${dist} km downstream and returns the same distance. Find the average speed for the whole trip.`,
        ans: kmph(avg), wrong: wrongsFrom(rng, avg, [u, (d + up) / 2, d, up]).map((x) => kmph(Number.isInteger(x) ? x : fixed(x, 2))),
        sol: [`धारा के साथ चाल = ${d} किमी/घंटा, समय = ${dist}/${d} = ${t1} घंटे`, `धारा के विपरीत चाल = ${up} किमी/घंटा, समय = ${dist}/${up} = ${t2} घंटे`, `कुल दूरी = ${2 * dist} किमी, कुल समय = ${t1} + ${t2} = ${total} घंटे`, `औसत चाल = ${2 * dist}/${total} = ${avg} किमी/घंटा`],
        fin: kmph(avg), diff: 'Hard', shortcut: 'औसत चाल = 2DU/(D²... ) — कुल दूरी ÷ कुल समय से ज्ञात करें',
      });
    }),
  },
];
