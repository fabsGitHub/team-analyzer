<!-- frontend/src/components/RadarChart.vue -->
<template>
    <div class="card chart-card" :aria-label="title" role="img" ref="box">
        <div class="head">
            <strong class="title">{{ title }}</strong>

            <div class="legend" v-if="series.length">
                <button v-for="(s, i) in series" :key="s.label" class="badge legend-badge"
                    :data-active="activeIndex === i" :style="{ '--col': colors[i % colors.length] }"
                    @mouseenter="activeIndex = i" @mouseleave="activeIndex = null" @click="$emit('select', s.label)">
                    {{ s.label }}
                </button>
            </div>
        </div>

        <div class="canvas-wrap" ref="wrap">
            <canvas ref="canvas" class="radar" @click="onClick" @keydown.enter.prevent="onKey" tabindex="0"
                :aria-label="a11yDesc" />
        </div>

        <div class="foot">
            <p class="label">{{ $t('misc.noData') }}</p>
        </div>
    </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch, computed } from 'vue'
import { CATEGORY_KEYS, type CategoryKey } from '../types'
import { useI18n } from 'vue-i18n'
type Series = { label: string; values: Record<CategoryKey, number> }

/** ➜ NEU: konfigurierbare Props */
const props = withDefaults(defineProps<{
    title: string
    series: Series[]
    max?: number
    sizePx?: number
    categories?: CategoryKey[]      // eigene Reihenfolge
    padding?: number                // Innenabstand in PX
    radiusScale?: number            // 0..1
    centerX?: number                // 0..1 (0 = links, 1 = rechts)
    centerY?: number                // 0..1 (0 = oben, 1 = unten)
    angleStartDeg?: number          // Startwinkel (Grad)
    clockwise?: boolean             // Drehrichtung
    labelOffset?: number            // Abstand Labels in PX
}>(), {
    sizePx: undefined,
    padding: 40,
    radiusScale: 1,
    centerX: 0.5,
    centerY: 0.5,
    angleStartDeg: -90,
    clockwise: true,
    labelOffset: 16
})

const cats = computed(() => props.categories ?? CATEGORY_KEYS)
const max = computed(() => props.max ?? 5)

const box = ref<HTMLDivElement | null>(null)   // äußere Karte (.chart-card)
const wrap = ref<HTMLDivElement | null>(null)  // innere Karte (.canvas-wrap)
const canvas = ref<HTMLCanvasElement | null>(null)
const ctx = () => canvas.value!.getContext('2d')!
const { t } = useI18n()
const colors = ['#b66a2b', '#2b7ab6', '#2b8b5e', '#8a5fb6', '#b62b53', '#2b96b6']
const activeIndex = ref<number | null>(null)

/* helpers */
function polarToXY(cx: number, cy: number, r: number, angle: number) {
    return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)]
}
function hexToRgba(hex: string, a: number) {
    const v = hex.replace('#', ''), n = parseInt(v, 16)
    const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255
    return `rgba(${r},${g},${b},${a})`
}
const labelFor = (k: CategoryKey) => ({
    appreciation: t('categories.appreciation'),
    equality: t('categories.equality'),
    workload: t('categories.workload'),
    collegiality: t('categories.collegiality'),
    transparency: t('categories.transparency')
}[k])

