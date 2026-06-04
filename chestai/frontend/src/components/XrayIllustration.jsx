function XrayIllustration() {
  return (
    <div className="relative w-full max-w-[300px] select-none">
      <div className="absolute inset-6 rounded-3xl bg-accent/8 blur-3xl pointer-events-none" />
      <svg
        viewBox="0 0 280 340"
        xmlns="http://www.w3.org/2000/svg"
        className="relative w-full rounded-2xl border border-white/8 bg-[#0B1220]"
        aria-label="Chest X-ray illustration"
      >
        <text x="12" y="18" fill="#243550" fontSize="7.5" fontFamily="monospace" letterSpacing="1.5">PA CHEST · DIGITAL</text>

        {/* Clavicles */}
        <path d="M140 54 C118 50 93 52 74 60" stroke="#243550" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
        <path d="M140 54 C162 50 187 52 206 60" stroke="#243550" strokeWidth="1.5" fill="none" strokeLinecap="round"/>

        {/* Spine */}
        <rect x="136" y="46" width="8" height="237" rx="4" fill="#18243A"/>

        {/* Left lung */}
        <path
          d="M136 60 C108 60 74 78 64 132 C54 186 58 238 70 268 C78 287 98 294 116 284 C128 276 136 254 136 238"
          stroke="#2D4060" strokeWidth="1.5" fill="rgba(99,102,241,0.05)" strokeLinejoin="round"
        />

        {/* Right lung */}
        <path
          d="M144 60 C172 60 206 78 216 132 C226 186 222 238 210 268 C202 287 182 294 164 284 C152 276 144 254 144 238"
          stroke="#2D4060" strokeWidth="1.5" fill="rgba(99,102,241,0.05)" strokeLinejoin="round"
        />

        {/* Ribs — left */}
        <path d="M136 90  C113 87  87 81  71 91"  stroke="#1C2E45" strokeWidth="1.1" fill="none" strokeLinecap="round"/>
        <path d="M136 108 C112 105 85 98  68 109" stroke="#1C2E45" strokeWidth="1.1" fill="none" strokeLinecap="round"/>
        <path d="M136 126 C111 123 83 115 66 128" stroke="#1C2E45" strokeWidth="1.1" fill="none" strokeLinecap="round"/>
        <path d="M136 144 C111 141 83 134 65 148" stroke="#1C2E45" strokeWidth="1.1" fill="none" strokeLinecap="round"/>
        <path d="M136 162 C112 159 85 153 68 167" stroke="#1C2E45" strokeWidth="1.1" fill="none" strokeLinecap="round"/>
        <path d="M136 180 C113 177 87 172 72 186" stroke="#1C2E45" strokeWidth="1.1" fill="none" strokeLinecap="round"/>

        {/* Ribs — right */}
        <path d="M144 90  C167 87  193 81  209 91"  stroke="#1C2E45" strokeWidth="1.1" fill="none" strokeLinecap="round"/>
        <path d="M144 108 C168 105 195 98  212 109" stroke="#1C2E45" strokeWidth="1.1" fill="none" strokeLinecap="round"/>
        <path d="M144 126 C169 123 197 115 214 128" stroke="#1C2E45" strokeWidth="1.1" fill="none" strokeLinecap="round"/>
        <path d="M144 144 C169 141 197 134 215 148" stroke="#1C2E45" strokeWidth="1.1" fill="none" strokeLinecap="round"/>
        <path d="M144 162 C168 159 195 153 212 167" stroke="#1C2E45" strokeWidth="1.1" fill="none" strokeLinecap="round"/>
        <path d="M144 180 C167 177 193 172 208 186" stroke="#1C2E45" strokeWidth="1.1" fill="none" strokeLinecap="round"/>

        {/* Heart / mediastinum */}
        <ellipse cx="125" cy="188" rx="34" ry="48" fill="#0E1926" stroke="#1C2E45" strokeWidth="1"/>

        {/* Diaphragm */}
        <path d="M64 268 C90 284 120 290 140 288 C160 290 190 284 216 268"
              stroke="#2D4060" strokeWidth="1.2" fill="none" strokeLinecap="round"/>

        {/* Lung highlight zones — animated accent */}
        <ellipse className="lung-pulse" cx="98"  cy="148" rx="22" ry="32" fill="rgba(99,102,241,0.08)"/>
        <ellipse className="lung-pulse" cx="182" cy="148" rx="22" ry="32" fill="rgba(99,102,241,0.08)"
                 style={{ animationDelay: '0.9s' }}/>

        {/* Corner calibration markers */}
        <line x1="258" y1="10" x2="270" y2="10" stroke="#1C2E45" strokeWidth="1"/>
        <line x1="264" y1="4"  x2="264" y2="16" stroke="#1C2E45" strokeWidth="1"/>
        <line x1="10"  y1="330" x2="22" y2="330" stroke="#1C2E45" strokeWidth="1"/>
        <line x1="16"  y1="324" x2="16" y2="336" stroke="#1C2E45" strokeWidth="1"/>

        <text x="186" y="332" fill="#1C2E45" fontSize="7" fontFamily="monospace">CHESTAI v1.0</text>
      </svg>
    </div>
  );
}

export default XrayIllustration;
