import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/context';

const FEATURES = [
  {
    icon: '🔐',
    title: 'Client-Side Encryption',
    desc: 'AES-256-GCM encryption happens on your machine. The server never sees plaintext. Your memories are yours alone.',
  },
  {
    icon: '🧠',
    title: '8 MCP Tools',
    desc: 'Remember, recall, read, forget, browse, and full session tracking. Your AI agent gets persistent memory in one install.',
  },
  {
    icon: '🔄',
    title: 'Works Everywhere',
    desc: 'Claude Code, Cursor, any MCP-compatible tool. One vault, every agent. Memories sync across all your AI workflows.',
  },
  {
    icon: '📂',
    title: 'Organized by Path',
    desc: 'Store memories at semantic paths like preferences/editor or project/architecture. Browse them like a filesystem.',
  },
  {
    icon: '🔍',
    title: 'Instant Recall',
    desc: 'Text search across all your memories. Optional vector search with OpenViking for semantic matching.',
  },
  {
    icon: '🤖',
    title: 'Agent Tracking',
    desc: 'See which AI agents are connected, when they last called, and how many requests they have made. Full visibility.',
  },
];

const SETUP_CODE = `{
  "mcpServers": {
    "context-chest": {
      "command": "npx",
      "args": ["@context-chest/mcp-server"]
    }
  }
}`;

function FeatureCard({ icon, title, desc, index }: { icon: string; title: string; desc: string; index: number }) {
  return (
    <div
      className={`opacity-0 animate-fade-up stagger-${index + 1} group relative border border-vault-border rounded-xl p-6 hover:border-vault-pink-dim transition-colors duration-500`}
    >
      <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-vault-pink/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      <div className="relative">
        <span className="text-2xl">{icon}</span>
        <h3 className="font-display text-lg text-white mt-3 mb-2">{title}</h3>
        <p className="text-sm text-vault-muted leading-relaxed">{desc}</p>
      </div>
    </div>
  );
}