/* drawing */
function draw() {
    if (!canvas.value || !box.value) return
    const dpr = Math.max(1, window.devicePixelRatio || 1)
    const container = wrap.value ?? box.value
    // feste Zielkantenlänge, skaliert nur runter, nie hoch
    const target = props.sizePx ?? container.clientWidth
    const sizeCss = Math.floor(Math.min(container.clientWidth, target))
    const sizePx = Math.floor(sizeCss * dpr)

    canvas.value.width = sizePx
    canvas.value.height = sizePx
    canvas.value.style.width = `${sizeCss}px`
    canvas.value.style.height = `${sizeCss}px`

    const c = ctx()
    c.setTransform(dpr, 0, 0, dpr, 0, 0)
    c.clearRect(0, 0, sizeCss, sizeCss)

    const w = sizeCss, h = sizeCss
    const cx = w * props.centerX
    const cy = h * props.centerY
    // Platz für Labels einkalkulieren: längstes Label bestimmen
    c.font = '12px system-ui, -apple-system, Segoe UI, Roboto, Arial'
    const longestLabelWidth = Math.max(
        ...cats.value.map(k => c.measureText(labelFor(k)).width)
    )
    // Sicherheitsabstand: Padding + Labelabstand + halbe Labelbreite + kleine Reserve
    const outerPad = props.padding + props.labelOffset + longestLabelWidth / 2 + 8
    const R = Math.max(24, Math.min(w, h) * 0.5 * props.radiusScale - outerPad)
    const axes = cats.value.length
    const step = (2 * Math.PI) / axes
    const start = (props.angleStartDeg * Math.PI) / 180
    const dir = props.clockwise ? 1 : -1

    // grid rings
    c.save()
    c.strokeStyle = '#eae3dc'
    c.lineWidth = 1
    for (let ring = 1; ring <= max.value; ring++) {
        c.beginPath()
        for (let i = 0; i < axes; i++) {
            const a = start + dir * i * step
            const [x, y] = polarToXY(cx, cy, (R * ring) / max.value, a)
            i === 0 ? c.moveTo(x, y) : c.lineTo(x, y)
        }
        c.closePath()
        c.stroke()
    }

    // axes
    c.setLineDash([3, 4])
    c.strokeStyle = '#efe7e0'
    for (let i = 0; i < axes; i++) {
        const a = start + dir * i * step
        const [x, y] = polarToXY(cx, cy, R, a)
        c.beginPath(); c.moveTo(cx, cy); c.lineTo(x, y); c.stroke()
    }
    c.restore()

    // labels
    c.font = '12px system-ui, -apple-system, Segoe UI, Roboto, Arial'
    for (let i = 0; i < axes; i++) {
        const a = start + dir * i * step
        const text = labelFor(cats.value[i])
        const [lx, ly] = polarToXY(cx, cy, R + props.labelOffset, a)
        const padX = 6
        const wTxt = c.measureText(text).width
        const x = lx - wTxt / 2 - padX
        const y = ly - 10
        roundedRect(c, x, y, wTxt + padX * 2, 18, 6, 'rgba(255,255,255,.7)')
        c.fillStyle = '#6b6b6b'
        c.textAlign = 'center'
        c.textBaseline = 'middle'
        c.fillText(text, lx, ly)
    }

    // series polygons
    props.series.forEach((s, si) => {
        const isDim = activeIndex.value !== null && activeIndex.value !== si
        const stroke = colors[si % colors.length]
        const fill = hexToRgba(stroke, isDim ? 0.10 : 0.20)

        c.beginPath()
        cats.value.forEach((k, i) => {
            const a = start + dir * i * step
            const r = R * (s.values[k] / max.value)
            const [x, y] = polarToXY(cx, cy, r, a)
            i === 0 ? c.moveTo(x, y) : c.lineTo(x, y)
        })
        c.closePath()

        c.save()
        c.shadowColor = hexToRgba(stroke, 0.25)
        c.shadowBlur = 8
        c.fillStyle = fill
        c.fill()
        c.restore()

        c.lineWidth = isDim ? 1.5 : 2.5
        c.strokeStyle = stroke
        c.stroke()
    })
}

function roundedRect(
    c: CanvasRenderingContext2D,
    x: number, y: number, w: number, h: number, r: number, bg: string
) {
    c.save()
    c.beginPath()
    c.moveTo(x + r, y)
    c.lineTo(x + w - r, y)
    c.quadraticCurveTo(x + w, y, x + w, y + r)
    c.lineTo(x + w, y + h - r)
    c.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
    c.lineTo(x + r, y + h)
    c.quadraticCurveTo(x, y + h, x, y + h - r)
    c.lineTo(x, y + r)
    c.quadraticCurveTo(x, y, x + r, y)
    c.closePath()
    c.fillStyle = bg
    c.fill()
    c.restore()
}

/* a11y/events */
function onClick() { }
function onKey() { }
const a11yDesc = t('analysis.desc')

/* responsive */
let ro: ResizeObserver | null = null
onMounted(() => {
    draw()
    ro = new ResizeObserver(() => draw())
    if (wrap.value) ro.observe(wrap.value)
})
onUnmounted(() => { if (ro && wrap.value) ro.unobserve(wrap.value) })
watch(() => props.series, draw, { deep: true })
watch([activeIndex, cats, () => props.radiusScale, () => props.centerX, () => props.centerY,
    () => props.padding, () => props.labelOffset, () => props.angleStartDeg, () => props.clockwise], draw)
</script>

<style scoped>
.chart-card {
    padding: .75rem;
    overflow: hidden;
}

.head {
    display: flex;
    align-items: center;
    gap: .5rem;
    justify-content: space-between;
    margin-bottom: .25rem;
}

.title {
    font-size: 1.05rem;
}

.legend {
    display: flex;
    flex-wrap: wrap;
    gap: .4rem;
}

.legend-badge {
    --col: var(--accent);
    color: var(--col);
    border-color: var(--col);
    background: transparent;
    transition: background-color .15s ease, box-shadow .15s ease;
}

.legend-badge:hover,
.legend-badge:focus-visible {
    background: color-mix(in srgb, var(--col) 12%, transparent);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--col) 25%, transparent);
    outline: none;
}

.legend-badge[data-active="true"] {
    background: color-mix(in srgb, var(--col) 18%, transparent);
}

.canvas-wrap {
    aspect-ratio: 1 / 1;
    width: 100%;
    min-width: 0;
    display: grid;
    place-items: center;
}

.radar {
    display: block;
    outline: none;
    border-radius: var(--radius);
    display: block;
    max-width: 100%;
    height: auto;
}

.hint {
    margin-top: .5rem;
    color: var(--muted);
    font-size: .92rem;
}

.foot {
    /* reserviert Platz, damit Karte nicht springt (mit/ohne Daten) */
    min-height: 1.6rem;
}
</style>
