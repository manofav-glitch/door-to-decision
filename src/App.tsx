import { HashRouter, Route, Routes } from 'react-router-dom';
import { DisclaimerGate } from './components/Disclaimer';
import { Layout } from './components/Layout';
import { ThemeSync } from './components/ThemeSync';
import { Home } from './screens/Home';
import { Settings } from './screens/Settings';
import { SystemPlaceholder } from './screens/SystemPlaceholder';

export function App() {
  return (
    <>
      <ThemeSync />
      <DisclaimerGate>
        <HashRouter>
          <Routes>
            <Route element={<Layout />}>
              <Route index element={<Home />} />
              <Route path="system/:id" element={<SystemPlaceholder />} />
              <Route path="settings" element={<Settings />} />
              <Route path="*" element={<Home />} />
            </Route>
          </Routes>
        </HashRouter>
      </DisclaimerGate>
    </>
  );
}
