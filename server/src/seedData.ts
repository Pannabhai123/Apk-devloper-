/**
 * Demo seed content. Every question below is an ORIGINAL practice question
 * written for this project. None of it is copied from any published book and
 * none of it is presented as a verified previous-year examination question.
 * Replace it with your own licensed content through the Admin Panel.
 */

export type SeedQuestion = {
  topic: string;
  difficulty: 'easy' | 'medium' | 'hard';
  text: string;
  options: [string, string, string, string];
  correct: number; // 1-based
  explanation: string;
  hi?: string;
};

export const SUBJECTS: { slug: string; name: string; nameHi: string; icon: string; topics: { slug: string; name: string }[] }[] = [
  { slug: 'physics', name: 'Physics', nameHi: 'भौतिक विज्ञान', icon: 'atom', topics: [
    { slug: 'mechanics', name: 'Mechanics' }, { slug: 'electricity', name: 'Electricity' }, { slug: 'optics', name: 'Optics' } ] },
  { slug: 'chemistry', name: 'Chemistry', nameHi: 'रसायन विज्ञान', icon: 'flask', topics: [
    { slug: 'atomic-structure', name: 'Atomic Structure' }, { slug: 'chemical-reactions', name: 'Chemical Reactions' }, { slug: 'periodic-table', name: 'Periodic Table' } ] },
  { slug: 'biology', name: 'Biology', nameHi: 'जीव विज्ञान', icon: 'leaf', topics: [
    { slug: 'cell-biology', name: 'Cell Biology' }, { slug: 'human-body', name: 'Human Body' }, { slug: 'genetics', name: 'Genetics' } ] },
  { slug: 'history', name: 'History', nameHi: 'इतिहास', icon: 'landmark', topics: [
    { slug: 'ancient-india', name: 'Ancient India' }, { slug: 'medieval-india', name: 'Medieval India' }, { slug: 'modern-india', name: 'Modern India' } ] },
  { slug: 'geography', name: 'Geography', nameHi: 'भूगोल', icon: 'globe', topics: [
    { slug: 'physical-geography', name: 'Physical Geography' }, { slug: 'indian-geography', name: 'Indian Geography' }, { slug: 'world-geography', name: 'World Geography' } ] },
  { slug: 'polity', name: 'Indian Polity', nameHi: 'भारतीय राजव्यवस्था', icon: 'scale', topics: [
    { slug: 'constitution', name: 'Constitution' }, { slug: 'parliament', name: 'Parliament' }, { slug: 'fundamental-rights', name: 'Fundamental Rights' } ] },
  { slug: 'mathematics', name: 'Mathematics', nameHi: 'गणित', icon: 'sigma', topics: [
    { slug: 'arithmetic', name: 'Arithmetic' }, { slug: 'algebra', name: 'Algebra' }, { slug: 'geometry', name: 'Geometry' } ] },
  { slug: 'reasoning', name: 'Reasoning', nameHi: 'तर्कशक्ति', icon: 'brain', topics: [
    { slug: 'analogies', name: 'Analogies' }, { slug: 'series', name: 'Series' }, { slug: 'logical-reasoning', name: 'Logical Reasoning' } ] },
  { slug: 'computer', name: 'Computer', nameHi: 'कंप्यूटर', icon: 'monitor', topics: [
    { slug: 'computer-fundamentals', name: 'Computer Fundamentals' }, { slug: 'ms-office', name: 'MS Office' }, { slug: 'internet-security', name: 'Internet & Security' } ] },
  { slug: 'english', name: 'English', nameHi: 'अंग्रेज़ी', icon: 'languages', topics: [
    { slug: 'grammar', name: 'Grammar' }, { slug: 'vocabulary', name: 'Vocabulary' }, { slug: 'comprehension', name: 'Comprehension' } ] },
  { slug: 'current-affairs', name: 'Current Affairs', nameHi: 'समसामयिकी', icon: 'newspaper', topics: [
    { slug: 'national', name: 'National' }, { slug: 'international', name: 'International' }, { slug: 'science-tech', name: 'Science & Technology' } ] },
  { slug: 'bihar-gk', name: 'Bihar GK', nameHi: 'बिहार सामान्य ज्ञान', icon: 'map-pin', topics: [
    { slug: 'bihar-history', name: 'Bihar History' }, { slug: 'bihar-geography', name: 'Bihar Geography' }, { slug: 'bihar-culture', name: 'Bihar Culture' } ] },
  { slug: 'teaching-aptitude', name: 'Teaching Aptitude', nameHi: 'शिक्षण अभिरुचि', icon: 'graduation-cap', topics: [
    { slug: 'pedagogy', name: 'Pedagogy' }, { slug: 'child-development', name: 'Child Development' }, { slug: 'assessment', name: 'Assessment' } ] },
];

