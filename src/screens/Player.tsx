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
  AllOptions,
  Feedback,
  LeadGrid,
  MultiSelect,
} from '../components/player/Sheet';
import { DevTag, Loading, NotFound, UnverifiedBadge } from '../components/ui';
import {
  act,
  clockAt,
  devJump,
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
import { DevPanel } from '../components/player/DevPanel';
import { useDevMode } from '../lib/dev';
import { prefetchCaseArt } from '../lib/offline';
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
  const [pending, setPending] = useState<{
    prev: RunState;
    res: ActResult;
    revealed?: boolean;
  } | null>(null);
  const present = saved.mode === 'present';
  // presenter mode: how many of the current step's panels are showing
  const [shown, setShown] = useState<{ node: string; count: number }>({ node: '', count: 1 });
  const heading = useRef<HTMLHeadingElement>(null);
  const dev = useDevMode();
  // after a dev jump the run can't be replayed from its inputs, so it is no longer saved
  const [devJumped, setDevJumped] = useState(false);
  const jump = (nodeId: string) => {
    if (!run) return;
    setPending(null);
    setRun(devJump(c, run, nodeId));
    setDevJumped(true);
  };
  const [leadSel, setLeadSel] = useState<{ node: string; leads: string[] }>({
    node: '',
    leads: [],
  });

  const view = pending?.prev ?? run;
  const viewNodeId = view?.nodeId;
  const viewNode = view ? currentNode(c, view) : undefined;

  // Presenter mode: big type for the whole screen, and F toggles full screen.
  useEffect(() => {
    if (!present) return;
    const root = document.documentElement;
    root.dataset.present = 'on';
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (
        e.key.toLowerCase() !== 'f' ||
        e.metaKey ||
        e.ctrlKey ||
        ['INPUT', 'TEXTAREA'].includes(t.tagName)
      )
        return;
      if (document.fullscreenElement) void document.exitFullscreen();
      else void root.requestFullscreen?.().catch(() => undefined);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      delete root.dataset.present;
      window.removeEventListener('keydown', onKey);
    };
  }, [present]);

  // Save this case's pictures in the background, so the rest of it still works if the signal drops.
  useEffect(() => {
    const t = setTimeout(() => prefetchCaseArt(c.id), 3000);
    return () => clearTimeout(t);
  }, [c.id]);

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

  const learn = saved.mode === 'learn' || present; // presenter mode shows feedback, after a reveal
  const doAct = (input: Input) => {
    const res = act(c, run, input);
    if (!devJumped) record(c.id, res.state.inputs);
    if (res.state.ended && !devJumped)
      finish(
        c.id,
        result(c, res.state),
        c.debrief.unlocks.map((u) => u.id),
      );
    if (learn && viewNode.type !== 'story') setPending({ prev: run, res });
    setRun(res.state);
  };

  const clock = clockAt(c, view.minutes);
  // presenter mode: the monitor mustn't give the answer away before the reveal
  const hudState = present && pending && !pending.revealed ? pending.prev : run;
  const longSheet = viewNode.type === 'calculator';
  const allPanels = lastPanels(c.nodes, view.path);
  const ownPanels = viewNode.panels?.length ?? 0;
  const revealedPanels =
    present && ownPanels && !pending
      ? shown.node === viewNodeId
        ? shown.count
        : 1
      : allPanels.length;
  const panels = allPanels.slice(0, revealedPanels);
  const morePanels = revealedPanels < allPanels.length;
  const nodeUnverified = 'check' in viewNode && viewNode.check && !viewNode.check.verified;
  const ecg = viewNode.type === 'ecg' || viewNode.type === 'ecg-leads' ? viewNode : undefined;
  const leadNode = viewNode.type === 'ecg-leads' ? viewNode : undefined;
  const layout = leadNode ? c.leadLayouts[leadNode.image] : undefined;
  const selectedLeads = leadSel.node === viewNodeId ? leadSel.leads : [];
  const toggleLead = (l: string) =>
    setLeadSel({
      node: viewNodeId!,
      leads: selectedLeads.includes(l)
        ? selectedLeads.filter((x) => x !== l)
        : [...selectedLeads, l],
    });

  let title: string;
  let body: React.ReactNode;
  if (pending && present && !pending.revealed) {
    title = 'Answer locked in';
    body = (
      <div className="flex flex-col gap-3">
        <ul className="flex list-disc flex-col gap-1 pl-5">
          {pending.res.picks
            .filter((p) => !p.missed)
            .map((p) => (
              <li key={p.optionId} className="font-semibold">
                {p.label}
              </li>
            ))}
        </ul>
        <p className="text-grey-1">Discuss, then reveal the answer.</p>
        <ContinueButton label="Reveal" onClick={() => setPending({ ...pending, revealed: true })} />
      </div>
    );
  } else if (pending) {
    title = 'What happened';
    const node = currentNode(c, pending.prev);
    body = (
      <>
        <Feedback
          res={pending.res}
          onContinue={() => setPending(null)}
          sources={
            node.type === 'calculator' ? scoreFor(c, node).refs.map((r) => r.citation) : undefined
          }
        />
        {present && 'options' in node && (
          <AllOptions
            options={visibleOptions(pending.prev, node)}
            chosen={pending.res.picks.filter((p) => !p.missed).map((p) => p.optionId)}
          />
        )}
      </>
    );
  } else if (morePanels) {
    title = 'Next panel';
    body = (
      <ContinueButton
        label="Show the next panel"
        onClick={() => setShown({ node: viewNodeId!, count: revealedPanels + 1 })}
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
      case 'ecg-leads':
        title = viewNode.prompt;
        body = (
          <LeadGrid
            leads={layout?.leads.map((l) => l.label) ?? []}
            selected={selectedLeads}
            onToggle={toggleLead}
            onSubmit={() => doAct({ kind: 'leads', leads: selectedLeads })}
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
            {devJumped ? (
              <ContinueButton
                label="Back to the case (dev run not saved)"
                onClick={() => navigate(`/case/${c.id}`)}
              />
            ) : (
              <ContinueButton
                label="See the debrief"
                onClick={() => navigate(`/debrief/${c.id}`)}
              />
            )}
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
            className="btn min-h-11 min-w-11 px-3"
            aria-label="Exit case (progress is saved)"
          >
            ✕
          </Link>
          <h1 className="min-w-0 truncate text-base font-semibold">{c.title}</h1>
          {c.draft && <UnverifiedBadge className="shrink-0" />}
          <span className="ml-auto shrink-0 text-sm text-grey-1">
            {present ? 'Present' : learn ? 'Learn' : 'Exam'}
          </span>
          {dev && <DevTag />}
        </div>
        <Hud
          vitals={hudState.vitals}
          limits={c.vitalLimits}
          clock={clockAt(c, hudState.minutes)}
          minutes={hudState.minutes}
        />
      </header>

      <main
        className={`mx-auto flex w-full ${present ? 'max-w-[96rem]' : 'max-w-6xl'} flex-1 flex-col px-4 pt-4 lg:grid lg:grid-cols-[minmax(0,1fr)_25rem] lg:items-start lg:gap-6`}
      >
        <section
          aria-label="Story panels"
          className="grid flex-1 grid-cols-[minmax(0,1fr)] content-start gap-4 pb-4 sm:grid-cols-[repeat(2,minmax(0,1fr))]"
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
              width={layout?.width}
              hotspots={
                layout
                  ? pending?.res.leads
                    ? {
                        layout,
                        selected: pending.res.leads.chosen,
                        answer: pending.res.leads.answer,
                      }
                    : { layout, selected: selectedLeads, onToggle: toggleLead }
                  : undefined
              }
            />
          )}
          {panels.map((p, i) => (
            <PanelView
              key={`${viewNodeId}-${i}`}
              panel={p}
              clock={clock}
              assets={assets}
              index={i}
              ctx={{ vitals: view.vitals, limits: c.vitalLimits }}
            />
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
          {dev && (
            <p className="-mt-2 mb-3 font-mono text-xs text-grey-1">
              step: {viewNodeId} ({viewNode.type}){devJumped && ' · jumped: not saved'}
            </p>
          )}
          {body}
          {dev && <DevPanel c={c} run={run} onJump={jump} />}
        </aside>
      </main>
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
