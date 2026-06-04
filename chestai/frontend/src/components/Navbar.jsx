import { NavLink } from 'react-router-dom';

function Navbar() {
  return (
    <header className="navbar">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
        <div className="nav-logo">
          <div className="logo-mark text-lg">🫁</div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-accent-hi">ChestAI</p>
            <p className="text-[11px] text-muted">Lung pathology explorer</p>
          </div>
        </div>
        <nav className="nav-links">
          <NavLink to="/" end className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
            Home
          </NavLink>
          <NavLink to="/analyze" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
            Analyze
          </NavLink>
          <NavLink to="/filter-lab" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
            Filter Lab
          </NavLink>
          <NavLink to="/how-it-works" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
            How It Works
          </NavLink>
          <NavLink to="/fairness" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
            Fairness
          </NavLink>
        </nav>
      </div>
    </header>
  );
}

export default Navbar;
