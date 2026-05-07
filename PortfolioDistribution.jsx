// Álamos · Portfolio Distribution · Pared 3D (W1 final)
// Receives { slices, total } — no hardcoded data.
// slices: [{ id: string, label: string, pct: number, color: string }]
// Plus Jakarta Sans 700/800 — matching brand logo

const FONT = '"Plus Jakarta Sans", system-ui, sans-serif';
const INK = '#0E0F0C';
const INK_3 = 'rgba(14,15,12,0.45)';
const SURFACE = '#FFFFFF';

function shade(hex, amt) {
  if (!hex || hex.startsWith('rgba') || hex.startsWith('rgb(')) return hex;
  const h = hex.replace('#','');
  const r = parseInt(h.slice(0,2),16), g = parseInt(h.slice(2,4),16), b = parseInt(h.slice(4,6),16);
  const f = (v) => Math.max(0, Math.min(255, Math.round(v + (255-v)*Math.max(0,amt) - v*Math.max(0,-amt))));
  return `rgb(${f(r)},${f(g)},${f(b)})`;
}

function textOn(color) {
  return color === '#0E0F0C' || color === '#000000' ? '#FAFAF7' : '#0E0F0C';
}

export default function PortfolioDistribution({ slices, total, label = 'Distribución' }) {
  const sorted = [...slices].sort((a,b) => b.pct - a.pct);
  const W = 340, H = 180;
  const wallW = 280, depth = 32, wallH = 100;
  const xL = (W - wallW) / 2;
  const yTop = 36, yBot = yTop + wallH;
  const totalPct = sorted.reduce((a,b) => a + b.pct, 0);

  let xAcc = xL;
  const blocks = sorted.map(s => {
    const w = (s.pct / totalPct) * wallW;
    const x0 = xAcc; xAcc += w;
    return { ...s, x0, x1: xAcc };
  });

  return (
    <div style={{
      width: '100%', maxWidth: 380, padding: 24, background: SURFACE,
      borderRadius: 22, fontFamily: FONT, boxSizing: 'border-box',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 16 }}>
        <span style={{ fontSize: 11, color: INK_3, letterSpacing: '0.2em', textTransform: 'uppercase', fontWeight: 700 }}>{label}</span>
        {total && <span style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.03em', color: INK }}>{total}</span>}
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block' }}>
        {/* ground shadow */}
        <ellipse cx={W/2 + depth/2} cy={yBot + 14} rx={wallW/2 + 14} ry={7} fill="rgba(14,15,12,0.10)" />

        {/* fills */}
        {blocks.map(blk => (
          <g key={blk.id}>
            <polygon points={`${blk.x0},${yTop} ${blk.x1},${yTop} ${blk.x1},${yBot} ${blk.x0},${yBot}`} fill={blk.color} />
            <polygon
              points={`${blk.x0},${yTop} ${blk.x1},${yTop} ${blk.x1 + depth},${yTop - depth*0.55} ${blk.x0 + depth},${yTop - depth*0.55}`}
              fill={shade(blk.color, 0.22)}
            />
            {(blk.x1 - blk.x0) > 38 && (
              <text x={(blk.x0 + blk.x1)/2} y={(yTop + yBot)/2 + 6}
                textAnchor="middle" fontSize="14" fontWeight="800"
                fill={textOn(blk.color)} letterSpacing="-0.6"
                fontFamily={FONT}>{blk.pct}%</text>
            )}
          </g>
        ))}

        {/* right side of last block */}
        {blocks.length > 0 && (() => {
          const last = blocks[blocks.length - 1];
          return (
            <polygon
              points={`${last.x1},${yTop} ${last.x1 + depth},${yTop - depth*0.55} ${last.x1 + depth},${yBot - depth*0.55} ${last.x1},${yBot}`}
              fill={shade(last.color, -0.2)}
            />
          );
        })()}

        {/* black outlines on top */}
        <g stroke={INK} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" fill="none">
          {blocks.slice(0, -1).map(blk => (
            <g key={`div-${blk.id}`}>
              <line x1={blk.x1} y1={yTop} x2={blk.x1} y2={yBot} />
              <line x1={blk.x1} y1={yTop} x2={blk.x1 + depth} y2={yTop - depth*0.55} />
            </g>
          ))}
          <polygon points={`${xL},${yTop} ${xL + wallW},${yTop} ${xL + wallW},${yBot} ${xL},${yBot}`} />
          <polygon points={`${xL},${yTop} ${xL + wallW},${yTop} ${xL + wallW + depth},${yTop - depth*0.55} ${xL + depth},${yTop - depth*0.55}`} />
          <polygon points={`${xL + wallW},${yTop} ${xL + wallW + depth},${yTop - depth*0.55} ${xL + wallW + depth},${yBot - depth*0.55} ${xL + wallW},${yBot}`} />
        </g>
      </svg>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 14px', marginTop: 12 }}>
        {sorted.map(s => (
          <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12 }}>
            <span style={{ width: 9, height: 9, background: s.color, borderRadius: 2 }} />
            <span style={{ color: INK, fontWeight: 600, flex: 1 }}>{s.label}</span>
            <span style={{ fontWeight: 800, letterSpacing: '-0.02em' }}>{s.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* USAGE
import PortfolioDistribution from './PortfolioDistribution';

<PortfolioDistribution
  total="$ 6,1M"
  slices={[
    { id: 'crypto',  label: 'Crypto',      pct: 50,  color: '#00E676' },
    { id: 'ar',      label: 'Acciones AR', pct: 34,  color: '#0E0F0C' },
    { id: 'bonos',   label: 'Bonos',       pct: 9.5, color: '#7EE9A6' },
    { id: 'cedears', label: 'CEDEARs',     pct: 5.9, color: '#00B864' },
    { id: 'fondos',  label: 'Fondos',      pct: 0.6, color: '#94A3B8' },
  ]}
/>
*/
