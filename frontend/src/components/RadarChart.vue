<!-- frontend/src/components/RadarChart.vue -->
<template>
    <div class="card" :aria-label="title" role="img">
        <div class="row" style="align-items:center; justify-content:space-between">
            <strong>{{ title }}</strong>
            <div class="legend" v-if="series.length">
                <template v-for="(s, i) in series" :key="s.label">
                    <button class="badge"
                        :style="{ borderColor: colors[i % colors.length], color: colors[i % colors.length] }"
                        @click="$emit('select', s.label)">
                        {{ s.label }}
                    </button>
                </template>
            </div>
        </div>
        <canvas ref="canvas" :width="size" :height="size" class="radar" @click="onClick" @keydown.enter.prevent="onKey"
            tabindex="0" :aria-label="a11yDesc"></canvas>
        <p class="label" style="margin-top:.5rem; color:var(--muted)">{{ hint }}</p>
    </div>
</template>
<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch, computed } from 'vue'
import { CATEGORY_KEYS, type CategoryKey } from '../types'

type Series = { label: string; values: Record<CategoryKey, number> }
const props = defineProps<{ title: string; series: Series[]; max?: number }>()
defineEmits<{ (e: 'select', label: string): void }>()
const canvas = ref<HTMLCanvasElement | null>(null)
const ctx = () => canvas.value!.getContext('2d')!
const size = 320
const max = computed(() => props.max ?? 5)
const colors = ['#b66a2b', '#2b7ab6', '#2b8b5e'] // warm, blue, green

function polarToXY(cx: number, cy: number, r: number, angle: number) {
    return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)]
}

function draw() {
    if (!canvas.value) return
    const c = ctx(); const w = canvas.value.width; const h = canvas.value.height
    c.clearRect(0, 0, w, h)
    const cx = w / 2, cy = h / 2, padding = 34, R = Math.min(cx, cy) - padding
    const axes = CATEGORY_KEYS.length
    // grid rings
    c.strokeStyle = '#e6ded6'; c.lineWidth = 1
    for (let ring = 1; ring <= max.value; ring++) {
        c.beginPath()
        for (let i = 0; i < axes; i++) {
            const a = i * 2 * Math.PI / axes - Math.PI / 2
            const [x, y] = polarToXY(cx, cy, R * ring / max.value, a)
            i === 0 ? c.moveTo(x, y) : c.lineTo(x, y)
        }
        c.closePath(); c.stroke()
    }
    // axis lines + labels
    c.fillStyle = '#6b6b6b'; c.font = '12px system-ui'
    for (let i = 0; i < axes; i++) {
        const a = i * 2 * Math.PI / axes - Math.PI / 2
        const [x, y] = polarToXY(cx, cy, R, a)
        c.beginPath(); c.moveTo(cx, cy); c.lineTo(x, y); c.stroke()
        // label
        const [lx, ly] = polarToXY(cx, cy, R + 16, a)
        c.textAlign = Math.abs(Math.cos(a)) < .3 ? 'center' : (Math.cos(a) > 0 ? 'left' : 'right')
        c.fillText(labelFor(CATEGORY_KEYS[i]), lx, ly)
    }
    // data polygons
    props.series.forEach((s, si) => {
        c.beginPath()
        CATEGORY_KEYS.forEach((k, i) => {
            const a = i * 2 * Math.PI / axes - Math.PI / 2
            const r = R * (s.values[k] / max.value)
            const [x, y] = polarToXY(cx, cy, r, a)
            i === 0 ? c.moveTo(x, y) : c.lineTo(x, y)
        })
        c.closePath()
        const col = colors[si % colors.length]
        c.fillStyle = hexToRgba(col, 0.18); c.strokeStyle = col; c.lineWidth = 2
        c.fill(); c.stroke()
    })
}

function hexToRgba(hex: string, a: number) {
    const v = hex.replace('#', ''); const bigint = parseInt(v, 16)
    const r = (bigint >> 16) & 255, g = (bigint >> 8) & 255, b = bigint & 255
    return `rgba(${r},${g},${b},${a})`
}

function labelFor(k: CategoryKey) {
    const map: Record<string, string> = {
        appreciation: 'Wertschätzung', equality: 'Gleichwertigkeit', workload: 'Arbeitsbelastung', collegiality: 'Umgang', transparency: 'Transparenz'
    }; return map[k]
}

function onClick() { /* surface click → noop; selection via legend buttons */ }
function onKey() { /* keyboard select via legend buttons handled by buttons themselves */ }

const hint = 'Tipp: Auf eine Team-Badge klicken, um Details zu öffnen.'
const a11yDesc = 'Fünfachsiges Radar-Diagramm mit Team-Durchschnittswerten.'
onMounted(() => { draw(); window.addEventListener('resize', draw) })
onUnmounted(() => window.removeEventListener('resize', draw))
watch(() => props.series, draw, { deep: true })
</script>
<style scoped>
.radar {
    width: 100%;
    outline: none;
    display: block;
    margin: auto
}
</style>
