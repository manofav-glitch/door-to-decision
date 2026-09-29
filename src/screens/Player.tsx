import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { findCase, isPlayable, useCase, type LoadedCase } from '../content/client';
import type { Node, Panel } from '../content/schema';
import { EcgFigure } from '../components/player/EcgFigure';
import { CalcForm } from '../components/ScoreParts';
import { Hud } from '../components/player/Hud';
import { PanelView } from '../components/player/PanelView';
import {
  ChoiceList,
  ContinueButton,
  DoseForm,
  Feedback,
  MultiSelect,
} from '../components/player/Sheet';
import { Loading, NotFound, UnverifiedBadge } from '../components/ui';
import {
  act,
  clockAt,
  currentNode,
  doseFor,
  replay,
  scoreFor,
  result,
  visibleOptions,
  type ActResult,
  type Input,
  type RunState,
} from '../engine/engine';
import { useProgress, type SavedRun } from '../store/progress';
import { useSettings } from '../store/settings';

export function Player() {
  const { caseId = '' } = useParams();
  const loaded = useCase(caseId);
  // Read once: finishing the case removes it from `active`, and the player must stay mounted.
  const [saved] = useState(() => useProgress.getState().active[caseId]);
  const showDrafts = useSettings((s) => s.showDrafts);
  const found = findCase(caseId);

  if (!found) return <NotFound what="Case" />;
  if (!saved || !isPlayable(found.summary, showDrafts))
    return <Navigate to={`/case/${caseId}`} replace />;
  if (loaded.status === 'loading') return <Loading />;
  if (loaded.status !== 'ready') return <NotFound what="Case" />;
  return <Play loaded={loaded.value} saved={saved} />;
}

