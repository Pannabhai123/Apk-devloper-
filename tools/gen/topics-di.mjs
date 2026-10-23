// Topic templates: Data Interpretation
import { R, gcd, F, mkQ, wrongsFrom, retry, inr, rs, pc, fixed } from './core.mjs';

const THEMES = [
  { rows: ['जनवरी', 'फरवरी', 'मार्च', 'अप्रैल', 'मई'], rowEn: ['Jan', 'Feb', 'Mar', 'Apr', 'May'], title: 'एक दुकान की पाँच महीनों की बिक्री (₹ हज़ार में)', titleEn: 'Sales of a shop for five months (in ₹ thousand)', lo: 40, hi: 95 },
  { rows: ['सोमवार', 'मंगलवार', 'बुधवार', 'गुरुवार', 'शुक्रवार'], rowEn: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'], title: 'एक संग्रहालय में पाँच दिनों में आए आगंतुक (संख्या)', titleEn: 'Visitors to a museum on five days', lo: 20, hi: 90 },
  { rows: ['2019', '2020', '2021', '2022', '2023'], rowEn: ['2019', '2020', '2021', '2022', '2023'], title: 'एक कारखाने की वार्षिक उत्पादन (हज़ार इकाई)', titleEn: 'Annual production of a factory (thousand units)', lo: 25, hi: 85 },
  { rows: ['राम', 'श्याम', 'मोहन', 'सोहन', 'गोपाल'], rowEn: ['Ram', 'Shyam', 'Mohan', 'Sohan', 'Gopal'], title: 'पाँच छात्रों के गणित में प्राप्तांक (100 में से)', titleEn: 'Mathematics marks of five students (out of 100)', lo: 7, hi: 19 },
  { rows: ['कक्षा 6', 'कक्षा 7', 'कक्षा 8', 'कक्षा 9', 'कक्षा 10'], rowEn: ['Class 6', 'Class 7', 'Class 8', 'Class 9', 'Class 10'], title: 'एक विद्यालय की पाँच कक्षाओं में छात्रों की संख्या', titleEn: 'Number of students in five classes of a school', lo: 8, hi: 20 },
  { rows: ['जून', 'जुलाई', 'अगस्त', 'सितंबर', 'अक्टूबर'], rowEn: ['Jun', 'Jul', 'Aug', 'Sep', 'Oct'], title: 'एक पुस्तक भंडार में पाँच महीनों में बेची गई पुस्तकें (संख्या)', titleEn: 'Books sold by a bookstore in five months', lo: 10, hi: 30 },
];

function makeTable(rng) {
  const theme = R.pick(rng, THEMES);
  const vals = [];
  for (let i = 0; i < 5; i++) {
    let v;
    do { v = R.int(rng, theme.lo, theme.hi) * 5; } while (vals.includes(v));
    vals.push(v);
  }
  const lines = [`${theme.title} / ${theme.titleEn}:`];
  theme.rows.forEach((r, i) => lines.push(`${r} (${theme.rowEn[i]}): ${vals[i]}`));
  return { theme, vals, text: lines.join('\n') };
}

export const DATA_INTERPRETATION = [
  {
    name: 'di-total', base: 'Easy',
    fn: (rng) => retry(() => {
      const { theme, vals, text } = makeTable(rng);
      const total = vals.reduce((a, b) => a + b, 0);
      return mkQ(rng, {
        q: `नीचे दी गई तालिका का अध्ययन करें और कुल योग ज्ञात कीजिए।\n\n${text}\n\nतालिका में दिए गए सभी पाँच मानों का कुल योग कितना है?`,
        qEn: `Study the table and find the total of all five values.`,
        ans: String(total), wrong: wrongsFrom(rng, total, [Math.round(total / 2), total - vals[0], total + vals[1], Math.max(...vals) * 2]),
        sol: [`तालिका के मान: ${vals.join(', ')}`, `कुल योग = ${vals.join(' + ')}`, `= ${total}`],
        fin: String(total), diff: 'Easy',
      });
    }),
  },
  {
    name: 'di-average', base: 'Easy',
    fn: (rng) => retry(() => {
      const { theme, vals, text } = makeTable(rng);
      const total = vals.reduce((a, b) => a + b, 0);
      if (total % 5 !== 0) throw 0;
      const avg = total / 5;
      return mkQ(rng, {
        q: `नीचे दी गई तालिका का अध्ययन करें।\n\n${text}\n\nपाँचों मानों का औसत (Average) ज्ञात कीजिए।`,
        qEn: `Study the table and find the average of the five values.`,
        ans: String(avg), wrong: wrongsFrom(rng, avg, [avg + 5, Math.max(...vals), Math.round(total / 4), avg - 5]),
        sol: [`कुल योग = ${vals.join(' + ')} = ${total}`, `मानों की संख्या = 5`, `औसत = ${total}/5 = ${avg}`],
        fin: String(avg), diff: 'Easy',
      });
    }),
  },
  {
    name: 'di-ratio', base: 'Moderate',
    fn: (rng) => retry(() => {
      const { theme, vals, text } = makeTable(rng);
      const i = R.int(rng, 0, 3), j = R.int(rng, i + 1, 4);
      const g = gcd(vals[i], vals[j]);
      const ratio = `${vals[i] / g} : ${vals[j] / g}`;
      return mkQ(rng, {
        q: `नीचे दी गई तालिका का अध्ययन करें।\n\n${text}\n\n${theme.rows[i]} और ${theme.rows[j]} के मानों का अनुपात ज्ञात कीजिए।`,
        qEn: `Study the table and find the ratio of the values of ${theme.rowEn[i]} and ${theme.rowEn[j]}.`,
        ans: ratio, wrong: [`${vals[j] / g} : ${vals[i] / g}`, `${vals[i]} : ${vals[j]}`, `${vals[i] / g + 1} : ${vals[j] / g}`].filter((w) => w !== ratio).slice(0, 3),
        sol: [`${theme.rows[i]} = ${vals[i]}, ${theme.rows[j]} = ${vals[j]}`, `अनुपात = ${vals[i]} : ${vals[j]}`, `= ${vals[i] / g} : ${vals[j] / g} (सबसे बड़े सार्व गुणनखंड ${g} से भाग)`, `= ${ratio}`],
        fin: ratio, diff: 'Moderate',
      });
    }),
  },
  {
    name: 'di-percent-share', base: 'Moderate',
    fn: (rng) => {
      // Table built so total = 100k and every value is a multiple of k:
      // share of any value = value/k is therefore always an integer %.
      const k = R.pick(rng, [4, 5]);
      const base = 20 * k; // mean value; total = 5 x base = 100k
      const devs = R.shuffle(rng, k === 4 ? [8, 12, 16, 20, 24] : [10, 15, 20, 25]).slice(0, 2);
      const [a, b] = devs;
      const vals = R.shuffle(rng, [base - a, base - b, base, base + b, base + a]);
      const total = vals.reduce((x, y) => x + y, 0);
      if (total !== 100 * k) throw new Error('construction failed');
      const theme = R.pick(rng, THEMES);
      const lines = [`${theme.title} / ${theme.titleEn}:`];
      theme.rows.forEach((r, i) => lines.push(`${r} (${theme.rowEn[i]}): ${vals[i]}`));
      const text = lines.join('\n');
      const i = R.int(rng, 0, 4);
      const share = vals[i] / k;
      return mkQ(rng, {
        q: `नीचे दी गई तालिका का अध्ययन करें।\n\n${text}\n\n${theme.rows[i]} का मान कुल योग का कितने प्रतिशत है?`,
        qEn: `Study the table. What percentage of the total does ${theme.rowEn[i]} represent?`,
        ans: pc(`${share}%`), wrong: wrongsFrom(rng, share, [100 - share, share + 10, share - 5, Math.round(share * 1.5)]).map((x) => pc(`${x}%`)),
        sol: [`कुल योग = ${vals.join(' + ')} = ${total}`, `${theme.rows[i]} = ${vals[i]}`, `प्रतिशत = ${vals[i]}/${total} × 100 = ${share}%`],
        fin: pc(`${share}%`), diff: 'Moderate',
      });
    },
  }, 
  {
    name: 'di-percent-change', base: 'Moderate',
    fn: (rng) => retry(() => {
      const { theme, vals, text } = makeTable(rng);
      const i = R.int(rng, 0, 3), j = i + 1;
      const change = ((vals[j] - vals[i]) * 100) / vals[i];
      if (!Number.isInteger(change) || change === 0) throw 0;
      const up = change > 0;
      return mkQ(rng, {
        q: `नीचे दी गई तालिका का अध्ययन करें।\n\n${text}\n\n${theme.rows[i]} से ${theme.rows[j]} तक मान में प्रतिशत परिवर्तन ज्ञात कीजिए।`,
        qEn: `Study the table. Find the percentage change in the value from ${theme.rowEn[i]} to ${theme.rowEn[j]}.`,
        ans: pc(`${up ? '' : '−'}${Math.abs(change)}%`), wrong: [pc(`${up ? '−' : ''}${Math.abs(change)}%`), pc(`${Math.abs(vals[j] - vals[i])}%`), pc(`${up ? '' : '−'}${Math.abs(change) + 5}%`)].filter((w) => w !== pc(`${up ? '' : '−'}${Math.abs(change)}%`)).slice(0, 3),
        sol: [`${theme.rows[i]} = ${vals[i]}, ${theme.rows[j]} = ${vals[j]}`, `परिवर्तन = ${vals[j]} − ${vals[i]} = ${vals[j] - vals[i]}`, `प्रतिशत परिवर्तन = ${vals[j] - vals[i]}/${vals[i]} × 100 = ${change}%`, `अतः ${up ? 'वृद्धि' : 'कमी'} ${Math.abs(change)}% हुई।`],
        fin: pc(`${up ? '' : '−'}${Math.abs(change)}%`), diff: 'Moderate',
      });
    }),
  },
  {
    name: 'di-difference', base: 'Easy',
    fn: (rng) => retry(() => {
      const { theme, vals, text } = makeTable(rng);
      const i = R.int(rng, 0, 3), j = R.int(rng, i + 1, 4);
      const diff = Math.abs(vals[j] - vals[i]);
      return mkQ(rng, {
        q: `नीचे दी गई तालिका का अध्ययन करें।\n\n${text}\n\n${theme.rows[i]} और ${theme.rows[j]} के मानों में कितना अंतर है?`,
        qEn: `Study the table. Find the difference between the values of ${theme.rowEn[i]} and ${theme.rowEn[j]}.`,
        ans: String(diff), wrong: wrongsFrom(rng, diff, [vals[i] + vals[j], diff / 2, diff * 2, Math.max(...vals)]),
        sol: [`${theme.rows[i]} = ${vals[i]}, ${theme.rows[j]} = ${vals[j]}`, `अंतर = |${vals[i]} − ${vals[j]}| = ${diff}`],
        fin: String(diff), diff: 'Easy',
      });
    }),
  },
  {
    name: 'di-max-min', base: 'Moderate',
    fn: (rng) => retry(() => {
      const { theme, vals, text } = makeTable(rng);
      const maxI = vals.indexOf(Math.max(...vals));
      const minI = vals.indexOf(Math.min(...vals));
      const diff = Math.max(...vals) - Math.min(...vals);
      return mkQ(rng, {
        q: `नीचे दी गई तालिका का अध्ययन करें।\n\n${text}\n\nसबसे अधिकतम और न्यूनतम मानों का अंतर ज्ञात कीजिए।`,
        qEn: `Study the table. Find the difference between the maximum and minimum values.`,
        ans: String(diff), wrong: wrongsFrom(rng, diff, [Math.max(...vals), Math.min(...vals), Math.round((Math.max(...vals) + Math.min(...vals)) / 2), diff / 2]),
        sol: [`अधिकतम मान = ${Math.max(...vals)} (${theme.rows[maxI]})`, `न्यूनतम मान = ${Math.min(...vals)} (${theme.rows[minI]})`, `अंतर = ${Math.max(...vals)} − ${Math.min(...vals)} = ${diff}`],
        fin: String(diff), diff: 'Moderate',
      });
    }),
  },
  {
    name: 'di-sum-of-two', base: 'Moderate',
    fn: (rng) => retry(() => {
      const { theme, vals, text } = makeTable(rng);
      const i = R.int(rng, 0, 3), j = R.int(rng, i + 1, 4);
      const sum = vals[i] + vals[j];
      return mkQ(rng, {
        q: `नीचे दी गई तालिका का अध्ययन करें।\n\n${text}\n\n${theme.rows[i]} और ${theme.rows[j]} के मानों का योग, शेष तीन मानों के योग का कितने प्रतिशत है?`,
        qEn: `Study the table. The sum of the values of ${theme.rowEn[i]} and ${theme.rowEn[j]} is what percentage of the sum of the remaining three?`,
        ans: pc(`${Math.round((sum * 100) / (vals.reduce((a, b) => a + b, 0) - sum))}%`), wrong: wrongsFrom(rng, Math.round((sum * 100) / (vals.reduce((a, b) => a + b, 0) - sum)), [100, 50, Math.round((sum * 100) / vals.reduce((a, b) => a + b, 0)), 200]).map((x) => pc(`${x}%`)),
        sol: [`${theme.rows[i]} + ${theme.rows[j]} = ${vals[i]} + ${vals[j]} = ${sum}`, `शेष तीन का योग = ${vals.reduce((a, b) => a + b, 0)} − ${sum} = ${vals.reduce((a, b) => a + b, 0) - sum}`, `प्रतिशत = ${sum}/${vals.reduce((a, b) => a + b, 0) - sum} × 100 = ${fixed((sum * 100) / (vals.reduce((a, b) => a + b, 0) - sum), 2)}%`],
        fin: pc(`${Math.round((sum * 100) / (vals.reduce((a, b) => a + b, 0) - sum))}%`), diff: 'Moderate',
      });
    }),
  },
];
