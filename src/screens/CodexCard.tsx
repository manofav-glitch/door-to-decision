import { useNavigate, useParams } from 'react-router-dom';
import { useCodex } from '../content/client';
import { Link } from 'react-router-dom';
import { Loading, NotFound, UnverifiedBadge } from '../components/ui';
import { ScoreCalculator } from '../components/ScoreParts';
import { useProgress } from '../store/progress';
import { kindLabel } from './Codex';

export function CodexCard() {
  const { cardId } = useParams();
  const navigate = useNavigate();
  const codex = useCodex();
  const unlocked = useProgress((s) => s.unlocked);
  if (codex.status === 'loading') return <Loading />;
  const card = codex.status === 'ready' ? codex.value.find((c) => c.id === cardId) : undefined;
  if (!card) return <NotFound what="Card" />;

  return (
    <main className="max-w-2xl">
      <button
        className="mb-3 inline-flex min-h-11 items-center text-grey-1 hover:underline"
        onClick={() => navigate(-1)}
      >
        ← Back
      </button>
      <p className="text-sm font-semibold tracking-wider text-grey-1 uppercase">
        <Link to="/codex" className="underline-offset-4 hover:underline">
          Codex
        </Link>{' '}
        ·{' '}
        <Link to={`/codex?tab=${card.kind}`} className="underline-offset-4 hover:underline">
          {kindLabel[card.kind]}
        </Link>
        {unlocked.includes(card.id) && <span className="ml-2 normal-case">✓ Unlocked</span>}
      </p>
      <h1 className="mb-2 flex flex-wrap items-center gap-3 text-2xl font-bold">
        {card.title} {!card.check.verified && <UnverifiedBadge />}
      </h1>
      <p className="mb-6 text-lg">{card.summary}</p>

      {card.score && (
        <>
          {!card.score.check.verified && (
            <p className="mb-2 text-sm text-grey-1">
              <UnverifiedBadge /> The point table below has not been verified yet.
            </p>
          )}
          <ScoreCalculator
            def={card.score}
            sources={card.refDetails
              .filter((r) => r.id !== card.score!.bandsSource)
              .map((r) => r.citation)}
            bandsSource={card.refDetails.find((r) => r.id === card.score!.bandsSource)?.citation}
          />
        </>
      )}

      {card.doses.length > 0 && (
        <section className="panel mb-6 p-4">
          <h2 className="mb-3 text-lg font-bold">Doses</h2>
          <dl className="flex flex-col gap-3">
            {card.doses.map((d) => (
              <div key={d.id}>
                <dt className="flex flex-wrap items-center gap-2 font-semibold">
                  {d.label} <span className="font-normal text-grey-1">· {d.route}</span>
                  {!d.check.verified && <UnverifiedBadge />}
                </dt>
                <dd>{d.text}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      {card.sections.map((s) => (
        <section key={s.heading} className="mb-5">
          <h2 className="mb-1 text-lg font-bold">{s.heading}</h2>
          <p>{s.body}</p>
        </section>
      ))}

      {card.india && (
        <section className="mb-5 border-l-4 border-ink pl-3">
          <h2 className="font-bold">In India</h2>
          <p>{card.india}</p>
        </section>
      )}

      {card.refDetails.length > 0 && (
        <section className="mt-8 border-t-2 border-grey-2 pt-3">
          <h2 className="mb-2 text-sm font-bold tracking-wider text-grey-1 uppercase">Sources</h2>
          <ol className="flex list-decimal flex-col gap-1 pl-6 text-sm text-grey-1">
            {card.refDetails.map((r) => (
              <li key={r.id}>{r.citation}</li>
            ))}
          </ol>
        </section>
      )}
    </main>
  );
}
