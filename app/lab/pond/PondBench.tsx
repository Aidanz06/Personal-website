'use client'

import { useState } from 'react'
import { Pond, DEFAULT_POND_SETTINGS, type PondSettings } from '@/components/Pond'
import type { Stone } from '@/lib/pond/field'

/**
 * Candidate stone layout. In the real homepage these become the routes, each
 * with a real <a> layered over it — here they exist to judge whether a stone
 * reads as a stone at all.
 */
const STONES: Stone[] = [
  { x: 180, y: 150, radius: 46, href: '/tailor-studio', label: 'tailor studio' },
  { x: 520, y: 300, radius: 40, href: '/about', label: 'about' },
  { x: 260, y: 450, radius: 38, href: '/resume', label: 'resume' },
]

export function PondBench() {
  const [settings, setSettings] = useState<PondSettings>(DEFAULT_POND_SETTINGS)
  const [showStones, setShowStones] = useState(true)
  const [stats, setStats] = useState({ fps: 0, cellsDrawn: 0, cells: 0 })

  const set = <K extends keyof PondSettings>(key: K, value: PondSettings[K]) =>
    setSettings((previous) => ({ ...previous, [key]: value }))

  return (
    <div>
      <div className="h-[600px] w-full border border-rule">
        <Pond
          className="h-full w-full"
          settings={settings}
          stones={showStones ? STONES : []}
          onStats={setStats}
        />
      </div>

      <p data-pond-stats className="mt-1 font-mono text-small text-muted">
        {stats.fps.toFixed(0)} fps · redrew {stats.cellsDrawn} of {stats.cells} cells
        last frame ({stats.cells > 0 ? ((stats.cellsDrawn / stats.cells) * 100).toFixed(0) : '0'}%)
      </p>

      <div className="mt-3 grid gap-x-4 gap-y-1 md:grid-cols-2">
        <Slider label="cellSize" value={settings.cellSize} min={4} max={20} step={1} unit="px"
          onChange={(v) => set('cellSize', v)} />
        <Slider label="cellAspect" value={settings.cellAspect} min={1} max={3} step={0.05} unit="×"
          onChange={(v) => set('cellAspect', v)} />
        <Slider label="waterBase" value={settings.waterBase} min={0} max={0.6} step={0.01} unit=""
          onChange={(v) => set('waterBase', v)} />
        <Slider label="waterAmplitude" value={settings.waterAmplitude} min={0} max={0.5} step={0.01} unit=""
          onChange={(v) => set('waterAmplitude', v)} />
        <Slider label="rippleStrength" value={settings.rippleStrength} min={0} max={1.5} step={0.05} unit=""
          onChange={(v) => set('rippleStrength', v)} />
        <Slider label="koiCount" value={settings.koiCount} min={0} max={12} step={1} unit=""
          onChange={(v) => set('koiCount', v)} />
        <Slider label="bodyRadius" value={settings.bodyRadius} min={6} max={90} step={1} unit="px"
          onChange={(v) => set('bodyRadius', v)} />
        <Slider label="tailAmplitude" value={settings.tailAmplitude} min={0} max={60} step={1} unit="px"
          onChange={(v) => set('tailAmplitude', v)} />
        <Slider label="beatRate" value={settings.beatRate} min={0.2} max={4} step={0.1} unit="×"
          onChange={(v) => set('beatRate', v)} />
        <Slider label="koiBrightness" value={settings.koiBrightness} min={0.1} max={1} step={0.05} unit=""
          onChange={(v) => set('koiBrightness', v)} />
        <Slider label="attractRadius" value={settings.attractRadius} min={0} max={700} step={10} unit="px"
          onChange={(v) => set('attractRadius', v)} />
        <Slider label="attractStrength" value={settings.attractStrength} min={0} max={6} step={0.1} unit="×"
          onChange={(v) => set('attractStrength', v)} />
        <Slider label="stoneBrightness" value={settings.stoneBrightness} min={0} max={1} step={0.05} unit=""
          onChange={(v) => set('stoneBrightness', v)} />
      </div>

      <div className="mt-2 flex flex-wrap gap-2">
        <button type="button" onClick={() => setShowStones((v) => !v)}
          className="font-mono text-small text-accent underline underline-offset-2">
          {showStones ? 'hide stones' : 'show stones'}
        </button>
        <button type="button" onClick={() => setSettings(DEFAULT_POND_SETTINGS)}
          className="font-mono text-small text-muted underline underline-offset-2">
          reset all
        </button>
      </div>
    </div>
  )
}

function Slider({
  label, value, min, max, step, unit, onChange,
}: {
  label: string; value: number; min: number; max: number; step: number; unit: string
  onChange: (value: number) => void
}) {
  return (
    <label className="flex items-center gap-1">
      <span className="w-[130px] shrink-0 font-mono text-small text-muted">{label}</span>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="min-w-0 flex-1 accent-[var(--color-accent)]" />
      <span className="w-[64px] shrink-0 text-right font-mono text-small tabular-nums">
        {value}{unit}
      </span>
    </label>
  )
}
