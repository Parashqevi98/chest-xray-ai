import { Component } from 'react';
import { Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar.jsx';
import Home from './pages/Home.jsx';
import Analyze from './pages/Analyze.jsx';
import HowItWorks from './pages/HowItWorks.jsx';
import Fairness from './pages/Fairness.jsx';
import FilterLab from './pages/FilterLab.jsx';

class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <div className="rounded-xl border border-rose-400/20 bg-rose-500/10 px-5 py-4 text-sm text-rose-300">
          <p className="font-semibold mb-1">Page error</p>
          <pre className="whitespace-pre-wrap text-xs opacity-80">{this.state.error.message}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

function App() {
  return (
    <div className="min-h-screen bg-navy text-slate-100">
      <Navbar />
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <ErrorBoundary>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/analyze" element={<Analyze />} />
            <Route path="/how-it-works" element={<HowItWorks />} />
            <Route path="/fairness" element={<Fairness />} />
            <Route path="/filter-lab" element={<FilterLab />} />
          </Routes>
        </ErrorBoundary>
      </main>
    </div>
  );
}

export default App;
