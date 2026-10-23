// Topic templates: Ratio & Proportion, Average, Age Problems, Statistics
import { R, gcd, F, mkQ, wrongsFrom, retry, inr, rs, pc, yr, fixed } from './core.mjs';

export const RATIO_PROPORTION = [
  {
    name: 'divide-money', base: 'Easy',
    fn: (rng) => retry(() => {
      const a = R.int(rng, 2, 7), b = R.int(rng, 2, 8), c = R.int(rng, 2, 9);
      const k = R.pick(rng, [40, 60, 80, 100, 120, 150, 200, 240, 300, 400, 500]);
      const total = (a + b + c) * k;
      const shareA = a * k;
      return mkQ(rng, {
        q: `${rs(total)} को A, B और C में ${a} : ${b} : ${c} के अनुपात में बाँटा जाता है। A को कितना मिलेगा?`,
        qEn: `₹${total} is divided among A, B and C in the ratio ${a}:${b}:${c}. Find A's share.`,
        ans: rs(shareA), wrong: wrongsFrom(rng, shareA, [total - shareA, (total * b) / (a + b + c), total / 3, k]).map((x) => rs(Math.round(x))),
        sol: [`कुल भाग = ${a} + ${b} + ${c} = ${a + b + c}`, `एक भाग = ${inr(total)} ÷ ${a + b + c} = ${inr(k)}`, `A का हिस्सा = ${a} × ${inr(k)} = ${inr(shareA)}`],
        fin: rs(shareA), diff: 'Easy',
      });
    }),
  },
  {
    name: 'combined-ratio', base: 'Moderate',
    fn: (rng) => retry(() => {
      const a = R.int(rng, 2, 5), n = R.int(rng, 2, 6);
      const b = R.int(rng, 2, 7), p = R.int(rng, 2, 6), c = R.int(rng, 2, 7);
      // a:b = m:n, b:c = p:q -> make b common: b = lcm(n,p)
      const bCommon = (n * p) / gcd(n, p);
      const a2 = a * (bCommon / n), c2 = c * (bCommon / p);
      const g = gcd(gcd(a2, bCommon), c2);
      const r = [a2 / g, bCommon / g, c2 / g];
      const ratioStr = `${r[0]} : ${r[1]} : ${r[2]}`;
      const m = R.int(rng, 2, 6);
      return mkQ(rng, {
        q: `यदि a : b = ${a} : ${n} और b : c = ${p} : ${c} है, तो a : b : c ज्ञात कीजिए।`,
        qEn: `If a:b = ${a}:${n} and b:c = ${p}:${c}, find a:b:c.`,
        ans: ratioStr, wrong: [`${a} : ${n} : ${c}`, `${r[0] + r[1]} : ${r[1]} : ${r[2]}`, `${a * p} : ${n * p} : ${c * n}`, `${r[2]} : ${r[1]} : ${r[0]}`].filter((s) => s !== ratioStr).slice(0, 3),
        sol: [`b को दोनों अनुपातों में समान बनाएँ: b का LCM मान = ${n}, ${p} का LCM = ${bCommon}`, `a : b = ${a} × ${bCommon / n} : ${bCommon} = ${a2} : ${bCommon}`, `b : c = ${bCommon} : ${c} × ${bCommon / p} = ${bCommon} : ${c2}`, `a : b : c = ${a2} : ${bCommon} : ${c2} = ${ratioStr}`],
        fin: ratioStr, diff: 'Moderate', shortcut: 'b को LCM से समान बनाकर जोड़ें।',
      });
    }),
  },
  {
    name: 'mean-proportional', base: 'Moderate',
    fn: (rng) => retry(() => {
      const a = R.pick(rng, [4, 9, 16, 25, 36, 49, 8, 12, 18, 20, 24, 28, 32, 45, 50, 72, 75]);
      const k = R.int(rng, 2, 9);
      const b = a * k * k;
      if (b > 20000) throw 0;
      const mean = a * k;
      return mkQ(rng, {
        q: `${a} और ${b} के बीच मध्यानुपाती (Mean Proportional) ज्ञात कीजिए।`,
        qEn: `Find the mean proportional between ${a} and ${b}.`,
        ans: String(mean), wrong: wrongsFrom(rng, mean, [(a + b) / 2, a + b, b - a, Math.round(Math.sqrt(a * b) / 2)]),
        sol: [`मान लीजिए मध्यानुपाती x है: a : x = x : b`, `x² = a × b = ${a} × ${b} = ${a * b}`, `x = √${a * b} = ${mean}`],
        fin: String(mean), diff: 'Moderate', shortcut: 'मध्यानुपाती = √(a×b)',
      });
    }),
  },
  {
    name: 'third-proportional', base: 'Moderate',
    fn: (rng) => retry(() => {
      const a = R.int(rng, 2, 12), k = R.int(rng, 2, 8);
      const b = a * k, c = b * k;
      if (c > 5000) throw 0;
      return mkQ(rng, {
        q: `${a} और ${b} का तृतीयानुपाती (Third Proportional) ज्ञात कीजिए।`,
        qEn: `Find the third proportional to ${a} and ${b}.`,
        ans: String(c), wrong: wrongsFrom(rng, c, [b, a * b, Math.round(b / a), c / k]),
        sol: [`तृतीयानुपाती x के लिए: a : b = b : x`, `x = b²/a = ${b}²/${a} = ${b * b}/${a} = ${c}`],
        fin: String(c), diff: 'Moderate', shortcut: 'तृतीयानुपाती = b²/a',
      });
    }),
  },
  {
    name: 'income-expenditure', base: 'Hard',
    fn: (rng) => retry(() => {
      const i1 = R.int(rng, 3, 8), i2 = R.int(rng, 3, 9);
      if (i1 === i2) throw 0;
      const e1 = R.int(rng, 2, 6), e2 = R.int(rng, 2, 7);
      if (e1 === e2) throw 0;
      // savings S: (i1x − e1y) = (i2x − e2y) = S ... simpler: savings equal
      // i1·k − e1·m = i2·k − e2·m  ⇒ (i1−i2)k = (e1−e2)m
      const di = i1 - i2, de = e1 - e2;
      if (di * de <= 0) throw 0; // need same direction for positive solution
      const g = gcd(di, de);
      const k = de / g, m = di / g;
      const S = i1 * k * 10 - e1 * m * 10;
      if (S <= 0) throw 0;
      return mkQ(rng, {
        q: `A और B की आयों का अनुपात ${i1} : ${i2} और व्ययों का अनुपात ${e1} : ${e2} है। यदि दोनों की बचत समान ${rs(S)} है, तो A की आय ज्ञात कीजिए।`,
        qEn: `The incomes of A and B are in the ratio ${i1}:${i2} and their expenditures in the ratio ${e1}:${e2}. If each saves ₹${S}, find A's income.`,
        ans: rs(i1 * k * 10), wrong: wrongsFrom(rng, i1 * k * 10, [i2 * k * 10, S, i1 * k, e1 * m * 10]).map((x) => rs(x)),
        sol: [`मान लीजिए A की आय = ${i1}x, B की आय = ${i2}x`, `A का व्यय = ${e1}y, B का व्यय = ${e2}y`, `बचत: ${i1}x − ${e1}y = ${i2}x − ${e2}y = ${S}`, `अनुपात हल करने पर x : y = ${k * 10} : ${m * 10} के गुणज में — x = ${k * 10} लेने पर:`, `A की आय = ${i1} × ${k * 10} = ${inr(i1 * k * 10)}, A का व्यय = ${e1} × ${m * 10} = ${inr(e1 * m * 10)}, बचत = ${inr(S)} ✔`],
        fin: rs(i1 * k * 10), diff: 'Hard',
      });
    }),
  },
  {
    name: 'ratio-after-add', base: 'Moderate',
    fn: (rng) => retry(() => {
      const a = R.int(rng, 2, 9), b = R.int(rng, 2, 9);
      const k = R.pick(rng, [3, 4, 5, 6, 8, 10, 12]);
      const c = R.pick(rng, [1, 2, 3, 4]);
      // (a k + add)/(b k) = (a+c)/b  => add = c*k
      const add = c * k;
      const A = a * k, B = b * k;
      const na = A + add;
      const g2 = gcd(na, B);
      const newR = `${na / g2} : ${B / g2}`;
      return mkQ(rng, {
        q: `दो संख्याओं का अनुपात ${a} : ${b} है। यदि पहली संख्या में ${inr(add)} जोड़ दिया जाए और दूसरी संख्या अपरिवर्तित रहे (संख्याएँ क्रमशः ${inr(A)} और ${inr(B)} हैं), तो नया अनुपात ${newR} है। यदि पहली संख्या में ${inr(add)} जोड़ा जाए तो नया अनुपात क्या होगा?`,
        qEn: `Two numbers are in the ratio ${a}:${b} (the numbers are ${A} and ${B}). If ${add} is added to the first number, find the new ratio.`,
        ans: newR, wrong: [`${a} : ${b}`, `${a + c} : ${b}`, `${na} : ${B + add}`, `${B / g2} : ${na / g2}`].filter((s) => s !== newR).slice(0, 3),
        sol: [`संख्याएँ: ${inr(A)} और ${inr(B)}`, `पहली में ${inr(add)} जोड़ने पर: ${inr(na)}`, `नया अनुपात = ${inr(na)} : ${inr(B)} = ${newR}`],
        fin: newR, diff: 'Moderate',
      });
    }),
  },
  {
    name: 'proportion-x', base: 'Easy',
    fn: (rng) => retry(() => {
      const a = R.int(rng, 2, 12), b = R.int(rng, 2, 15), k = R.int(rng, 2, 9);
      const c = a * k, x = b * k;
      if (x === c) throw 0;
      return mkQ(rng, {
        q: `यदि ${a} : ${b} :: ${c} : x है, तो x का मान ज्ञात कीजिए।`,
        qEn: `If ${a} : ${b} :: ${c} : x, find the value of x.`,
        ans: String(x), wrong: wrongsFrom(rng, x, [c, (b * b) / a, Math.round(c / b), x + a]),
        sol: [`अनुपात में: a × x = b × c (गुणनफल समान)`, `${a} × x = ${b} × ${c} = ${b * c}`, `x = ${b * c}/${a} = ${x}`],
        fin: String(x), diff: 'Easy', shortcut: 'a:b :: c:d ⇒ ad = bc',
      });
    }),
  },
];