/** topic|difficulty|question|A|B|C|D|correct(1-4)|explanation */
const BANK: Record<string, string[]> = {
  physics: [
    'mechanics|easy|The SI unit of force is|A|Newton|B|Joule|C|Watt|D|Pascal|1|Force is measured in newtons (N); one newton accelerates 1 kg by 1 m/s².',
    'mechanics|medium|A body moving with uniform velocity has|non-zero acceleration|B|zero acceleration|C|increasing momentum|D|variable speed|2|Uniform velocity means both speed and direction are constant, so acceleration is zero.',
    'mechanics|medium|The rate of change of momentum is equal to|displacement|B|velocity|C|applied force|D|work done|3|Newton’s second law states that net force equals the rate of change of momentum.',
    'mechanics|hard|The escape velocity from the surface of the Earth is approximately|5.6 km/s|B|7.9 km/s|C|11.2 km/s|D|15.0 km/s|3|Escape velocity at Earth’s surface is about 11.2 km/s.',
    'mechanics|easy|Which quantity is a scalar?|Velocity|B|Force|C|Speed|D|Acceleration|3|Speed has magnitude only; the others are vectors.',
    'electricity|easy|The SI unit of electric current is|Volt|B|Ampere|C|Ohm|D|Coulomb|2|Electric current is measured in amperes (A).',
    'electricity|medium|Ohm’s law relates voltage (V), current (I) and|power|B|resistance|C|capacitance|D|inductance|2|V = IR, where R is resistance.',
    'electricity|medium|In a series circuit, the quantity that remains the same through every component is|voltage|B|current|C|resistance|D|power|2|Current is identical through components connected in series.',
    'electricity|hard|The reciprocal of resistance is called|conductance|B|capacitance|C|inductance|D|impedance|1|Conductance G = 1/R, measured in siemens.',
    'optics|easy|The speed of light in vacuum is approximately|3 × 10⁶ m/s|B|3 × 10⁸ m/s|C|3 × 10¹⁰ m/s|D|3 × 10⁵ m/s|2|Light travels at about 3 × 10⁸ m/s in vacuum.',
    'optics|medium|A concave lens is also known as a|converging lens|B|diverging lens|C|plane lens|D|cylindrical lens|2|A concave lens diverges parallel rays and is called a diverging lens.',
    'optics|medium|The phenomenon responsible for the formation of a rainbow is|reflection only|B|refraction and dispersion|C|diffraction only|D|polarization only|2|Rainbows arise from refraction, internal reflection and dispersion in water droplets.',
    'optics|hard|The power of a lens is measured in|joule|B|watt|C|dioptre|D|lumen|3|Lens power P = 1/f (metres), measured in dioptres.',
  ],
  chemistry: [
    'atomic-structure|easy|The particle with a negative charge in an atom is|proton|B|neutron|C|electron|D|nucleus|3|Electrons carry a negative charge and orbit the nucleus.',
    'atomic-structure|medium|The mass number of an atom equals the number of|protons only|B|protons and neutrons|C|electrons and protons|D|neutrons only|2|Mass number A = protons + neutrons in the nucleus.',
    'atomic-structure|medium|Isotopes of an element have the same number of|neutrons|B|protons|C|nucleons|D|electrons and neutrons|2|Isotopes share the same atomic number (protons) but differ in neutron count.',
    'atomic-structure|hard|The maximum number of electrons in the M shell is|2|B|8|C|18|D|32|3|The third shell (n = 3) can hold 2n² = 18 electrons.',
    'chemical-reactions|easy|Rusting of iron is an example of|neutralisation|B|oxidation|C|sublimation|D|dissolution|2|Rusting is oxidation of iron in the presence of oxygen and moisture.',
    'chemical-reactions|medium|The pH of a neutral solution at 25°C is|0|B|7|C|10|D|14|2|A neutral aqueous solution at 25 °C has pH 7.',
    'chemical-reactions|medium|Which gas is released when an acid reacts with a metal carbonate?|Oxygen|B|Hydrogen|C|Carbon dioxide|D|Nitrogen|3|Acid + carbonate produces salt, water and carbon dioxide.',
    'chemical-reactions|hard|In a balanced chemical equation, the total mass of reactants is|greater than products|B|equal to products|C|less than products|D|unrelated|2|The law of conservation of mass requires equal total mass on both sides.',
    'periodic-table|easy|The chemical symbol of sodium is|S|B|Na|C|So|D|N|2|Sodium derives its symbol Na from the Latin natrium.',
    'periodic-table|medium|Which group of the periodic table contains the noble gases?|Group 1|B|Group 7|C|Group 17|D|Group 18|4|Noble gases occupy Group 18 and are largely inert.',
    'periodic-table|hard|The most electronegative element is|oxygen|B|chlorine|C|fluorine|D|nitrogen|3|Fluorine has the highest electronegativity on the Pauling scale.',
  ],
  biology: [
    'cell-biology|easy|The basic structural and functional unit of life is|tissue|B|organ|C|cell|D|system|3|The cell is the smallest unit capable of life processes.',
    'cell-biology|medium|The powerhouse of the cell is|ribosome|B|mitochondrion|C|nucleus|D|Golgi body|2|Mitochondria generate most of the cell’s ATP.',
    'cell-biology|medium|Photosynthesis in plants mainly occurs in|roots|B|chloroplasts|C|stems|D|flowers|2|Chloroplasts contain chlorophyll that captures light energy.',
    'cell-biology|hard|The organelle responsible for protein synthesis is|lysosome|B|ribosome|C|vacuole|D|centriole|2|Ribosomes translate messenger RNA into polypeptide chains.',
    'human-body|easy|The normal adult human heart beats about|20 times/min|B|72 times/min|C|200 times/min|D|500 times/min|2|A resting adult heart rate is roughly 60–100 beats per minute.',
    'human-body|medium|Which blood cells help in clotting?|RBC|B|WBC|C|Platelets|D|Plasma|3|Platelets (thrombocytes) form clots at injury sites.',
    'human-body|medium|Insulin is produced by the|liver|B|pancreas|C|kidney|D|thyroid|2|Beta cells of the pancreatic islets secrete insulin.',
    'human-body|hard|The functional unit of the kidney is|alveolus|B|nephron|C|neuron|D|villus|2|Each kidney contains about a million nephrons that filter blood.',
    'genetics|easy|The molecule carrying genetic information in most organisms is|RNA|B|DNA|C|ATP|D|Glucose|2|DNA stores hereditary information in most living organisms.',
    'genetics|medium|The number of chromosomes in a normal human body cell is|23|B|46|C|44|D|48|2|Human somatic cells are diploid with 46 chromosomes (23 pairs).',
    'genetics|hard|A change in the nucleotide sequence of DNA is called|translation|B|transcription|C|mutation|D|replication|3|Mutations are permanent alterations in the DNA sequence.',
  ],
  history: [
    'ancient-india|easy|The Indus Valley civilisation is also known as the|Vedic civilisation|B|Harappan civilisation|C|Mauryan civilisation|D|Gupta civilisation|2|Harappa was the first excavated site of the Indus Valley civilisation.',
    'ancient-india|medium|The ancient university of Nalanda was located in present-day|Uttar Pradesh|B|Bihar|C|Madhya Pradesh|D|Odisha|2|Nalanda Mahavihara was a renowned ancient centre of learning in Bihar.',
    'ancient-india|medium|Ashoka’s edicts were primarily inscribed on|palm leaves|B|rocks and pillars|C|paper|D|copper coins|2|Ashoka’s dhamma was recorded on rock edicts and polished sandstone pillars.',
    'ancient-india|hard|The Arthashastra is traditionally attributed to|Kalidasa|B|Chanakya|C|Banabhatta|D|Fa-Hien|2|Chanakya (Kautilya) is the traditional author of the Arthashastra.',
    'medieval-india|easy|The Qutub Minar in Delhi was begun by|Akbar|B|Qutb al-Din Aibak|C|Shah Jahan|D|Babur|2|Qutb al-Din Aibak started its construction around 1199 CE.',
    'medieval-india|medium|The Mughal emperor known for religious tolerance and Din-i Ilahi was|Babur|B|Akbar|C|Aurangzeb|D|Jahangir|2|Akbar promoted dialogue among religions and founded Din-i Ilahi.',
    'medieval-india|medium|The founder of the Vijayanagara Empire was|Krishnadevaraya|B|Harihara and Bukka|C|Shivaji|D|Rana Pratap|2|Harihara I and Bukka Raya I founded Vijayanagara in 1336.',
    'modern-india|easy|The First War of Indian Independence took place in|1757|B|1857|C|1905|D|1919|2|The uprising of 1857 is often called the First War of Independence.',
    'modern-india|medium|The Dandi March of 1930 was led by|Jawaharlal Nehru|B|Mahatma Gandhi|C|Subhas Chandra Bose|D|Sardar Patel|2|Gandhi led the Salt Satyagraha from Sabarmati to Dandi.',
    'modern-india|medium|The Indian National Congress was founded in|1885|B|1905|C|1919|D|1920|1|The INC held its first session in Bombay in December 1885.',
    'modern-india|hard|The Government of India Act that introduced provincial autonomy was the Act of|1858|B|1909|C|1919|D|1935|4|The 1935 Act introduced provincial autonomy and a federal scheme.',
  ],
  geography: [
    'physical-geography|easy|The layer of the Earth on which we live is called the|mantle|B|core|C|crust|D|asthenosphere|3|The crust is the Earth’s thin, solid outermost layer.',
    'physical-geography|medium|The Richter scale measures the|intensity of rainfall|B|magnitude of earthquakes|C|speed of wind|D|depth of oceans|2|The Richter scale expresses earthquake magnitude logarithmically.',
    'physical-geography|medium|Which process wears away rocks by wind and water?|Volcanism|B|Erosion|C|Folding|D|Faulting|2|Erosion is the removal and transport of weathered material.',
    'indian-geography|easy|The longest river flowing entirely within India is|Ganga|B|Godavari|C|Narmada|D|Krishna|2|The Godavari is often called the Dakshin Ganga and is the longest intra-Indian river.',
    'indian-geography|medium|The southernmost point of the Indian mainland is|Kanyakumari|B|Indira Point|C|Cape Comorin|D|Kovalam|1|Kanyakumari (Cape Comorin) is the southern tip of mainland India; Indira Point is on an island.',
    'indian-geography|medium|Which state is known as the Land of Five Rivers?|Bihar|B|Punjab|C|Assam|D|Kerala|2|Punjab is named for the five rivers of the region.',
    'world-geography|easy|The largest ocean on Earth is the|Atlantic|B|Indian|C|Pacific|D|Arctic|3|The Pacific is the largest and deepest ocean.',
    'world-geography|medium|The Sahara Desert is located in|Asia|B|South America|C|Africa|D|Australia|3|The Sahara spans much of North Africa.',
    'world-geography|hard|The Prime Meridian passes through|Paris|B|Greenwich|C|New York|D|Tokyo|2|The zero-degree longitude line passes through Greenwich, London.',
  ],
  polity: [
    'constitution|easy|The Constitution of India came into effect on|15 August 1947|B|26 January 1950|C|26 November 1949|D|2 October 1950|2|The Constitution commenced on 26 January 1950, celebrated as Republic Day.',
    'constitution|medium|The Preamble describes India as a|Sovereign Socialist Secular Democratic Republic|B|Federal Monarchy|C|Unitary State only|D|Confederation|1|The 42nd Amendment added Socialist, Secular and Integrity to the Preamble description.',
    'constitution|medium|The Constituent Assembly adopted the Constitution on|26 January 1950|B|26 November 1949|C|15 August 1947|D|9 December 1946|2|The Assembly adopted it on 26 November 1949, now Constitution Day.',
    'constitution|hard|Which part of the Constitution deals with Fundamental Rights?|Part II|B|Part III|C|Part IV|D|Part V|2|Fundamental Rights are enumerated in Part III, Articles 12–35.',
    'parliament|easy|The Lok Sabha is also known as the|Council of States|B|House of the People|C|Upper House|D|Senate|2|The Lok Sabha is the directly elected House of the People.',
    'parliament|medium|The maximum strength of the Lok Sabha provided by the Constitution is|545|B|550|C|552|D|543|3|The Constitution provides for a maximum of 552 members in the Lok Sabha.',
    'parliament|medium|Money Bills can be introduced only in|Rajya Sabha|B|Lok Sabha|C|either House|D|State Assemblies|2|Article 109 requires Money Bills to originate in the Lok Sabha.',
    'fundamental-rights|easy|The Right to Equality is guaranteed under Articles|14–18|B|19–22|C|23–24|D|25–28|1|Articles 14 to 18 cover equality before law and abolition of untouchability.',
    'fundamental-rights|medium|The writ of Habeas Corpus protects against|illegal detention|B|illegal tax|C|defamation|D|contract breach|1|Habeas Corpus requires a detained person to be produced before a court.',
    'fundamental-rights|hard|Fundamental Rights can be suspended during a National Emergency under|Article 352 only with no exceptions|B|Article 359 as specified by the President|C|Article 356|D|Article 368|2|Article 359 allows the President to suspend enforcement of specified rights.',
  ],
  mathematics: [
    'arithmetic|easy|What is 25% of 240?|40|B|50|C|60|D|80|3|240 × 25/100 = 60.',
    'arithmetic|medium|A shopkeeper sells an item costing ₹400 for ₹460. His profit percentage is|10%|B|12%|C|15%|D|20%|3|Profit = 60; 60/400 × 100 = 15%.',
    'arithmetic|medium|The simple interest on ₹2,000 at 5% per annum for 3 years is|₹200|B|₹300|C|₹400|D|₹450|2|SI = PRT/100 = 2000 × 5 × 3 / 100 = ₹300.',
    'arithmetic|hard|If a train travels 180 km in 3 hours, its average speed is|50 km/h|B|54 km/h|C|60 km/h|D|72 km/h|3|Speed = distance/time = 180/3 = 60 km/h.',
    'algebra|easy|If x + 5 = 12, then x equals|5|B|7|C|12|D|17|2|Subtracting 5 from both sides gives x = 7.',
    'algebra|medium|The value of 2³ × 2² is|16|B|24|C|32|D|64|3|2³ × 2² = 2⁵ = 32.',
    'algebra|medium|The solution of 3x − 9 = 0 is|x = 0|B|x = 3|C|x = 9|D|x = −3|2|3x = 9 so x = 3.',
    'algebra|hard|If a² = 49 and a > 0, then a is|−7|B|7|C|49|D|14|2|The positive square root of 49 is 7.',
    'geometry|easy|The sum of angles in a triangle is|90°|B|180°|C|270°|D|360°|2|The interior angles of any triangle total 180 degrees.',
    'geometry|medium|The area of a circle of radius 7 cm using π = 22/7 is|44 cm²|B|154 cm²|C|220 cm²|D|308 cm²|2|Area = πr² = 22/7 × 49 = 154 cm².',
    'geometry|hard|In a right triangle with legs 3 cm and 4 cm, the hypotenuse is|5 cm|B|6 cm|C|7 cm|D|12 cm|1|3² + 4² = 25, so the hypotenuse is √25 = 5 cm.',
  ],
  reasoning: [
    'analogies|easy|Bird is to Nest as Bee is to|Hive|B|Web|C|Burrow|D|Den|1|Bees live in a hive just as birds live in a nest.',
    'analogies|medium|Doctor is to Hospital as Teacher is to|Court|B|School|C|Bank|D|Studio|2|A teacher characteristically works in a school.',
    'series|easy|Find the next number: 2, 4, 6, 8, ...|9|B|10|C|12|D|14|2|The series increases by 2 each step, so 10 follows.',
    'series|medium|Find the missing term: 3, 9, 27, __, 243|54|B|64|C|81|D|108|3|Each term is multiplied by 3; 27 × 3 = 81.',
    'series|hard|Find the next term: 1, 4, 9, 16, ...|20|B|24|C|25|D|36|3|These are perfect squares: 1², 2², 3², 4², then 5² = 25.',
    'logical-reasoning|easy|If all roses are flowers and some flowers fade, then|all roses fade|B|some roses may fade|C|no rose fades|D|roses are not flowers|2|The statements allow but do not guarantee that some roses fade.',
    'logical-reasoning|medium|Pointing to a man, Rita says, “His mother is my mother’s only daughter.” Rita is the man’s|sister|B|mother|C|aunt|D|cousin|2|Rita’s mother’s only daughter is Rita herself, so she is his mother.',
    'logical-reasoning|hard|In a row of 20 students, Aman is 7th from the left. His position from the right is|12th|B|13th|C|14th|D|15th|3|Position from right = 20 − 7 + 1 = 14.',
  ],
  computer: [
    'computer-fundamentals|easy|CPU stands for|Central Processing Unit|B|Computer Personal Unit|C|Central Program Utility|D|Control Processing Unit|1|The CPU executes instructions and is the primary processor.',
    'computer-fundamentals|medium|Which of the following is volatile memory?|Hard disk|B|RAM|C|SSD|D|DVD|2|RAM loses its contents when power is switched off.',
    'computer-fundamentals|medium|1 gigabyte (GB) is commonly equal to|1024 bytes|B|1024 kilobytes|C|1024 megabytes|D|1000 bits|3|1 GB = 1024 MB in the binary convention.',
    'computer-fundamentals|hard|The binary equivalent of the decimal number 9 is|1001|B|1010|C|1100|D|0111|1|9 = 8 + 1 = 1001 in binary.',
    'ms-office|easy|In MS Excel, a formula always begins with|=|B|#|C|@|D|$|1|Excel formulas start with the equals sign.',
    'ms-office|medium|The keyboard shortcut to save a document in most office applications is|Ctrl + P|B|Ctrl + S|C|Ctrl + C|D|Alt + F4|2|Ctrl + S saves the current file.',
    'ms-office|medium|In MS Word, Ctrl + B applies|italics|B|underline|C|bold|D|centre alignment|3|Ctrl + B toggles bold formatting.',
    'internet-security|easy|HTTP stands for|Hyper Text Transfer Protocol|B|High Transfer Text Protocol|C|Hyperlink Transfer Program|D|Host Text Transfer Process|1|HTTP is the application protocol used to transfer web pages.',
    'internet-security|medium|A strong password should contain|only your name|B|only numbers|C|a mix of letters, numbers and symbols|D|only lowercase letters|3|Long passphrases mixing character classes are harder to guess.',
    'internet-security|medium|Phishing is a technique used to|speed up a computer|B|steal credentials by impersonation|C|compress files|D|scan for viruses|2|Phishing tricks users into revealing passwords or financial data.',
    'internet-security|hard|HTTPS adds security to HTTP primarily through|faster caching|B|TLS encryption|C|image compression|D|DNS blocking|2|HTTPS wraps HTTP in TLS to protect data in transit.',
  ],
  english: [
    'grammar|easy|Choose the correct plural:|childs|B|children|C|childes|D|childrens|2|The irregular plural of child is children.',
    'grammar|medium|She ___ to school every day.|go|B|goes|C|going|D|gone|2|With a third-person singular subject, use “goes”.',
    'grammar|medium|Identify the tense: “They had finished the work.”|Simple past|B|Past perfect|C|Present perfect|D|Future perfect|2|“Had finished” is the past perfect tense.',
    'vocabulary|easy|The antonym of “scarce” is|rare|B|abundant|C|meagre|D|limited|2|Scarce means in short supply; abundant means plentiful.',
    'vocabulary|medium|“Benevolent” most nearly means|harmful|B|kind and generous|C|careless|D|angry|2|Benevolent describes a person who is well-meaning and charitable.',
    'comprehension|medium|In the sentence “The diligent student revised daily,” diligent means|lazy|B|hardworking|C|noisy|D|forgetful|2|Diligent means showing careful and persistent effort.',
  ],
  'current-affairs': [
    'national|easy|Which body conducts the Census of India?|Election Commission|B|Office of the Registrar General|C|NITI Aayog|D|Reserve Bank of India|2|The Census is conducted by the Office of the Registrar General and Census Commissioner.',
    'national|medium|The headquarters of the Reserve Bank of India is in|New Delhi|B|Mumbai|C|Kolkata|D|Chennai|2|The RBI is headquartered in Mumbai.',
    'national|medium|NITI Aayog was constituted in|2010|B|2014|C|2015|D|2017|3|NITI Aayog replaced the Planning Commission in 2015.',
    'international|easy|The headquarters of the United Nations is in|Geneva|B|New York|C|Paris|D|Vienna|2|The UN is headquartered in New York City.',
    'international|medium|Which organisation publishes the World Economic Outlook?|World Bank|B|International Monetary Fund|C|WTO|D|WHO|2|The IMF publishes the World Economic Outlook report.',
    'international|medium|The number of Sustainable Development Goals is|8|B|15|C|17|D|21|3|The UN 2030 Agenda contains 17 SDGs.',
    'science-tech|easy|GPS stands for|Global Positioning System|B|General Positioning Service|C|Geographic Public System|D|Global Programme Signal|1|GPS is a satellite-based global positioning system.',
    'science-tech|medium|The Chandrayaan-3 mission was launched by|NASA|B|ISRO|C|ESA|D|JAXA|2|ISRO launched Chandrayaan-3, India’s third lunar mission.',
    'science-tech|hard|The term “Artificial Intelligence” was coined at a conference at|MIT|B|Dartmouth College|C|Stanford|D|Oxford|2|The phrase was coined for the 1956 Dartmouth workshop.',
  ],
  'bihar-gk': [
    'bihar-history|easy|The ancient kingdom of Maghad had its capital at|Vaishali|B|Rajgir|C|Patna|D|Nalanda|2|Rajgir was an early capital of Magadha before Pataliputra.',
    'bihar-history|medium|The Champaran Satyagraha of 1917 was associated with|Mahatma Gandhi|B|Jawaharlal Nehru|C|Subhas Bose|D|Bhagat Singh|1|Gandhi’s first major satyagraha in India was at Champaran, Bihar.',
    'bihar-history|medium|Pataliputra is the ancient name of|Gaya|B|Patna|C|Muzaffarpur|D|Bhagalpur|2|Modern Patna occupies the site of ancient Pataliputra.',
    'bihar-geography|easy|Which river flows through Patna?|Gandak|B|Ganga|C|Kosi|D|Son|2|The Ganga flows along the northern edge of Patna.',
    'bihar-geography|medium|The Kosi river is often called the|Sorrow of Bihar|B|Ganga of Bihar|C|Lifeline of Bihar|D|Golden river|1|The Kosi’s frequent floods earned it the name “Sorrow of Bihar”.',
    'bihar-geography|medium|Bihar shares its eastern border with|Uttar Pradesh|B|Jharkhand|C|West Bengal|D|Nepal|3|West Bengal lies to the east of Bihar; Nepal is to the north.',
    'bihar-culture|easy|Chhath Puja is primarily dedicated to|Lord Shiva|B|the Sun God|C|Goddess Lakshmi|D|Lord Krishna|2|Chhath is dedicated to Surya, the Sun God, and Chhathi Maiya.',
    'bihar-culture|medium|Madhubani painting is traditionally associated with the|Mithila region|B|Chota Nagpur|C|Bhojpur region|D|Magadh region|1|Madhubani (Mithila) painting originates in north Bihar’s Mithila region.',
    'bihar-culture|hard|Bihar Day (Bihar Diwas) is celebrated on|22 March|B|26 January|C|15 August|D|2 October|1|22 March marks the formation of the state of Bihar in 1912.',
  ],
  'teaching-aptitude': [
    'pedagogy|easy|Learning by doing is most closely associated with|John Dewey|B|Pavlov|C|Skinner|D|Piaget|1|Dewey emphasised experiential, hands-on learning.',
    'pedagogy|medium|The zone of proximal development was proposed by|Vygotsky|B|Freud|C|Thorndike|D|Kohlberg|1|Vygotsky introduced the ZPD to describe guided learning potential.',
    'pedagogy|medium|Teaching aids are primarily used to|replace the teacher|B|make learning concrete and engaging|C|shorten the syllabus|D|reduce attendance|2|Teaching aids support explanation and multi-sensory understanding.',
    'child-development|easy|Childhood is generally considered a period of|stagnation|B|rapid growth and development|C|decline|D|no learning|2|Childhood involves rapid physical, cognitive and social development.',
    'child-development|medium|According to Piaget, the sensorimotor stage spans roughly|0–2 years|B|2–7 years|C|7–11 years|D|11+ years|1|The sensorimotor stage covers infancy from birth to about two years.',
    'assessment|easy|A test conducted at the end of a course is called|formative|B|summative|C|diagnostic|D|placement|2|Summative assessment evaluates learning after instruction.',
    'assessment|medium|Formative assessment is mainly used to|award final grades|B|monitor learning and give feedback|C|rank schools|D|issue certificates|2|Formative assessment guides ongoing teaching and learning.',
    'assessment|hard|The term “rubric” in assessment refers to|a scoring guide with criteria|B|the school timetable|C|the syllabus|D|a textbook|1|Rubrics describe performance criteria and achievement levels.',
  ],
};

