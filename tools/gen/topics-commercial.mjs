// Topic templates: Percentage, Profit & Loss, Discount,
// Simple Interest, Compound Interest, Partnership, Mixture & Alligation
import { R, gcd, F, mkQ, wrongsFrom, retry, inr, rs, pc, dys, L, kg, fixed } from './core.mjs';

export const PERCENTAGE = [
  {
    name: 'pct-of-number', base: 'Easy',
    fn: (rng) => retry(() => {
      const p = R.pick(rng, [5, 12, 15, 20, 24, 25, 35, 40, 45, 60, 75, 80]);
      const n = R.pick(rng, [120, 160, 180, 200, 240, 250, 300, 320, 360, 400, 450, 480, 500, 600, 720, 800]);
      const v = (p * n) / 100;
      if (!Number.isInteger(v)) throw 0;
      return mkQ(rng, {
        q: `${inr(n)} का ${p}% कितना होगा?`, qEn: `What is ${p}% of ${n}?`,
        ans: inr(v), wrong: wrongsFrom(rng, v, [v * 2, Math.round(v / 2), v + 10, n - v, Math.round((v * 11) / 10)]).map((x) => inr(x)),
        sol: [`${p}% of ${inr(n)} = ${n} × ${p}/100`, `= ${inr(v)}`],
        fin: inr(v), diff: 'Easy', shortcut: 'x% of n = n × x/100',
      });
    }),
  },
  {
    name: 'find-number-from-pct', base: 'Easy',
    fn: (rng) => retry(() => {
      const p = R.pick(rng, [5, 10, 20, 25, 40, 50, 60, 75]);
      const num = R.int(rng, 6, 60) * 4;
      const val = (p * num) / 100;
      if (!Number.isInteger(val)) throw 0;
      return mkQ(rng, {
        q: `यदि किसी संख्या का ${p}% = ${inr(val)} है, तो वह संख्या क्या है?`,
        qEn: `If ${p}% of a number is ${val}, find the number.`,
        ans: String(num), wrong: wrongsFrom(rng, num, [val, num / 2, num * 2, num + val, num - val]),
        sol: [`मान लीजिए संख्या x है।`, `x का ${p}% = ${inr(val)}`, `x × ${p}/100 = ${val}`, `x = ${val} × 100/${p} = ${num}`],
        fin: String(num), diff: 'Easy',
      });
    }),
  },
  {
    name: 'net-change', base: 'Moderate',
    fn: (rng) => retry(() => {
      const pairs = [[10, 10], [20, 10], [10, 20], [20, 20], [25, 20], [20, 25], [25, 10], [50, 10], [10, 50], [30, 10], [40, 20], [20, 40], [25, 25], [50, 50]];
      const [a, b] = R.pick(rng, pairs);
      const net = a - b - (a * b) / 100;
      const increase = net >= 0;
      const netAbs = Math.abs(net);
      if (!Number.isInteger(net)) throw 0;
      return mkQ(rng, {
        q: `किसी वस्तु की कीमत पहले ${a}% बढ़ाई जाती है और फिर ${b}% घटाई जाती है। कीमत में शुद्ध (net) परिवर्तन क्या है?`,
        qEn: `The price of an article is first increased by ${a}% and then decreased by ${b}%. Find the net change in price.`,
        ans: pc(`${increase ? '' : '−'}${netAbs}%`), wrong: [pc(`${a - b}%`), pc(`${netAbs + 1}%`), pc(`${netAbs + 2}%`), pc(`${a + b}%`), ...(netAbs !== 0 ? [pc(`${increase ? '−' : ''}${netAbs}%`)] : [])].filter((s) => s !== pc(`${increase ? '' : '−'}${netAbs}%`)).slice(0, 3),
        sol: [`शुद्ध परिवर्तन सूत्र: a% वृद्धि फिर b% कमी ⇒ a − b − ab/100`, `= ${a} − ${b} − (${a} × ${b})/100`, `= ${a} − ${b} − ${(a * b) / 100} = ${increase ? '+' : '−'}${netAbs}%`, `अतः कीमत में ${increase ? `${netAbs}% वृद्धि` : `${netAbs}% कमी`} होगी।`],
        fin: pc(`${increase ? '' : '−'}${netAbs}%`), diff: 'Moderate',
        shortcut: 'क्रमिक परिवर्तन: net% = a + b + ab/100 (चिह्न के साथ)',
      });
    }),
  },
  {
    name: 'salary-expenditure', base: 'Moderate',
    fn: (rng) => retry(() => {
      const p = R.pick(rng, [60, 70, 75, 80]);
      const remains = (100 - p);
      const save = R.pick(rng, [1200, 1500, 1800, 2000, 2400, 3000, 3600, 4200, 4800, 6000]);
      const salary = (save * 100) / remains;
      if (!Number.isInteger(salary)) throw 0;
      return mkQ(rng, {
        q: `एक व्यक्ति अपनी मासिक वेतन का ${p}% खर्च करता है और ${rs(save)} बचाता है। उसका मासिक वेतन कितना है?`,
        qEn: `A person spends ${p}% of his monthly salary and saves ₹${save}. Find his monthly salary.`,
        ans: rs(salary), wrong: wrongsFrom(rng, salary, [save * 100 / p, save, salary / 2, salary + save]).map((x) => rs(Math.round(x))),
        sol: [`खर्च = ${p}%, अतः बचत = ${100 - p}% of वेतन`, `${100 - p}% × वेतन = ${rs(save)}`, `वेतन = ${save} × 100/${100 - p} = ${inr(salary)}`],
        fin: rs(salary), diff: 'Moderate',
      });
    }),
  },
  {
    name: 'election-margin', base: 'Moderate',
    fn: (rng) => retry(() => {
      const w = R.pick(rng, [55, 56, 60, 62, 65, 68, 70]);
      const total = R.pick(rng, [2000, 2500, 3000, 4000, 5000, 6000, 7500, 8000, 10000]);
      const marginPct = 2 * w - 100;
      const margin = (total * marginPct) / 100;
      if (!Number.isInteger(margin)) throw 0;
      return mkQ(rng, {
        q: `दो उम्मीदवारों के बीच चुनाव में कुल ${inr(total)} वैध मत पड़े। विजेता उम्मीदवार को कुल मतों का ${w}% प्राप्त हुआ। विजेता को हारने वाले उम्मीदवार से कितने मतों की वृद्धि (margin) प्राप्त हुई?`,
        qEn: `In an election between two candidates, ${total} valid votes were cast. The winner got ${w}% of total votes. Find the winning margin.`,
        ans: inr(margin), wrong: wrongsFrom(rng, margin, [total * w / 100, total - margin, margin / 2, total * (100 - w) / 100]).map((x) => inr(Math.round(x))),
        sol: [`विजेता के मत = ${total} का ${w}% = ${inr((total * w) / 100)}`, `हारने वाले के मत = ${total} का ${100 - w}% = ${inr((total * (100 - w)) / 100)}`, `वृद्धि (margin) = ${inr((total * w) / 100)} − ${inr((total * (100 - w)) / 100)} = ${inr(margin)}`],
        fin: inr(margin), diff: 'Moderate',
        shortcut: `margin = (2×विजेता% − 100)% × कुल मत`,
      });
    }),
  },
  {
    name: 'population-growth', base: 'Moderate',
    fn: (rng) => retry(() => {
      const p1 = R.pick(rng, [5, 10, 20, 25]);
      const p2 = R.pick(rng, [4, 5, 10, 20]);
      const pop = R.pick(rng, [4000, 5000, 8000, 10000, 20000, 25000, 40000, 50000]);
      const final = Math.round(pop * (1 + p1 / 100) * (1 + p2 / 100));
      return mkQ(rng, {
        q: `एक शहर की जनसंख्या ${inr(pop)} है। पहले वर्ष यह ${p1}% बढ़ती है और दूसरे वर्ष ${p2}% बढ़ती है। दो वर्ष बाद जनसंख्या कितनी होगी?`,
        qEn: `A town's population is ${pop}. It increases by ${p1}% in the first year and ${p2}% in the second year. Find the population after two years.`,
        ans: inr(final), wrong: wrongsFrom(rng, final, [Math.round(pop * (1 + (p1 + p2) / 100)), pop, Math.round(pop * (1 + p1 / 100)), Math.round(final * 1.1)]).map((x) => inr(x)),
        sol: [`पहले वर्ष के बाद: ${inr(pop)} × (100 + ${p1})/100 = ${inr(Math.round(pop * (1 + p1 / 100)))}`, `दूसरे वर्ष के बाद: ${inr(Math.round(pop * (1 + p1 / 100)))} × (100 + ${p2})/100 = ${inr(final)}`],
        fin: inr(final), diff: 'Moderate',
        shortcut: 'क्रमिक वृद्धि: नई संख्या = पुरानी × (100+r₁)/100 × (100+r₂)/100',
      });
    }),
  },
  {
    name: 'number-to-number', base: 'Easy',
    fn: (rng) => retry(() => {
      const a = R.pick(rng, [40, 50, 60, 80, 120, 150, 200, 240, 250, 300, 400, 500]);
      const p = R.pick(rng, [10, 20, 25, 40, 50]);
      const up = R.bool(rng);
      const b = up ? a * (1 + p / 100) : a * (1 - p / 100);
      if (!Number.isInteger(b)) throw 0;
      const changeWord = up ? 'बढ़ाकर' : 'घटाकर';
      return mkQ(rng, {
        q: `एक संख्या को ${pc(p)} ${changeWord} ${inr(b)} किया जाता है। मूल संख्या क्या थी?`,
        qEn: `A number is ${up ? 'increased' : 'decreased'} by ${p}% to get ${b}. Find the original number.`,
        ans: String(a), wrong: wrongsFrom(rng, a, [b, a / 2, a * 2, Math.round(up ? b - p : b + p)]),
        sol: [`मान लीजिए मूल संख्या x है।`, `x ${up ? '×' : '×'} (100 ${up ? '+' : '−'} ${p})/100 = ${b}`, `x = ${b} × 100/(100 ${up ? '+' : '−'} ${p}) = ${a}`],
        fin: String(a), diff: 'Easy',
        shortcut: `मूल संख्या = नई संख्या × 100/(100 ${up ? '+' : '−'} ${p})`,
      });
    }),
  },
  {
    name: 'exam-pass-marks', base: 'Hard',
    fn: (rng) => retry(() => {
      const p1 = R.pick(rng, [30, 33, 35, 36, 40]);
      const failBy = R.pick(rng, [20, 25, 30, 40, 45, 50]);
      const p2 = p1 + R.pick(rng, [10, 12, 15, 20, 24]);
      const gotAbove = R.pick(rng, [16, 20, 24, 30, 36]);
      const diffPct = p2 - p1;
      const diffMarks = failBy + gotAbove;
      const max = (diffMarks * 100) / diffPct;
      if (!Number.isInteger(max)) throw 0;
      const pass = (max * p1) / 100 + failBy;
      if (!Number.isInteger(pass)) throw 0;
      return mkQ(rng, {
        q: `एक परीक्षा में एक छात्र को अधिकतम अंकों का ${p1}% प्राप्त होने पर ${failBy} अंकों से अनुत्तीर्ण होना पड़ता है, जबकि दूसरे छात्र को ${p2}% प्राप्त होने पर उत्तीर्ण अंकों से ${gotAbove} अंक अधिक मिलते हैं। अधिकतम अंक ज्ञात कीजिए।`,
        qEn: `In an exam, a student scoring ${p1}% of maximum marks fails by ${failBy} marks, while another scoring ${p2}% gets ${gotAbove} marks more than pass marks. Find the maximum marks.`,
        ans: String(max), wrong: wrongsFrom(rng, max, [diffMarks * 100, max / 2, max + 100, pass]),
        sol: [`मान लीजिए अधिकतम अंक M हैं और उत्तीर्ण अंक P हैं।`, `${p1}% of M = P − ${failBy}`, `${p2}% of M = P + ${gotAbove}`, `घटाने पर: (${p2} − ${p1})% of M = ${failBy} + ${gotAbove} = ${diffMarks}`, `${diffPct}/100 × M = ${diffMarks} ⇒ M = ${diffMarks} × 100/${diffPct} = ${max}`],
        fin: String(max), diff: 'Hard',
      });
    }),
  },
];