export const AVERAGE = [
  {
    name: 'average-basic', base: 'Easy',
    fn: (rng) => retry(() => {
      const n = R.pick(rng, [4, 5, 6, 7, 8]);
      const avg = R.int(rng, 12, 80);
      const nums = [];
      let remaining = avg * n;
      for (let i = 0; i < n - 1; i++) {
        const dev = R.int(rng, -10, 10);
        nums.push(avg + dev); remaining -= avg + dev;
      }
      if (remaining <= 0 || remaining === nums[nums.length - 1]) throw 0;
      nums.push(remaining);
      if (nums.some((x) => x <= 0)) throw 0;
      return mkQ(rng, {
        q: `प्रथम ${n} प्राकृत संख्याओं के स्थान पर ${n} संख्याओं ${nums.join(', ')} का औसत (Average) ज्ञात कीजिए।`,
        qEn: `Find the average of the numbers ${nums.join(', ')}.`,
        ans: String(avg), wrong: wrongsFrom(rng, avg, [avg + 1, avg - 1, Math.max(...nums), Math.round(remaining / n), avg * 2]),
        sol: [`योग = ${nums.join(' + ')} = ${inr(avg * n)}`, `संख्याओं की संख्या = ${n}`, `औसत = ${inr(avg * n)}/${n} = ${avg}`],
        fin: String(avg), diff: 'Easy', shortcut: 'औसत = योग ÷ संख्याओं की संख्या',
      });
    }),
  },
  {
    name: 'average-first-n', base: 'Easy',
    fn: (rng) => retry(() => {
      const kind = R.pick(rng, ['natural', 'odd', 'even', 'square']);
      const n = R.pick(rng, [10, 12, 15, 18, 20, 24, 25, 30, 40, 50]);
      let avg, q, en;
      if (kind === 'natural') { avg = (n + 1) / 2; q = `पहली ${n} प्राकृत संख्याओं का औसत ज्ञात कीजिए।`; en = `Find the average of the first ${n} natural numbers.`; }
      else if (kind === 'odd') { avg = n; q = `पहली ${n} विषम संख्याओं का औसत ज्ञात कीजिए।`; en = `Find the average of the first ${n} odd numbers.`; }
      else if (kind === 'even') { avg = n + 1; q = `पहली ${n} सम संख्याओं का औसत ज्ञात कीजिए।`; en = `Find the average of the first ${n} even numbers.`; }
      else { avg = ((2 * n - 1) * (2 * n) * (2 * n + 1)) / 6 / n; q = `पहली ${n} वर्ग संख्याओं (1² से ${n}²) का औसत ज्ञात कीजिए।`; en = `Find the average of the first ${n} square numbers.`; }
      if (!Number.isInteger(avg)) throw 0;
      return mkQ(rng, {
        q, qEn: en,
        ans: String(avg), wrong: wrongsFrom(rng, avg, [avg + 1, avg - 1, 2 * avg, Math.round(avg / 2)]),
        sol: kind === 'natural'
          ? [`प्रथम n प्राकृत संख्याओं का योग = n(n+1)/2 = ${n} × ${n + 1}/2 = ${inr((n * (n + 1)) / 2)}`, `औसत = ${inr((n * (n + 1)) / 2)}/${n} = ${avg}`]
          : kind === 'odd'
            ? [`प्रथम n विषम संख्याओं का योग = n² = ${n}² = ${inr(n * n)}`, `औसत = ${inr(n * n)}/${n} = ${avg}`]
            : kind === 'even'
              ? [`प्रथम n सम संख्याओं का योग = n(n+1) = ${n} × ${n + 1} = ${inr(n * (n + 1))}`, `औसत = ${inr(n * (n + 1))}/${n} = ${avg}`]
              : [`प्रथम n वर्गों का योग = n(n+1)(2n+1)/6 = ${n} × ${n + 1} × ${2 * n + 1}/6 = ${inr((n * (n + 1) * (2 * n + 1)) / 6)}`, `औसत = ${inr((n * (n + 1) * (2 * n + 1)) / 6)}/${n} = ${fixed(avg, 2)}`],
        fin: String(avg), diff: 'Easy',
        shortcut: kind === 'odd' ? 'प्रथम n विषम संख्याओं का औसत = n' : kind === 'even' ? 'प्रथम n सम संख्याओं का औसत = n+1' : 'प्रथम n प्राकृत संख्याओं का औसत = (n+1)/2',
      });
    }),
  },
  {
    name: 'average-replace', base: 'Moderate',
    fn: (rng) => retry(() => {
      const n = R.pick(rng, [8, 10, 12, 15, 20]);
      const avg = R.int(rng, 20, 60);
      const chg = R.pick(rng, [1, 2, 3, 4]);
      const newAvg = avg + chg;
      const oldVal = R.int(rng, 5, avg - 2);
      const newVal = oldVal + n * chg;
      if (newVal <= 0) throw 0;
      return mkQ(rng, {
        q: `${n} संख्याओं का औसत ${avg} है। यदि एक संख्या ${oldVal} को हटाकर एक नई संख्या रखी जाती है, तो औसत ${newAvg} हो जाता है। नई संख्या ज्ञात कीजिए।`,
        qEn: `The average of ${n} numbers is ${avg}. If one number ${oldVal} is replaced by a new number, the average becomes ${newAvg}. Find the new number.`,
        ans: String(newVal), wrong: wrongsFrom(rng, newVal, [oldVal + chg, newVal - n, oldVal, newVal + chg]),
        sol: [`पुराना योग = ${n} × ${avg} = ${inr(n * avg)}`, `नया योग = ${n} × ${newAvg} = ${inr(n * newAvg)}`, `योग में वृद्धि = ${inr(n * newAvg)} − ${inr(n * avg)} = ${inr(n * chg)}`, `नई संख्या = ${oldVal} + ${n * chg} = ${newVal}`],
        fin: String(newVal), diff: 'Moderate', shortcut: 'नई संख्या = पुरानी संख्या ± n × (औसत परिवर्तन)',
      });
    }),
  },
  {
    name: 'average-age-team', base: 'Moderate',
    fn: (rng) => retry(() => {
      const n = R.pick(rng, [10, 11, 12, 15, 16]);
      const avg = R.int(rng, 20, 30);
      const coachAge = avg + R.pick(rng, [15, 18, 20, 22, 25]);
      const withCoach = (avg * n + coachAge) / (n + 1);
      if (!Number.isInteger(withCoach) || withCoach <= avg) throw 0;
      return mkQ(rng, {
        q: `${n} खिलाड़ियों की टीम की औसत आयु ${avg} वर्ष है। जब कोच (आयु ${coachAge} वर्ष) को शामिल किया जाता है, तो औसत आयु कितनी हो जाती है?`,
        qEn: `The average age of a team of ${n} players is ${avg} years. When the coach aged ${coachAge} years is included, what is the average age?`,
        ans: yr(withCoach), wrong: wrongsFrom(rng, withCoach, [avg, withCoach + 1, coachAge, (avg * n) / (n + 1)]).map((x) => yr(Math.round(x))),
        sol: [`खिलाड़ियों की कुल आयु = ${n} × ${avg} = ${inr(n * avg)} वर्ष`, `कोच सहित कुल आयु = ${inr(n * avg)} + ${coachAge} = ${inr(n * avg + coachAge)} वर्ष`, `नया औसत = ${inr(n * avg + coachAge)}/${n + 1} = ${withCoach} वर्ष`],
        fin: yr(withCoach), diff: 'Moderate',
      });
    }),
  },
  {
    name: 'average-batting', base: 'Hard',
    fn: (rng) => retry(() => {
      const innings = R.pick(rng, [8, 9, 10, 11, 12]);
      const avg = R.pick(rng, [30, 35, 40, 45, 50]);
      const need = R.pick(rng, [innings * 2, innings * 3, innings * 4, innings * 5]);
      // x such that (innings*avg + x)/(innings+1) = avg + k
      const newAvg = avg + R.int(rng, 2, 8);
      const x = (innings + 1) * newAvg - innings * avg;
      if (x <= 0 || x > 200) throw 0;
      return mkQ(rng, {
        q: `एक बल्लेबाज का ${innings} पारियों में औसत ${avg} रन है। ${innings + 1}वीं पारी में उसे कितने रन बनाने चाहिए ताकि औसत ${newAvg} हो जाए?`,
        qEn: `A batsman has an average of ${avg} runs in ${innings} innings. How many runs must he score in the ${innings + 1}th innings to raise his average to ${newAvg}?`,
        ans: `${x} रन`, wrong: wrongsFrom(rng, x, [newAvg, avg, x + innings, x - innings]).map((v) => `${v} रन`),
        sol: [`कुल रन (${innings} पारियाँ) = ${innings} × ${avg} = ${inr(innings * avg)}`, `लक्षित कुल रन (${innings + 1} पारियाँ) = ${innings + 1} × ${newAvg} = ${inr((innings + 1) * newAvg)}`, `आवश्यक रन = ${inr((innings + 1) * newAvg)} − ${inr(innings * avg)} = ${x} रन`],
        fin: `${x} रन`, diff: 'Hard', shortcut: 'आवश्यक रन = नया औसत × (n+1) − पुराना औसत × n',
      });
    }),
  },
  {
    name: 'average-consecutive', base: 'Moderate',
    fn: (rng) => retry(() => {
      const n = R.pick(rng, [4, 6, 8]);
      const start = R.int(rng, 3, 40);
      const nums = Array.from({ length: n }, (_, i) => start + i);
      const total = nums.reduce((a, b) => a + b, 0);
      const removeMax = R.bool(rng);
      const removed = removeMax ? nums[n - 1] : nums[0];
      const remainingSum = total - removed;
      const newAvg = remainingSum / (n - 1); // always integer for even n
      if (!Number.isInteger(newAvg)) throw 0;
      const oldAvg = total / n;
      return mkQ(rng, {
        q: `${n} क्रमागत संख्याओं ${start}, ${start + 1}, ..., ${start + n - 1} में से ${removeMax ? 'सबसे बड़ी' : 'सबसे छोटी'} संख्या ${removed} को हटा दिया जाता है। शेष संख्याओं का औसत ज्ञात कीजिए।`,
        qEn: `From ${n} consecutive numbers ${start}, ${start + 1}, ..., ${start + n - 1}, the ${removeMax ? 'largest' : 'smallest'} number ${removed} is removed. Find the average of the remaining numbers.`,
        ans: String(newAvg), wrong: wrongsFrom(rng, newAvg, [oldAvg, newAvg + 1, newAvg - 1, removed, newAvg + 2]),
        sol: [`कुल योग = (${start} + ${start + n - 1}) × ${n}/2 = ${total}`, `हटाई गई संख्या = ${removed}`, `शेष योग = ${total} − ${removed} = ${remainingSum}`, `शेष औसत = ${remainingSum}/${n - 1} = ${newAvg}`],
        fin: String(newAvg), diff: 'Moderate',
      });
    }),
  }, 
  {
    name: 'average-temp', base: 'Easy',
    fn: (rng) => retry(() => {
      const mon = R.int(rng, 18, 28), tue = R.int(rng, 18, 32), wed = R.int(rng, 18, 32);
      const avg = (mon + tue + wed) / 3;
      if (!Number.isInteger(avg)) throw 0;
      return mkQ(rng, {
        q: `सोमवार, मंगलवार और बुधवार के तापमान क्रमशः ${mon}°C, ${tue}°C और ${wed}°C रहे। तीन दिनों का औसत तापमान ज्ञात कीजिए।`,
        qEn: `The temperatures on Monday, Tuesday and Wednesday were ${mon}°C, ${tue}°C and ${wed}°C. Find the average temperature of the three days.`,
        ans: `${avg}°C`, wrong: wrongsFrom(rng, avg, [Math.max(mon, tue, wed), avg + 1, avg - 1, (mon + tue) / 2]).map((x) => (Number.isInteger(x) ? `${x}°C` : `${fixed(x, 1)}°C`)),
        sol: [`योग = ${mon} + ${tue} + ${wed} = ${mon + tue + wed}°C`, `औसत = ${mon + tue + wed}/3 = ${avg}°C`],
        fin: `${avg}°C`, diff: 'Easy',
      });
    }),
  },
];

