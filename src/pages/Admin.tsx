import { useEffect, useMemo, useState } from 'react';
import { loadIndex, loadTest } from '../lib/questions';
import { clearOverride, getOverrides, getUnpublished, setOverride, setUnpublished } from '../lib/storage';
import type { BankIndex, Question, TestFile } from '../lib/types';

/**
 * LOCAL QUESTION MANAGEMENT (no server).
 * This platform is a static site — there is NO backend, so this admin panel
 * works entirely in your browser's localStorage. Edits are visible only on
 * this device and are NOT synced anywhere. For permanent changes, edit the
 * JSON files in src/data/ and rebuild (see README).
 */
export default function Admin() {
  const [tab, setTab] = useState<'tests' | 'questions' | 'validate'>('tests');
  const [idx, setIdx] = useState<BankIndex | null>(null);
  const [, force] = useState(0);

  useEffect(() => { loadIndex().then(setIdx).catch(() => {}); }, [force]);
  const unpublished = getUnpublished();
  const overrides = getOverrides();

  return (
    <>
      <div className="section-title"><h2>प्रश्न प्रबंधन (स्थानीय) / Question Management (Local)</h2></div>
      <div className="notice mb">
        <b>⚠ सीमाएँ / Limitations:</b> यह एक स्थैतिक (static) वेबसाइट है — कोई सर्वर या डेटाबेस नहीं है।
        यह पैनल प्रश्नों को <b>केवल इस ब्राउज़र</b> में देख/संपादित/सत्यापित करता है (localStorage overrides)।
        परिवर्तन इस डिवाइस तक सीमित हैं और कहीं सिंक नहीं होते। स्थायी परिवर्तनों के लिए <code>src/data/</code> की JSON फ़ाइलें संपादित करके पुनर्निर्माण (rebuild) करें।
        चूँकि कोई बैकएंड नहीं है, इसलिए यहाँ कोई लॉगिन/सुरक्षा प्रणाली नहीं है — यह कोई सर्वर-सुरक्षित एडमिन नहीं है।
      </div>

      <div className="tabs" role="tablist">
        <button className={tab === 'tests' ? 'tab active' : 'tab'} onClick={() => setTab('tests')}>टेस्ट ({idx?.tests.length ?? '…'})</button>
        <button className={tab === 'questions' ? 'tab active' : 'tab'} onClick={() => setTab('questions')}>प्रश्न खोजें / संपादित करें</button>
        <button className={tab === 'validate' ? 'tab active' : 'tab'} onClick={() => setTab('validate')}>डेटा सत्यापन</button>
      </div>

      {tab === 'tests' && (
        <div className="card">
          <h3>सभी 20 मॉक टेस्ट</h3>
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>टेस्ट</th><th>कठिनाई</th><th>प्रश्न</th><th>स्थिति</th><th>प्रकाशित/अप्रकाशित</th></tr></thead>
              <tbody>
                {(idx?.tests ?? []).map((t) => (
                  <tr key={t.testNumber}>
                    <td><b>Mock Test {String(t.testNumber).padStart(2, '0')}</b></td>
                    <td>{t.difficulty}</td>
                    <td>{t.count}</td>
                    <td>{unpublished.includes(t.testNumber) ? <span className="badge badge-red">अप्रकाशित (स्थानीय)</span> : <span className="badge badge-green">प्रकाशित</span>}</td>
                    <td>
                      <button
                        className={`btn btn-sm ${unpublished.includes(t.testNumber) ? 'btn-green' : 'btn-red'}`}
                        onClick={() => {
                          const list = unpublished.includes(t.testNumber)
                            ? unpublished.filter((x) => x !== t.testNumber)
                            : [...unpublished, t.testNumber];
                          setUnpublished(list);
                          force((x) => x + 1);
                        }}
                      >
                        {unpublished.includes(t.testNumber) ? 'प्रकाशित करें' : 'अप्रकाशित करें'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="small muted mt">अप्रकाशित टेस्ट टेस्ट-सूची से छिप जाते हैं (केवल इस ब्राउज़र में)।</p>
        </div>
      )}

      {tab === 'questions' && <QuestionBrowser />}
      {tab === 'validate' && <ValidatePanel />}
      {Object.keys(overrides).length > 0 && (
        <div className="card mt">
          <h3>स्थानीय संपादन / Local Overrides ({Object.keys(overrides).length})</h3>
          <p className="small muted">इन प्रश्नों में आपने स्थानीय परिवर्तन किए हैं (केवल यह ब्राउज़र):</p>
          {Object.entries(overrides).map(([id, o]) => (
            <p key={id} className="small">
              <code>{id}</code> — {Object.keys(o).join(', ')}{' '}
              <button className="btn btn-ghost btn-sm" onClick={() => { clearOverride(id); force((x) => x + 1); }}>मूल पुनर्स्थापित करें</button>
            </p>
          ))}
        </div>
      )}
    </>
  );
}

function QuestionBrowser() {
  const [q, setQ] = useState('');
  const [testN, setTestN] = useState(1);
  const [test, setTest] = useState<TestFile | null>(null);
  const [editing, setEditing] = useState<Question | null>(null);

  useEffect(() => { setTest(null); loadTest(testN).then(setTest).catch(() => {}); }, [testN]);

  const filtered = useMemo(() => {
    if (!test) return [];
    const needle = q.trim().toLowerCase();
    if (!needle) return test.questions;
    return test.questions.filter((x) =>
      x.question.toLowerCase().includes(needle) || x.questionEn.toLowerCase().includes(needle) ||
      x.topic.toLowerCase().includes(needle) || x.topicHi.includes(needle) || x.id.toLowerCase().includes(needle),
    );
  }, [test, q]);

  return (
    <div className="card">
      <h3>प्रश्न देखें / खोजें / संपादित करें</h3>
      <div className="btn-row" style={{ alignItems: 'center' }}>
        <label className="small">टेस्ट:
          <select className="input" style={{ width: 'auto', marginLeft: 6 }} value={testN} onChange={(e) => setTestN(parseInt(e.target.value, 10))}>
            {Array.from({ length: 20 }, (_, i) => (
              <option key={i + 1} value={i + 1}>Mock Test {String(i + 1).padStart(2, '0')}</option>
            ))}
          </select>
        </label>
        <input className="input" style={{ flex: 1, minWidth: 200 }} placeholder="🔍 प्रश्न, विषय या आईडी खोजें…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="प्रश्न खोजें" />
      </div>
      {!test && <div className="spinner" role="progressbar" aria-label="लोड हो रहा है" />}
      {test && (
        <>
          <p className="small muted mt">{filtered.length} / {test.questions.length} प्रश्न • कठिनाई: {test.difficulty}</p>
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>#</th><th>प्रश्न</th><th>विषय</th><th>कठिनाई</th><th>उत्तर</th><th></th></tr></thead>
              <tbody>
                {filtered.slice(0, 60).map((x) => (
                  <tr key={x.id}>
                    <td>{x.questionNumber}</td>
                    <td style={{ whiteSpace: 'normal', maxWidth: 340 }}>{x.question.split('\n')[0].slice(0, 90)}…</td>
                    <td>{x.topicHi}</td>
                    <td>{x.difficulty}</td>
                    <td><b>{x.correctAnswer}</b></td>
                    <td><button className="btn btn-ghost btn-sm" onClick={() => setEditing(x)}>खोलें / संपादित करें</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {editing && <EditModal q0={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function EditModal({ q0, onClose }: { q0: Question; onClose: () => void }) {
  const [q, setQ] = useState(q0.question);
  const [qEn, setQEn] = useState(q0.questionEn);
  const [opts, setOpts] = useState({ ...q0.options });
  const [ans, setAns] = useState(q0.correctAnswer);
  const [sol, setSol] = useState(q0.solution.join('\n'));
  const [saved, setSaved] = useState(false);

  const save = () => {
    setOverride(q0.id, {
      question: q, questionEn: qEn, options: opts, correctAnswer: ans,
      solution: sol.split('\n').map((s) => s.trim()).filter(Boolean),
    });
    setSaved(true);
    setTimeout(onClose, 700);
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal" style={{ maxWidth: 640 }}>
        <h3>प्रश्न संपादित करें <span className="mono small muted">{q0.id}</span></h3>
        <p className="small muted">परिवर्तन केवल इस ब्राउज़र में सहेजे जाएँगे (localStorage override)।</p>
        <label className="small">प्रश्न (हिंदी)<textarea className="input" value={q} onChange={(e) => setQ(e.target.value)} rows={3} /></label>
        <label className="small">प्रश्न (English)<textarea className="input" value={qEn} onChange={(e) => setQEn(e.target.value)} rows={2} /></label>
        <div className="grid grid-2" style={{ gap: 8 }}>
          {(['A', 'B', 'C', 'D'] as const).map((l) => (
            <label key={l} className="small">विकल्प {l}
              <input className="input" value={opts[l]} onChange={(e) => setOpts({ ...opts, [l]: e.target.value })} />
            </label>
          ))}
        </div>
        <label className="small">सही उत्तर
          <select className="input" value={ans} onChange={(e) => setAns(e.target.value as Question['correctAnswer'])}>
            <option value="A">A</option><option value="B">B</option><option value="C">C</option><option value="D">D</option>
          </select>
        </label>
        <label className="small">समाधान (हर line एक चरण / one step per line)
          <textarea className="input" value={sol} onChange={(e) => setSol(e.target.value)} rows={5} />
        </label>
        <div className="btn-row mt">
          <button className="btn btn-ghost" onClick={onClose}>रद्द करें</button>
          <button className="btn btn-green" onClick={save}>{saved ? '✔ सहेजा गया' : 'सहेजें (स्थानीय)'}</button>
        </div>
      </div>
    </div>
  );
}

function ValidatePanel() {
  const [report, setReport] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true);
    const errs: string[] = [];
    let total = 0;
    const ids = new Set<string>();
    const texts = new Set<string>();
    for (let n = 1; n <= 20; n++) {
      let t: TestFile;
      try { t = await loadTest(n); } catch { errs.push(`टेस्ट ${n}: लोड विफल`); continue; }
      if (t.questions.length !== 60) errs.push(`टेस्ट ${n}: ${t.questions.length} प्रश्न (60 होने चाहिए)`);
      if (t.durationMinutes !== 90) errs.push(`टेस्ट ${n}: अवधि ${t.durationMinutes} मिनट`);
      for (const x of t.questions) {
        total++;
        if (ids.has(x.id)) errs.push(`${x.id}: डुप्लिकेट आईडी`);
        ids.add(x.id);
        const key = x.question.replace(/\s+/g, ' ').trim();
        if (texts.has(key)) errs.push(`${x.id}: डुप्लिकेट प्रश्न पाठ`);
        texts.add(key);
        const letters = Object.keys(x.options) as ('A' | 'B' | 'C' | 'D')[];
        if (letters.length !== 4 || !(['A', 'B', 'C', 'D'] as const).every((l) => letters.includes(l))) errs.push(`${x.id}: विकल्प A–D नहीं`);
        if (new Set(letters.map((l) => x.options[l])).size !== 4) errs.push(`${x.id}: डुप्लिकेट विकल्प`);
        if (!['A', 'B', 'C', 'D'].includes(x.correctAnswer)) errs.push(`${x.id}: अमान्य उत्तर`);
        if (x.options[x.correctAnswer] !== x.finalAnswer) errs.push(`${x.id}: finalAnswer ≠ सही विकल्प`);
        if (!Array.isArray(x.solution) || x.solution.length < 2) errs.push(`${x.id}: समाधान अनुपलब्ध`);
      }
    }
    if (total !== 1200) errs.push(`कुल प्रश्न: ${total} (1200 होने चाहिए)`);
    setReport(errs.length ? errs : []);
    setBusy(false);
  };

  return (
    <div className="card">
      <h3>प्रश्न बैंक सत्यापन / Question Bank Validation</h3>
      <p className="small muted">सभी 20 टेस्ट फ़ाइलों की जाँच: प्रश्न संख्या, विकल्प, उत्तर-समाधान निरंतरता, अद्वितीय आईडी और पाठ।</p>
      <button className="btn btn-navy" onClick={run} disabled={busy}>{busy ? 'जाँच हो रही है…' : '▶ सत्यापन चलाएँ'}</button>
      {report && (
        report.length === 0
          ? <p className="mt" style={{ color: 'var(--green)', fontWeight: 700 }}>✔ सभी जाँचें उत्तीर्ण — 20 टेस्ट × 60 प्रश्न = 1,200, कोई त्रुटि नहीं।</p>
          : (
            <div className="mt">
              <p style={{ color: 'var(--red)', fontWeight: 700 }}>✘ {report.length} त्रुटियाँ मिलीं:</p>
              <ul className="small">{report.slice(0, 30).map((e) => <li key={e}>{e}</li>)}</ul>
            </div>
          )
      )}
    </div>
  );
}
