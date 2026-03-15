import { useChest } from '../context/chest-context';

export function ChestSwitcher() {
  const { chests, activeChest, setActiveChest, loading } = useChest();

  if (loading || chests.length === 0) return null;

  return (
    <div className="px-3 py-2.5 border-b-2 border-cc-border">
      <label className="font-pixel text-[9px] text-cc-muted tracking-widest block mb-1.5">CHEST</label>
      <select
        value={activeChest?.name ?? 'default'}
        onChange={(e) => {
          const chest = chests.find((c) => c.name === e.target.value);
          if (chest) setActiveChest(chest);
        }}
        className="w-full bg-cc-black border-2 border-cc-border px-2 py-1.5 text-xs text-cc-white font-mono focus:outline-none focus:border-cc-pink transition-colors cursor-pointer"
      >
        {chests.map((c) => (
          <option key={c.id} value={c.name}>{c.name}</option>
        ))}
      </select>
    </div>
  );
}
