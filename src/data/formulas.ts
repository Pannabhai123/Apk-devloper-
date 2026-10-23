export interface FormulaGroup {
  topic: string;
  topicHi: string;
  formulas: { title: string; titleEn?: string; formula: string; note?: string }[];
}

export const FORMULAS: FormulaGroup[] = [
  {
    topic: 'Percentage', topicHi: 'प्रतिशत',
    formulas: [
      { title: 'प्रतिशत', formula: 'x% of n = n × x/100' },
      { title: 'यदि A, B से x% अधिक है', formula: 'A = B × (100 + x)/100' },
      { title: 'परिवर्तन प्रतिशत', formula: '% परिवर्तन = (नया − पुराना)/पुराना × 100' },
      { title: 'क्रमिक परिवर्तन (a% फिर b%)', formula: 'net% = a + b + ab/100 (चिह्न सहित)' },
      { title: 'संख्या n गुनी होने पर', formula: 'R = (n − 1) × 100/T (साधारण ब्याज पर)' },
    ],
  },
  {
    topic: 'Profit and Loss', topicHi: 'लाभ एवं हानि',
    formulas: [
      { title: 'लाभ', formula: 'लाभ = SP − CP (जब SP > CP)' },
      { title: 'हानि', formula: 'हानि = CP − SP (जब CP > SP)' },
      { title: 'लाभ%', formula: 'लाभ% = लाभ/CP × 100' },
      { title: 'हानि%', formula: 'हानि% = हानि/CP × 100' },
      { title: 'SP निकालना', formula: 'SP = CP × (100 ± p%)/100' },
      { title: 'x वस्तुओं का CP = y वस्तुओं का SP', formula: 'लाभ% = (x − y)/y × 100' },
      { title: 'समान SP, समान % लाभ-हानि', formula: 'शुद्ध हानि% = (x/10)²' },
    ],
  },
  {
    topic: 'Discount', topicHi: 'छूट',
    formulas: [
      { title: 'छूट', formula: 'छूट = MP − SP; छूट% = छूट/MP × 100' },
      { title: 'SP', formula: 'SP = MP × (100 − d%)/100' },
      { title: 'क्रमिक छूट (d₁, d₂)', formula: 'समतुल्य छूट = d₁ + d₂ − d₁d₂/100' },
      { title: 'MP (लाभ + छूट साथ में)', formula: 'MP = CP × (100 + p%)/(100 − d%)' },
      { title: 'खरीदें x पाएँ y मुफ्त', formula: 'छूट% = y/(x + y) × 100' },
    ],
  },
  {
    topic: 'Average', topicHi: 'औसत',
    formulas: [
      { title: 'औसत', formula: 'औसत = पदों का योग / पदों की संख्या' },
      { title: 'प्रथम n प्राकृत संख्याएँ', formula: 'औसत = (n + 1)/2' },
      { title: 'प्रथम n विषम संख्याएँ', formula: 'औसत = n' },
      { title: 'प्रथम n सम संख्याएँ', formula: 'औसत = n + 1' },
      { title: 'समान दूरी की औसत चाल', formula: 'औसत चाल = 2ab/(a + b)' },
    ],
  },
  {
    topic: 'Ratio and Proportion', topicHi: 'अनुपात एवं समानुपात',
    formulas: [
      { title: 'अनुपात', formula: 'a : b = a/b' },
      { title: 'समानुपात', formula: 'a : b :: c : d ⇒ ad = bc' },
      { title: 'मध्यानुपाती (a, b के बीच)', formula: 'x = √(ab)' },
      { title: 'तृतीयानुपाती (a, b का)', formula: 'x = b²/a' },
      { title: 'चौथ्यानुपाती', formula: 'a : b :: c : x ⇒ x = bc/a' },
    ],
  },
  {
    topic: 'Simple Interest', topicHi: 'साधारण ब्याज',
    formulas: [
      { title: 'साधारण ब्याज', formula: 'SI = P × R × T/100' },
      { title: 'मिश्रधन', formula: 'A = P + SI' },
      { title: 'दर', formula: 'R = SI × 100/(P × T)' },
      { title: 'n गुना होने में समय', formula: 'T = (n − 1)/R × 100' },
    ],
  },
  {
    topic: 'Compound Interest', topicHi: 'चक्रवृद्धि ब्याज',
    formulas: [
      { title: 'मिश्रधन', formula: 'A = P(1 + R/100)^T' },
      { title: 'CI', formula: 'CI = A − P' },
      { title: '2 वर्ष का CI − SI', formula: 'अंतर = P(R/100)²' },
      { title: '3 वर्ष का CI − SI', formula: 'अंतर = P(R/100)²(3 + R/100)' },
      { title: 'अर्ध-वार्षिक', formula: 'दर आधी, समय दोगुना' },
      { title: 'मूल्यह्रास', formula: 'V = P(1 − R/100)^T' },
    ],
  },
  {
    topic: 'Time and Work', topicHi: 'समय एवं कार्य',
    formulas: [
      { title: 'कार्य दर', formula: 'A a दिन में ⇒ 1 दिन का कार्य = 1/a' },
      { title: 'एक साथ (दो व्यक्ति)', formula: 'समय = ab/(a + b) दिन' },
      { title: 'कुशलता और समय', formula: 'कुशलता ∝ 1/समय' },
      { title: 'पुरुष-दिन', formula: 'M₁D₁H₁/W₁ = M₂D₂H₂/W₂' },
      { title: 'मज़दूरी', formula: 'मज़दूरी ∝ किया गया कार्य (दर × समय)' },
    ],
  },
  {
    topic: 'Pipes and Cisterns', topicHi: 'पाइप एवं टंकी',
    formulas: [
      { title: 'भरने की दर', formula: 'a घंटे में भरे ⇒ दर = +1/a' },
      { title: 'खाली करने की दर', formula: 'b घंटे में खाली ⇒ दर = −1/b' },
      { title: 'शुद्ध दर', formula: 'भरने की दरें का योग − खाली करने की दरें' },
    ],
  },
  {
    topic: 'Time, Speed and Distance', topicHi: 'समय, चाल एवं दूरी',
    formulas: [
      { title: 'मूल सूत्र', formula: 'दूरी = चाल × समय' },
      { title: 'किमी/घंटा → मी/से', formula: '× 5/18' },
      { title: 'मी/से → किमी/घंटा', formula: '× 18/5' },
      { title: 'विपरीत दिशा', formula: 'सापेक्ष चाल = चालों का योग' },
      { title: 'समान दिशा', formula: 'सापेक्ष चाल = चालों का अंतर' },
    ],
  },
  {
    topic: 'Train Problems', topicHi: 'रेलगाड़ी',
    formulas: [
      { title: 'खंभा/बिंदु पार करना', formula: 'समय = रेलगाड़ी की लंबाई / चाल' },
      { title: 'प्लेटफार्म पार करना', formula: 'समय = (रेलगाड़ी + प्लेटफार्म की लंबाई) / चाल' },
      { title: 'दो रेलगाड़ियाँ (विपरीत)', formula: 'समय = (L₁ + L₂)/(v₁ + v₂)' },
      { title: 'दो रेलगाड़ियाँ (समान)', formula: 'समय = (L₁ + L₂)/(v₁ − v₂)' },
    ],
  },
  {
    topic: 'Boat and Stream', topicHi: 'नाव एवं धारा',
    formulas: [
      { title: 'धारा के साथ', formula: 'Downstream = नाव + धारा' },
      { title: 'धारा के विपरीत', formula: 'Upstream = नाव − धारा' },
      { title: 'नाव की चाल', formula: 'नाव = (D + U)/2' },
      { title: 'धारा की चाल', formula: 'धारा = (D − U)/2' },
    ],
  },
  {
    topic: 'Algebra', topicHi: 'बीजगणित',
    formulas: [
      { title: '(a + b)²', formula: 'a² + 2ab + b²' },
      { title: '(a − b)²', formula: 'a² − 2ab + b²' },
      { title: 'a² − b²', formula: '(a + b)(a − b)' },
      { title: '(a + b)³', formula: 'a³ + b³ + 3ab(a + b)' },
      { title: 'a³ + b³', formula: '(a + b)(a² − ab + b²)' },
      { title: 'a³ − b³', formula: '(a − b)(a² + ab + b²)' },
      { title: 'a² + b²', formula: '(a + b)² − 2ab' },
      { title: 'x + 1/x = k', formula: 'x² + 1/x² = k² − 2; x³ + 1/x³ = k³ − 3k' },
      { title: 'द्विघात मूल', formula: 'α + β = −b/a; αβ = c/a' },
    ],
  },
  {
    topic: 'Geometry', topicHi: 'ज्यामिति',
    formulas: [
      { title: 'त्रिभुज कोण योग', formula: '∠A + ∠B + ∠C = 180°' },
      { title: 'बहिष्कोण', formula: 'बहिष्कोण = दो अंतर्विपरीत कोणों का योग' },
      { title: 'पाइथागोरस', formula: 'कर्ण² = लंब² + आधार²' },
      { title: 'चतुर्भुज कोण योग', formula: '360°' },
      { title: 'समांतर चतुर्भुज', formula: 'आसन्न कोणों का योग = 180°' },
      { title: 'समरूप त्रिभुज', formula: 'क्षेत्रफल अनुपात = (भुजा अनुपात)²' },
      { title: 'वृत्त की जीवा', formula: 'अर्धजीवा = √(r² − d²)' },
    ],
  },
  {
    topic: 'Mensuration', topicHi: 'क्षेत्रमिति',
    formulas: [
      { title: 'आयत', formula: 'क्षेत्रफल = l × b; परिमाप = 2(l + b)' },
      { title: 'वर्ग', formula: 'क्षेत्रफल = a² = d²/2' },
      { title: 'त्रिभुज', formula: 'क्षेत्रफल = ½ × आधार × ऊँचाई' },
      { title: 'समबाहु त्रिभुज', formula: 'क्षेत्रफल = (√3/4)a²' },
      { title: 'समलंब', formula: 'क्षेत्रफल = ½(a + b) × h' },
      { title: 'वृत्त', formula: 'क्षेत्रफल = πr²; परिधी = 2πr' },
      { title: 'घन', formula: 'आयतन = a³; कुल पृष्ठ = 6a²' },
      { title: 'घनाभ', formula: 'आयतन = lbh; पृष्ठ = 2(lb + bh + lh)' },
      { title: 'बेलन', formula: 'आयतन = πr²h; वक्र पृष्ठ = 2πrh' },
      { title: 'शंकु', formula: 'आयतन = (1/3)πr²h; तिर्यक पृष्ठ = πrl' },
      { title: 'गोला', formula: 'आयतन = (4/3)πr³; पृष्ठ = 4πr²' },
    ],
  },
  {
    topic: 'Trigonometry', topicHi: 'त्रिकोणमिति',
    formulas: [
      { title: 'मूल सर्वसमिका', formula: 'sin²θ + cos²θ = 1' },
      { title: 'अन्य सर्वसमिकाएँ', formula: 'sec²θ − tan²θ = 1; cosec²θ − cot²θ = 1' },
      { title: 'पूरक कोण', formula: 'sinθ = cos(90° − θ); tanθ = cot(90° − θ)' },
      { title: 'मानक मान', formula: 'sin30° = 1/2, cos60° = 1/2, tan45° = 1' },
      { title: '√ मान', formula: 'sin45° = 1/√2, sin60° = √3/2, tan30° = 1/√3' },
      { title: 'ऊँचाई-दूरी', formula: 'tanθ = ऊँचाई/क्षैतिज दूरी' },
    ],
  },
  {
    topic: 'Number System', topicHi: 'संख्या पद्धति',
    formulas: [
      { title: 'प्रथम n प्राकृत संख्याओं का योग', formula: 'n(n + 1)/2' },
      { title: 'प्रथम n वर्गों का योग', formula: 'n(n + 1)(2n + 1)/6' },
      { title: 'प्रथम n घनों का योग', formula: '[n(n + 1)/2]²' },
      { title: 'विभाजन शेषफल', formula: 'N = dq + r, 0 ≤ r < d' },
      { title: 'HCF × LCM', formula: 'दो संख्याओं का गुणनफल' },
    ],
  },
  {
    topic: 'Mixture and Alligation', topicHi: 'मिश्रण',
    formulas: [
      { title: 'मिश्रण नियम', formula: '(महँगा − M)/(M − सस्ता) = मात्रा अनुपात' },
      { title: 'मिश्रण की कीमत', formula: '(कुल कीमत)/(कुल मात्रा)' },
      { title: 'प्रतिस्थापन', formula: 'शेष मूल द्रव्य = कुल × (1 − r/T)ⁿ' },
    ],
  },
  {
    topic: 'Partnership', topicHi: 'साझेदारी',
    formulas: [
      { title: 'लाभ वितरण', formula: 'लाभ ∝ पूँजी × समय' },
      { title: 'अनुपात', formula: 'A : B = P₁T₁ : P₂T₂' },
    ],
  },
  {
    topic: 'Statistics', topicHi: 'सांख्यिकी',
    formulas: [
      { title: 'माध्य', formula: 'Σx/n' },
      { title: 'माध्यिका (विषम n)', formula: '((n + 1)/2)वाँ पद' },
      { title: 'माध्यिका (सम n)', formula: 'दो मध्य पदों का औसत' },
      { title: 'बहुलक', formula: 'सर्वाधिक बारंबारता वाला मान' },
      { title: 'परिसर', formula: 'अधिकतम − न्यूनतम' },
    ],
  },
];
