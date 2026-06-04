import { Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar.jsx';
import Home from './pages/Home.jsx';
import Analyze from './pages/Analyze.jsx';
import HowItWorks from './pages/HowItWorks.jsx';
import Fairness from './pages/Fairness.jsx';
import FilterLab from './pages/FilterLab.jsx';

function App() {
  return (
    <div className="min-h-screen bg-navy text-slate-100">
      <Navbar />
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/analyze" element={<Analyze />} />
          <Route path="/how-it-works" element={<HowItWorks />} />
          <Route path="/fairness" element={<Fairness />} />
          <Route path="/filter-lab" element={<FilterLab />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