export function parseBank(): Record<string, SeedQuestion[]> {
  const out: Record<string, SeedQuestion[]> = {};
  for (const [subject, lines] of Object.entries(BANK)) {
    out[subject] = lines.map((line) => {
      const parts = line.split('|');
      // Shorthand: topic|difficulty|text|<four options, optionally interspersed
      // with A/B/C/D labels>|correct(1-4)|explanation
      if (parts.length < 9) throw new Error(`Invalid seed question line in ${subject}: ${line}`);
      const correct = parts[parts.length - 2];
      const explanation = parts[parts.length - 1];
      const tail = parts.slice(3, -2).filter((p) => !/^[A-D]$/.test(p));
      if (tail.length !== 4) throw new Error(`Invalid options in seed line: ${line}`);
      return {
        topic: parts[0],
        difficulty: parts[1] as SeedQuestion['difficulty'],
        text: parts[2],
        options: tail as SeedQuestion['options'],
        correct: Number(correct),
        explanation,
      };
    });
  }
  return out;
}

/** Hand-written Hindi translations for a subset of the demo bank. */
export const HINDI_TRANSLATIONS: Record<string, string> = {
  'The SI unit of force is': 'बल का SI मात्रक है',
  'A body moving with uniform velocity has': 'समान वेग से गतिमान वस्तु में होता है',
  'The rate of change of momentum is equal to': 'संवेग परिवर्तन की दर बराबर होती है',
  'The escape velocity from the surface of the Earth is approximately': 'पृथ्वी की सतह से पलायन वेग लगभग है',
  'Which quantity is a scalar?': 'कौन-सी राशि अदिश है?',
  'The SI unit of electric current is': 'विद्युत धारा का SI मात्रक है',
  'Ohm’s law relates voltage (V), current (I) and': 'ओम का नियम वोल्टता (V), धारा (I) और — से संबंधित है',
  'In a series circuit, the quantity that remains the same through every component is': 'श्रेणी परिपथ में प्रत्येक घटक से होकर समान रहने वाली राशि है',
  'The reciprocal of resistance is called': 'प्रतिरोध के व्युत्क्रम को कहते हैं',
  'The speed of light in vacuum is approximately': 'निर्वात में प्रकाश की चाल लगभग है',
  'A concave lens is also known as a': 'अवतल लेंस को कहा जाता है',
  'The phenomenon responsible for the formation of a rainbow is': 'इंद्रधनुष के निर्माण के लिए उत्तरदायी परिघटना है',
  'The power of a lens is measured in': 'लेंस की क्षमता मापी जाती है',
  'The particle with a negative charge in an atom is': 'परमाणु में ऋणावेश वाला कण है',
  'The mass number of an atom equals the number of': 'किसी परमाणु की द्रव्यमान संख्या बराबर होती है',
  'Isotopes of an element have the same number of': 'किसी तत्व के समस्थानिकों में समान संख्या होती है',
  'The maximum number of electrons in the M shell is': 'M कोश में इलेक्ट्रॉनों की अधिकतम संख्या है',
  'Rusting of iron is an example of': 'लोहे में जंग लगना किसका उदाहरण है',
  'The pH of a neutral solution at 25°C is': '25°C पर उदासीन विलयन का pH होता है',
  'Which gas is released when an acid reacts with a metal carbonate?': 'अम्ल की धातु कार्बोनेट से अभिक्रिया पर कौन-सी गैस निकलती है?',
  'The chemical symbol of sodium is': 'सोडियम का रासायनिक प्रतीक है',
  'Which group of the periodic table contains the noble gases?': 'आवर्त सारणी के किस समूह में उत्कृष्ट गैसें हैं?',
  'The most electronegative element is': 'सबसे अधिक विद्युत्-ऋणात्मक तत्व है',
  'The basic structural and functional unit of life is': 'जीवन की मूल संरचनात्मक और क्रियात्मक इकाई है',
  'The powerhouse of the cell is': 'कोशिका का शक्तिगृह है',
  'The normal adult human heart beats about': 'सामान्य वयस्क मानव हृदय लगभग बार धड़कता है',
  'The Constitution of India came into effect on': 'भारत का संविधान कब लागू हुआ?',
  'The Preamble describes India as a': 'प्रस्तावना भारत को कैसा बताती है?',
  'The Lok Sabha is also known as the': 'लोकसभा को कहा जाता है',
  'What is 25% of 240?': '240 का 25% कितना है?',
  'If x + 5 = 12, then x equals': 'यदि x + 5 = 12, तो x का मान है',
  'The sum of angles in a triangle is': 'त्रिभुज के कोणों का योग होता है',
  'CPU stands for': 'CPU का पूर्ण रूप है',
};