export const AGE_PROBLEMS = [
  {
    name: 'father-son-ratio', base: 'Moderate',
    fn: (rng) => retry(() => {
      const m = R.pick(rng, [3, 4, 5, 6]);
      const t = R.pick(rng, [4, 5, 6, 8, 10, 12]);
      // (F+t)/(S+t) = (m+? ) ... construct: father now = m*x, son = x; after t: ratio (m*x+t)/(x+t)
      // choose x such that ratio is nice: pick x, compute ratio, present it
      const x = R.pick(rng, [5, 6, 8, 10, 12, 15, 16, 18, 20, 24]);
      const F = m * x, S = x;
      const r2n = F + t, r2d = S + t;
      const g = gcd(r2n, r2d);
      if (r2n / g > 12 || r2n / g === r2d / g) throw 0;
      const newRatio = `${r2n / g} : ${r2d / g}`;
      const sum = F + S;
      return mkQ(rng, {
        q: `पिता और पुत्र की वर्तमान आयु का अनुपात ${m} : 1 है और उनकी आयु का योग ${sum} वर्ष है। ${t} वर्ष बाद उनकी आयु का अनुपात क्या होगा?`,
        qEn: `The ratio of present ages of father and son is ${m}:1 and the sum of their ages is ${sum} years. What will be the ratio of their ages after ${t} years?`,
        ans: newRatio, wrong: [`${m} : 1`, `${r2d / g} : ${r2n / g}`, `${m + 1} : 1`, `${r2n / g + 1} : ${r2d / g}`].filter((s) => s !== newRatio).slice(0, 3),
        sol: [`मान लीजिए पुत्र की आयु = x वर्ष, पिता = ${m}x वर्ष`, `x + ${m}x = ${sum} ⇒ ${m + 1}x = ${sum} ⇒ x = ${S}`, `पिता = ${F} वर्ष, पुत्र = ${S} वर्ष`, `${t} वर्ष बाद: ${F + t} : ${S + t} = ${newRatio}`],
        fin: newRatio, diff: 'Moderate',
      });
    }),
  },
  {
    name: 'age-times', base: 'Easy',
    fn: (rng) => retry(() => {
      const k = R.pick(rng, [3, 4, 5]);
      const yrs = R.pick(rng, [5, 6, 8, 10, 12]);
      // A = k*S now; after yrs: A+yrs = 2(S+yrs) => k*S + yrs = 2S + 2yrs => S(k-2) = yrs
      if (k === 3) {
        const S = yrs; const A = k * S;
        return mkQ(rng, {
          q: `A की आयु B से ${k} गुनी है। ${yrs} वर्ष बाद A की आयु, B की आयु की दोगुनी हो जाएगी। A की वर्तमान आयु ज्ञात कीजिए।`,
          qEn: `A's age is ${k} times B's age. After ${yrs} years, A will be twice as old as B. Find A's present age.`,
          ans: yr(A), wrong: wrongsFrom(rng, A, [S, A + yrs, A - yrs, k * yrs]).map((x) => yr(x)),
          sol: [`मान लीजिए B की आयु = x ⇒ A = ${k}x`, `${yrs} वर्ष बाद: ${k}x + ${yrs} = 2(x + ${yrs})`, `${k}x + ${yrs} = 2x + ${2 * yrs} ⇒ ${k - 2}x = ${yrs} ⇒ x = ${S}`, `A की आयु = ${k} × ${S} = ${A} वर्ष`],
          fin: yr(A), diff: 'Easy',
        });
      }
      throw 0;
    }),
  },
  {
    name: 'age-5-years-ago', base: 'Moderate',
    fn: (rng) => retry(() => {
      const k = R.pick(rng, [3, 4, 5]);
      const t = R.pick(rng, [5, 6, 8, 10]);
      // (S - t)*k = F - t  with F = k*S - t*(k-1); pick S
      const S = R.pick(rng, [12, 14, 15, 16, 18, 20, 22, 24]);
      const F = k * (S - t) + t;
      if (F <= S + 10) throw 0;
      return mkQ(rng, {
        q: `${t} वर्ष पहले, पिता की आयु अपने पुत्र की आयु की ${k} गुनी थी। पुत्र की वर्तमान आयु ${S} वर्ष है। पिता की वर्तमान आयु ज्ञात कीजिए।`,
        qEn: `${t} years ago, a father's age was ${k} times his son's age. The son's present age is ${S} years. Find the father's present age.`,
        ans: yr(F), wrong: wrongsFrom(rng, F, [k * S, F - t, F + t, S + t]).map((x) => yr(x)),
        sol: [`${t} वर्ष पहले पुत्र की आयु = ${S} − ${t} = ${S - t} वर्ष`, `तब पिता की आयु = ${k} × ${S - t} = ${k * (S - t)} वर्ष`, `पिता की वर्तमान आयु = ${k * (S - t)} + ${t} = ${F} वर्ष`],
        fin: yr(F), diff: 'Moderate',
      });
    }),
  },
  {
    name: 'age-ratio-sum', base: 'Moderate',
    fn: (rng) => retry(() => {
      const a = R.int(rng, 2, 6), b = R.int(rng, 1, a - 1);
      const k = R.pick(rng, [4, 5, 6, 7, 8, 9, 10, 11, 12]);
      const A = a * k, B = b * k;
      const sum = A + B;
      return mkQ(rng, {
        q: `दो व्यक्तियों की वर्तमान आयु का अनुपात ${a} : ${b} है और आयु का योग ${sum} वर्ष है। छोटे व्यक्ति की आयु ज्ञात कीजिए।`,
        qEn: `The ratio of present ages of two persons is ${a}:${b} and the sum of their ages is ${sum} years. Find the age of the younger person.`,
        ans: yr(B), wrong: wrongsFrom(rng, B, [A, sum / 2, B + 5, a * k]).map((x) => yr(x)),
        sol: [`मान लीजिए आयुएँ ${a}x और ${b}x वर्ष हैं।`, `${a}x + ${b}x = ${sum} ⇒ ${a + b}x = ${sum} ⇒ x = ${k}`, `छोटे व्यक्ति की आयु = ${b} × ${k} = ${B} वर्ष`],
        fin: yr(B), diff: 'Moderate',
      });
    }),
  },
  {
    name: 'age-average-family', base: 'Moderate',
    fn: (rng) => retry(() => {
      const n = R.pick(rng, [4, 5]);
      const avg = R.int(rng, 24, 34);
      const child = R.int(rng, 8, 15);
      const adultAvg = (avg * n - child) / (n - 1);
      if (!Number.isInteger(adultAvg)) throw 0;
      return mkQ(rng, {
        q: `${n} सदस्यों के एक परिवार की औसत आयु ${avg} वर्ष है। सबसे छोटे सदस्य की आयु ${child} वर्ष है। शेष सदस्यों की औसत आयु ज्ञात कीजिए।`,
        qEn: `The average age of a family of ${n} members is ${avg} years. The youngest member is ${child} years old. Find the average age of the remaining members.`,
        ans: yr(adultAvg), wrong: wrongsFrom(rng, adultAvg, [avg, adultAvg + 2, child, avg + 5]).map((x) => yr(x)),
        sol: [`कुल आयु = ${n} × ${avg} = ${inr(n * avg)} वर्ष`, `शेष सदस्यों की कुल आयु = ${inr(n * avg)} − ${child} = ${inr(n * avg - child)} वर्ष`, `शेष का औसत = ${inr(n * avg - child)}/${n - 1} = ${adultAvg} वर्ष`],
        fin: yr(adultAvg), diff: 'Moderate',
      });
    }),
  },
];