export function Landing() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  const handleCTA = () => {
    navigate(isAuthenticated ? '/memories' : '/login');
  };

  return (
    <div className="min-h-screen gradient-mesh noise-overlay relative overflow-hidden">
      {/* Ambient glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-vault-pink/5 rounded-full blur-[120px] animate-glow-pulse pointer-events-none" />

      {/* Nav */}
      <nav className="relative z-10 flex items-center justify-between max-w-6xl mx-auto px-6 py-6">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-vault-pink to-vault-pink-dim flex items-center justify-center text-vault-crust font-bold text-sm">
            CC
          </div>
          <span className="font-display text-lg text-white">Context Chest</span>
        </div>
        <button
          onClick={handleCTA}
          className="text-sm text-vault-muted hover:text-white transition-colors"
        >
          {isAuthenticated ? 'Dashboard' : 'Sign in'}
        </button>
      </nav>

      {/* Hero */}
      <section className="relative z-10 max-w-4xl mx-auto px-6 pt-20 pb-16 text-center">
        <div className="opacity-0 animate-fade-up">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-vault-pink/20 bg-vault-pink/5 text-vault-pink text-xs font-mono mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-vault-pink animate-pulse" />
            Open Source &middot; End-to-End Encrypted
          </div>
        </div>

        <h1 className="opacity-0 animate-fade-up stagger-1 font-display text-5xl md:text-7xl text-white leading-[1.1] mb-6">
          Your AI forgets<br />
          <span className="text-vault-pink italic">everything.</span>
        </h1>

        <p className="opacity-0 animate-fade-up stagger-2 text-lg md:text-xl text-vault-muted max-w-2xl mx-auto mb-10 leading-relaxed font-light">
          Context Chest gives AI agents persistent, encrypted memory.
          Preferences, project context, decisions &mdash; remembered across
          every session, encrypted so only you can read them.
        </p>

        <div className="opacity-0 animate-fade-up stagger-3 flex flex-col sm:flex-row items-center justify-center gap-4">
          <button
            onClick={handleCTA}
            className="px-8 py-3 bg-vault-pink text-vault-crust font-semibold rounded-lg hover:bg-vault-pink/90 transition-colors text-sm tracking-wide"
          >
            {isAuthenticated ? 'Open Dashboard' : 'Get Started Free'}
          </button>
          <a
            href="https://github.com/fuckupic/context-chest"
            target="_blank"
            rel="noopener noreferrer"
            className="px-8 py-3 border border-vault-border text-vault-muted rounded-lg hover:border-vault-pink-dim hover:text-white transition-colors text-sm"
          >
            View on GitHub
          </a>
        </div>
      </section>

      {/* Setup */}
      <section className="relative z-10 max-w-3xl mx-auto px-6 pb-20">
        <div className="opacity-0 animate-fade-up stagger-4">
          <p className="text-center text-xs text-vault-muted font-mono uppercase tracking-widest mb-4">
            30-second setup
          </p>
          <div className="relative rounded-xl border border-vault-border bg-vault-mantle/50 overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-vault-border">
              <div className="w-2.5 h-2.5 rounded-full bg-vault-accent/60" />
              <div className="w-2.5 h-2.5 rounded-full bg-vault-pink/60" />
              <div className="w-2.5 h-2.5 rounded-full bg-green-500/60" />
              <span className="text-xs text-vault-muted ml-2 font-mono">.mcp.json</span>
            </div>
            <pre className="p-5 text-sm font-mono text-vault-pink/80 overflow-x-auto leading-relaxed">
              {SETUP_CODE}
            </pre>
          </div>
          <p className="text-center text-xs text-vault-muted mt-3">
            Add to your Claude Code or Cursor config. That&apos;s it.
          </p>
        </div>
      </section>

      <div className="vault-line max-w-4xl mx-auto" />

      {/* Features */}
      <section className="relative z-10 max-w-5xl mx-auto px-6 py-20">
        <div className="text-center mb-14">
          <h2 className="opacity-0 animate-fade-up font-display text-3xl md:text-4xl text-white mb-4">
            Everything your agent needs<br />to <span className="text-vault-pink italic">remember</span>
          </h2>
          <p className="opacity-0 animate-fade-up stagger-1 text-vault-muted max-w-xl mx-auto">
            A complete memory layer for any MCP-compatible AI tool.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-5">
          {FEATURES.map((f, i) => (
            <FeatureCard key={f.title} {...f} index={i} />
          ))}
        </div>
      </section>

      <div className="vault-line max-w-4xl mx-auto" />

      {/* How it works */}
      <section className="relative z-10 max-w-4xl mx-auto px-6 py-20">
        <h2 className="opacity-0 animate-fade-up font-display text-3xl md:text-4xl text-white text-center mb-14">
          How it <span className="text-vault-pink italic">works</span>
        </h2>

        <div className="space-y-8">
          {[
            {
              step: '01',
              title: 'Agent encrypts locally',
              desc: 'When your AI agent stores a memory, it encrypts the content with your key before it leaves your machine. The server only sees ciphertext.',
            },
            {
              step: '02',
              title: 'Summaries enable search',
              desc: 'Unencrypted summaries (L0/L1) are stored alongside the encrypted content, enabling browse and recall without exposing the full memory.',
            },
            {
              step: '03',
              title: 'Any agent can access',
              desc: 'Claude Code, Cursor, or any MCP tool connects to the same vault. Your AI agents share context seamlessly, encrypted end-to-end.',
            },
          ].map((item, i) => (
            <div key={item.step} className={`opacity-0 animate-slide-right stagger-${i + 1} flex gap-6 items-start`}>
              <span className="font-mono text-vault-pink/40 text-3xl font-bold shrink-0 w-12">
                {item.step}
              </span>
              <div>
                <h3 className="font-display text-xl text-white mb-1">{item.title}</h3>
                <p className="text-vault-muted text-sm leading-relaxed">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="vault-line max-w-4xl mx-auto" />

      {/* CTA */}
      <section className="relative z-10 max-w-3xl mx-auto px-6 py-24 text-center">
        <h2 className="opacity-0 animate-fade-up font-display text-3xl md:text-5xl text-white mb-4">
          Give your AI a <span className="text-vault-pink italic">memory</span>
        </h2>
        <p className="opacity-0 animate-fade-up stagger-1 text-vault-muted mb-8 text-lg">
          Free to use. Open source. Your data stays yours.
        </p>
        <div className="opacity-0 animate-fade-up stagger-2">
          <button
            onClick={handleCTA}
            className="px-10 py-4 bg-vault-pink text-vault-crust font-semibold rounded-lg hover:bg-vault-pink/90 transition-colors tracking-wide"
          >
            {isAuthenticated ? 'Open Dashboard' : 'Get Started Free'}
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-vault-border py-8 text-center">
        <p className="text-xs text-vault-muted">
          Context Chest &middot; Open Source &middot;{' '}
          <a
            href="https://github.com/fuckupic/context-chest"
            className="text-vault-pink/60 hover:text-vault-pink transition-colors"
            target="_blank"
            rel="noopener noreferrer"
          >
            GitHub
          </a>
        </p>
      </footer>
    </div>
  );
}
