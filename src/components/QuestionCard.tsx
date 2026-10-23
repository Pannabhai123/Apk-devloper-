import type { Letter, Question } from '../lib/types';
import { isBookmarked, toggleBookmark } from '../lib/storage';
import { useState } from 'react';

interface ExamProps {
  mode: 'exam';
  q: Question;
  selected?: Letter;
  onSelect: (l: Letter) => void;
}
interface ReviewProps {
  mode: 'review';
  q: Question;
  selected?: Letter;
  showSolution?: boolean;
  index?: number;
}
interface PracticeProps {
  mode: 'practice';
  q: Question;
  selected?: Letter;
  revealed: boolean;
  onSelect: (l: Letter) => void;
}

type Props = ExamProps | ReviewProps | PracticeProps;

export default function QuestionCard(props: Props) {
  const { q, mode, selected } = props;
  const [marked, setMarked] = useState(() => isBookmarked(q.id));

  const bookmark = () => {
    const now = toggleBookmark({
      id: q.id, testNumber: q.testNumber, questionNumber: q.questionNumber,
      topic: q.topic, topicHi: q.topicHi, savedAt: Date.now(),
    });
    setMarked(now);
  };

  const revealed = mode === 'review' || (mode === 'practice' && props.revealed);

  const optClass = (l: Letter) => {
    if (mode === 'exam') return selected === l ? 'opt selected' : 'opt';
    if (mode === 'practice' && !revealed) return selected === l ? 'opt selected' : 'opt';
    // revealed / review
    if (l === q.correctAnswer) return 'opt correct disabled';
    if (selected === l) return 'opt wrong disabled';
    return 'opt disabled';
  };

  return (
    <article className="card" aria-label={`प्रश्न ${q.questionNumber}`}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <span className="badge">प्रश्न {q.questionNumber} / Question {q.questionNumber}</span>
          <span className="badge badge-grey">{q.topicHi}</span>
          <span className={`badge ${q.difficulty === 'Easy' ? 'badge-green' : q.difficulty === 'Moderate' ? 'badge-amber' : 'badge-red'}`}>
            {q.difficulty === 'Easy' ? 'सरल' : q.difficulty === 'Moderate' ? 'मध्यम' : 'कठिन'}
          </span>
        </div>
        {mode !== 'exam' && (
          <button className="btn btn-ghost btn-sm" onClick={bookmark} aria-pressed={marked} title="बाद में दोहराने के लिए सहेजें">
            {marked ? '★ सहेजा गया' : '☆ बुकमार्क'}
          </button>
        )}
      </div>

      <p className="q-text" style={{ marginTop: 12 }}>{q.question}</p>
      {q.questionEn && <p className="q-text-en">{q.questionEn}</p>}

      <div className="opt-grid" role="group" aria-label={`प्रश्न ${q.questionNumber} के विकल्प`}>
        {(['A', 'B', 'C', 'D'] as Letter[]).map((l) => (
          <button
            key={l}
            className={optClass(l)}
            onClick={() => {
              if (revealed) return;
              if (mode === 'exam') props.onSelect(l);
              else if (mode === 'practice') props.onSelect(l);
            }}
            aria-label={`विकल्प ${l}: ${q.options[l]}${revealed ? (l === q.correctAnswer ? ' (सही उत्तर)' : selected === l ? ' (आपका गलत उत्तर)' : '') : ''}`}
          >
            <span className="letter" aria-hidden="true">{l}</span>
            <span>{q.options[l]}</span>
          </button>
        ))}
      </div>

      {mode === 'exam' && selected && (
        <p className="small muted mt">
          चयनित उत्तर: <b>{selected}. {q.options[selected]}</b> — आप सबमिट से पहले इसे बदल सकते हैं।
        </p>
      )}

      {mode === 'practice' && revealed && <PracticeFeedback q={q} selected={selected} />}
      {mode === 'review' && <ReviewFeedback q={q} selected={selected} />}
    </article>
  );
}

function PracticeFeedback({ q, selected }: { q: Question; selected?: Letter }) {
  const correct = selected === q.correctAnswer;
  return (
    <div className="mt">
      <p style={{ fontWeight: 700, color: correct ? 'var(--green)' : 'var(--red)', fontSize: '1.05rem' }}>
        {selected ? (correct ? '✔ सही उत्तर! / Correct!' : `✘ गलत उत्तर। सही उत्तर: ${q.correctAnswer}`) : `सही उत्तर: ${q.correctAnswer}`}
      </p>
      <SolutionBlock q={q} />
    </div>
  );
}

function ReviewFeedback({ q, selected }: { q: Question; selected?: Letter }) {
  return (
    <div className="mt">
      <div className="btn-row" style={{ gap: 8 }}>
        <span className="badge badge-grey">आपका उत्तर: {selected ? `${selected}. ${q.options[selected]}` : '— (छोड़ा गया)'}</span>
        <span className="badge badge-green">सही उत्तर: {q.correctAnswer}. {q.options[q.correctAnswer]}</span>
        {selected ? (
          selected === q.correctAnswer
            ? <span className="badge badge-green">✔ सही / Correct</span>
            : <span className="badge badge-red">✘ गलत / Incorrect</span>
        ) : (
          <span className="badge badge-amber">छोड़ा गया / Unanswered</span>
        )}
      </div>
      <SolutionBlock q={q} />
    </div>
  );
}

export function SolutionBlock({ q }: { q: Question }) {
  return (
    <div className="solution-box">
      <h4 style={{ marginBottom: 8 }}>विस्तृत समाधान / Detailed Solution</h4>
      {q.solution.map((s, i) => (
        <div className="sol-step" key={i}>{s}</div>
      ))}
      <p style={{ marginTop: 10, fontWeight: 700 }}>अतः उत्तर: {q.finalAnswer}</p>
      {q.shortcut && (
        <div className="shortcut-box">
          <b>शॉर्टकट / Shortcut:</b> {q.shortcut}
        </div>
      )}
      <p className="small muted" style={{ marginTop: 8 }}>
        विषय: {q.topicHi} ({q.topic}) • कठिनाई: {q.difficulty} • टेस्ट {String(q.testNumber).padStart(2, '0')} • आईडी: {q.id}
      </p>
    </div>
  );
}