export const STATISTICS = [
  {
    name: 'mean-basic', base: 'Easy',
    fn: (rng) => retry(() => {
      const n = R.pick(rng, [5, 6, 7]);
      const mean = R.int(rng, 15, 60);
      const data = [];
      let rem = mean * n;
      for (let i = 0; i < n - 1; i++) { const d = R.int(rng, -8, 8); data.push(mean + d); rem -= mean + d; }
      if (rem <= 0) throw 0;
      data.push(rem);
      return mkQ(rng, {
        q: `निम्न आँकड़ों का माध्य (Mean) ज्ञात कीजिए: ${data.join(', ')}`,
        qEn: `Find the mean of the following data: ${data.join(', ')}`,
        ans: String(mean), wrong: wrongsFrom(rng, mean, [mean + 1, mean - 1, Math.max(...data), (Math.max(...data) + Math.min(...data)) / 2]),
        sol: [`योग = ${data.join(' + ')} = ${inr(mean * n)}`, `पदों की संख्या = ${n}`, `माध्य = ${inr(mean * n)}/${n} = ${mean}`],
        fin: String(mean), diff: 'Easy', shortcut: 'माध्य = Σx/n',
      });
    }),
  },
  {
    name: 'median-basic', base: 'Easy',
    fn: (rng) => retry(() => {
      const n = R.pick(rng, [5, 7, 9]);
      const data = R.shuffle(rng, Array.from({ length: n + 4 }, (_, i) => i + R.int(rng, 2, 30))).slice(0, n);
      const sorted = data.slice().sort((a, b) => a - b);
      const median = sorted[(n - 1) / 2];
      const shown = R.bool(rng) ? data : sorted;
      return mkQ(rng, {
        q: `निम्न आँकड़ों का माध्यिका (Median) ज्ञात कीजिए: ${shown.join(', ')}`,
        qEn: `Find the median of the following data: ${shown.join(', ')}`,
        ans: String(median), wrong: wrongsFrom(rng, median, [shown[(n - 1) / 2], sorted[0], sorted[n - 1], (sorted[0] + sorted[n - 1]) / 2]),
        sol: [`आँकड़ों को आरोही क्रम में लगाएँ: ${sorted.join(', ')}`, `पदों की संख्या n = ${n} (विषम)`, `माध्यिका = ((n+1)/2)वाँ पद = ${(n + 1) / 2}वाँ पद = ${median}`],
        fin: String(median), diff: 'Easy', shortcut: 'विषम n पर माध्यिका = (n+1)/2 वाँ पद',
      });
    }),
  },
  {
    name: 'median-even', base: 'Moderate',
    fn: (rng) => retry(() => {
      const n = R.pick(rng, [6, 8]);
      const data = R.shuffle(rng, Array.from({ length: n + 4 }, (_, i) => i + R.int(rng, 2, 40))).slice(0, n);
      const sorted = data.slice().sort((a, b) => a - b);
      const a = sorted[n / 2 - 1], b = sorted[n / 2];
      if ((a + b) % 2 !== 0) throw 0;
      const median = (a + b) / 2;
      return mkQ(rng, {
        q: `निम्न आँकड़ों का माध्यिका (Median) ज्ञात कीजिए: ${data.join(', ')}`,
        qEn: `Find the median of the following data: ${data.join(', ')}`,
        ans: String(median), wrong: wrongsFrom(rng, median, [a, b, (a + b) / 2 + 1, sorted[n / 2 + 1] || b]),
        sol: [`आरोही क्रम: ${sorted.join(', ')}`, `n = ${n} (सम)`, `माध्यिका = (n/2वाँ + (n/2)+1वाँ पद)/2 = (${a} + ${b})/2 = ${median}`],
        fin: String(median), diff: 'Moderate', shortcut: 'सम n पर माध्यिका = दो मध्य पदों का औसत',
      });
    }),
  },
  {
    name: 'mode-basic', base: 'Easy',
    fn: (rng) => retry(() => {
      const mode = R.int(rng, 10, 50);
      const others = [];
      while (others.length < 5) { const v = R.int(rng, 8, 60); if (v !== mode && !others.includes(v)) others.push(v); }
      const data = R.shuffle(rng, [mode, mode, mode, ...others]);
      return mkQ(rng, {
        q: `निम्न आँकड़ों का बहुलक (Mode) ज्ञात कीजिए: ${data.join(', ')}`,
        qEn: `Find the mode of the following data: ${data.join(', ')}`,
        ans: String(mode), wrong: wrongsFrom(rng, mode, [others[0], others[1], Math.max(...data)]),
        sol: [`प्रत्येक पद की बारंबारता गिनें।`, `${mode} तीन बार आया है — सबसे अधिक बारंबारता।`, `अतः बहुलक = ${mode}`],
        fin: String(mode), diff: 'Easy', shortcut: 'बहुलक = सर्वाधिक बारंबारता वाला पद',
      });
    }),
  },
  {
    name: 'range-basic', base: 'Easy',
    fn: (rng) => retry(() => {
      const n = R.pick(rng, [6, 7, 8]);
      const data = [];
      while (data.length < n) { const v = R.int(rng, 5, 90); if (!data.includes(v)) data.push(v); }
      const range = Math.max(...data) - Math.min(...data);
      return mkQ(rng, {
        q: `निम्न आँकड़ों का परिसर (Range) ज्ञात कीजिए: ${data.join(', ')}`,
        qEn: `Find the range of the following data: ${data.join(', ')}`,
        ans: String(range), wrong: wrongsFrom(rng, range, [Math.max(...data), Math.min(...data), range / 2, Math.max(...data) + Math.min(...data)]),
        sol: [`सबसे बड़ा मान = ${Math.max(...data)}`, `सबसे छोटा मान = ${Math.min(...data)}`, `परिसर = ${Math.max(...data)} − ${Math.min(...data)} = ${range}`],
        fin: String(range), diff: 'Easy', shortcut: 'परिसर = अधिकतम − न्यूनतम',
      });
    }),
  },
  {
    name: 'mean-freq', base: 'Hard',
    fn: (rng) => retry(() => {
      const vals = [];
      while (vals.length < 4) { const v = R.int(rng, 5, 40); if (!vals.includes(v)) vals.push(v); }
      const freqs = [R.int(rng, 2, 8), R.int(rng, 2, 8), R.int(rng, 2, 8), R.int(rng, 2, 8)];
      const sum = vals.reduce((a, v, i) => a + v * freqs[i], 0);
      const N = freqs.reduce((a, b) => a + b, 0);
      if (sum % N !== 0) throw 0;
      const mean = sum / N;
      return mkQ(rng, {
        q: `एक बारंबारता बंटन में मान ${vals.join(', ')} की बारंबारता क्रमशः ${freqs.join(', ')} है। बंटन का माध्य (Mean) ज्ञात कीजिए।`,
        qEn: `In a frequency distribution, the values ${vals.join(', ')} occur with frequencies ${freqs.join(', ')} respectively. Find the mean of the distribution.`,
        ans: String(mean), wrong: wrongsFrom(rng, mean, [vals.reduce((a, b) => a + b, 0) / 4, mean + 1, Math.max(...vals), Math.round(sum / 4)]),
        sol: [`Σfx = ${vals.map((v, i) => `${v}×${freqs[i]}`).join(' + ')} = ${sum}`, `Σf = ${N}`, `माध्य = Σfx/Σf = ${sum}/${N} = ${mean}`],
        fin: String(mean), diff: 'Hard', shortcut: 'माध्य = Σfx/Σf',
      });
    }),
  },
  {
    name: 'mean-new-value', base: 'Moderate',
    fn: (rng) => retry(() => {
      const n = R.pick(rng, [7, 9, 11]);
      const mean = R.int(rng, 12, 50);
      const x = R.int(rng, 20, 80);
      const newMean = (mean * n + x) / (n + 1);
      if (!Number.isInteger(newMean)) throw 0;
      return mkQ(rng, {
        q: `${n} संख्याओं का माध्य ${mean} है। इसमें एक नई संख्या ${x} जोड़ दी जाती है। नया माध्य ज्ञात कीजिए।`,
        qEn: `The mean of ${n} numbers is ${mean}. A new number ${x} is added. Find the new mean.`,
        ans: String(newMean), wrong: wrongsFrom(rng, newMean, [mean, (mean + x) / 2, newMean + 1, x]),
        sol: [`पुराना योग = ${n} × ${mean} = ${inr(n * mean)}`, `नया योग = ${inr(n * mean)} + ${x} = ${inr(n * mean + x)}`, `नया माध्य = ${inr(n * mean + x)}/${n + 1} = ${newMean}`],
        fin: String(newMean), diff: 'Moderate',
      });
    }),
  },
];
