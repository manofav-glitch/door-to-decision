import { HashRouter, Route, Routes } from 'react-router-dom';
import { DisclaimerGate } from './components/Disclaimer';
import { Layout } from './components/Layout';
import { ThemeSync } from './components/ThemeSync';
import { CaseSetup } from './screens/CaseSetup';
import { ArtSheet } from './screens/ArtSheet';
import { Codex } from './screens/Codex';
import { CodexCard } from './screens/CodexCard';
import { Debrief } from './screens/Debrief';
import { Home } from './screens/Home';
import { Module } from './screens/Module';
import { Player } from './screens/Player';
import { Settings } from './screens/Settings';
import { System } from './screens/System';

export function App() {
  return (
    <>
      <ThemeSync />
      <DisclaimerGate>
        <HashRouter>
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
              <Route path="settings" element={<Settings />} />
              {import.meta.env.DEV && <Route path="dev/art" element={<ArtSheet />} />}
              <Route path="*" element={<Home />} />
            </Route>
          </Routes>
        </HashRouter>
      </DisclaimerGate>
    </>
  );
}