export const PROFIT_LOSS = [
  {
    name: 'profit-pct', base: 'Easy',
    fn: (rng) => retry(() => {
      const cp = R.pick(rng, [200, 240, 250, 300, 320, 360, 400, 450, 480, 500, 600, 640, 720, 800, 900, 1000, 1200, 1500, 1600, 2000, 2400, 2500, 3000, 4000, 5000]);
      const pPct = R.pick(rng, [5, 10, 12, 15, 20, 24, 25, 30, 40, 50]);
      const sp = cp * (1 + pPct / 100);
      if (!Number.isInteger(sp)) throw 0;
      const profit = sp - cp;
      return mkQ(rng, {
        q: `एक वस्तु का क्रय मूल्य ${rs(cp)} और विक्रय मूल्य ${rs(sp)} है। लाभ प्रतिशत ज्ञात कीजिए।`,
        qEn: `The cost price of an article is ₹${cp} and its selling price is ₹${sp}. Find the profit percentage.`,
        ans: pc(`${pPct}%`), wrong: wrongsFrom(rng, pPct, [(profit / sp) * 100, pPct * 2, pPct / 2, pPct + 5, Math.round((profit / sp) * 100)]).map((x) => pc(`${fixed(x, 2)}%`)).filter((s) => s !== pc(`${pPct}%`)).slice(0, 3),
        sol: [`क्रय मूल्य (CP) = ${rs(cp)}`, `विक्रय मूल्य (SP) = ${rs(sp)}`, `लाभ = SP − CP = ${rs(sp)} − ${rs(cp)} = ${rs(profit)}`, `लाभ% = (लाभ/CP) × 100 = (${profit}/${cp}) × 100 = ${pPct}%`],
        fin: pc(`${pPct}%`), diff: 'Easy',
        shortcut: 'लाभ% = (लाभ ÷ क्रय मूल्य) × 100',
      });
    }),
  },
  {
    name: 'find-cp', base: 'Easy',
    fn: (rng) => retry(() => {
      const pPct = R.pick(rng, [10, 15, 20, 25, 40, 50]);
      const cp = R.pick(rng, [160, 200, 240, 320, 360, 400, 480, 500, 640, 800, 1000, 1200, 1600, 2000]);
      const sp = cp * (1 + pPct / 100);
      if (!Number.isInteger(sp)) throw 0;
      return mkQ(rng, {
        q: `एक वस्तु ${rs(sp)} में बेची जाती है, जिससे ${pPct}% लाभ होता है। वस्तु का क्रय मूल्य ज्ञात कीजिए।`,
        qEn: `An article is sold for ₹${sp} at a profit of ${pPct}%. Find its cost price.`,
        ans: rs(cp), wrong: wrongsFrom(rng, cp, [sp, Math.round(sp / (1 + pPct / 50)), Math.round(cp / 2), sp - 100]).map((x) => rs(Math.round(x))),
        sol: [`SP = CP × (100 + लाभ%)/100`, `${sp} = CP × ${100 + pPct}/100`, `CP = ${sp} × 100/${100 + pPct} = ${inr(cp)}`],
        fin: rs(cp), diff: 'Easy',
      });
    }),
  },
  {
    name: 'same-sp-profit-loss', base: 'Hard',
    fn: (rng) => retry(() => {
      const p = R.pick(rng, [10, 20, 50]);
      const spEach = R.pick(rng, [600, 1000, 1200, 1500, 2000, 2400, 3000]);
      // Same SP on both, +p% on one and -p% on the other: net loss% = p*p/100
      const loss = (p * p) / 100;
      const cp1 = spEach / (1 + p / 100), cp2 = spEach / (1 - p / 100);
      const totalCP = cp1 + cp2, totalSP = 2 * spEach;
      return mkQ(rng, {
        q: `एक दुकानदार दो वस्तुएँ ${rs(spEach)} प्रत्येक की दर से बेचता है। एक वस्तु पर उसे ${p}% लाभ और दूसरी पर ${p}% हानि होती है। पूरे सौदे में उसे कितने प्रतिशत हानि हुई?`,
        qEn: `A shopkeeper sells two articles for ₹${spEach} each, gaining ${p}% on one and losing ${p}% on the other. Find his overall loss percentage.`,
        ans: pc(`−${fixed(loss, 2)}%`),
        wrong: [pc('0%'), pc(`${p}%`), pc(`−${p / 2}%`), pc(`−${fixed(p / 4, 2)}%`), pc(`−${fixed(p * 2, 2)}%`)].filter((s) => s !== pc(`−${fixed(loss, 2)}%`)).slice(0, 3),
        sol: [`वस्तु 1 का CP = ${spEach} × 100/(${100 + p}) = ${fixed(cp1, 2)}`, `वस्तु 2 का CP = ${spEach} × 100/(${100 - p}) = ${fixed(cp2, 2)}`, `कुल CP = ${fixed(totalCP, 2)}, कुल SP = ${inr(totalSP)}`, `हानि = ${fixed(totalCP - totalSP, 2)}`, `हानि% = हानि/कुल CP × 100 = ${fixed(totalCP - totalSP, 2)}/${fixed(totalCP, 2)} × 100 = ${fixed(loss, 2)}%`],
        fin: pc(`−${fixed(loss, 2)}%`), diff: 'Hard',
        shortcut: 'समान SP, समान % लाभ-हानि ⇒ शुद्ध हानि% = (x/10)²',
      });
    }),
  }, 
  {
    name: 'cp-of-x-sp-of-y', base: 'Moderate',
    fn: (rng) => retry(() => {
      const pairs = [[12, 10], [15, 12], [20, 16], [24, 20], [10, 8], [25, 20], [16, 12], [18, 15], [21, 18], [30, 24]];
      const [x, y] = R.pick(rng, pairs);
      const profitPct = ((x - y) / y) * 100;
      if (Number.isInteger(profitPct)) {
        return mkQ(rng, {
          q: `यदि ${x} वस्तुओं का क्रय मूल्य ${y} वस्तुओं के विक्रय मूल्य के बराबर है, तो लाभ प्रतिशत ज्ञात कीजिए।`,
          qEn: `If the cost price of ${x} articles equals the selling price of ${y} articles, find the profit percentage.`,
          ans: pc(`${fixed(profitPct, 2)}%`), wrong: [pc(`${fixed(((x - y) / x) * 100, 2)}%`), pc(`${x - y}%`), pc(`${fixed((x / y) * 100, 2)}%`), pc(`${fixed(((x + y) / y) * 10, 2)}%`)].filter((s) => s !== pc(`${fixed(profitPct, 2)}%`)).slice(0, 3),
          sol: [`मान लीजिए प्रत्येक वस्तु का SP = ₹1`, `${y} वस्तुओं का SP = ₹${y} = ${x} वस्तुओं का CP`, `प्रत्येक वस्तु का CP = ${x} → कुल CP (${y} वस्तुओं का) = ${y} × 1/${x}... सरलतम: CP ${x} = SP ${y}`, `लाभ = SP − CP अनुपात में: (${x} − ${y})/${y}`, `लाभ% = (${x} − ${y})/${y} × 100 = ${fixed(profitPct, 2)}%`],
          fin: pc(`${fixed(profitPct, 2)}%`), diff: 'Moderate',
          shortcut: 'लाभ% = (x − y)/y × 100 जब x वस्तुओं का CP = y वस्तुओं का SP',
        });
      }
      throw 0;
    }),
  },
  {
    name: 'profit-if-cheaper', base: 'Hard',
    fn: (rng) => retry(() => {
      const d = R.pick(rng, [50, 100, 150, 200]);
      const p1 = R.pick(rng, [10, 15, 20, 25]);
      const p2 = R.pick(rng, [p1 + 10, p1 + 15, p1 + 20, 2 * p1]);
      // SP = CP(1+p1/100); new CP = CP-d, new SP = SP+d at p2% ⇒ CP(p2-p1)/100 = d(2+p2/100)
      const cp = (d * (2 + p2 / 100)) / ((p2 - p1) / 100);
      if (!Number.isInteger(cp) || cp < 100) throw 0;
      return mkQ(rng, {
        q: `एक वस्तु ${pc(p1)} लाभ पर बेची जाती है। यदि उसे ${rs(d)} कम में खरीदा जाता और ${rs(d)} अधिक में बेचा जाता, तो ${pc(p2)} लाभ होता। वस्तु का क्रय मूल्य ज्ञात कीजिए।`,
        qEn: `An article is sold at ${p1}% profit. Had it been bought for ₹${d} less and sold for ₹${d} more, the profit would have been ${p2}%. Find the cost price.`,
        ans: rs(cp), wrong: wrongsFrom(rng, cp, [cp - d, cp + d, cp / 2, cp * 2]).map((x) => rs(Math.round(x))),
        sol: [`मान लीजिए CP = x`, `SP = x × ${100 + p1}/100`, `नई स्थिति: नया CP = x − ${d}, नया SP = x × ${100 + p1}/100 + ${d}`, `नया लाभ% = ${p2}% ⇒ नया SP = (x − ${d}) × ${100 + p2}/100`, `समीकरण हल करने पर: x(${p2 - p1}/100) = ${d} × ${100 + p2}/100 + ${d} = ${fixed(d * (100 + p2) / 100 + d, 2)}`, `x = ${inr(cp)}`],
        fin: rs(cp), diff: 'Hard',
      });
    }),
  },
  {
    name: 'two-items-avg-profit', base: 'Moderate',
    fn: (rng) => retry(() => {
      const cp1 = R.pick(rng, [300, 400, 450, 500, 600, 750, 800, 900, 1200, 1500]);
      const cp2 = R.pick(rng, [300, 400, 500, 600, 800, 1000, 1200, 1600, 2000, 2400]);
      const p = R.pick(rng, [10, 12, 15, 20, 25]);
      if (cp1 === cp2) throw 0;
      const sp1 = cp1 * (1 + p / 100), sp2 = cp2 * (1 + p / 100);
      if (!(Number.isInteger(sp1) && Number.isInteger(sp2))) throw 0;
      const totalProfit = sp1 + sp2 - cp1 - cp2;
      const pct = (totalProfit / (cp1 + cp2)) * 100;
      if (!Number.isInteger(pct)) throw 0;
      return mkQ(rng, {
        q: `दो वस्तुएँ क्रमशः ${rs(cp1)} और ${rs(cp2)} में खरीदी गईं और दोनों ${pc(p)} लाभ पर बेची गईं। कुल लेन-देन पर लाभ प्रतिशत ज्ञात कीजिए।`,
        qEn: `Two articles are bought for ₹${cp1} and ₹${cp2} and both are sold at ${p}% profit. Find the overall profit percentage.`,
        ans: pc(`${pct}%`), wrong: wrongsFrom(rng, pct, [p * 2, p / 2, p + 5, Math.round(pct / 2)]).map((x) => pc(`${x}%`)),
        sol: [`कुल CP = ${inr(cp1)} + ${inr(cp2)} = ${inr(cp1 + cp2)}`, `वस्तु 1 का SP = ${inr(sp1)}; वस्तु 2 का SP = ${inr(sp2)}`, `कुल SP = ${inr(sp1 + sp2)}`, `कुल लाभ = ${inr(sp1 + sp2 - cp1 - cp2)}`, `लाभ% = ${sp1 + sp2 - cp1 - cp2}/${cp1 + cp2} × 100 = ${pct}%`],
        fin: pc(`${pct}%`), diff: 'Moderate',
        shortcut: 'समान लाभ% पर कुल लाभ% भी वही रहता है (CP पर भारित)।',
      });
    }),
  },
  {
    name: 'loss-pct', base: 'Easy',
    fn: (rng) => retry(() => {
      const cp = R.pick(rng, [400, 450, 500, 600, 720, 800, 900, 1000, 1200, 1500, 1800, 2000, 2400, 2500, 3000, 3600, 4000, 4500, 5000, 6000]);
      const lPct = R.pick(rng, [4, 5, 8, 10, 12, 15, 20, 25]);
      const sp = cp * (1 - lPct / 100);
      if (!Number.isInteger(sp)) throw 0;
      return mkQ(rng, {
        q: `एक वस्तु का क्रय मूल्य ${rs(cp)} है और विक्रय मूल्य ${rs(sp)} है। हानि प्रतिशत ज्ञात कीजिए।`,
        qEn: `The cost price of an article is ₹${cp} and selling price is ₹${sp}. Find the loss percentage.`,
        ans: pc(`${lPct}%`), wrong: wrongsFrom(rng, lPct, [((cp - sp) / sp) * 100, lPct * 2, lPct / 2, lPct + 4]).map((x) => pc(`${fixed(x, 2)}%`)).filter((s) => s !== pc(`${lPct}%`)).slice(0, 3),
        sol: [`CP = ${rs(cp)}, SP = ${rs(sp)}`, `हानि = CP − SP = ${rs(cp - sp)}`, `हानि% = (हानि/CP) × 100 = (${cp - sp}/${cp}) × 100 = ${lPct}%`],
        fin: pc(`${lPct}%`), diff: 'Easy',
      });
    }),
  },
];