export const HINDI_OPTION_HINTS: Record<string, [string, string, string, string]> = {
  'The SI unit of force is': ['न्यूटन', 'जूल', 'वाट', 'पास्कल'],
  'Which quantity is a scalar?': ['वेग', 'बल', 'चाल', 'त्वरण'],
  'The SI unit of electric current is': ['वोल्ट', 'एम्पियर', 'ओम', 'कूलॉम'],
  'The powerhouse of the cell is': ['राइबोसोम', 'माइटोकॉन्ड्रिया', 'केंद्रक', 'गॉल्जीकाय'],
  'CPU stands for': ['सेंट्रल प्रोसेसिंग यूनिट', 'कंप्यूटर पर्सनल यूनिट', 'सेंट्रल प्रोग्राम यूटिलिटी', 'कंट्रोल प्रोसेसिंग यूनिट'],
  'What is 25% of 240?': ['40', '50', '60', '80'],
  'The sum of angles in a triangle is': ['90°', '180°', '270°', '360°'],
};

export const CATEGORIES = [
  { slug: 'railway-exams', name: 'Railway Exams', icon: 'train', color: '#0B4FA8', description: 'RRB NTPC, Group D and other railway practice sets.' },
  { slug: 'ssc-exams', name: 'SSC Exams', icon: 'briefcase', color: '#2563EB', description: 'SSC CGL, CHSL, MTS and GD preparation.' },
  { slug: 'lucent-books', name: 'Lucent GK', icon: 'book', color: '#7C3AED', description: 'General knowledge practice collections.' },
  { slug: 'current-affairs', name: 'Current Affairs', icon: 'newspaper', color: '#14B8A6', description: 'National, international and science updates.' },
  { slug: 'bihar-gk', name: 'Bihar GK', icon: 'map-pin', color: '#F59E0B', description: 'Bihar history, geography and culture.' },
  { slug: 'general-knowledge', name: 'General Knowledge', icon: 'lightbulb', color: '#16A34A', description: 'Wide-ranging general awareness practice.' },
  { slug: 'computer-tests', name: 'Computer Tests', icon: 'monitor', color: '#0891B2', description: 'Computer fundamentals, office tools and security.' },
  { slug: 'bihar-board', name: 'Bihar Board', icon: 'graduation-cap', color: '#DC2626', description: 'Class 10 and 12 board exam practice.' },
  { slug: 'up-board', name: 'UP Board', icon: 'graduation-cap', color: '#EA580C', description: 'UP board subject-wise practice.' },
  { slug: 'teaching-exams', name: 'Teaching Exams', icon: 'presentation', color: '#7C3AED', description: 'Teaching aptitude and pedagogy tests.' },
  { slug: 'previous-year-questions', name: 'Previous Year Questions', icon: 'history', color: '#475569', description: 'Exam-style practice sets (original questions).' },
  { slug: 'competitive-exams', name: 'General Competitive Exams', icon: 'trophy', color: '#0B4FA8', description: 'Mixed practice for all competitive exams.' },
];

