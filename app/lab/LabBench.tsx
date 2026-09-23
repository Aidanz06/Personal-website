'use client'

import { useState } from 'react'
import { AsciiImage } from '@/components/AsciiImage'
import {
  DEFAULT_CELL_ASPECT,
  DEFAULT_CELL_SIZE,
  DEFAULT_EXIT_EASE_MS,
  DEFAULT_INNER_RADIUS,
  DEFAULT_OUTER_RADIUS,
  DEFAULT_RAMP,
} from '@/lib/ascii/constants'

type Params = {
  ramp: string
  cellSize: number
  cellAspect: number
  innerRadius: number
  outerRadius: number
  exitEaseMs: number
}

const INITIAL: Params = {
  ramp: DEFAULT_RAMP,
  cellSize: DEFAULT_CELL_SIZE,
  cellAspect: DEFAULT_CELL_ASPECT,
  innerRadius: DEFAULT_INNER_RADIUS,
  outerRadius: DEFAULT_OUTER_RADIUS,
  exitEaseMs: DEFAULT_EXIT_EASE_MS,
}

const RAMP_PRESETS = [
  { label: 'default', value: DEFAULT_RAMP },
  { label: 'coarse', value: '.:*#@' },
  { label: 'fine', value: ' .\'`^",:;Il!i><~+_-?][}{1)(|\\/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$' },
  { label: 'blocks', value: '░▒▓█' },
  { label: 'reversed', value: [...DEFAULT_RAMP].reverse().join('') },
]

export function LabBench({ images }: { images: string[] }) {
  if (images.length === 0) {
    return (
      <p className="font-mono text-small text-muted">
        [public/lab/ is empty — drop candidate photographs in and reload]
      </p>
    )
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {images.map((src) => (
        <LabInstance key={src} src={src} />
      ))}
    </div>
  )
}

function LabInstance({ src }: { src: string }) {
  const [params, setParams] = useState<Params>(INITIAL)
  const [degradedTo, setDegradedTo] = useState<number | null>(null)

  const set = <K extends keyof Params>(key: K, value: Params[K]) =>
    setParams((previous) => ({ ...previous, [key]: value }))

  const name = src.split('/').pop() ?? src

  return (
    <section className="border-t border-rule pt-2">
      <h2 className="font-mono text-small text-muted">{name}</h2>

      <div className="mt-1 h-[360px] w-full">
        <AsciiImage
          src={src}
          alt={`lab candidate: ${name}`}
          className="h-full w-full"
          ramp={params.ramp}
          cellSize={params.cellSize}
          cellAspect={params.cellAspect}
          innerRadius={params.innerRadius}
          outerRadius={params.outerRadius}
          exitEaseMs={params.exitEaseMs}
          onDegrade={setDegradedTo}
        />
      </div>

      {degradedTo !== null && (
        <p className="mt-1 font-mono text-small text-muted">
          frame rate dropped — cell size raised to {degradedTo}px at runtime
        </p>
      )}

      <div className="mt-2 space-y-1">
        <Slider
          label="cellSize"
          value={params.cellSize}
          min={3}
          max={24}
          step={1}
          unit="px"
          onChange={(v) => {
            setDegradedTo(null)
            set('cellSize', v)
          }}
        />
        <Slider
          label="cellAspect"
          value={params.cellAspect}
          min={1}
          max={3}
          step={0.05}
          unit="×"
          onChange={(v) => set('cellAspect', v)}
        />
        <Slider
          label="innerRadius"
          value={params.innerRadius}
          min={0}
          max={300}
          step={5}
          unit="px"
          onChange={(v) => set('innerRadius', v)}
        />
        <Slider
          label="outerRadius"
          value={params.outerRadius}
          min={10}
          max={600}
          step={10}
          unit="px"
          onChange={(v) => set('outerRadius', v)}
        />
        <Slider
          label="exitEaseMs"
          value={params.exitEaseMs}
          min={0}
          max={2000}
          step={50}
          unit="ms"
          onChange={(v) => set('exitEaseMs', v)}
        />

        <div className="flex flex-wrap items-baseline gap-1 pt-1">
          <span className="w-[110px] font-mono text-small text-muted">ramp</span>
          <input
            type="text"
            value={params.ramp}
            onChange={(e) => set('ramp', e.target.value)}
            className="min-w-0 flex-1 border-b border-rule bg-transparent font-mono text-small"
            aria-label="character ramp"
          />
        </div>

        <div className="flex flex-wrap gap-1.5 pt-0.5 pl-[110px]">
          {RAMP_PRESETS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => set('ramp', preset.value)}
              className="font-mono text-small text-accent underline underline-offset-2"
            >
              {preset.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              setParams(INITIAL)
              setDegradedTo(null)
            }}
            className="font-mono text-small text-muted underline underline-offset-2"
          >
            reset all
          </button>
        </div>
      </div>
    </section>
  )
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  unit,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  unit: string
  onChange: (value: number) => void
}) {
  return (
    <label className="flex items-center gap-1">
      <span className="w-[110px] shrink-0 font-mono text-small text-muted">
        {label}
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="min-w-0 flex-1 accent-[var(--color-accent)]"
      />
      <span className="w-[72px] shrink-0 text-right font-mono text-small tabular-nums">
        {value}
        {unit}
      </span>
    </label>
  )
}