export const DISCOUNT = [
  {
    name: 'sp-after-discount', base: 'Easy',
    fn: (rng) => retry(() => {
      const mp = R.pick(rng, [400, 500, 600, 800, 1000, 1200, 1500, 1600, 2000, 2400, 2500, 3000, 4000, 5000]);
      const d = R.pick(rng, [5, 10, 12, 15, 20, 25, 30, 40]);
      const sp = mp * (1 - d / 100);
      if (!Number.isInteger(sp)) throw 0;
      return mkQ(rng, {
        q: `एक वस्तु का अंकित मूल्य (Marked Price) ${rs(mp)} है और ${pc(d)} की छूट दी जाती है। वस्तु का विक्रय मूल्य ज्ञात कीजिए।`,
        qEn: `The marked price of an article is ₹${mp} and a discount of ${d}% is given. Find the selling price.`,
        ans: rs(sp), wrong: wrongsFrom(rng, sp, [mp - d, sp / 2, mp * d / 100, sp + 50]).map((x) => rs(Math.round(x))),
        sol: [`अंकित मूल्य (MP) = ${rs(mp)}`, `छूट = ${pc(d)} of ${rs(mp)} = ${rs((mp * d) / 100)}`, `SP = MP − छूट = ${inr(mp)} − ${inr((mp * d) / 100)} = ${inr(sp)}`],
        fin: rs(sp), diff: 'Easy', shortcut: 'SP = MP × (100 − d%)/100',
      });
    }),
  },
  {
    name: 'successive-discount', base: 'Moderate',
    fn: (rng) => retry(() => {
      const pairs = [[10, 20], [20, 20], [10, 10], [20, 25], [25, 20], [20, 10], [25, 40], [40, 25], [10, 40], [50, 20], [20, 50], [25, 25]];
      const [d1, d2] = R.pick(rng, pairs);
      const eq = d1 + d2 - (d1 * d2) / 100;
      if (!Number.isInteger(eq)) throw 0;
      return mkQ(rng, {
        q: `एक वस्तु पर ${pc(d1)} और ${pc(d2)} की दो क्रमिक छूटें दी जाती हैं। समतुल्य एकल छूट (equivalent single discount) ज्ञात कीजिए।`,
        qEn: `Two successive discounts of ${d1}% and ${d2}% are offered. Find the equivalent single discount.`,
        ans: pc(`${eq}%`), wrong: [pc(`${d1 + d2}%`), pc(`${d1 + d2 - 1}%`), pc(`${eq - 5}%`), pc(`${eq + 5}%`)].filter((s) => s !== pc(`${eq}%`)).slice(0, 3),
        sol: [`मान लीजिए MP = 100`, `पहली छूट के बाद: 100 − ${d1} = ${100 - d1}`, `दूसरी छूट के बाद: ${100 - d1} × (100 − ${d2})/100 = ${fixed((100 - d1) * (100 - d2) / 100, 2)}`, `कुल छूट = 100 − ${fixed((100 - d1) * (100 - d2) / 100, 2)} = ${eq}`, `अतः समतुल्य एकल छूट = ${eq}%`],
        fin: pc(`${eq}%`), diff: 'Moderate',
        shortcut: 'समतुल्य छूट = d₁ + d₂ − d₁d₂/100',
      });
    }),
  },
  {
    name: 'mp-for-profit', base: 'Hard',
    fn: (rng) => retry(() => {
      const cp = R.pick(rng, [200, 250, 320, 400, 480, 500, 640, 750, 800, 960, 1000, 1250, 1500, 1600, 2000]);
      const d = R.pick(rng, [10, 15, 20, 25]);
      const p = R.pick(rng, [12, 15, 20, 25, 28, 40]);
      const mp = (cp * (100 + p)) / (100 - d);
      if (!Number.isInteger(mp)) throw 0;
      return mkQ(rng, {
        q: `एक वस्तु का क्रय मूल्य ${rs(cp)} है। दुकानदार ${pc(d)} छूट देकर भी ${pc(p)} लाभ कमाना चाहता है। अंकित मूल्य कितना रखना चाहिए?`,
        qEn: `The cost price of an article is ₹${cp}. A shopkeeper wants to earn ${p}% profit even after allowing a ${d}% discount. What should be the marked price?`,
        ans: rs(mp), wrong: wrongsFrom(rng, mp, [cp * (100 + p) / 100, cp + (mp - cp) / 2, cp, mp + 100]).map((x) => rs(Math.round(x))),
        sol: [`SP = CP × (100 + ${p})/100 = ${inr((cp * (100 + p)) / 100)}`, `SP = MP × (100 − ${d})/100`, `${inr((cp * (100 + p)) / 100)} = MP × ${100 - d}/100`, `MP = ${inr((cp * (100 + p)) / 100)} × 100/${100 - d} = ${inr(mp)}`],
        fin: rs(mp), diff: 'Hard', shortcut: 'MP = CP(100 + p%)/(100 − d%)',
      });
    }),
  },
  {
    name: 'buy-x-get-y', base: 'Moderate',
    fn: (rng) => retry(() => {
      const items = [[4, 1, 20], [3, 1, 25], [1, 1, 50], [9, 1, 10], [5, 1, '16.67'], [2, 1, '33.33']];
      const [x, y, disc] = R.pick(rng, items.filter((it) => Number.isInteger(it[2])));
      return mkQ(rng, {
        q: `"खरीदें ${x} पाएँ ${x + y}" की योजना पर प्रभावी छूट (effective discount) कितने प्रतिशत है?`,
        qEn: `What is the effective discount on the scheme "buy ${x} get ${y} free"?`,
        ans: pc(`${disc}%`), wrong: [pc(`${y * 10}%`), pc(`${x * 5}%`), pc(`${disc + 5}%`), pc(`${disc - 5}%`)].filter((s) => s !== pc(`${disc}%`)).slice(0, 3),
        sol: [`मान लीजिए प्रत्येक वस्तु की कीमत ₹1 है।`, `कुल वस्तुएँ मिलती हैं = ${x + y}, भुगतान = ${x} वस्तुओं का = ₹${x}`, `छूट = ${y} वस्तुओं की कीमत = ₹${y}`, `छूट% = ${y}/${x + y} × 100 = ${disc}%`],
        fin: pc(`${disc}%`), diff: 'Moderate',
        shortcut: 'छूट% = मुफ्त वस्तुएँ/(कुल वस्तुएँ) × 100',
      });
    }),
  },
  {
    name: 'discount-pct-from-mp-sp', base: 'Easy',
    fn: (rng) => retry(() => {
      const mp = R.pick(rng, [400, 500, 600, 800, 1000, 1200, 1250, 1500, 1600, 2000, 2400, 2500, 3000, 3200, 4000, 5000]);
      const d = R.pick(rng, [4, 5, 8, 10, 12, 15, 20, 24, 25]);
      const sp = mp * (1 - d / 100);
      if (!Number.isInteger(sp)) throw 0;
      return mkQ(rng, {
        q: `एक वस्तु का अंकित मूल्य ${rs(mp)} है तथा विक्रय मूल्य ${rs(sp)} है। छूट प्रतिशत ज्ञात कीजिए।`,
        qEn: `The marked price of an article is ₹${mp} and its selling price is ₹${sp}. Find the discount percentage.`,
        ans: pc(`${d}%`), wrong: wrongsFrom(rng, d, [((mp - sp) / sp) * 100, d * 2, d / 2, d + 3]).map((x) => pc(`${fixed(x, 2)}%`)).filter((s) => s !== pc(`${d}%`)).slice(0, 3),
        sol: [`MP = ${rs(mp)}, SP = ${rs(sp)}`, `छूट = MP − SP = ${rs(mp - sp)}`, `छूट% = (छूट/MP) × 100 = (${mp - sp}/${mp}) × 100 = ${d}%`],
        fin: pc(`${d}%`), diff: 'Easy',
      });
    }),
  },
];

