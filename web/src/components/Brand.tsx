import { Link } from 'react-router-dom';

export function BrandMark({ size = 36 }: { size?: number }) {
  return (
    <svg className="brand-mark" width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <rect width="48" height="48" rx="13" fill="#0B4FA8" />
      <path d="M10 18.5 24 12l14 6.5-14 6.5-14-6.5Z" fill="#fff" />
      <path d="M16 22v7.5c0 2.5 3.6 4.5 8 4.5s8-2 8-4.5V22" stroke="#7DD3FC" strokeWidth="2.6" strokeLinecap="round" />
      <circle cx="35" cy="32" r="7" fill="#14B8A6" />
      <path d="m32 32 2.1 2.1L38.4 30" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link to="/" className="brand" aria-label="VidyaPariksha home">
      <BrandMark size={compact ? 32 : 36} />
      {!compact && (
        <span className="brand-name">Vidya<span>Pariksha</span>
          <span className="brand-sub">Learn · Practise · Progress</span>
        </span>
      )}
    </Link>
  );
}

export function HeroVisual() {
  return (
    <svg viewBox="0 0 520 380" className="hero-visual" role="img" aria-label="Illustration of an online test with a question palette and progress chart">
      <defs>
        <linearGradient id="hv-card" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#fff" /><stop offset="1" stopColor="#F3F8FF" /></linearGradient>
        <linearGradient id="hv-blue" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#0B4FA8" /><stop offset="1" stopColor="#3B82F6" /></linearGradient>
      </defs>
      <rect x="34" y="40" width="452" height="292" rx="22" fill="#E3EDFB" opacity=".8" transform="rotate(-3 260 186)" />
      <rect x="54" y="34" width="412" height="286" rx="20" fill="url(#hv-card)" stroke="#D9E6F8" />
      <rect x="54" y="34" width="412" height="46" rx="20" fill="url(#hv-blue)" />
      <rect x="54" y="62" width="412" height="18" fill="url(#hv-blue)" />
      <circle cx="78" cy="57" r="5" fill="#93C5FD" /><circle cx="95" cy="57" r="5" fill="#5EEAD4" /><circle cx="112" cy="57" r="5" fill="#fff" opacity=".7" />
      <rect x="76" y="100" width="176" height="12" rx="6" fill="#CBD5E1" />
      <rect x="76" y="122" width="228" height="9" rx="4" fill="#E2E8F0" />
      <rect x="76" y="139" width="196" height="9" rx="4" fill="#E2E8F0" />
      {[0, 1, 2, 3].map((i) => (
        <g key={i}>
          <rect x="76" y={166 + i * 34} width="228" height="27" rx="9" fill={i === 1 ? '#EFF6FF' : '#F8FAFC'} stroke={i === 1 ? '#2563EB' : '#E2E8F0'} strokeWidth={i === 1 ? 2 : 1} />
          <circle cx="94" cy={179 + i * 34} r="8" fill={i === 1 ? '#2563EB' : '#fff'} stroke={i === 1 ? '#2563EB' : '#CBD5E1'} />
          <text x="94" y={182 + i * 34} fontSize="9" fontWeight="700" textAnchor="middle" fill={i === 1 ? '#fff' : '#64748B'}>{'ABCD'[i]}</text>
          <rect x="112" y={175 + i * 34} width={110 + (i % 2) * 32} height="8" rx="4" fill="#E2E8F0" />
        </g>
      ))}
      <rect x="326" y="100" width="118" height="94" rx="14" fill="#fff" stroke="#E2E8F0" />
      <text x="342" y="122" fontSize="10" fontWeight="700" fill="#64748B">TIME LEFT</text>
      <text x="342" y="150" fontSize="24" fontWeight="800" fill="#0B4FA8">24:18</text>
      <rect x="342" y="166" width="86" height="7" rx="3" fill="#E8EEF7" /><rect x="342" y="166" width="57" height="7" rx="3" fill="#14B8A6" />
      <rect x="326" y="206" width="118" height="96" rx="14" fill="#fff" stroke="#E2E8F0" />
      <text x="342" y="228" fontSize="10" fontWeight="700" fill="#64748B">QUESTIONS</text>
      {Array.from({ length: 20 }).map((_, i) => (
        <rect key={i} x={342 + (i % 5) * 20} y={238 + Math.floor(i / 5) * 14} width="15" height="10" rx="3"
          fill={i < 6 ? '#DCFCE7' : i === 6 ? '#2563EB' : '#F1F5F9'} stroke={i < 6 ? '#86EFAC' : 'none'} />
      ))}
      <g transform="translate(356 288)">
        <rect width="118" height="42" rx="12" fill="#16A34A" />
        <text x="59" y="26" fontSize="12" fontWeight="700" textAnchor="middle" fill="#fff">Save &amp; Next →</text>
      </g>
      <g transform="translate(410 8)">
        <circle r="24" fill="#14B8A6" /><path d="M-10 2 -3 9 11 -8" stroke="#fff" strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
  );
}
