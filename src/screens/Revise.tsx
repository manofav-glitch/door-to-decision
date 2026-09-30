// Revise mode: the mistakes deck. Choice and ECG questions come back as flashcards; a card leaves
// the deck after MASTERED_AFTER correct answers in a row. Other question types come back as review cards.
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { findCase, useCase } from '../content/client';
import { EcgFigure } from '../components/player/EcgFigure';
import { ChoiceList, ContinueButton } from '../components/player/Sheet';
import { GradeChip, Loading } from '../components/ui';
import { startRun, visibleOptions } from '../engine/engine';
import { MASTERED_AFTER, reviseDeck, useProgress, type ReviseCard } from '../store/progress';

export function Revise() {
  const mistakes = useProgress((s) => s.mistakes);
  const streaks = useProgress((s) => s.reviseStreak);
  const deck = reviseDeck(mistakes, streaks);
  const [queue, setQueue] = useState<ReviseCard[] | null>(null);
  const [at, setAt] = useState(0);
  const [right, setRight] = useState(0);

  if (queue && at < queue.length)
    return (
      <main className="max-w-2xl">
        <div className="mb-3 flex items-center justify-between gap-2 text-sm text-grey-1">
          <button className="underline-offset-4 hover:underline" onClick={() => setQueue(null)}>
            ← End session
          </button>
          <span aria-live="polite">
            Card {at + 1} of {queue.length}
          </span>
        </div>
        <CardView
          key={queue[at]!.key}
          card={queue[at]!}
          onDone={(correct) => {
            if (correct) setRight((n) => n + 1);
            setAt((i) => i + 1);
          }}
        />
      </main>
    );

  if (queue)
    return (
      <main className="max-w-2xl">
        <h1 className="mb-2 text-2xl font-bold">Session complete</h1>
        <p className="panel mb-4 p-4">
          {right} of {queue.length} right.{' '}
          {deck.length > 0
            ? `${deck.length} question${deck.length === 1 ? '' : 's'} left in the deck.`
            : 'Your deck is empty.'}
        </p>
        <div className="flex flex-wrap gap-3">
          {deck.length > 0 && (
            <button className="btn btn-primary" onClick={() => start(deck)}>
              Revise again
            </button>
          )}
          <Link to="/" className="btn">
            Home
          </Link>
        </div>
      </main>
    );

  function start(cards: ReviseCard[]) {
    setQueue([...cards].sort(() => Math.random() - 0.5));
    setAt(0);
    setRight(0);
  }

  const byCase = new Map<string, ReviseCard[]>();
  for (const c of deck) byCase.set(c.caseId, [...(byCase.get(c.caseId) ?? []), c]);

  return (
    <main className="max-w-2xl">
      <h1 className="mb-1 text-2xl font-bold">Revise</h1>
      <p className="mb-6 text-grey-1">
        Questions you got wrong come back here. Answer one right {MASTERED_AFTER} times in a row and
        it leaves the deck.
      </p>
      {deck.length === 0 ? (
        <p className="panel border-dashed p-4 text-grey-1">
          Nothing to revise yet. Suboptimal and harmful choices from your cases will land here.
        </p>
      ) : (
        <>
          <button
            className="btn btn-primary mb-6 w-full text-lg sm:w-auto"
            onClick={() => start(deck)}
          >
            Start revising ({deck.length})
          </button>
          {[...byCase].map(([caseId, cards]) => (
            <section key={caseId} className="mb-5">
              <h2 className="mb-2 font-bold">{findCase(caseId)?.summary.title ?? caseId}</h2>
              <ul className="flex flex-col gap-2">
                {cards.map((c) => (
                  <li
                    key={c.key}
                    className="panel flex items-start justify-between gap-3 p-3 text-sm"
                  >
                    <span>{c.prompt}</span>
                    <span className="shrink-0 text-grey-1" title="Correct in a row">
                      {'●'.repeat(c.streak) + '○'.repeat(MASTERED_AFTER - c.streak)}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </>
      )}
    </main>
  );
}

function CardView({ card, onDone }: { card: ReviseCard; onDone: (correct: boolean) => void }) {
  const loaded = useCase(card.caseId);
  const revise = useProgress((s) => s.revise);
  const dropCard = useProgress((s) => s.dropCard);
  const [picked, setPicked] = useState<string | null>(null);

  if (loaded.status === 'loading') return <Loading />;
  const c = loaded.status === 'ready' ? loaded.value.data : undefined;
  const node = c?.nodes[card.nodeId];
  const done = (correct: boolean) => {
    revise(card.key, correct);
    onDone(correct);
  };

  if (!c || !node)
    return (
      <div className="panel p-4">
        <p className="mb-3">This question has changed or been removed from its case.</p>
        <button
          className="btn"
          onClick={() => {
            dropCard(card.key);
            onDone(false);
          }}
        >
          Remove it and continue
        </button>
      </div>
    );

  const header = (
    <p className="mb-1 text-sm text-grey-1">
      {c.title} · <span className="font-semibold">{card.nodeId}</span>
    </p>
  );
  const earlier = (
    <ul className="flex flex-col gap-3">
      {card.mistakes.map((m, i) => (
        <li key={i} className="border-l-4 border-grey-2 pl-3">
          <div className="flex items-start gap-2">
            <GradeChip grade={m.grade} missed={m.missed} />
            <span className="font-semibold">{m.label}</span>
          </div>
          <p className="mt-1 text-grey-1">{m.teaching}</p>
        </li>
      ))}
    </ul>
  );

  // flashcard: ask the question again
  if (node.type === 'choice' || node.type === 'ecg') {
    const setting = card.setting ?? c.settings[0]?.id ?? null;
    const options = visibleOptions(startRun(c, setting), node);
    const choice = options.find((o) => o.id === picked);
    const best = options.filter((o) => o.grade === 'best');
    return (
      <article className="flex flex-col gap-4">
        {header}
        {node.type === 'ecg' && loaded.status === 'ready' && loaded.value.assets[node.image] && (
          <EcgFigure src={loaded.value.assets[node.image]!} alt={node.alt} />
        )}
        <h2 className="text-xl font-bold">{node.prompt}</h2>
        {!choice ? (
          <ChoiceList options={options} onPick={setPicked} />
        ) : (
          <div className="flex flex-col gap-3" aria-live="polite">
            <div
              className={`border-l-4 pl-3 ${choice.grade === 'best' ? 'border-ink' : choice.grade === 'harmful' ? 'border-alarm' : 'border-grey-2'}`}
            >
              <div className="flex items-start gap-2">
                <GradeChip grade={choice.grade} />
                <span className="font-semibold">{choice.label}</span>
              </div>
              <p className="mt-1">{choice.consequence}</p>
              <p className="mt-1 text-grey-1">{choice.teaching}</p>
            </div>
            {choice.grade !== 'best' && best.length > 0 && (
              <p className="border-2 border-dashed border-grey-2 p-2 text-sm">
                <span className="font-semibold">Best:</span> {best.map((b) => b.label).join('; ')}
                <span className="block text-grey-1">{best[0]!.teaching}</span>
              </p>
            )}
            <p className="text-sm text-grey-1">
              {choice.grade === 'best'
                ? card.streak + 1 >= MASTERED_AFTER
                  ? 'Mastered: this card leaves the deck.'
                  : `${card.streak + 1} of ${MASTERED_AFTER} in a row.`
                : 'Not yet: this card stays in the deck.'}
            </p>
            <ContinueButton label="Next card" onClick={() => done(choice.grade === 'best')} />
          </div>
        )}
      </article>
    );
  }

  // review card for multi-select, dose, calculator and lead questions
  return (
    <article className="flex flex-col gap-4">
      {header}
      <h2 className="text-xl font-bold">
        {node.type === 'story' || node.type === 'ending' ? card.prompt : node.prompt}
      </h2>
      <p className="text-sm text-grey-1">Last time:</p>
      {earlier}
      <div className="flex flex-wrap gap-3">
        <ContinueButton label="Got it" onClick={() => done(true)} />
        <Link to={`/case/${card.caseId}`} className="btn">
          Replay the case
        </Link>
      </div>
    </article>
  );
}