export const SIMPLE_INTEREST = [
  {
    name: 'si-basic', base: 'Easy',
    fn: (rng) => retry(() => {
      const p = R.pick(rng, [1200, 1500, 2000, 2400, 2500, 3000, 3600, 4000, 4500, 4800, 5000, 6000, 7200, 8000, 9000, 10000, 12000, 15000, 16000, 20000, 24000, 25000]);
      const r = R.pick(rng, [4, 5, 6, 8, 9, 10, 12, 15]);
      const t = R.pick(rng, [2, 3, 4, 5, 6, 8, 10]);
      const si = (p * r * t) / 100;
      if (!Number.isInteger(si)) throw 0;
      return mkQ(rng, {
        q: `${rs(p)} की राशि पर ${pc(r)} वार्षिक दर से ${t} वर्ष का साधारण ब्याज (Simple Interest) ज्ञात कीजिए।`,
        qEn: `Find the simple interest on ₹${p} at ${r}% per annum for ${t} years.`,
        ans: rs(si), wrong: wrongsFrom(rng, si, [si / t, p + si, si / 2, si * 2, p * r / 100]).map((x) => rs(Math.round(x))),
        sol: [`सूत्र: SI = P × R × T/100`, `P = ${inr(p)}, R = ${r}% प्रति वर्ष, T = ${t} वर्ष`, `SI = ${p} × ${r} × ${t}/100 = ${inr(si)}`],
        fin: rs(si), diff: 'Easy', shortcut: 'SI = PRT/100',
      });
    }),
  },
  {
    name: 'si-find-rate', base: 'Easy',
    fn: (rng) => retry(() => {
      const p = R.pick(rng, [1200, 1600, 2000, 2400, 3000, 3600, 4000, 4800, 5000, 6000, 8000, 10000, 12000]);
      const r = R.pick(rng, [4, 5, 6, 8, 10, 12]);
      const t = R.pick(rng, [2, 3, 4, 5, 6, 8]);
      const si = (p * r * t) / 100;
      if (!Number.isInteger(si)) throw 0;
      return mkQ(rng, {
        q: `${rs(p)} पर ${t} वर्ष में ${rs(si)} साधारण ब्याज मिलता है। ब्याज की दर प्रतिशत प्रति वर्ष ज्ञात कीजिए।`,
        qEn: `₹${p} gives ₹${si} simple interest in ${t} years. Find the rate of interest per annum.`,
        ans: pc(`${r}%`), wrong: wrongsFrom(rng, r, [r * 2, r / 2, r + 2, r - 1]).map((x) => pc(`${x}%`)),
        sol: [`SI = PRT/100 ⇒ R = SI × 100/(P × T)`, `R = ${si} × 100/(${p} × ${t})`, `R = ${si * 100}/${p * t} = ${r}% प्रति वर्ष`],
        fin: pc(`${r}%`), diff: 'Easy',
      });
    }),
  },
  {
    name: 'si-doubles', base: 'Moderate',
    fn: (rng) => retry(() => {
      const t = R.pick(rng, [4, 5, 8, 10, 20, 25]);
      const r = 100 / t;
      return mkQ(rng, {
        q: `एक राशि साधारण ब्याज पर ${t} वर्ष में दोगुनी हो जाती है। ब्याज की दर ज्ञात कीजिए।`,
        qEn: `A sum doubles itself in ${t} years at simple interest. Find the rate of interest.`,
        ans: pc(`${r}%`), wrong: wrongsFrom(rng, r, [r * 2, r / 2, t, 100 / (2 * t)]).map((x) => pc(`${x}%`)),
        sol: [`दोगुनी होने के लिए SI = P (स्वयं राशि के बराबर ब्याज)`, `P = P × R × ${t}/100 ⇒ R × ${t} = 100`, `R = 100/${t} = ${r}% प्रति वर्ष`],
        fin: pc(`${r}%`), diff: 'Moderate', shortcut: 'n गुना होने में दर R = (n−1) × 100/T',
      });
    }),
  },
  {
    name: 'si-difference-rates', base: 'Moderate',
    fn: (rng) => retry(() => {
      const p = R.pick(rng, [4000, 5000, 6000, 8000, 10000, 12000, 15000, 20000, 24000, 25000]);
      const r1 = R.pick(rng, [4, 5, 6, 8, 10]);
      const r2 = r1 + R.pick(rng, [2, 3, 4]);
      const t = R.pick(rng, [2, 3, 4]);
      const diff = (p * (r2 - r1) * t) / 100;
      if (!Number.isInteger(diff)) throw 0;
      return mkQ(rng, {
        q: `${rs(p)} की राशि पर ${t} वर्ष में ${pc(r1)} और ${pc(r2)} की दरों के साधारण ब्याज का अंतर ज्ञात कीजिए।`,
        qEn: `Find the difference between the simple interests on ₹${p} for ${t} years at ${r1}% and ${r2}% per annum.`,
        ans: rs(diff), wrong: wrongsFrom(rng, diff, [diff * 2, diff / t, p * (r2 - r1) / 100, diff + 100]).map((x) => rs(Math.round(x))),
        sol: [`SI₁ = ${p} × ${r1} × ${t}/100 = ${inr((p * r1 * t) / 100)}`, `SI₂ = ${p} × ${r2} × ${t}/100 = ${inr((p * r2 * t) / 100)}`, `अंतर = ${inr((p * r2 * t) / 100)} − ${inr((p * r1 * t) / 100)} = ${inr(diff)}`, `सीधा: अंतर = P × (r₂ − r₁) × T/100`],
        fin: rs(diff), diff: 'Moderate', shortcut: 'दरों के अंतर पर ही गणना करें',
      });
    }),
  },
  {
    name: 'si-n-times', base: 'Hard',
    fn: (rng) => retry(() => {
      const n = R.pick(rng, [3, 4, 5]);
      const t = R.pick(rng, [4, 5, 6, 8, 10, 12, 15, 20]);
      const r = ((n - 1) * 100) / t;
      if (!Number.isInteger(r)) throw 0;
      return mkQ(rng, {
        q: `एक राशि साधारण ब्याज पर ${t} वर्ष में अपनी ${n} गुनी हो जाती है। ब्याज की वार्षिक दर ज्ञात कीजिए।`,
        qEn: `A sum becomes ${n} times itself in ${t} years at simple interest. Find the annual rate of interest.`,
        ans: pc(`${r}%`), wrong: wrongsFrom(rng, r, [n * 100 / t, r / 2, r * 2, (n - 1) * 10]).map((x) => pc(`${x}%`)),
        sol: [`n गुना होने के लिए ब्याज = (n − 1)P`, `(n − 1)P = P × R × T/100`, `R = (n − 1) × 100/T = ${n - 1} × 100/${t} = ${r}%`],
        fin: pc(`${r}%`), diff: 'Hard', shortcut: 'R = (n−1)×100/T',
      });
    }),
  },
];