export const BOOKS: {
  slug: string; title: string; description: string; badge: string | null;
  categories: string[]; subjects: string[]; cover: string;
}[] = [
  { slug: 'lucent-subject-wise', title: 'Lucent Subject Wise', description: 'Original general-knowledge style questions arranged by subject.', badge: 'popular', categories: ['lucent-books', 'railway-exams', 'ssc-exams', 'competitive-exams'], subjects: ['physics', 'chemistry', 'biology', 'history', 'geography', 'polity'], cover: 'indigo' },
  { slug: 'lucent-topic-wise', title: 'Lucent Topic Wise', description: 'Focused topic-level revision sets for quick daily practice.', badge: 'new', categories: ['lucent-books', 'competitive-exams'], subjects: ['physics', 'chemistry', 'biology', 'history', 'geography', 'polity'], cover: 'violet' },
  { slug: 'lucent-objective-gk', title: 'Lucent Objective GK', description: 'Mixed objective general knowledge for competitive exams.', badge: 'popular', categories: ['lucent-books', 'general-knowledge', 'railway-exams'], subjects: ['history', 'geography', 'polity', 'mathematics', 'reasoning', 'english'], cover: 'blue' },
  { slug: 'speedy-current-affairs', title: 'Speedy Current Affairs', description: 'Practice questions on national, international and science topics.', badge: 'new', categories: ['current-affairs', 'ssc-exams'], subjects: ['current-affairs'], cover: 'teal' },
  { slug: 'railway-previous-year', title: 'Railway Previous Year Style', description: 'Original exam-style practice sets. Not verified previous-year papers.', badge: null, categories: ['railway-exams', 'previous-year-questions'], subjects: ['mathematics', 'reasoning', 'physics', 'chemistry', 'history', 'geography'], cover: 'amber' },
  { slug: 'bihar-special-gk', title: 'Bihar Special GK', description: 'Bihar-focused history, geography and culture practice.', badge: 'popular', categories: ['bihar-gk', 'bihar-board'], subjects: ['bihar-gk', 'history', 'geography'], cover: 'green' },
  { slug: 'computer-test-series', title: 'Computer Test Series', description: 'Computer fundamentals, office productivity and internet safety.', badge: 'popular', categories: ['computer-tests'], subjects: ['computer'], cover: 'cyan' },
  { slug: 'teaching-exam-practice', title: 'Teaching Exam Practice', description: 'Pedagogy, child development and assessment practice.', badge: null, categories: ['teaching-exams'], subjects: ['teaching-aptitude', 'english'], cover: 'rose' },
  { slug: 'general-knowledge', title: 'General Knowledge', description: 'A broad mixed collection of general awareness questions.', badge: null, categories: ['general-knowledge', 'competitive-exams'], subjects: ['history', 'geography', 'polity', 'physics', 'chemistry', 'biology', 'mathematics'], cover: 'slate' },
  { slug: 'board-exam-practice', title: 'Bihar & UP Board Practice', description: 'Class 10 and 12 oriented science and mathematics practice.', badge: 'new', categories: ['bihar-board', 'up-board'], subjects: ['physics', 'chemistry', 'biology', 'mathematics'], cover: 'orange' },
];

export const DEFAULT_SETTINGS: Record<string, unknown> = {
  site_name: 'VidyaPariksha',
  site_tagline: 'Practice Smarter. Prepare Better. Achieve More.',
  site_description: 'Attempt realistic online mock tests, analyse your performance and prepare confidently for your exams.',
  contact_email: 'support@vidyapariksha.example',
  contact_phone: '',
  address: 'Patna, Bihar, India',
  footer_about: 'VidyaPariksha is an independent online practice platform. All demo questions are original practice content.',
  primary_color: '#0B4FA8',
  accent_color: '#14B8A6',
  default_language: 'en',
  allow_registration: true,
  guest_tests_enabled: true,
  result_visibility: 'after_submit',
  maintenance_mode: false,
  hero_badge: 'Free online CBT practice',
  disclaimer: 'Demo content on this site consists of original practice questions. It is not affiliated with any examination authority or publisher.',
};
