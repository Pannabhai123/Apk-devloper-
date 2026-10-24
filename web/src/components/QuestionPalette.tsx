import { PALETTE_LABELS, paletteStatus, type PaletteState } from '../lib/exam';

interface PaletteQuestion { id: number; visited: boolean; selectedOptionIds: number[]; markedForReview: boolean }

const SWATCH: Record<string, string> = {
  not_visited: '#F1F5F9', not_answered: '#FEE2E2', answered: '#DCFCE7',
  marked: '#C084FC', answered_marked: '#DCFCE7', current: '#DBEAFE',
};

export function QuestionPalette({ questions, currentIndex, onJump }: {
  questions: PaletteQuestion[]; currentIndex: number; onJump: (index: number) => void;
}) {
  return (
    <div className="palette-card card">
      <div className="row-between" style={{ marginBottom: 12 }}>
        <h3 style={{ fontSize: '.98rem' }}>Question Palette</h3>
        <span className="tiny muted">{questions.length} questions</span>
      </div>
      <div className="palette-grid" role="group" aria-label="Question navigator">
        {questions.map((q, i) => {
          const state = paletteStatus(q, i === currentIndex);
          return (
            <button key={q.id} className={`palette-btn st-${state}`} onClick={() => onJump(i)}
              aria-label={`Question ${i + 1}: ${PALETTE_LABELS[state]}`}
              aria-current={i === currentIndex ? 'true' : undefined}
              title={`Q${i + 1} — ${PALETTE_LABELS[state]}`}>
              {i + 1}
            </button>
          );
        })}
      </div>
      <div className="legend">
        {(['not_visited', 'not_answered', 'answered', 'marked', 'answered_marked', 'current'] as PaletteState[]).map((s) => (
          <div className="legend-item" key={s}>
            <span className="legend-swatch" style={{ background: SWATCH[s], borderColor: s === 'current' ? 'var(--secondary)' : undefined, position: 'relative' }}>
              {s === 'answered_marked' && <span style={{ position: 'absolute', bottom: 1, right: 1, width: 6, height: 6, borderRadius: '50%', background: '#9333EA' }} />}
            </span>
            {PALETTE_LABELS[s]}
          </div>
        ))}
      </div>
    </div>
  );
}
