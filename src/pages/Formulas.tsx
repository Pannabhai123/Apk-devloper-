import { useMemo, useState } from 'react';
import { FORMULAS } from '../data/formulas';

export default function Formulas() {
  const [q, setQ] = useState('');
  const needle = q.trim().toLowerCase();

  const groups = useMemo(() => {
    if (!needle) return FORMULAS;
    return FORMULAS.map((g) => ({
      ...g,
      formulas: g.formulas.filter((f) =>
        f.title.toLowerCase().includes(needle) || f.formula.toLowerCase().includes(needle) || g.topicHi.includes(needle) || g.topic.toLowerCase().includes(needle),
      ),
    })).filter((g) => g.formulas.length > 0);
  }, [needle]);

  return (
    <>
      <div className="section-title"><h2>गणित फॉर्मूला शीट / Mathematics Formula Sheet</h2></div>
      <div className="info-notice mb">
        प्रतियोगी परीक्षाओं (रेलवे ALP, NTPC, Group D, SSC) के लिए महत्वपूर्ण सूत्रों का संग्रह — विषय के अनुसार व्यवस्थित।
      </div>

      <input
        className="input mb"
        placeholder="🔍 सूत्र खोजें… (जैसे: लाभ, average, interest, वृत्त)"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        aria-label="फॉर्मूला खोजें"
      />

      {groups.length === 0 && <div className="card"><div className="empty-state"><div className="icon">🔍</div>कोई सूत्र नहीं मिला — दूसरे शब्द से खोजें।</div></div>}

      {groups.map((g) => (
        <div className="card" key={g.topic}>
          <h3>{g.topicHi} <span className="muted small">/ {g.topic}</span></h3>
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>सूत्र / Formula</th><th>व्यंजक / Expression</th></tr></thead>
              <tbody>
                {g.formulas.map((f) => (
                  <tr key={f.title + f.formula}>
                    <td style={{ whiteSpace: 'normal' }}>{f.title}</td>
                    <td style={{ whiteSpace: 'normal' }}><b className="mono">{f.formula}</b></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </>
  );
}
