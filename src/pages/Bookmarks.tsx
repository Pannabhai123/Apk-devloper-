import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { listBookmarks } from '../lib/storage';
import { topicHi } from '../lib/questions';

export default function Bookmarks() {
  const [, force] = useState(0);
  const bookmarks = useMemo(() => listBookmarks(), [force]);
  const [filter, setFilter] = useState('all');

  const topics = Array.from(new Set(bookmarks.map((b) => b.topic)));
  const shown = filter === 'all' ? bookmarks : bookmarks.filter((b) => b.topic === filter);
  const ids = shown.map((b) => b.id).join(',');

  return (
    <>
      <div className="section-title"><h2>बुकमार्क किए प्रश्न / Bookmarked Questions</h2></div>
      {bookmarks.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="icon">☆</div>
            <h3>अभी कोई प्रश्न बुकमार्क नहीं</h3>
            <p>समाधान देखते समय ☆ बुकमार्क बटन दबाकर प्रश्न यहाँ सहेजें — बाद में दोहराने के लिए।</p>
            <Link to="/tests" className="btn btn-primary">मॉक टेस्ट देखें</Link>
          </div>
        </div>
      ) : (
        <>
          <div className="tabs" role="tablist" aria-label="विषय फ़िल्टर">
            <button className={filter === 'all' ? 'tab active' : 'tab'} onClick={() => setFilter('all')}>सभी ({bookmarks.length})</button>
            {topics.map((t) => (
              <button key={t} className={filter === t ? 'tab active' : 'tab'} onClick={() => setFilter(t)}>
                {topicHi(t)} ({bookmarks.filter((b) => b.topic === t).length})
              </button>
            ))}
          </div>
          <div className="card">
            <p className="small muted">
              {shown.length} प्रश्न सहेजे गए — नीचे सभी को अभ्यास मोड में हल करें या समाधान देखें।
            </p>
            <div className="btn-row">
              <Link to={`/practice?ids=${ids}`} className="btn btn-primary">✏️ सभी बुकमार्क का अभ्यास करें</Link>
            </div>
            <div className="table-wrap mt">
              <table className="data-table">
                <thead><tr><th>प्रश्न आईडी</th><th>टेस्ट</th><th>विषय</th><th>क्रमांक</th><th></th></tr></thead>
                <tbody>
                  {shown.map((b) => (
                    <tr key={b.id}>
                      <td className="mono small">{b.id}</td>
                      <td>Mock Test {String(b.testNumber).padStart(2, '0')}</td>
                      <td>{b.topicHi}</td>
                      <td>प्रश्न {b.questionNumber}</td>
                      <td><Link className="btn btn-ghost btn-sm" to={`/practice?ids=${b.id}`}>हल करें →</Link></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </>
  );
}
