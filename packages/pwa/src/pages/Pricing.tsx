import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/context';

const TIERS = [
  {
    name: 'FREE',
    price: 'Free',
    period: 'forever',
    description: 'Get started with AI memory.',
    cta: 'GET STARTED',
    ctaLink: null,
    highlight: false,
    features: [
      { text: 'Unlimited memories', included: true },
      { text: '3 chests', included: true },
      { text: '2 AI agents', included: true },
      { text: 'Auto-sort by topic', included: true },
      { text: 'Markdown editor', included: true },
      { text: 'Export / Import', included: true },
      { text: 'E2E encryption', included: true },
      { text: 'Cloud hosted', included: true },
      { text: 'Unlimited chests', included: false },
      { text: 'Unlimited agents', included: false },
      { text: 'Priority support', included: false },
    ],
  },
  {
    name: 'PRO',
    price: '$9',
    period: '/month',
    description: 'We host it. You just use it.',
    cta: 'UPGRADE NOW',
    ctaLink: null,
    highlight: true,
    badge: 'MOST POPULAR',
    features: [
      { text: 'Unlimited memories', included: true },
      { text: 'Unlimited chests', included: true },
      { text: 'Unlimited AI agents', included: true },
      { text: 'Auto-sort by topic', included: true },
      { text: 'Markdown editor', included: true },
      { text: 'Export / Import', included: true },
      { text: 'E2E encryption', included: true },
      { text: 'Cloud hosted (zero setup)', included: true },
      { text: 'Priority support', included: true },
      { text: 'Early access to new features', included: true },
      { text: 'Team sharing', included: false },
      { text: 'SSO / SAML', included: false },
    ],
  },
  {
    name: 'ENTERPRISE',
    price: 'Custom',
    period: '',
    description: 'Teams, compliance, dedicated infra.',
    cta: 'CONTACT US',
    ctaLink: 'mailto:tady@uhumdrum.com?subject=Context%20Chest%20Enterprise',
    highlight: false,
    features: [
      { text: 'Everything in Pro', included: true },
      { text: 'Shared chests across teams', included: true },
      { text: 'Team permissions & roles', included: true },
      { text: 'SSO / SAML authentication', included: true },
      { text: 'Dedicated infrastructure', included: true },
      { text: 'On-prem deployment option', included: true },
      { text: 'Audit logs & compliance', included: true },
      { text: 'SLA & priority support', included: true },
      { text: 'Custom integrations', included: true },
      { text: 'Volume pricing', included: true },
    ],
  },
];

