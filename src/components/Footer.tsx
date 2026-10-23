import { Link } from 'react-router-dom';
import { SITE } from '../data/app';

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-inner">
        <div>
          <h4>{SITE.titleHi}</h4>
          <p>{SITE.subtitle}</p>
          <p className="small" style={{ opacity: 0.8 }}>
            20 मॉक टेस्ट • 1,200 प्रश्न • प्रत्येक टेस्ट 90 मिनट • विस्तृत हिंदी समाधान
          </p>
        </div>
        <div>
          <h4>त्वरित लिंक / Quick Links</h4>
          <p><Link to="/tests">सभी मॉक टेस्ट</Link></p>
          <p><Link to="/practice">गणित अभ्यास (Practice Mode)</Link></p>
          <p><Link to="/formulas">गणित फॉर्मूला शीट</Link></p>
          <p><Link to="/progress">मेरी प्रगति</Link></p>
        </div>
        <div>
          <h4>संपर्क / Contact</h4>
          <p>प्रश्न या सुझाव के लिए संपर्क करें:</p>
          <p><a href={`mailto:${SITE.contactEmail}`}>{SITE.contactEmail}</a></p>
          <p className="small" style={{ opacity: 0.7 }}>(साइट स्वामी: कृपया अपना वास्तविक ईमेल README में दिए निर्देश से बदलें)</p>
        </div>
        <div>
          <h4>कानूनी / Legal</h4>
          <p><Link to="/privacy">गोपनीयता नीति / Privacy Policy</Link></p>
          <p><Link to="/admin">प्रश्न प्रबंधन (स्थानीय) / Admin</Link></p>
          <p className="small" style={{ opacity: 0.8 }}>
            अस्वीकरण: ये मूल अभ्यास मॉक टेस्ट हैं। ये रेलवे या SSC के किसी आधिकारिक प्रश्नपत्र की प्रतिलिपि नहीं हैं।
          </p>
        </div>
      </div>
      <div className="footer-bottom">
        © {new Date().getFullYear()} {SITE.titleHi} — मूल अभ्यास सामग्री (original practice content) • v{SITE.version}
      </div>
    </footer>
  );
}
