import { useState } from 'react';
import { useAuth } from '../auth/context';
import { useNavigate } from 'react-router-dom';
import { SetupGuide, SETUP_CODE, AGENT_INSTRUCTIONS } from '../components/SetupGuide';

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={async () => { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      className="font-pixel text-[10px] tracking-wider px-2 py-1 border border-cc-border text-cc-muted hover:border-cc-pink hover:text-cc-pink transition-colors"
    >
      {copied ? 'COPIED!' : label}
    </button>
  );
}

function ApiKeySection() {
  const { client } = useAuth();
  const [generating, setGenerating] = useState(false);
  const [generatedKey, setGeneratedKey] = useState<{ apiKey: string; exportKey: string; encryptedMasterKey: string } | null>(null);
  const [keys, setKeys] = useState<Array<{ id: string; prefix: string; name: string; createdAt: string }>>([]);
  const [loaded, setLoaded] = useState(false);

  const loadKeys = async () => {
    if (!client || loaded) return;
    try {
      const res = await (client as unknown as { request: <T>(m: string, p: string) => Promise<T> }).request<{ data: typeof keys }>('GET', '/v1/api-keys');
      setKeys(res.data);
    } catch { /* */ }
    setLoaded(true);
  };

  const handleGenerate = async () => {
    if (!client) return;
    setGenerating(true);
    try {
      const res = await (client as unknown as { request: <T>(m: string, p: string, b?: unknown) => Promise<T> }).request<{
        data: { apiKey: string; exportKey: string; encryptedMasterKey: string; prefix: string };
      }>('POST', '/v1/api-keys', { name: 'default' });
      setGeneratedKey({
        apiKey: res.data.apiKey,
        exportKey: localStorage.getItem('cc_export_key') ?? '',
        encryptedMasterKey: res.data.encryptedMasterKey ?? '',
      });
      loadKeys();
    } catch { /* */ }
    setGenerating(false);
  };

  const handleRevoke = async (id: string) => {
    if (!client || !confirm('Revoke this API key?')) return;
    try {
      await (client as unknown as { request: <T>(m: string, p: string) => Promise<T> }).request<void>('DELETE', `/v1/api-keys/${id}`);
      setKeys((prev) => prev.filter((k) => k.id !== id));
    } catch { /* */ }
  };

  // Load on first render
  if (!loaded) loadKeys();

  const mcpConfig = generatedKey ? `{
  "mcpServers": {
    "context-chest": {
      "command": "npx",
      "args": ["-y", "context-chest-mcp"],
      "env": {
        "CONTEXT_CHEST_API_KEY": "${generatedKey.apiKey}",
        "CONTEXT_CHEST_EXPORT_KEY": "${generatedKey.exportKey}"
      }
    }
  }
}` : null;

  return (
    <div className="border-2 border-cc-pink bg-cc-dark p-4">
      <p className="font-pixel text-[10px] text-cc-muted tracking-wider mb-3">API KEY — FASTEST SETUP</p>

      {!generatedKey && (
        <>
          <p className="text-xs text-cc-sub mb-3">Generate an API key to skip the login step. Just paste the config into .mcp.json.</p>
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="font-pixel text-xs tracking-wider px-4 py-2 bg-cc-pink text-cc-black hover:bg-cc-pink-dim transition-colors disabled:opacity-50"
          >
            {generating ? 'GENERATING...' : 'GENERATE API KEY'}
          </button>
        </>
      )}

      {generatedKey && mcpConfig && (
        <div className="space-y-3">
          <div className="border-2 border-green-500/30 bg-green-500/5 p-3">
            <p className="text-green-400 text-xs font-pixel tracking-wider mb-2">KEY GENERATED — COPY NOW</p>
            <p className="text-[10px] text-cc-muted">This key will not be shown again. Create <span className="text-cc-white">.mcp.json</span> in your project folder with this:</p>
          </div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-cc-muted font-pixel tracking-wider">.mcp.json</span>
            <CopyButton text={mcpConfig} label="COPY CONFIG" />
          </div>
          <pre className="bg-cc-black border border-cc-border p-3 text-[11px] font-mono text-cc-sub overflow-x-auto leading-relaxed whitespace-pre">{mcpConfig}</pre>
          <p className="text-[10px] text-cc-muted italic">No login command needed. Just paste and restart Claude Code.</p>
        </div>
      )}

      {keys.length > 0 && (
        <div className="mt-4 pt-3 border-t border-cc-border">
          <p className="text-[10px] text-cc-muted font-pixel tracking-wider mb-2">ACTIVE KEYS</p>
          {keys.map((k) => (
            <div key={k.id} className="flex items-center justify-between py-1">
              <span className="font-mono text-xs text-cc-sub">{k.prefix}...</span>
              <button onClick={() => handleRevoke(k.id)} className="font-pixel text-[9px] text-cc-muted hover:text-red-400 tracking-wider">REVOKE</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function Settings() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="max-w-lg mx-auto p-8">
      <h1 className="font-pixel text-xl text-cc-white tracking-wider mb-6">SETTINGS</h1>
      <div className="space-y-4">
        {/* API Key — fastest setup */}
        <ApiKeySection />

        {/* Manual setup guide */}
        <div className="border-2 border-cc-border bg-cc-dark p-4">
          <p className="font-pixel text-[10px] text-cc-muted tracking-wider mb-3">MANUAL SETUP (ALTERNATIVE)</p>
          <SetupGuide compact />
        </div>

        <div className="border-2 border-cc-border bg-cc-dark p-4">
          <p className="font-pixel text-[10px] text-cc-muted tracking-wider mb-3">ENCRYPTION</p>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-cc-sub">Master Key</span>
            <span className="inline-flex items-center gap-1.5 font-pixel text-[10px] text-green-400 tracking-wider">
              <span className="w-1.5 h-1.5 bg-green-400" />
              ACTIVE
            </span>
          </div>
          <p className="text-cc-muted text-[11px] leading-relaxed">
            AES-256-GCM encryption. Key derived on your device, never sent to server.
          </p>
        </div>

        <div className="border-2 border-cc-border bg-cc-dark p-4">
          <p className="font-pixel text-[10px] text-cc-muted tracking-wider mb-3">ABOUT</p>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-cc-muted">Version</span>
              <span className="font-mono text-[11px] text-cc-sub">0.2.0</span>
            </div>
            <div className="flex justify-between">
              <span className="text-cc-muted">License</span>
              <span className="text-cc-sub">MIT</span>
            </div>
            <div className="flex justify-between">
              <span className="text-cc-muted">Source</span>
              <a href="https://github.com/fuckupic/context-chest" target="_blank" rel="noopener noreferrer" className="text-cc-pink text-[11px] hover:underline">GITHUB</a>
            </div>
          </div>
        </div>

        <a
          href="https://www.feedsea.com/submit/feedback/ad2ca0f3-23df-4362-8e95-5778ca3a85ac"
          target="_blank"
          rel="noopener noreferrer"
          className="block w-full py-2.5 border-2 border-cc-border bg-cc-dark text-cc-pink font-pixel text-xs tracking-wider hover:bg-cc-pink-glow hover:border-cc-pink-border transition-colors text-center"
        >
          SEND FEEDBACK
        </a>

        <button
          onClick={() => { logout(); navigate('/login'); }}
          className="w-full py-2.5 border-2 border-cc-border bg-cc-dark text-cc-muted font-pixel text-xs tracking-wider hover:text-red-400 hover:border-red-400/30 transition-colors"
        >
          SIGN OUT
        </button>
      </div>
    </div>
  );
}
