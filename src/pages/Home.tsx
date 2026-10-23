import { Link } from 'react-router-dom';
import { INSTRUCTIONS, SITE, TOTAL_QUESTIONS, TOTAL_TESTS, QUESTIONS_PER_TEST, TEST_DURABILITY } from '../data/app';

export default function Home() {
  return (
    <>
      <section className="hero">
        <h1>{SITE.title}</h1>
        <p className="sub">{SITE.subtitle}</p>
        <p className="en">{SITE.subtitleEn}</p>
        <div className="btn-row" style={{ justifyContent: 'center', marginTop: 18 }}>
          <Link to="/tests" className="btn btn-primary btn-lg">🚆 START MOCK TEST</Link>
          <Link to="/practice" className="btn btn-ghost btn-lg" style={{ background: 'rgba(255,255,255,0.14)', color: '#fff', borderColor: 'rgba(255,255,255,0.4)' }}>
            ✏️ Start Practicing
          </Link>
        </div>
      </section>

      <div className="grid grid-4" style={{ marginTop: 18 }}>
        <div className="stat-card"><div className="stat-num">{TOTAL_TESTS}</div><div className="stat-label">कुल मॉक टेस्ट<br />Total Mock Tests</div></div>
        <div className="stat-card"><div className="stat-num">{QUESTIONS_PER_TEST}</div><div className="stat-label">प्रति टेस्ट प्रश्न<br />Questions / Test</div></div>
        <div className="stat-card"><div className="stat-num">{TEST_DURABILITY} मिनट</div><div className="stat-label">टेस्ट अवधि<br />Test Duration</div></div>
        <div className="stat-card"><div className="stat-num">{TOTAL_QUESTIONS.toLocaleString('en-IN')}</div><div className="stat-label">कुल प्रश्न उपलब्ध<br />Total Questions</div></div>
      </div>

      <div className="section-title"><h2>परीक्षा निर्देश / Test Instructions</h2></div>
      <div className="card">
        <ol style={{ margin: 0, paddingLeft: 22, display: 'grid', gap: 7 }}>
          {INSTRUCTIONS.map((it, i) => (
            <li key={i}>{it_hi(it, i)}</li>
          ))}
        </ol>
        <div className="notice mt">
          <b>अंकन योजना (Marking Scheme):</b> डिफ़ॉल्ट अभ्यास मोड में प्रत्येक सही उत्तर पर <b>+1</b> अंक तथा गलत/अनुत्तरित प्रश्न पर <b>0</b> अंक।
          टेस्ट शुरू करने से पहले आप वैकल्पिक नकारात्मक अंकन (−1/3) चुन सकते हैं। यह एक सामान्य अभ्यास योजना है —
          यह हर रेलवे/SSC परीक्षा की आधिकारिक अंकन योजना नहीं है; वास्तविक परीक्षा की योजना अधिसूचना से देखें।
        </div>
        <div className="btn-row mt">
          <Link to="/tests" className="btn btn-navy">सभी 20 मॉक टेस्ट देखें</Link>
        </div>
      </div>

      <div className="section-title"><h2>प्लेटफ़ॉर्म सुविधाएँ / Platform Features</h2></div>
      <div className="grid grid-2">
        {[
          { icon: '⏱️', t: '90 मिनट का वास्तविक टाइमर', d: 'पेज रिफ्रेश होने पर भी टाइमर रीसेट नहीं होता; समय समाप्त होने पर ऑटो-सबमिट।' },
          { icon: '🧮', t: '1,200 मूल प्रश्न', d: '20 टेस्ट × 60 प्रश्न — सभी हिंदी में, सत्यापित उत्तरों और चरण-दर-चरण समाधान के साथ।' },
          { icon: '📊', t: 'परिणाम डैशबोर्ड', d: 'स्कोर, सटीकता, समय, विषयवार प्रदर्शन और PDF डाउनलोड।' },
          { icon: '📚', t: 'विस्तृत समाधान', d: 'हर प्रश्न का पूरा हल + शॉर्टकट ट्रिक — केवल सबमिशन के बाद।' },
          { icon: '🔄', t: 'रिवीज़न सुविधाएँ', d: 'गलत प्रश्नों का संग्रह, बुकमार्क, और अनटाइम्ड प्रैक्टिस मोड।' },
          { icon: '📱', t: 'मोबाइल-फर्स्ट + PWA', d: 'Android फ़ोन पर इंस्टॉल करने योग्य; ऑफ़लाइन कैशिंग के साथ तेज़ गति।' },
        ].map((f) => (
          <div className="card" key={f.t}>
            <div style={{ fontSize: '1.6rem' }}>{f.icon}</div>
            <h3>{f.t}</h3>
            <p className="muted small">{f.d}</p>
          </div>
        ))}
      </div>

      <div className="section-title"><h2>किसके लिए उपयोगी / Who is it for</h2></div>
      <div className="card">
        <p>
          यह प्लेटफ़ॉर्म <b>रेलवे ALP, रेलवे NTPC, रेलवे Group D, SSC CGL, SSC CHSL</b> एवं अन्य प्रतियोगी परीक्षाओं के
          गणित (Mathematics) खंड की तैयारी के लिए बनाया गया है। पाठ्यक्रम के 28 विषयों — संख्या पद्धति से लेकर
          निर्देशांक ज्यामिति तक — के प्रश्न हर टेस्ट में संतुलित रूप से शामिल हैं।
        </p>
        <div className="info-notice">
          <b>महत्वपूर्ण:</b> ये <b>मूल अभ्यास मॉक टेस्ट</b> (original practice mock tests) हैं, न कि किसी आधिकारिक रेलवे/SSC प्रश्नपत्र की प्रतिलिपि।
          आपका परीक्षा पैटर्न अलग हो सकता है — कृपया अधिसूचना से पुष्टि करें।
        </div>
        <div className="notice mt">
          <b>डेटा संग्रहण:</b> यह साइट कोई खाता या लॉगिन माँगती है नहीं। आपके परिणाम केवल आपके ब्राउज़र (localStorage) में सुरक्षित रहते हैं।
          ब्राउज़र डेटा मिटाने या डिवाइस बदलने पर गुमनाम (anonymous) प्रगति खो सकती है।{' '}
          <Link to="/privacy">पूरी गोपनीयता नीति पढ़ें →</Link>
        </div>
      </div>
    </>
  );
}

function it_hi(it: { hi: string; en: string }, i: number) {
  return (
    <span>
      {it.hi} <span className="muted small">({it.en})</span>
    </span>
  );
}