export const COMPOUND_INTEREST = [
  {
    name: 'ci-2yr', base: 'Moderate',
    fn: (rng) => retry(() => {
      const p = R.pick(rng, [5000, 6250, 8000, 10000, 12500, 16000, 20000, 25000, 32000, 40000, 50000]);
      const r = R.pick(rng, [4, 5, 8, 10, 12.5, 20]);
      const A = p * (1 + r / 100) ** 2;
      const ci = A - p;
      if (Math.abs(ci - Math.round(ci)) > 1e-9) throw 0;
      return mkQ(rng, {
        q: `${rs(p)} की राशि पर ${pc(`${r}%`)} वार्षिक दर से 2 वर्ष का चक्रवृद्धि ब्याज (Compound Interest) ज्ञात कीजिए।`,
        qEn: `Find the compound interest on ₹${p} at ${r}% per annum for 2 years.`,
        ans: rs(Math.round(ci)), wrong: wrongsFrom(rng, Math.round(ci), [Math.round((p * r * 2) / 100), Math.round(ci * 2), Math.round(p * (1 + r / 100) - p), Math.round(ci / 2)]).map((x) => rs(x)),
        sol: [`A = P(1 + R/100)^T`, `A = ${p}(1 + ${r / 100})² = ${p} × ${fixed((1 + r / 100) ** 2, 4)} = ${inr(Math.round(A))}`, `CI = A − P = ${inr(Math.round(A))} − ${inr(p)} = ${inr(Math.round(ci))}`],
        fin: rs(Math.round(ci)), diff: 'Moderate', shortcut: 'CI(2 वर्ष) = P[(1+r/100)² − 1]',
      });
    }),
  },
  {
    name: 'ci-si-difference', base: 'Hard',
    fn: (rng) => retry(() => {
      const p = R.pick(rng, [4000, 5000, 8000, 10000, 20000, 25000, 40000, 50000, 100000]);
      const r = R.pick(rng, [5, 10, 20, 25]);
      const diff = p * (r / 100) ** 2;
      if (!Number.isInteger(diff)) throw 0;
      return mkQ(rng, {
        q: `${rs(p)} की राशि पर 2 वर्ष के लिए ${pc(r)} वार्षिक दर से चक्रवृद्धि ब्याज और साधारण ब्याज का अंतर ज्ञात कीजिए।`,
        qEn: `Find the difference between compound interest and simple interest on ₹${p} for 2 years at ${r}% per annum.`,
        ans: rs(diff), wrong: wrongsFrom(rng, diff, [diff * 2, diff / 2, (p * r * 2) / 100, diff + 50]).map((x) => rs(Math.round(x))),
        sol: [`SI(2 वर्ष) = P × 2R/100 = ${inr((p * 2 * r) / 100)}`, `CI(2 वर्ष) = P[(1 + R/100)² − 1] = ${inr(Math.round(p * ((1 + r / 100) ** 2 - 1)))}`, `अंतर = P(R/100)² = ${p} × (${r}/100)² = ${inr(diff)}`],
        fin: rs(diff), diff: 'Hard', shortcut: '2 वर्ष का अंतर = P(R/100)²',
      });
    }),
  },
  {
    name: 'ci-half-yearly', base: 'Hard',
    fn: (rng) => retry(() => {
      const p = R.pick(rng, [6400, 8000, 10000, 12500, 16000, 20000, 25000, 32000, 40000, 50000]);
      const r = R.pick(rng, [8, 10, 12, 16, 20]);
      const half = r / 2;
      const A = p * (1 + half / 100) ** 2; // 1 year compounded half-yearly
      if (Math.abs(A - Math.round(A)) > 1e-9) throw 0;
      return mkQ(rng, {
        q: `${rs(p)} की राशि पर ${pc(r)} वार्षिक दर से, ब्याज अर्ध-वार्षिक संयोजित होने पर 1 वर्ष बाद मिश्रधन (Amount) ज्ञात कीजिए।`,
        qEn: `Find the amount on ₹${p} at ${r}% per annum compounded half-yearly for 1 year.`,
        ans: rs(Math.round(A)), wrong: wrongsFrom(rng, Math.round(A), [p * (1 + r / 100), Math.round(A) - p, Math.round(p + (p * r) / 100), Math.round(A / 2)]).map((x) => rs(Math.round(x))),
        sol: [`अर्ध-वार्षिक संयोजन पर दर = ${r}/2 = ${half}% प्रति अर्ध-वर्ष, समय = 2 अर्ध-वर्ष`, `A = P(1 + ${half}/100)² = ${p} × ${fixed((1 + half / 100) ** 2, 4)}`, `A = ${inr(Math.round(A))}`],
        fin: rs(Math.round(A)), diff: 'Hard', shortcut: 'अर्ध-वार्षिक: दर आधी, समय दोगुना',
      });
    }),
  },
  {
    name: 'ci-amount-3yr', base: 'Moderate',
    fn: (rng) => retry(() => {
      const p = R.pick(rng, [8000, 10000, 12500, 16000, 20000, 25000, 32000, 40000, 50000, 64000]);
      const r = R.pick(rng, [5, 10, 20]);
      const A = p * (1 + r / 100) ** 3;
      if (Math.abs(A - Math.round(A)) > 1e-9) throw 0;
      return mkQ(rng, {
        q: `${rs(p)} की राशि ${pc(r)} वार्षिक चक्रवृद्धि दर से 3 वर्ष में कितनी हो जाएगी?`,
        qEn: `What will ₹${p} amount to in 3 years at ${r}% per annum compound interest?`,
        ans: rs(Math.round(A)), wrong: wrongsFrom(rng, Math.round(A), [p + (p * r * 3) / 100, Math.round(A) - p, Math.round(p * (1 + r / 100) ** 2), Math.round(A / 2)]).map((x) => rs(Math.round(x))),
        sol: [`A = P(1 + R/100)³`, `A = ${p} × (${fixed(1 + r / 100, 2)})³ = ${p} × ${fixed((1 + r / 100) ** 3, 4)}`, `A = ${inr(Math.round(A))}`],
        fin: rs(Math.round(A)), diff: 'Moderate',
      });
    }),
  },
  {
    name: 'depreciation', base: 'Moderate',
    fn: (rng) => retry(() => {
      const p = R.pick(rng, [8000, 10000, 12500, 16000, 20000, 25000, 32000, 40000, 50000, 62500, 80000, 100000, 125000, 200000]);
      const r = R.pick(rng, [4, 5, 10, 20]);
      const t = R.pick(rng, [2, 3]);
      const V = p * (1 - r / 100) ** t;
      if (Math.abs(V - Math.round(V)) > 1e-9) throw 0;
      return mkQ(rng, {
        q: `एक मशीन का मूल्य ${rs(p)} है, जो प्रति वर्ष ${pc(r)} की दर से मूल्यह्रास (depreciation) करती है। ${t} वर्ष बाद उसका मूल्य ज्ञात कीजिए।`,
        qEn: `A machine worth ₹${p} depreciates at ${r}% per annum. Find its value after ${t} years.`,
        ans: rs(Math.round(V)), wrong: wrongsFrom(rng, Math.round(V), [p - (p * r * t) / 100, p, Math.round(V / 2), Math.round(p * (1 - r / 100))]).map((x) => rs(Math.round(x))),
        sol: [`मूल्यह्रास पर: V = P(1 − R/100)^T`, `V = ${p}(1 − ${r / 100})^${t} = ${p} × ${fixed((1 - r / 100) ** t, 4)}`, `V = ${inr(Math.round(V))}`],
        fin: rs(Math.round(V)), diff: 'Moderate', shortcut: 'मूल्यह्रास: V = P(1 − r/100)^t',
      });
    }),
  },
];

