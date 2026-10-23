import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="card center">
      <div className="empty-state">
        <div className="icon" style={{ fontSize: '3rem' }}>🚉</div>
        <h3>404 — पृष्ठ नहीं मिला / Page Not Found</h3>
        <p>आप जिस पृष्ठ की तलाश में हैं वह मौजूद नहीं है। नीचे से आगे बढ़ें:</p>
      </div>
      <div className="btn-row" style={{ justifyContent: 'center' }}>
        <Link to="/" className="btn btn-primary">🏠 होम</Link>
        <Link to="/tests" className="btn btn-navy">सभी मॉक टेस्ट</Link>
        <Link to="/progress" className="btn btn-ghost">मेरी प्रगति</Link>
      </div>
    </div>
  );
}