export function Pricing() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  const [plan, setPlan] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated) return;
    const token = localStorage.getItem('cc_auth_token');
    if (!token) return;
    fetch(`${import.meta.env.VITE_API_URL ?? ''}/v1/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => setPlan(data.plan))
      .catch(() => {});
  }, [isAuthenticated]);

  const handleUpgrade = async (interval: 'month' | 'year' = 'month') => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    const token = localStorage.getItem('cc_auth_token');
    if (!token) return;
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL ?? ''}/v1/billing/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ interval }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch { /* */ }
  };

  return (
    <div className="min-h-screen bg-cc-black relative">
      <div className="fixed inset-0 dither-bg pointer-events-none" />

      {/* Nav */}
      <nav className="relative z-10 flex items-center justify-between max-w-5xl mx-auto px-6 py-5">
        <a href="/" className="flex items-center gap-2.5">
          <img src="/logo.png" alt="" className="w-6 h-6" style={{ imageRendering: 'auto' }} />
          <span className="font-pixel text-base text-cc-white tracking-wide">Context Chest</span>
        </a>
        <div className="flex gap-4">
          <a href="https://github.com/fuckupic/context-chest" target="_blank" rel="noopener noreferrer" className="font-pixel text-xs text-cc-muted hover:text-cc-pink tracking-wider transition-colors">GITHUB</a>
          <button onClick={() => navigate(isAuthenticated ? '/settings' : '/login')} className="font-pixel text-xs text-cc-muted hover:text-cc-pink tracking-wider transition-colors">
            {isAuthenticated ? 'DASHBOARD' : 'SIGN IN'}
          </button>
        </div>
      </nav>

      {/* Header */}
      <section className="relative z-10 max-w-5xl mx-auto px-4 md:px-6 pt-10 md:pt-16 pb-8 text-center">
        <h1 className="font-pixel text-3xl md:text-5xl text-cc-white tracking-wide mb-4">
          SIMPLE <span className="text-cc-pink">PRICING</span>
        </h1>
        <p className="text-cc-sub text-sm max-w-lg mx-auto">
          Free forever. Upgrade when you need more.
        </p>
      </section>

      {/* Pricing Cards */}
      <section className="relative z-10 max-w-5xl mx-auto px-4 md:px-6 pb-16">
        <div className="grid md:grid-cols-3 gap-4 md:gap-6">
          {TIERS.map((tier) => (
            <div
              key={tier.name}
              className={`border-2 bg-cc-dark flex flex-col ${
                tier.highlight ? 'border-cc-pink' : 'border-cc-border'
              }`}
            >
              {/* Header */}
              <div className={`p-5 border-b-2 ${tier.highlight ? 'border-cc-pink' : 'border-cc-border'}`}>
                <div className="flex items-center gap-2 mb-3">
                  <h3 className="font-pixel text-sm text-cc-white tracking-wider">{tier.name}</h3>
                  {tier.badge && (
                    <span className="font-pixel text-[8px] tracking-wider px-1.5 py-0.5 bg-cc-pink text-cc-black">
                      {tier.badge}
                    </span>
                  )}
                </div>
                <div className="flex items-baseline gap-1 mb-2">
                  <span className="font-pixel text-3xl text-cc-white">{tier.price}</span>
                  {tier.period && <span className="text-cc-muted text-sm">{tier.period}</span>}
                </div>
                <p className="text-xs text-cc-muted">{tier.description}</p>
              </div>

              {/* Features */}
              <div className="p-5 flex-1">
                <ul className="space-y-2">
                  {tier.features.map((f) => (
                    <li key={f.text} className="flex items-start gap-2 text-xs">
                      <span className={`mt-0.5 ${f.included ? 'text-cc-pink' : 'text-cc-border'}`}>
                        {f.included ? '>' : '-'}
                      </span>
                      <span className={f.included ? 'text-cc-sub' : 'text-cc-muted line-through'}>
                        {f.text}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* CTA */}
              <div className="p-5 pt-0">
                {tier.ctaLink ? (
                  <a
                    href={tier.ctaLink}
                    target={tier.ctaLink.startsWith('http') ? '_blank' : undefined}
                    rel={tier.ctaLink.startsWith('http') ? 'noopener noreferrer' : undefined}
                    className={`block w-full py-2.5 font-pixel text-xs tracking-wider text-center transition-colors ${
                      tier.highlight
                        ? 'bg-cc-pink text-cc-black hover:bg-cc-pink-dim'
                        : 'border-2 border-cc-border text-cc-muted hover:border-cc-pink hover:text-cc-pink'
                    }`}
                  >
                    {tier.cta}
                  </a>
                ) : (tier.name === 'PRO' && plan === 'pro') || (tier.name === 'FREE' && isAuthenticated && plan !== 'pro') ? (
                  <button disabled className="w-full py-2.5 font-pixel text-xs tracking-wider bg-cc-pink/30 text-cc-black cursor-not-allowed">
                    CURRENT PLAN
                  </button>
                ) : (
                  <button
                    onClick={tier.name === 'PRO' ? () => handleUpgrade() : () => navigate(isAuthenticated ? '/memories' : '/login')}
                    className={`w-full py-2.5 font-pixel text-xs tracking-wider transition-colors ${
                      tier.highlight
                        ? 'bg-cc-pink text-cc-black hover:bg-cc-pink-dim'
                        : 'border-2 border-cc-border text-cc-muted hover:border-cc-pink hover:text-cc-pink'
                    }`}
                  >
                    {tier.cta}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        <p className="text-center text-xs text-cc-muted mt-8">
          All plans include E2E encryption, auto-sort, and cross-agent memory.
          <br />
          Free forever. Upgrade anytime. Also{' '}
          <a href="https://github.com/fuckupic/context-chest" target="_blank" rel="noopener noreferrer" className="text-cc-pink hover:underline">open source on GitHub</a>.
        </p>
      </section>

      {/* FAQ */}
      <section className="relative z-10 max-w-3xl mx-auto px-4 md:px-6 pb-16">
        <h2 className="font-pixel text-2xl text-cc-white text-center mb-8 tracking-wide">
          <span className="text-cc-pink">FAQ</span>
        </h2>
        <div className="space-y-4">
          {[
            {
              q: 'Is the free tier actually free forever?',
              a: 'Yes. Free includes 3 chests, 2 agents, and unlimited memories — forever. Want to self-host instead? The entire project is open source (MIT) on GitHub.',
            },
            {
              q: 'What happens to my data if I stop paying?',
              a: 'Your data is always yours. Export everything as .md files or .zip archives anytime. If you stop paying for Pro, your memories stay accessible in read-only mode, and you can export them.',
            },
            {
              q: 'Can you read my memories?',
              a: 'No. Everything is encrypted on your device with AES-256-GCM before being sent to the server. We store ciphertext only. Even with full database access, we cannot read your content.',
            },
            {
              q: 'What AI tools does it work with?',
              a: 'Any tool that supports the Model Context Protocol (MCP): Claude Code, Cursor, Windsurf, and more. It also has a REST API for custom integrations.',
            },
            {
              q: 'How is this different from Claude\'s built-in memory?',
              a: 'Claude\'s memory only works inside Claude. Context Chest works across all your AI tools. Store in Claude, recall in Cursor. Plus it\'s encrypted, exportable, and self-hostable.',
            },
          ].map((faq) => (
            <div key={faq.q} className="border-2 border-cc-border bg-cc-dark p-4">
              <h3 className="font-pixel text-xs text-cc-white tracking-wider mb-2">{faq.q}</h3>
              <p className="text-xs text-cc-muted leading-relaxed">{faq.a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t-2 border-cc-border py-6 text-center">
        <p className="font-pixel text-[10px] text-cc-muted tracking-wider">
          CONTEXT CHEST &middot; MIT LICENSE &middot;{' '}
          <a href="https://github.com/fuckupic/context-chest" className="text-cc-pink hover:underline" target="_blank" rel="noopener noreferrer">GITHUB</a>
          {' '}&middot;{' '}
          <a href="/" className="text-cc-pink hover:underline">HOME</a>
        </p>
      </footer>
    </div>
  );
}