export const PARTNERSHIP = [
  {
    name: 'profit-share', base: 'Easy',
    fn: (rng) => retry(() => {
      const c1 = R.pick(rng, [20000, 24000, 25000, 30000, 36000, 40000, 45000, 48000, 50000, 60000]);
      const c2 = R.pick(rng, [15000, 20000, 25000, 30000, 35000, 40000, 50000]);
      const t1 = R.pick(rng, [6, 8, 10, 12]);
      const t2 = R.pick(rng, [6, 8, 10, 12]);
      const g = gcd(c1 * t1, c2 * t2);
      const r1 = (c1 * t1) / g, r2 = (c2 * t2) / g;
      const total = R.pick(rng, [4900, 6300, 7000, 8400, 9800, 10500, 14000, 17500, 21000, 24500, 28000, 35000]);
      if ((total * r1) % (r1 + r2) !== 0) throw 0;
      const s1 = (total * r1) / (r1 + r2);
      return mkQ(rng, {
        q: `A और B एक व्यवसाय में क्रमशः ${rs(c1)} और ${rs(c2)} निवेश करते हैं। A अपनी पूँजी ${t1} महीने तक और B ${t2} महीने तक लगाता है। कुल ${rs(total)} लाभ में A का हिस्सा ज्ञात कीजिए।`,
        qEn: `A and B invest ₹${c1} and ₹${c2} in a business. A keeps his capital for ${t1} months and B for ${t2} months. Find A's share in a total profit of ₹${total}.`,
        ans: rs(s1), wrong: wrongsFrom(rng, s1, [total - s1, (total * c1) / (c1 + c2), total / 2, s1 / 2]).map((x) => rs(Math.round(x))),
        sol: [`लाभ ∝ पूँजी × समय`, `A : B = ${c1} × ${t1} : ${c2} × ${t2} = ${inr(c1 * t1)} : ${inr(c2 * t2)} = ${r1} : ${r2}`, `A का हिस्सा = ${total} × ${r1}/(${r1} + ${r2}) = ${inr(s1)}`],
        fin: rs(s1), diff: 'Easy', shortcut: 'लाभ अनुपात = पूँजी × समय',
      });
    }),
  },
  {
    name: 'partner-joins-late', base: 'Moderate',
    fn: (rng) => retry(() => {
      const a = R.pick(rng, [3, 4, 5]); // ratio parts
      const b = R.pick(rng, [2, 3, 5]);
      if (a === b) throw 0;
      const after = R.pick(rng, [4, 5, 6, 8]);
      const total_months = 12;
      const g = gcd(a * 12, b * (12 - after));
      const r1 = (a * 12) / g, r2 = (b * (12 - after)) / g;
      const total = R.pick(rng, [4200, 5600, 7000, 8400, 9100, 10500, 14000, 16800, 21000, 26000]);
      if ((total * r2) % (r1 + r2) !== 0) throw 0;
      const s2 = (total * r2) / (r1 + r2);
      return mkQ(rng, {
        q: `A और B एक व्यवसाय शुरू करते हैं, जिसमें पूँजी का अनुपात ${a} : ${b} है। B, A से ${after} महीने बाद जुड़ता है। वर्ष के अंत में कुल ${rs(total)} लाभ में से B को कितना मिलेगा?`,
        qEn: `A and B start a business with capitals in the ratio ${a}:${b}. B joins ${after} months after A. Out of the annual profit of ₹${total}, find B's share.`,
        ans: rs(s2), wrong: wrongsFrom(rng, s2, [total - s2, (total * b) / (a + b), total / 2, s2 * 2]).map((x) => rs(Math.round(x))),
        sol: [`मान लीजिए पूँजियाँ ${a}x और ${b}x हैं।`, `A की पूँजी 12 महीने, B की पूँजी ${12 - after} महीने लगी।`, `लाभ अनुपात = ${a} × 12 : ${b} × ${12 - after} = ${a * 12} : ${b * (12 - after)} = ${r1} : ${r2}`, `B का हिस्सा = ${total} × ${r2}/(${r1} + ${r2}) = ${inr(s2)}`],
        fin: rs(s2), diff: 'Moderate',
      });
    }),
  },
  {
    name: 'find-capital', base: 'Hard',
    fn: (rng) => retry(() => {
      const c1 = R.pick(rng, [20000, 24000, 25000, 30000, 32000, 36000, 40000, 45000, 48000, 50000]);
      const t1 = 12, t2 = 12;
      const r = R.pick(rng, [[2, 3], [3, 4], [2, 5], [3, 5], [4, 5]]);
      // profit ratio c1*t1 : c2*t2 = r
      const c2 = (c1 * t1 * r[1]) / (t2 * r[0]);
      if (!Number.isInteger(c2)) throw 0;
      return mkQ(rng, {
        q: `A और B समान समय (एक वर्ष) तक व्यवसाय करते हैं। A ने ${rs(c1)} लगाया। यदि लाभ का अनुपात ${r[0]} : ${r[1]} है, तो B की पूँजी ज्ञात कीजिए।`,
        qEn: `A and B run a business for the same period. A invested ₹${c1}. If profits are shared in the ratio ${r[0]}:${r[1]}, find B's capital.`,
        ans: rs(c2), wrong: wrongsFrom(rng, c2, [c1, (c1 * r[0]) / r[1], c2 / 2, c2 + 10000]).map((x) => rs(Math.round(x))),
        sol: [`समान समय पर लाभ अनुपात = पूँजी अनुपात`, `${c1} : c2 = ${r[0]} : ${r[1]}`, `c2 = ${c1} × ${r[1]}/${r[0]} = ${inr(c2)}`],
        fin: rs(c2), diff: 'Hard',
      });
    }),
  },
];

