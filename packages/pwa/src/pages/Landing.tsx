import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/context';

const SETUP_CODE = `{
  "mcpServers": {
    "context-chest": {
      "command": "npx",
      "args": ["@context-chest/mcp-server"]
    }
  }
}`;

const FEATURES = [
  { title: 'ENCRYPTED', desc: 'AES-256-GCM on your machine. Server never sees plaintext.' },
  { title: '8 TOOLS', desc: 'Remember, recall, read, forget, browse, sessions.' },
  { title: 'ANY AGENT', desc: 'Claude Code, Cursor, any MCP tool. One vault.' },
  { title: 'ORGANIZED', desc: 'Path-based storage. Browse like a filesystem.' },
  { title: 'SEARCHABLE', desc: 'Instant text recall across all memories.' },
  { title: 'OPEN SOURCE', desc: 'MIT licensed. Self-host or use our cloud.' },
];

export function Landing() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  const handleCTA = () => navigate(isAuthenticated ? '/memories' : '/login');

  return (
    <div className="min-h-screen bg-cc-black relative">
      {/* Dither overlay */}
      <div className="fixed inset-0 dither-bg pointer-events-none" />

      {/* Nav */}
      <nav className="relative z-10 flex items-center justify-between max-w-5xl mx-auto px-6 py-5">
        <div className="flex items-center gap-2.5">
          <img src="/chest-white.png" alt="" className="w-6 h-6" style={{ imageRendering: 'auto' }} />
          <span className="font-pixel text-base text-cc-white tracking-wide">Context Chest</span>
        </div>
        <button onClick={handleCTA} className="font-pixel text-xs text-cc-muted hover:text-cc-pink tracking-wider transition-colors">
          {isAuthenticated ? 'DASHBOARD' : 'SIGN IN'}
        </button>
      </nav>

      {/* Hero */}
      <section className="relative z-10 max-w-5xl mx-auto px-6 pt-16 pb-20">
        <div className="flex flex-col md:flex-row items-center gap-12">
          {/* Chest image */}
          <div className="opacity-0 animate-fade-in md:w-1/2 flex justify-center">
            <img
              src="/chest-dithered.png"
              alt="Context Chest"
              className="w-72 md:w-96"
              style={{ imageRendering: 'auto' }}
            />
          </div>

          {/* Text */}
          <div className="md:w-1/2">
            <h1 className="opacity-0 animate-fade-up font-pixel text-5xl md:text-6xl text-cc-white leading-none mb-6 tracking-wide">
              Your AI<br />
              forgets<br />
              <span className="text-cc-pink">everything.</span>
            </h1>
            <p className="opacity-0 animate-fade-up stagger-1 text-cc-sub text-sm leading-relaxed mb-8 max-w-sm">
              Context Chest gives AI agents persistent, encrypted memory.
              Preferences, project context, decisions — remembered across
              every session. Encrypted so only you can read them.
            </p>
            <div className="opacity-0 animate-fade-up stagger-2 flex gap-3">
              <button
                onClick={handleCTA}
                className="px-6 py-2.5 bg-cc-pink text-cc-black font-pixel text-sm tracking-wider hover:bg-cc-pink-dim transition-colors"
              >
                {isAuthenticated ? 'OPEN DASHBOARD' : 'GET STARTED'}
              </button>
              <a
                href="https://github.com/fuckupic/context-chest"
                target="_blank"
                rel="noopener noreferrer"
                className="px-6 py-2.5 border-2 border-cc-border text-cc-muted font-pixel text-sm tracking-wider hover:border-cc-pink hover:text-cc-pink transition-colors"
              >
                GITHUB
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Divider */}
      <div className="max-w-5xl mx-auto px-6">
        <div className="border-t-2 border-cc-border border-dashed" />
      </div>

      {/* Setup */}
      <section className="relative z-10 max-w-3xl mx-auto px-6 py-16">
        <p className="font-pixel text-xs text-cc-muted tracking-[0.3em] mb-4 text-center">30 SECOND SETUP</p>
        <div className="border-2 border-cc-border bg-cc-dark">
          <div className="flex items-center gap-2 px-3 py-2 border-b-2 border-cc-border">
            <span className="font-pixel text-[10px] text-cc-muted tracking-wider">.mcp.json</span>
          </div>
          <pre className="p-4 text-sm font-mono text-cc-pink overflow-x-auto leading-relaxed">{SETUP_CODE}</pre>
        </div>
        <p className="text-center text-xs text-cc-muted mt-3">
          Add to Claude Code or Cursor config. That's it.
        </p>
      </section>

      {/* Divider */}
      <div className="max-w-5xl mx-auto px-6">
        <div className="border-t-2 border-cc-border border-dashed" />
      </div>

      {/* Features */}
      <section className="relative z-10 max-w-5xl mx-auto px-6 py-16">
        <h2 className="font-pixel text-3xl text-cc-white text-center mb-12 tracking-wide">
          WHAT'S IN THE <span className="text-cc-pink">CHEST</span>
        </h2>
        <div className="grid md:grid-cols-3 gap-px bg-cc-border">
          {FEATURES.map((f) => (
            <div key={f.title} className="bg-cc-black p-6 hover:bg-cc-surface transition-colors group">
              <h3 className="font-pixel text-base text-cc-white mb-2 tracking-wider group-hover:text-cc-pink transition-colors">
                {f.title}
              </h3>
              <p className="text-xs text-cc-muted leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Divider */}
      <div className="max-w-5xl mx-auto px-6">
        <div className="border-t-2 border-cc-border border-dashed" />
      </div>

      {/* How it works */}
      <section className="relative z-10 max-w-3xl mx-auto px-6 py-16">
        <h2 className="font-pixel text-3xl text-cc-white text-center mb-12 tracking-wide">
          HOW IT <span className="text-cc-pink">WORKS</span>
        </h2>
        <div className="space-y-6">
          {[
            { n: '01', title: 'ENCRYPT LOCALLY', desc: 'Your agent encrypts content with your key before it leaves your machine.' },
            { n: '02', title: 'STORE SUMMARIES', desc: 'Unencrypted summaries enable search. Full content stays encrypted.' },
            { n: '03', title: 'ACCESS ANYWHERE', desc: 'Any MCP tool connects to the same vault. Memories sync across agents.' },
          ].map((item) => (
            <div key={item.n} className="flex gap-5 items-start border-2 border-cc-border p-4 hover:border-cc-pink-border transition-colors">
              <span className="font-pixel text-2xl text-cc-pink shrink-0">{item.n}</span>
              <div>
                <h3 className="font-pixel text-sm text-cc-white tracking-wider mb-1">{item.title}</h3>
                <p className="text-xs text-cc-muted leading-relaxed">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="relative z-10 max-w-3xl mx-auto px-6 py-20 text-center">
        <h2 className="font-pixel text-4xl md:text-5xl text-cc-white mb-4 tracking-wide">
          GIVE YOUR AI<br />A <span className="text-cc-pink">MEMORY</span>
        </h2>
        <p className="text-cc-muted text-sm mb-8">Free. Open source. Your data stays yours.</p>
        <button
          onClick={handleCTA}
          className="px-8 py-3 bg-cc-pink text-cc-black font-pixel text-sm tracking-wider hover:bg-cc-pink-dim transition-colors"
        >
          {isAuthenticated ? 'OPEN DASHBOARD' : 'GET STARTED FREE'}
        </button>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t-2 border-cc-border py-6 text-center">
        <p className="font-pixel text-[10px] text-cc-muted tracking-wider">
          CONTEXT CHEST &middot; MIT LICENSE &middot;{' '}
          <a href="https://github.com/fuckupic/context-chest" className="text-cc-pink hover:underline" target="_blank" rel="noopener noreferrer">
            GITHUB
          </a>
        </p>
      </footer>
    </div>
  );
}
