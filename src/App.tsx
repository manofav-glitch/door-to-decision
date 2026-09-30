import { lazy, Suspense } from 'react';
import { HashRouter, Route, Routes } from 'react-router-dom';
import { Loading } from './components/ui';
import { DisclaimerGate } from './components/Disclaimer';
import { Layout } from './components/Layout';
import { ThemeSync } from './components/ThemeSync';
import { CaseSetup } from './screens/CaseSetup';
import { Home } from './screens/Home';
import { Module } from './screens/Module';
import { Settings } from './screens/Settings';
import { System } from './screens/System';

// Heavier screens load on first use, keeping the first download small.
const ArtSheet = lazy(() => import('./screens/ArtSheet').then((m) => ({ default: m.ArtSheet })));
const Codex = lazy(() => import('./screens/Codex').then((m) => ({ default: m.Codex })));
const CodexCard = lazy(() => import('./screens/CodexCard').then((m) => ({ default: m.CodexCard })));
const Debrief = lazy(() => import('./screens/Debrief').then((m) => ({ default: m.Debrief })));
const Player = lazy(() => import('./screens/Player').then((m) => ({ default: m.Player })));
const Revise = lazy(() => import('./screens/Revise').then((m) => ({ default: m.Revise })));

export function App() {
  return (
    <>
      <ThemeSync />
      <DisclaimerGate>
        <HashRouter>
          <Suspense fallback={<Loading />}>
            <Routes>
              <Route path="play/:caseId" element={<Player />} />
              <Route element={<Layout />}>
                <Route index element={<Home />} />
                <Route path="s/:systemId" element={<System />} />
                <Route path="s/:systemId/:moduleId" element={<Module />} />
                <Route path="case/:caseId" element={<CaseSetup />} />
                <Route path="debrief/:caseId" element={<Debrief />} />
                <Route path="codex" element={<Codex />} />
                <Route path="codex/:cardId" element={<CodexCard />} />
                <Route path="revise" element={<Revise />} />
                <Route path="settings" element={<Settings />} />
                {import.meta.env.DEV && <Route path="dev/art" element={<ArtSheet />} />}
                <Route path="*" element={<Home />} />
              </Route>
            </Routes>
          </Suspense>
        </HashRouter>
      </DisclaimerGate>
    </>
  );
}
