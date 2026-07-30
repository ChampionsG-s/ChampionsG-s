export function PitchShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-green-900/70 bg-[linear-gradient(180deg,#1d5533,#194a2c_50%,#153f26_65%,#0e2c1a)] p-4 py-6 space-y-6 shadow-[0_16px_40px_rgba(0,0,0,0.4)]">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        {/* Linea de medio campo + circulo central completo */}
        <div className="absolute left-0 right-0 top-1/2 h-px bg-white/25" />
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-28 h-28 rounded-full border-2 border-white/20" />
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-white/30" />

        {/* Porteria y area rival (arriba) */}
        <div className="absolute left-1/2 top-0 -translate-x-1/2 w-44 h-16 border-2 border-t-0 border-white/20 rounded-b-md" />
        <div className="absolute left-1/2 top-0 -translate-x-1/2 w-24 h-7 border-2 border-t-0 border-white/20 rounded-b-md" />

        {/* Area y porteria propia (abajo) */}
        <div className="absolute left-1/2 bottom-0 -translate-x-1/2 w-44 h-16 border-2 border-b-0 border-white/20 rounded-t-md" />
        <div className="absolute left-1/2 bottom-0 -translate-x-1/2 w-24 h-7 border-2 border-b-0 border-white/20 rounded-t-md" />

        {/* Banda lateral */}
        <div className="absolute inset-0 border-x border-white/10" />

        {/* Esquinas */}
        <div className="absolute top-0 left-0 w-5 h-5 border-2 border-white/20 rounded-br-full" style={{ borderTop: 0, borderLeft: 0 }} />
        <div className="absolute top-0 right-0 w-5 h-5 border-2 border-white/20 rounded-bl-full" style={{ borderTop: 0, borderRight: 0 }} />
        <div className="absolute bottom-0 left-0 w-5 h-5 border-2 border-white/20 rounded-tr-full" style={{ borderLeft: 0, borderBottom: 0 }} />
        <div className="absolute bottom-0 right-0 w-5 h-5 border-2 border-white/20 rounded-tl-full" style={{ borderRight: 0, borderBottom: 0 }} />
      </div>

      {children}
    </div>
  )
}
