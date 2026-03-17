import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/context';
import { AGENT_INSTRUCTIONS } from '../components/SetupGuide';

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={async () => { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      className="font-pixel text-[10px] tracking-wider px-3 py-1.5 border-2 border-cc-border text-cc-muted hover:border-cc-pink hover:text-cc-pink transition-colors"
    >
      {copied ? 'COPIED!' : label}
    </button>
  );
}

function Divider() {
  return <div className="max-w-5xl mx-auto px-4 md:px-6"><div className="border-t-2 border-cc-border border-dashed" /></div>;
}

export function Landing() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const handleCTA = () => navigate(isAuthenticated ? '/settings' : '/login');

  return (
    <div className="min-h-screen bg-cc-black relative">
      <div className="fixed inset-0 dither-bg pointer-events-none" />

      {/* Nav */}
      <nav className="relative z-10 flex items-center justify-between max-w-5xl mx-auto px-6 py-5">
        <div className="flex items-center gap-2.5">
          <img src="/logo.png" alt="" className="w-6 h-6" style={{ imageRendering: 'auto' }} />
          <span className="font-pixel text-base text-cc-white tracking-wide">Context Chest</span>
        </div>
        <div className="flex gap-4">
          <a href="/pricing" className="font-pixel text-xs text-cc-muted hover:text-cc-pink tracking-wider transition-colors">PRICING</a>
          <a href="https://github.com/fuckupic/context-chest" target="_blank" rel="noopener noreferrer" className="font-pixel text-xs text-cc-muted hover:text-cc-pink tracking-wider transition-colors">GITHUB</a>
          <button onClick={handleCTA} className="font-pixel text-xs text-cc-muted hover:text-cc-pink tracking-wider transition-colors">
            {isAuthenticated ? 'DASHBOARD' : 'SIGN IN'}
          </button>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative z-10 max-w-5xl mx-auto px-4 md:px-6 pt-10 md:pt-16 pb-12 md:pb-20">
        <div className="flex flex-col md:flex-row items-center gap-8 md:gap-12">
          <div className="opacity-0 animate-fade-in md:w-1/2 flex justify-center">
            <div className="relative py-4 px-2 md:py-6 md:px-4">
              <span className="hidden sm:block absolute top-[8%] left-[5%] z-20 px-2 md:px-3 py-1 md:py-1.5 bg-[#4a9eff] text-white font-pixel text-[10px] md:text-xs tracking-wider border-2 border-[#4a9eff] rotate-[-4deg] shadow-[3px_3px_0_0_rgba(0,0,0,0.3)]">CLAUDE CODE</span>
              <span className="hidden sm:block absolute top-[6%] right-[8%] z-20 px-2 md:px-3 py-1 md:py-1.5 bg-[#a855f7] text-white font-pixel text-[10px] md:text-xs tracking-wider border-2 border-[#a855f7] rotate-[3deg] shadow-[3px_3px_0_0_rgba(0,0,0,0.3)]">CURSOR</span>
              <span className="hidden sm:block absolute top-[30%] left-[10%] z-20 px-2 md:px-3 py-1 md:py-1.5 bg-cc-dark text-cc-white font-pixel text-[10px] md:text-xs tracking-wider border-2 border-cc-border rotate-[-2deg] shadow-[3px_3px_0_0_#222]">PROJECT A</span>
              <span className="hidden sm:block absolute top-[28%] right-[5%] z-20 px-2 md:px-3 py-1 md:py-1.5 bg-cc-dark text-cc-white font-pixel text-[10px] md:text-xs tracking-wider border-2 border-cc-border rotate-[4deg] shadow-[3px_3px_0_0_#222]">PROJECT B</span>
              <span className="hidden sm:block absolute top-[48%] left-[20%] z-20 px-2 md:px-3 py-1 md:py-1.5 bg-cc-pink text-cc-black font-pixel text-[10px] md:text-xs tracking-wider border-2 border-cc-pink rotate-[1deg] shadow-[3px_3px_0_0_rgba(255,255,255,0.2)]">SECOND BRAIN</span>
              <span className="hidden sm:block absolute top-[62%] right-[8%] z-20 px-2 md:px-3 py-1 md:py-1.5 bg-[#22c55e] text-white font-pixel text-[10px] md:text-xs tracking-wider border-2 border-[#22c55e] rotate-[-3deg] shadow-[3px_3px_0_0_rgba(0,0,0,0.3)]">WINDSURF</span>
              <span className="hidden sm:block absolute top-[72%] left-[8%] z-20 px-2 md:px-3 py-1 md:py-1.5 bg-cc-dark text-cc-white font-pixel text-[10px] md:text-xs tracking-wider border-2 border-cc-border rotate-[5deg] shadow-[3px_3px_0_0_#222]">PROJECT C</span>
              <span className="hidden sm:block absolute top-[82%] right-[15%] z-20 px-2 md:px-3 py-1 md:py-1.5 bg-[#f97316] text-white font-pixel text-[10px] md:text-xs tracking-wider border-2 border-[#f97316] rotate-[-4deg] shadow-[3px_3px_0_0_rgba(0,0,0,0.3)]">ANY MCP</span>
              <span className="hidden sm:block absolute top-[88%] left-[22%] z-20 px-2 md:px-3 py-1 md:py-1.5 bg-cc-dark text-cc-muted font-pixel text-[10px] md:text-xs tracking-wider border-2 border-cc-border rotate-[2deg] shadow-[3px_3px_0_0_#222]">AES-256 ENCRYPTED</span>
              <img src="/logo.png" alt="Context Chest" className="w-48 sm:w-72 md:w-96 relative" style={{ imageRendering: 'auto' }} />
            </div>
          </div>

          <div className="md:w-1/2 text-center md:text-left">
            <h1 className="opacity-0 animate-fade-up font-pixel text-3xl sm:text-4xl md:text-5xl text-cc-white leading-none mb-4 md:mb-6 tracking-wide">
              Your second brain.<br />
              For <span className="text-cc-pink">every</span> AI tool<br />
              you use.
            </h1>
            <p className="opacity-0 animate-fade-up stagger-1 text-cc-sub text-xs sm:text-sm leading-relaxed mb-6 md:mb-8 max-w-sm mx-auto md:mx-0">
              You use Claude Code, Cursor, and Windsurf across 5 projects.
              Each one forgets everything between sessions. Context Chest gives
              them all a shared, encrypted memory that auto-organizes by topic.
            </p>
            <div className="opacity-0 animate-fade-up stagger-2 flex gap-3 justify-center md:justify-start">
              <button onClick={handleCTA} className="px-5 md:px-6 py-2.5 bg-cc-pink text-cc-black font-pixel text-xs sm:text-sm tracking-wider hover:bg-cc-pink-dim transition-colors">
                {isAuthenticated ? 'OPEN DASHBOARD' : 'START FREE'}
              </button>
              <a href="https://github.com/fuckupic/context-chest" target="_blank" rel="noopener noreferrer" className="px-5 md:px-6 py-2.5 border-2 border-cc-border text-cc-muted font-pixel text-xs sm:text-sm tracking-wider hover:border-cc-pink hover:text-cc-pink transition-colors">
                GITHUB
              </a>
            </div>
          </div>
        </div>
      </section>

      <Divider />

      {/* Sound Familiar? */}
      <section className="relative z-10 max-w-4xl mx-auto px-4 md:px-6 py-10 md:py-16">
        <h2 className="font-pixel text-2xl md:text-3xl text-cc-white text-center mb-8 md:mb-12 tracking-wide">
          SOUND <span className="text-cc-pink">FAMILIAR?</span>
        </h2>
        <div className="grid md:grid-cols-3 gap-4">
          {[
            { q: '"What framework are we using again?"', a: 'You\'ve told Claude your stack 50 times. New session? Start over.' },
            { q: '"Wait, which project is this?"', a: 'You switch between 5 projects daily. Your AI has no idea which one it\'s looking at.' },
            { q: '"I already told Cursor this yesterday"', a: 'You explained your architecture in Cursor. Now Claude asks the same question.' },
          ].map((pain) => (
            <div key={pain.q} className="border-2 border-cc-border bg-cc-dark p-5 hover:border-cc-pink-border transition-colors">
              <p className="font-mono text-sm text-cc-pink mb-3 italic">{pain.q}</p>
              <p className="text-xs text-cc-muted leading-relaxed">{pain.a}</p>
            </div>
          ))}
        </div>
      </section>

      <Divider />

      {/* How It Works */}
      <section className="relative z-10 max-w-3xl mx-auto px-4 md:px-6 py-10 md:py-16">
        <h2 className="font-pixel text-2xl md:text-3xl text-cc-white text-center mb-8 md:mb-12 tracking-wide">
          HOW IT <span className="text-cc-pink">WORKS</span>
        </h2>
        <div className="space-y-6">
          {[
            { n: '01', title: 'YOU JUST WORK NORMALLY', desc: 'Talk to your AI about anything — tech stack, pricing decisions, team plans. You don\'t say "remember this." Context Chest extracts what matters automatically.' },
            { n: '02', title: 'MEMORIES AUTO-SORT INTO ENCRYPTED CHESTS', desc: 'Work context goes to your Work chest. Health stuff to Health. Finance to Finance. Six auto-created categories, or create your own. Each one AES-256 encrypted.' },
            { n: '03', title: 'EVERY AI TOOL RECALLS THE SAME MEMORY', desc: 'Store a decision in Claude Code. Recall it from Cursor. Browse it from Windsurf. One vault, every tool, every project.' },
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

      <Divider />

      {/* Tools */}
      <section className="relative z-10 max-w-4xl mx-auto px-4 md:px-6 py-10 md:py-16">
        <h2 className="font-pixel text-2xl md:text-3xl text-cc-white text-center mb-4 tracking-wide">
          ONE VAULT. <span className="text-cc-pink">EVERY TOOL.</span>
        </h2>
        <p className="text-center text-xs text-cc-muted mb-10">
          Store a memory from Claude Code. Recall it from Cursor. Browse it from Windsurf. All encrypted.
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-cc-border">
          {[
            { name: 'CLAUDE CODE', status: 'MCP server' },
            { name: 'CURSOR', status: 'MCP server' },
            { name: 'WINDSURF', status: 'MCP server' },
            { name: 'ANY MCP TOOL', status: 'Works out of the box' },
          ].map((agent) => (
            <div key={agent.name} className="bg-cc-black p-5 text-center hover:bg-cc-surface transition-colors group">
              <h3 className="font-pixel text-sm text-cc-white tracking-wider mb-1 group-hover:text-cc-pink transition-colors">{agent.name}</h3>
              <p className="text-[10px] text-cc-muted font-mono">{agent.status}</p>
            </div>
          ))}
        </div>
      </section>

      <Divider />

      {/* Features */}
      <section className="relative z-10 max-w-5xl mx-auto px-4 md:px-6 py-10 md:py-16">
        <h2 className="font-pixel text-2xl md:text-3xl text-cc-white text-center mb-8 md:mb-12 tracking-wide">
          WHAT'S IN THE <span className="text-cc-pink">CHEST</span>
        </h2>
        <div className="grid md:grid-cols-3 gap-px bg-cc-border">
          {[
            { title: 'CROSS-AGENT', desc: 'Store in Claude. Recall in Cursor. One memory across every tool you use.' },
            { title: 'AUTO-SORTED', desc: 'Memories route to chests: work, health, finance, personal. No manual organizing.' },
            { title: 'MULTI-PROJECT', desc: 'Different project? Different chest. One API key works everywhere.' },
            { title: 'ENCRYPTED', desc: 'AES-256-GCM on your machine. The server stores ciphertext. Even we can\'t read it.' },
            { title: 'FULL EDITOR', desc: 'Browse, search, edit, and export your memories. Markdown editor built in.' },
            { title: 'OPEN SOURCE', desc: 'MIT licensed. Self-host it. Own your infrastructure and your keys.' },
          ].map((f) => (
            <div key={f.title} className="bg-cc-black p-6 hover:bg-cc-surface transition-colors group">
              <h3 className="font-pixel text-base text-cc-white mb-2 tracking-wider group-hover:text-cc-pink transition-colors">{f.title}</h3>
              <p className="text-xs text-cc-muted leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <Divider />

      {/* Who It's For */}
      <section className="relative z-10 max-w-5xl mx-auto px-4 md:px-6 py-10 md:py-16">
        <h2 className="font-pixel text-2xl md:text-3xl text-cc-white text-center mb-8 md:mb-12 tracking-wide">
          BUILT FOR DEVELOPERS WHO <span className="text-cc-pink">USE AI EVERY DAY</span>
        </h2>
        <div className="grid md:grid-cols-2 gap-4">
          {[
            {
              who: 'THE MULTI-TOOL DEVELOPER',
              what: 'You bounce between Claude Code for architecture, Cursor for quick edits, and Windsurf for prototyping. Context Chest means you explain your stack once. Every tool knows it.',
            },
            {
              who: 'THE FREELANCER WITH 5 CLIENTS',
              what: 'Acme Corp uses PostgreSQL. Widget Inc uses MongoDB. Your AI auto-separates them into different chests. Client A\'s secrets never leak into Client B\'s session.',
            },
            {
              who: 'THE TECHNICAL FOUNDER',
              what: 'Revenue numbers, hiring plans, investor deck notes — you paste sensitive context into AI daily. Context Chest encrypts it so a server breach reveals nothing.',
            },
            {
              who: 'THE PRIVACY-CONSCIOUS ENGINEER',
              what: 'In regulated industries, you can\'t have project context stored in plaintext on someone else\'s server. Self-host Context Chest. Your infra, your keys, your data.',
            },
          ].map((uc) => (
            <div key={uc.who} className="border-2 border-cc-border bg-cc-dark p-5 hover:border-cc-pink-border transition-colors group">
              <h3 className="font-pixel text-sm text-cc-white tracking-wider mb-2 group-hover:text-cc-pink transition-colors">{uc.who}</h3>
              <p className="text-xs text-cc-sub leading-relaxed">{uc.what}</p>
            </div>
          ))}
        </div>
      </section>

      <Divider />

      {/* Comparison */}
      <section className="relative z-10 max-w-3xl mx-auto px-4 md:px-6 py-10 md:py-16">
        <h2 className="font-pixel text-2xl md:text-3xl text-cc-white text-center mb-4 tracking-wide">
          CLAUDE REMEMBERS.<br /><span className="text-cc-pink">BUT ONLY INSIDE CLAUDE.</span>
        </h2>
        <p className="text-center text-xs text-cc-muted mb-8">Why not just use Claude's built-in memory?</p>
        <div className="border-2 border-cc-border bg-cc-dark overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b-2 border-cc-border">
                <th className="p-3 text-left font-pixel text-[10px] text-cc-muted tracking-wider"></th>
                <th className="p-3 text-center font-pixel text-[10px] text-cc-muted tracking-wider">CLAUDE MEMORY</th>
                <th className="p-3 text-center font-pixel text-[10px] text-cc-pink tracking-wider">CONTEXT CHEST</th>
              </tr>
            </thead>
            <tbody className="font-mono">
              {[
                ['Works in Claude', true, true],
                ['Works in Cursor', false, true],
                ['Works in Windsurf', false, true],
                ['E2E encrypted', false, true],
                ['Auto-organized by topic', false, true],
                ['Exportable (.md / .zip)', false, true],
                ['Self-hostable', false, true],
                ['Open source', false, true],
              ].map(([label, claude, chest]) => (
                <tr key={label as string} className="border-b border-cc-border">
                  <td className="p-3 text-cc-sub">{label as string}</td>
                  <td className="p-3 text-center">{claude ? <span className="text-green-400">Yes</span> : <span className="text-cc-muted">No</span>}</td>
                  <td className="p-3 text-center">{chest ? <span className="text-cc-pink">Yes</span> : <span className="text-cc-muted">No</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <Divider />

      {/* Setup */}
      <section className="relative z-10 max-w-3xl mx-auto px-4 md:px-6 py-10 md:py-16">
        <p className="font-pixel text-xs text-cc-muted tracking-[0.3em] mb-4 text-center">SETUP IN 3 STEPS</p>
        <div className="space-y-4">
          <div className="border-2 border-cc-pink bg-cc-dark">
            <div className="flex items-center gap-3 px-4 py-3 border-b-2 border-cc-border">
              <span className="font-pixel text-lg text-cc-pink">01</span>
              <span className="font-pixel text-xs text-cc-white tracking-wider">SIGN UP + GENERATE API KEY</span>
            </div>
            <div className="p-4">
              <p className="text-xs text-cc-sub mb-3">Create an account, go to Settings, click <span className="text-cc-pink">Generate API Key</span>. Copy the .mcp.json config.</p>
              <button onClick={handleCTA} className="px-5 py-2 bg-cc-pink text-cc-black font-pixel text-xs tracking-wider hover:bg-cc-pink-dim transition-colors">
                {isAuthenticated ? 'DASHBOARD' : 'SIGN UP FREE'}
              </button>
            </div>
          </div>
          <div className="border-2 border-cc-border bg-cc-dark">
            <div className="flex items-center justify-between px-4 py-3 border-b-2 border-cc-border">
              <div className="flex items-center gap-3">
                <span className="font-pixel text-lg text-cc-pink">02</span>
                <span className="font-pixel text-xs text-cc-white tracking-wider">PASTE CONFIG + INSTRUCTIONS</span>
              </div>
              <CopyButton text={AGENT_INSTRUCTIONS} label="COPY CLAUDE.MD" />
            </div>
            <div className="p-4 space-y-2">
              <p className="text-xs text-cc-muted">Paste the .mcp.json config into your project root. Then paste the CLAUDE.md instructions.</p>
              <p className="text-[10px] text-cc-muted italic">No terminal login. No password prompts. API key handles everything.</p>
            </div>
          </div>
          <div className="border-2 border-cc-pink bg-cc-dark">
            <div className="flex items-center gap-3 px-4 py-3 border-b-2 border-cc-border">
              <span className="font-pixel text-lg text-cc-pink">03</span>
              <span className="font-pixel text-xs text-cc-white tracking-wider">RESTART CLAUDE CODE</span>
            </div>
            <div className="p-4">
              <p className="text-xs text-cc-muted">Type <span className="text-cc-white font-mono">/exit</span>, relaunch. Done. 30 seconds total.</p>
            </div>
          </div>
        </div>
      </section>

      <Divider />

      {/* Under the Hood */}
      <section className="relative z-10 max-w-4xl mx-auto px-4 md:px-6 py-10 md:py-16">
        <h2 className="font-pixel text-2xl md:text-3xl text-cc-white text-center mb-8 md:mb-12 tracking-wide">
          UNDER THE <span className="text-cc-pink">HOOD</span>
        </h2>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="border-2 border-cc-border bg-cc-dark p-5">
            <h3 className="font-pixel text-sm text-cc-white tracking-wider mb-3">ENCRYPTION MODEL</h3>
            <pre className="text-[11px] font-mono text-cc-sub leading-relaxed">{'Master Key (256-bit random)\n  │\n  ├─ HKDF(exportKey, userId)\n  │  → wrapping key\n  │  → wraps master key for storage\n  │\n  └─ HKDF(masterKey, chestName/URI)\n     → per-item AES-256-GCM key\n     → encrypts content'}</pre>
          </div>
          <div className="border-2 border-cc-border bg-cc-dark p-5">
            <h3 className="font-pixel text-sm text-cc-white tracking-wider mb-3">WHAT THE SERVER SEES</h3>
            <div className="space-y-2 text-[11px] font-mono">
              <div className="flex justify-between"><span className="text-cc-muted">Chest</span><span className="text-green-400">work</span></div>
              <div className="flex justify-between"><span className="text-cc-muted">URI path</span><span className="text-green-400">project/stack</span></div>
              <div className="flex justify-between"><span className="text-cc-muted">Content</span><span className="text-cc-pink">████████████</span></div>
              <div className="border-t border-cc-border my-1" />
              <p className="text-cc-muted">Server stores ciphertext only. Even we can't read your memories.</p>
            </div>
          </div>
          <div className="border-2 border-cc-border bg-cc-dark p-5">
            <h3 className="font-pixel text-sm text-cc-white tracking-wider mb-3">TECH STACK</h3>
            <div className="space-y-1.5 text-[11px] font-mono text-cc-sub">
              <p><span className="text-cc-pink">API</span> — Fastify + Prisma + PostgreSQL</p>
              <p><span className="text-cc-pink">MCP</span> — @modelcontextprotocol/sdk</p>
              <p><span className="text-cc-pink">CRYPTO</span> — AES-256-GCM + HKDF per-chest keys</p>
              <p><span className="text-cc-pink">PWA</span> — React + Tailwind + Vite</p>
              <p><span className="text-cc-pink">DEPLOY</span> — Railway (API) + Vercel (PWA)</p>
            </div>
          </div>
          <div className="border-2 border-cc-border bg-cc-dark p-5">
            <h3 className="font-pixel text-sm text-cc-white tracking-wider mb-3">SELF-HOST IT</h3>
            <pre className="text-[11px] font-mono text-cc-sub leading-relaxed">{'git clone github.com/fuckupic/\n  context-chest\n\ndocker-compose up -d\nnpm install\nnpx prisma migrate dev\nnpm run dev'}</pre>
            <p className="text-[11px] text-cc-muted mt-3">Full control. Your infra, your keys. MIT licensed.</p>
          </div>
        </div>
      </section>

      <Divider />

      {/* CTA */}
      <section className="relative z-10 max-w-3xl mx-auto px-4 md:px-6 py-12 md:py-20 text-center">
        <h2 className="font-pixel text-2xl sm:text-4xl md:text-5xl text-cc-white mb-4 tracking-wide">
          ONE SECOND BRAIN.<br /><span className="text-cc-pink">EVERY AI TOOL. EVERY PROJECT.</span>
        </h2>
        <p className="text-cc-muted text-sm mb-8">Free. Open source. Self-hostable. Your keys, your data.</p>
        <button onClick={handleCTA} className="px-8 py-3 bg-cc-pink text-cc-black font-pixel text-sm tracking-wider hover:bg-cc-pink-dim transition-colors">
          {isAuthenticated ? 'OPEN DASHBOARD' : 'START FREE'}
        </button>
      </section>

      {/* Founders */}
      <section className="relative z-10 max-w-3xl mx-auto px-4 md:px-6 py-10 md:py-16 text-center">
        <p className="font-pixel text-[10px] text-cc-muted tracking-[0.3em] mb-8">BUILT BY</p>
        <div className="flex justify-center gap-12">
          <div>
            <img src="/tady.png" alt="Tady" className="w-24 h-24 border-2 border-cc-border mx-auto mb-3" style={{ imageRendering: 'auto' }} />
            <p className="font-pixel text-sm text-cc-white tracking-wider">TADY</p>
            <p className="text-[11px] text-cc-muted">Co-founder</p>
          </div>
          <div>
            <img src="/luky.png" alt="Luky" className="w-24 h-24 border-2 border-cc-border mx-auto mb-3" style={{ imageRendering: 'auto' }} />
            <p className="font-pixel text-sm text-cc-white tracking-wider">LUKY</p>
            <p className="text-[11px] text-cc-muted">Co-founder</p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t-2 border-cc-border py-6 text-center">
        <p className="font-pixel text-[10px] text-cc-muted tracking-wider">
          CONTEXT CHEST &middot; MIT LICENSE &middot;{' '}
          <a href="https://github.com/fuckupic/context-chest" className="text-cc-pink hover:underline" target="_blank" rel="noopener noreferrer">GITHUB</a>
          {' '}&middot;{' '}
          <a href="https://www.feedsea.com/submit/feedback/ad2ca0f3-23df-4362-8e95-5778ca3a85ac" className="text-cc-pink hover:underline" target="_blank" rel="noopener noreferrer">FEEDBACK</a>
        </p>
      </footer>
    </div>
  );
}