function Play({ loaded, saved }: { loaded: LoadedCase; saved: SavedRun }) {
  const { data: c, assets } = loaded;
  const navigate = useNavigate();
  const record = useProgress((s) => s.record);
  const finish = useProgress((s) => s.finish);
  const [run, setRun] = useState<RunState | null>(() => {
    try {
      return replay(c, saved.setting, saved.inputs);
    } catch {
      return null;
    }
  });
  const [pending, setPending] = useState<{ prev: RunState; res: ActResult } | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);

  const view = pending?.prev ?? run;
  const viewNodeId = view?.nodeId;
  const viewNode = view ? currentNode(c, view) : undefined;

  // New beat: scroll up and move focus to the sheet heading.
  useEffect(() => {
    window.scrollTo({ top: 0 });
    heading.current?.focus({ preventScroll: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewNodeId, pending === null]);

  if (!run || !view || !viewNode)
    return (
      <main className="mx-auto max-w-xl p-4">
        <p className="panel mb-4 p-4">
          This case has changed since you started it, so your run can't be resumed.
        </p>
        <Link to={`/case/${c.id}`} className="btn btn-primary">
          Start again
        </Link>
      </main>
    );

  const learn = saved.mode === 'learn';
  const doAct = (input: Input) => {
    const res = act(c, run, input);
    record(c.id, res.state.inputs);
    if (res.state.ended)
      finish(
        c.id,
        result(c, res.state),
        c.debrief.unlocks.map((u) => u.id),
      );
    if (learn && viewNode.type !== 'story') setPending({ prev: run, res });
    setRun(res.state);
  };

  const clock = clockAt(c, view.minutes);
  const longSheet = viewNode.type === 'calculator';
  const panels = lastPanels(c.nodes, view.path);
  const nodeUnverified = 'check' in viewNode && viewNode.check && !viewNode.check.verified;
  const ecg = viewNode.type === 'ecg' ? viewNode : undefined;

  let title: string;
  let body: React.ReactNode;
  if (pending) {
    title = 'What happened';
    const node = currentNode(c, pending.prev);
    body = (
      <Feedback
        res={pending.res}
        onContinue={() => setPending(null)}
        sources={
          node.type === 'calculator' ? scoreFor(c, node).refs.map((r) => r.citation) : undefined
        }
      />
    );
  } else {
    switch (viewNode.type) {
      case 'story':
        title = 'Continue the story';
        body = <ContinueButton onClick={() => doAct({ kind: 'continue' })} />;
        break;
      case 'choice':
      case 'ecg':
        title = viewNode.prompt;
        body = (
          <ChoiceList
            options={visibleOptions(run, viewNode)}
            onPick={(optionId) => doAct({ kind: 'pick', optionId })}
          />
        );
        break;
      case 'multiselect':
        title = viewNode.prompt;
        body = (
          <MultiSelect
            node={viewNode}
            options={visibleOptions(run, viewNode)}
            onSubmit={(optionIds) => doAct({ kind: 'multi', optionIds })}
          />
        );
        break;
      case 'dose':
        title = viewNode.prompt;
        body = (
          <DoseForm
            key={viewNode.drug + viewNode.dose}
            unit={doseFor(c, viewNode).unit}
            onSubmit={(value) => doAct({ kind: 'dose', value })}
          />
        );
        break;
      case 'calculator':
        title = viewNode.prompt;
        body = (
          <CalcForm
            key={viewNodeId}
            def={scoreFor(c, viewNode).def}
            onSubmit={(answers) => doAct({ kind: 'calc', answers })}
          />
        );
        break;
      case 'ending':
        title = viewNode.outcome === 'critical' ? 'Critical outcome' : 'Case complete';
        body = (
          <div className="flex flex-col gap-3">
            <p>{viewNode.summary}</p>
            <ContinueButton label="See the debrief" onClick={() => navigate(`/debrief/${c.id}`)} />
          </div>
        );
        break;
    }
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-20 bg-paper">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-1">
          <Link
            to={`/case/${c.id}`}
            className="btn min-h-10 px-3"
            aria-label="Exit case (progress is saved)"
          >
            ✕
          </Link>
          <span className="min-w-0 truncate font-semibold">{c.title}</span>
          {c.draft && <UnverifiedBadge className="shrink-0" />}
          <span className="ml-auto shrink-0 text-sm text-grey-1">{learn ? 'Learn' : 'Exam'}</span>
        </div>
        <Hud
          vitals={run.vitals}
          limits={c.vitalLimits}
          clock={clockAt(c, run.minutes)}
          minutes={run.minutes}
        />
      </header>

      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 pt-4 lg:grid lg:grid-cols-[minmax(0,1fr)_400px] lg:items-start lg:gap-6">
        <section
          aria-label="Story panels"
          className="grid flex-1 content-start gap-4 pb-4 sm:grid-cols-2"
        >
          {/* On ECG beats the tracing comes first: it's what the learner has to read. */}
          {ecg && assets[ecg.image] && (
            <EcgFigure
              src={assets[ecg.image]!}
              alt={ecg.alt}
              unverified={
                c.imageChecks[ecg.image] && !c.imageChecks[ecg.image]!.verified ? (
                  <UnverifiedBadge />
                ) : undefined
              }
            />
          )}
          {panels.map((p, i) => (
            <PanelView key={`${viewNodeId}-${i}`} panel={p} clock={clock} assets={assets} />
          ))}
        </section>

        <aside
          className={`z-10 -mx-4 border-t-[3px] bg-paper px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] lg:sticky lg:top-28 lg:mx-0 lg:max-h-[calc(100dvh-8rem)] lg:overflow-y-auto lg:border-[3px] lg:p-4 lg:shadow-none ${
            // Long forms (calculators) flow with the page on phones instead of a cramped scrolling sheet.
            longSheet
              ? ''
              : 'sticky bottom-0 max-h-[55dvh] overflow-y-auto shadow-[0_-8px_16px_-12px_rgba(0,0,0,0.4)]'
          } ${
            viewNode.type === 'ending' && viewNode.outcome === 'critical' && !pending
              ? 'border-alarm'
              : 'border-ink'
          }`}
          aria-label="Your decision"
        >
          <div className="mb-3 flex items-start justify-between gap-2">
            <h2
              ref={heading}
              tabIndex={-1}
              className="text-lg leading-snug font-bold focus:outline-none"
            >
              {title}
            </h2>
            {nodeUnverified && !pending && <UnverifiedBadge className="mt-1 shrink-0" />}
          </div>
          {body}
        </aside>
      </div>
    </div>
  );
}

/** Panels of the current node, or of the most recent node that had some (keeps the scene in view). */
function lastPanels(nodes: Record<string, Node>, path: string[]): Panel[] {
  for (let i = path.length - 1; i >= 0; i--) {
    const p = nodes[path[i]!]?.panels;
    if (p?.length) return p;
  }
  return [];
}
