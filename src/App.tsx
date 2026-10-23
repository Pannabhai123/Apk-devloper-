import { Route, Routes } from 'react-router-dom';
import Header from './components/Header';
import Footer from './components/Footer';
import Home from './pages/Home';
import Tests from './pages/Tests';
import Instructions from './pages/Instructions';
import Attempt from './pages/Attempt';
import Result from './pages/Result';
import Solutions from './pages/Solutions';
import Progress from './pages/Progress';
import Practice from './pages/Practice';
import Formulas from './pages/Formulas';
import Bookmarks from './pages/Bookmarks';
import Revision from './pages/Revision';
import Admin from './pages/Admin';
import Privacy from './pages/Privacy';
import NotFound from './pages/NotFound';

export default function App() {
  return (
    <>
      <Header />
      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/tests" element={<Tests />} />
          <Route path="/tests/:testNumber/instructions" element={<Instructions />} />
          <Route path="/tests/:testNumber/attempt" element={<Attempt />} />
          <Route path="/results/:attemptId" element={<Result />} />
          <Route path="/results/:attemptId/solutions" element={<Solutions />} />
          <Route path="/progress" element={<Progress />} />
          <Route path="/practice" element={<Practice />} />
          <Route path="/formulas" element={<Formulas />} />
          <Route path="/bookmarks" element={<Bookmarks />} />
          <Route path="/revision" element={<Revision />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <Footer />
    </>
  );
}