export const MIXTURE_ALLIGATION = [
  {
    name: 'two-mixtures-ratio', base: 'Moderate',
    fn: (rng) => retry(() => {
      const m1 = R.pick(rng, [[3, 1], [4, 1], [5, 1], [2, 1], [3, 2], [4, 3], [5, 3], [7, 3], [5, 2]]);
      const m2 = R.pick(rng, [[3, 1], [4, 1], [5, 1], [2, 1], [3, 2], [4, 3], [5, 3], [7, 3], [5, 2], [1, 1], [1, 2]]);
      if (m1[0] / m1[1] === m2[0] / m2[1]) throw 0;
      const q1 = R.int(rng, 2, 15), q2 = R.int(rng, 2, 15);
      const milk = (q1 * m1[0]) / (m1[0] + m1[1]) + (q2 * m2[0]) / (m2[0] + m2[1]);
      const water = q1 + q2 - milk;
      const fr = F(Math.round(milk * 100), 100).add(F(0));
      const totF = F(q1 + q2);
      const milkF = F((q1 * m1[0]) / (m1[0] + m1[1]) * 1).add(F((q2 * m2[0]) / (m2[0] + m2[1])));
      const ratio = milkF.div(totF.sub(milkF));
      return mkQ(rng, {
        q: `एक बर्तन में ${L(q1)} दूध-पानी का मिश्रण है जिसमें दूध और पानी का अनुपात ${m1[0]} : ${m1[1]} है। दूसरे बर्तन में ${L(q2)} मिश्रण है जिसमें अनुपात ${m2[0]} : ${m2[1]} है। दोनों को मिलाने पर नए मिश्रण में दूध और पानी का अनुपात क्या होगा?`,
        qEn: `A vessel has ${q1} L of milk-water mixture in ratio ${m1[0]}:${m1[1]}. Another vessel has ${q2} L in ratio ${m2[0]}:${m2[1]}. Find the milk:water ratio of the combined mixture.`,
        ans: ratio.str(), wrong: [F(m1[0], m1[1]).str(), F(m2[0], m2[1]).str(), ratio.add(F(1)).str(), ratio.mul(F(2)).str()].filter((s) => s !== ratio.str()).slice(0, 3),
        sol: [`बर्तन 1: दूध = ${q1} × ${m1[0]}/${m1[0] + m1[1]} = ${fixed((q1 * m1[0]) / (m1[0] + m1[1]), 3)} L, पानी = ${fixed(q1 - (q1 * m1[0]) / (m1[0] + m1[1]), 3)} L`, `बर्तन 2: दूध = ${q2} × ${m2[0]}/${m2[0] + m2[1]} = ${fixed((q2 * m2[0]) / (m2[0] + m2[1]), 3)} L, पानी = ${fixed(q2 - (q2 * m2[0]) / (m2[0] + m2[1]), 3)} L`, `कुल दूध = ${fixed(milk, 3)} L, कुल पानी = ${fixed(water, 3)} L`, `अनुपात = ${fixed(milk, 3)} : ${fixed(water, 3)} = ${ratio.str()}`],
        fin: ratio.str(), diff: 'Moderate',
      });
    }),
  },
  {
    name: 'alligation-price', base: 'Moderate',
    fn: (rng) => retry(() => {
      const x = R.pick(rng, [30, 36, 40, 42, 45, 48, 50]);
      const y = R.pick(rng, [60, 64, 68, 72, 75, 80, 90]);
      const z = R.pick(rng, [40, 42, 45, 48, 50, 52, 55, 58]);
      if (!(x < z && z < y)) throw 0;
      const r1 = y - z, r2 = z - x;
      const g = gcd(r1, r2);
      const ratio = `${r1 / g} : ${r2 / g}`;
      return mkQ(rng, {
        q: `${rs(x)}/किग्रा वाले चावल को ${rs(y)}/किग्रा वाले चावल के साथ किस अनुपात में मिलाया जाए कि मिश्रण की कीमत ${rs(z)}/किग्रा हो जाए?`,
        qEn: `In what ratio must rice at ₹${x}/kg be mixed with rice at ₹${y}/kg so that the mixture costs ₹${z}/kg?`,
        ans: ratio, wrong: [`${r2 / g} : ${r1 / g}`, `1 : 1`, `${r1 / g} : ${r2 / g + 1}`, `${r1 + r2} : ${r1}`].filter((s) => s !== ratio).slice(0, 3),
        sol: [`मिश्रण नियम (Alligation rule):`, `सस्ते की मात्रा : महँगे की मात्रा = (महँगा − मिश्रण) : (मिश्रण − सस्ता)`, `= (${y} − ${z}) : (${z} − ${x}) = ${r1} : ${r2}`, `= ${ratio}`],
        fin: ratio, diff: 'Moderate', shortcut: '(महँगा − M) : (M − सस्ता)',
      });
    }),
  },
  {
    name: 'add-water', base: 'Moderate',
    fn: (rng) => retry(() => {
      const m = R.pick(rng, [[3, 1], [4, 1], [5, 1], [2, 1], [5, 3], [7, 3], [4, 3]]);
      const target = R.pick(rng, [[3, 2], [2, 1], [5, 2], [3, 4], [1, 1], [7, 5], [2, 3], [5, 4]]);
      if (m[0] / m[1] <= target[0] / target[1]) throw 0;
      const total = R.pick(rng, [12, 20, 24, 30, 36, 40, 45, 60, 72, 80, 90, 120]);
      if (total % (m[0] + m[1]) !== 0) throw 0;
      const milk = (total * m[0]) / (m[0] + m[1]);
      const water = total - milk;
      const newWater = (milk * target[1]) / target[0];
      const added = newWater - water;
      if (!Number.isInteger(added) || added <= 0) throw 0;
      return mkQ(rng, {
        q: `${L(total)} दूध-पानी के मिश्रण में दूध और पानी का अनुपात ${m[0]} : ${m[1]} है। इसमें कितना पानी मिलाया जाए कि अनुपात ${target[0]} : ${target[1]} हो जाए?`,
        qEn: `A ${total} L milk-water mixture has milk:water = ${m[0]}:${m[1]}. How much water must be added to make the ratio ${target[0]}:${target[1]}?`,
        ans: `${added} लीटर`, wrong: [`${total - milk} लीटर`, `${added + 5} लीटर`, `${milk - water} लीटर`, `${added * 2} लीटर`].filter((s) => s !== `${added} लीटर`).slice(0, 3),
        sol: [`दूध = ${total} × ${m[0]}/${m[0] + m[1]} = ${milk} L (स्थिर रहेगा)`, `पानी = ${water} L`, `नया अनुपात ${target[0]}:${target[1]} में पानी = दूध × ${target[1]}/${target[0]} = ${milk} × ${target[1]}/${target[0]} = ${newWater} L`, `मिलाया गया पानी = ${newWater} − ${water} = ${added} L`],
        fin: `${added} लीटर`, diff: 'Moderate', shortcut: 'दूध स्थिर रहता है — पानी की गणना दूध के आधार पर करें।',
      });
    }),
  },
  {
    name: 'replace-with-water', base: 'Hard',
    fn: (rng) => retry(() => {
      const total = R.pick(rng, [20, 30, 40, 60, 80, 90, 100]);
      const rem = R.pick(rng, [total / 4, total / 5, total / 10, total / 2]);
      if (!Number.isInteger(rem)) throw 0;
      const frac = F(total - rem, total);
      const milkPct = ((total - rem) / total) * 100;
      return mkQ(rng, {
        q: `एक टंकी में ${L(total)} शुद्ध दूध है। इसमें से ${L(rem)} दूध निकालकर उतना ही पानी मिला दिया जाता है। अब मिश्रण में दूध का प्रतिशत कितना है?`,
        qEn: `A tank contains ${total} L of pure milk. ${rem} L is drawn and replaced with water. What is the percentage of milk in the mixture now?`,
        ans: pc(`${milkPct}%`), wrong: [pc(`${100 - milkPct}%`), pc(`${milkPct / 2}%`), pc(`${milkPct + 10}%`), pc('100%')].filter((s) => s !== pc(`${milkPct}%`)).slice(0, 3),
        sol: [`निकाले गए दूध का भाग = ${rem}/${total}`, `शेष दूध = ${total} − ${rem} = ${total - rem} L (कुल मात्रा ${total} L ही रहती है)`, `दूध% = ${total - rem}/${total} × 100 = ${milkPct}%`],
        fin: pc(`${milkPct}%`), diff: 'Hard',
      });
    }),
  },
  {
    name: 'mixture-price-total', base: 'Easy',
    fn: (rng) => retry(() => {
      const x = R.pick(rng, [20, 24, 25, 30, 32, 36, 40]);
      const y = R.pick(rng, [45, 50, 56, 60, 64, 72, 75]);
      const q1 = R.pick(rng, [4, 5, 6, 8, 10, 12]);
      const q2 = R.pick(rng, [4, 5, 6, 8, 10, 12]);
      const price = (x * q1 + y * q2) / (q1 + q2);
      if (!Number.isInteger(price)) throw 0;
      return mkQ(rng, {
        q: `${q1} किग्रा चाय पत्ती (${rs(x)}/किग्रा) को ${q2} किग्रा चाय पत्ती (${rs(y)}/किग्रा) के साथ मिलाया जाता है। मिश्रण की प्रति किग्रा कीमत ज्ञात कीजिए।`,
        qEn: `${q1} kg of tea costing ₹${x}/kg is mixed with ${q2} kg costing ₹${y}/kg. Find the cost of the mixture per kg.`,
        ans: rs(price), wrong: wrongsFrom(rng, price, [(x + y) / 2, x + y, price + 5, Math.min(x, y)]).map((v) => rs(v)),
        sol: [`कुल कीमत = ${x} × ${q1} + ${y} × ${q2} = ${inr(x * q1)} + ${inr(y * q2)} = ${inr(x * q1 + y * q2)}`, `कुल मात्रा = ${q1} + ${q2} = ${q1 + q2} किग्रा`, `मिश्रण की कीमत = ${inr(x * q1 + y * q2)}/${q1 + q2} = ${inr(price)} प्रति किग्रा`],
        fin: rs(price), diff: 'Easy', shortcut: 'मिश्रण कीमत = कुल कीमत ÷ कुल मात्रा',
      });
    }),
  },
];
