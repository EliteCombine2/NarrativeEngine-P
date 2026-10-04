// Original handheld-inspired art. Presentation only: never changes field or route data.
export const PIXEL_PALETTE = Object.freeze({
    plains: '#8cbd62', farmland: '#a8be64', forest: '#669e58', jungle: '#5d9f58',
    taiga: '#719a75', tundra: '#bbc9a4', glacier: '#d6e8e6', mountain: '#a9ac88',
    snow: '#e4edf0', volcanic: '#63535b', deadzone: '#9b8c91', sand: '#e9cc8b', swamp: '#486b60',
    desert: '#e4cb85', savanna: '#c6c373', marsh: '#789d7a', ocean: '#3986b5',
});
export const SITE_SPRITES = Object.freeze({ settlement: 13, camp: 5, ruin: 6, shrine: 7, crossing: 15, landmark: 14 });
let sheet = null;
let loading = null;
export function loadPixelArt() {
    if (sheet) return Promise.resolve(true);
    if (loading) return loading;
    if (typeof Image === 'undefined') return Promise.resolve(false);
    loading = new Promise(resolve => {
        const image = new Image();
        image.onload = () => { sheet = image; resolve(true); };
        image.onerror = () => { loading = null; resolve(false); };
        image.src = new URL('./assets/overworld-sprites-v1.png', import.meta.url).href;
    });
    return loading;
}
export function drawPixelSprite(ctx, slot, x, y, size, shadow = false) {
    if (!sheet) return false;
    if (shadow) paintPixelShadow(ctx, x, y, size);
    const unitX = sheet.naturalWidth / 4, unitY = sheet.naturalHeight / 4;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(sheet, (slot % 4) * unitX, Math.floor(slot / 4) * unitY, unitX, unitY,
        Math.round(x), Math.round(y), Math.round(size), Math.round(size));
    return true;
}
/** Small stepped contact shadow, cast toward the lower right by north-west light. */
export function paintPixelShadow(ctx, x, y, size) {
    const bands = [[0.20, 0.66, 0.64, 0.16, 0.06], [0.25, 0.69, 0.54, 0.10, 0.10], [0.32, 0.71, 0.40, 0.06, 0.13]];
    for (const [dx, dy, w, h, alpha] of bands) {
        ctx.fillStyle = `rgba(22,31,39,${alpha})`;
        ctx.fillRect(x + dx * size, y + dy * size, w * size, h * size);
    }
}

/** Shared vertex normals give adjacent cells identical lighting along their edges. */
export function paintPixelRelief(ctx, store, x, y, px, py, size, shade) {
    const cell = store.getCell(x, y);
    if (!cell || cell.biome === 'ocean' || !Number.isFinite(cell.elevation)) return;
    const heights = [];
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const value = store.getCell(x + dx, y + dy)?.elevation;
        heights.push(Number.isFinite(value) ? value : cell.elevation);
    }
    const flat = shade(0, 0);
    const corners = [[0,1,3,4],[1,2,4,5],[3,4,6,7],[4,5,7,8]].map(([a,b,c,d]) => {
        const ex = (heights[b] + heights[d] - heights[a] - heights[c]) / 2;
        const ey = (heights[c] + heights[d] - heights[a] - heights[b]) / 2;
        return shade(ex, ey) / flat;
    });
    const samples = Math.min(8, Math.max(1, Math.round(size / 4)));
    const step = size / samples;
    for (let j = 0; j < samples; j++) for (let i = 0; i < samples; i++) {
        const u = (i + 0.5) / samples, v = (j + 0.5) / samples;
        const value = (corners[0] * (1-u) + corners[1] * u) * (1-v)
            + (corners[2] * (1-u) + corners[3] * u) * v;
        const alpha = Math.min(0.28, Math.abs(value - 1));
        if (alpha < 0.002) continue;
        ctx.fillStyle = value < 1 ? `rgba(23,31,47,${alpha.toFixed(3)})` : `rgba(255,240,197,${alpha.toFixed(3)})`;
        ctx.fillRect(px + i * step, py + j * step, step, step);
    }
    // Short broken rock faces mark a substantial downhill drop, never a new obstacle.
    if (size < 16) return;
    for (const [dx,dy,index] of [[1,0,5],[0,1,7]]) {
        const neighbour = store.getCell(x + dx, y + dy);
        if (!neighbour || neighbour.biome === 'ocean' || cell.elevation - heights[index] < 0.08) continue;
        for (let i = 0; i < 3; i++) {
            const jitter = noise(x, y, 109 + i) % 2;
            const a = dx ? 13 + jitter : 2 + i * 4, b = dy ? 13 + jitter : 2 + i * 4;
            ctx.fillStyle = 'rgba(35,36,40,0.22)';
            ctx.fillRect(px + a * size / 16, py + b * size / 16, (dx ? 1 : 3) * size / 16, (dy ? 1 : 3) * size / 16);
            ctx.fillStyle = 'rgba(245,225,180,0.16)';
            ctx.fillRect(px + (a - dx) * size / 16, py + (b - dy) * size / 16, (dx ? 1 : 3) * size / 16, (dy ? 1 : 3) * size / 16);
        }
    }
}
function noise(x, y, salt = 0) {
    let n = Math.imul(x + 1013, 374761393) ^ Math.imul(y + 719, 668265263) ^ Math.imul(salt + 1, 1274126177);
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    return (n ^ (n >>> 16)) >>> 0;
}
export function terrainSprite(biome, variant) {
    if (biome === 'forest') return 0;
    if (biome === 'taiga') return 2 === variant % 5 ? 10 : 1;
    if (biome === 'jungle') return variant % 3 ? 0 : 2;
    if (biome === 'mountain') return 3;
    if (biome === 'marsh' || biome === 'swamp') return variant % 3 === 0 ? 11 : null;
    if (biome === 'tundra') return variant % 9 === 0 ? 10 : null;
    if (biome === 'savanna') return variant % 7 === 0 ? 0 : null;
    if (biome === 'plains') return variant % 11 === 0 ? 9 : null;
    return null;
}
// Four authored motifs per terrain family, with placement independent of camera/cache.
export const TERRAIN_VARIANTS = Object.freeze(['A', 'B', 'C', 'D']);
export function terrainVariant(x, y) {
    return noise(x, y, 47) % TERRAIN_VARIANTS.length;
}

/** Paint a reusable 16x16 terrain sprite. Edges retain the biome's base colour. */
export function paintTerrainVariant(ctx, biome, variant, px, py, size) {
    const v = ((variant % 4) + 4) % 4, pixel = size / 16;
    const mark = (color, x, y, w = 1, h = 1) => {
        ctx.fillStyle = color;
        ctx.fillRect(px + x * pixel, py + y * pixel, w * pixel, h * pixel);
    };
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = PIXEL_PALETTE[biome] ?? PIXEL_PALETTE.plains;
    ctx.fillRect(px, py, size, size);
    const spots = [[3, 4], [10, 10], [4, 11], [11, 4]];
    const tuft = (x, y, dark, light) => {
        mark(dark, x, y, 3, 1); mark(dark, x, y - 2, 1, 2);
        mark(light, x + 1, y - 3, 1, 3); mark(dark, x + 2, y - 1);
    };
    const stone = (x, y, dark, light) => {
        mark(dark, x, y + 1, 4, 1); mark(dark, x + 1, y, 3, 1);
        mark(light, x + 1, y, 2, 1);
    };
    for (let i = 0; i < 2 + (v === 1 ? 1 : 0); i++) {
        const [x, y] = spots[(i + v) % spots.length];
        if (biome === 'ocean') {
            mark('#4f9ec9', x - 1, y, 4, 1);
            mark('#72b9d6', x, y + 1, v === 2 ? 3 : 2, 1);
            if (v === 3) mark('#286e9c', x + 1, y + 3, 3, 1);
        } else if (['sand', 'desert'].includes(biome)) {
            if (v === 2) stone(x, y, '#c39b61', '#f9e4ae');
            else {
                mark('#d2b274', x - 1, y + 1, 5, 1);
                mark('#f9e4ae', x, y, v === 1 ? 4 : 2, 1);
                if (v === 3) mark('#c39b61', x + 2, y + 3);
            }
        } else if (['snow', 'glacier', 'tundra'].includes(biome)) {
            if (v === 3 && biome === 'tundra') tuft(x, y, '#879e80', '#d4dfb7');
            else if (v === 2) stone(x, y, '#96b4c3', '#f7fcfa');
            else {
                mark('#b7cedd', x - 1, y + 1, 4, 1);
                mark('#f7fcfa', x, y, 3, 1);
                if (v === 1) mark('#a3c3d1', x + 1, y + 2, 1, 2);
            }
        } else if (['swamp', 'marsh'].includes(biome)) {
            if (v === 1 || v === 3) tuft(x, y, '#304f59', '#a2b773');
            else {
                mark('#365962', x - 1, y, 5, 2);
                mark('#669183', x, y, 3, 1);
                if (v === 2) mark('#a2b773', x + 1, y - 1, 2, 1);
            }
        } else if (biome === 'farmland') {
            const vertical = v % 2 === 1;
            for (let row = 2; row < 14; row += 4) {
                mark('#8b9f4e', vertical ? row : 1, vertical ? 1 : row, vertical ? 1 : 14, vertical ? 14 : 1);
                if (v < 2) mark('#c2cf77', vertical ? row + 1 : 1, vertical ? 1 : row + 1, vertical ? 1 : 14, vertical ? 14 : 1);
                else for (let col = 3; col < 14; col += 3) mark('#d4d58a', vertical ? row + 1 : col, vertical ? col : row + 1);
            }
            break;
        } else if (['mountain', 'volcanic', 'deadzone'].includes(biome)) {
            const dark = biome === 'volcanic' ? '#403d49' : biome === 'deadzone' ? '#6e666e' : '#858b73';
            const light = biome === 'volcanic' ? '#aa8074' : biome === 'deadzone' ? '#c0ada7' : '#d0d0ab';
            if (v === 1 || v === 3) {
                mark(dark, x, y - 1, 1, 3); mark(dark, x + 1, y + 1, 3, 1);
                mark(light, x + 1, y - 1, 2, 1);
            } else stone(x, y, dark, light);
        } else {
            const dry = biome === 'savanna';
            const dark = dry ? '#a49e54' : '#60954d', light = dry ? '#e5d68b' : '#b4d984';
            if (v === 0 || v === 1) tuft(x, y, dark, light);
            else if (v === 2) {
                tuft(x, y, dark, light);
                mark(dry ? '#f6e8b2' : '#f1e6a6', x + 1, y - 3);
                mark(dry ? '#d4a562' : '#dfb4cc', x + 2, y - 2);
            } else {
                stone(x, y, dry ? '#9e9b70' : '#819879', dry ? '#ded2a0' : '#c2cead');
                mark(dark, x - 1, y + 2);
            }
        }
    }
}
const EDGE_OFFSETS = [[0,-1],[1,0],[0,1],[-1,0],[-1,-1],[1,-1],[1,1],[-1,1]];
const rgb = color => [1, 3, 5].map(i => parseInt(color.slice(i, i + 2), 16));
const smooth = value => { const t = Math.max(0, Math.min(1, value)); return t * t * (3 - 2 * t); };
function edgeWeight(u, v, dx, dy) {
    const wx = dx === 0 ? 1 : smooth((0.36 - (dx < 0 ? u : 1 - u)) / 0.36);
    const wy = dy === 0 ? 1 : smooth((0.36 - (dy < 0 ? v : 1 - v)) / 0.36);
    return wx * wy;
}

// Blend only observed neighbours. Missing cells never reveal or generate terrain.
function paintTerrainEdges(ctx, biome, neighbours, px, py, size) {
    const base = rgb(PIXEL_PALETTE[biome] ?? PIXEL_PALETTE.plains);
    const edges = neighbours.map((cell, i) => {
        if (!cell || cell.biome === biome || cell.biome === 'ocean' || biome === 'ocean') return null;
        return { offset: EDGE_OFFSETS[i], color: rgb(PIXEL_PALETTE[cell.biome] ?? PIXEL_PALETTE.plains) };
    }).filter(Boolean);
    if (!edges.length) return;
    const step = size / 8;
    for (let j = 0; j < 8; j++) for (let i = 0; i < 8; i++) {
        const sum = [0, 0, 0]; let weight = 0;
        for (const edge of edges) {
            const w = edgeWeight((i + 0.5) / 8, (j + 0.5) / 8, ...edge.offset);
            weight += w; for (let c = 0; c < 3; c++) sum[c] += edge.color[c] * w;
        }
        if (!weight) continue;
        const alpha = Math.min(0.72, weight * 0.5);
        const color = base.map((c, k) => Math.round(c * (1 - alpha) + sum[k] / weight * alpha));
        ctx.fillStyle = `rgb(${color.join(',')})`;
        ctx.fillRect(px + i * step, py + j * step, step, step);
    }
}

/** Fade fog inward over known terrain; unexplored cells always stay fully opaque. */
export function paintPixelFog(ctx, generated, visible, fog, x, y, px, py, size) {
    const opacity = (cx, cy) => !generated.has(`${cx},${cy}`) ? 1 : visible.has(`${cx},${cy}`) || !fog ? 0 : 0.48;
    const base = opacity(x, y);
    const edges = EDGE_OFFSETS.slice(0, 4).map(([dx, dy]) => opacity(x + dx, y + dy));
    if (base === 1 || edges.every(alpha => alpha <= base)) {
        if (!base) return;
        ctx.fillStyle = base === 1 ? '#17252d' : `rgba(23,37,45,${base})`;
        ctx.fillRect(px, py, size, size); return;
    }
    const step = size / 8;
    for (let j = 0; j < 8; j++) for (let i = 0; i < 8; i++) {
        let alpha = base;
        for (let side = 0; side < 4; side++) {
            alpha = Math.max(alpha, base + (edges[side] - base) * edgeWeight((i + 0.5) / 8, (j + 0.5) / 8, ...EDGE_OFFSETS[side]));
        }
        if (!alpha) continue;
        ctx.fillStyle = `rgba(23,37,45,${alpha.toFixed(3)})`;
        ctx.fillRect(px + i * step, py + j * step, step, step);
    }
}
// Logical 16-pixel ground tiles at every zoom; motifs stay stable across tile/cache boundaries.
export function paintPixelCell(ctx, store, x, y, px, py, size) {
    const cell = store.getCell(x, y);
    if (!cell) return;
    const biome = cell.biome, pixel = size / 16;
    // Crop orientation belongs to a field, rather than changing at every cell.
    const variant = biome === 'farmland' ? terrainVariant(Math.floor(x / 6), Math.floor(y / 6)) : terrainVariant(x, y);
    if (biome !== 'farmland' && biome !== 'ocean' && noise(x, y, 83) % 5 < 2) {
        ctx.fillStyle = PIXEL_PALETTE[biome] ?? PIXEL_PALETTE.plains;
        ctx.fillRect(px, py, size, size);
    } else paintTerrainVariant(ctx, biome, variant, px, py, size);
    const surrounding = EDGE_OFFSETS.map(([dx, dy]) => store.getCell(x + dx, y + dy));
    paintTerrainEdges(ctx, biome, surrounding, px, py, size);
    const mark = (color, a, b, w, h) => {
        ctx.fillStyle = color;
        ctx.fillRect(px + a * pixel, py + b * pixel, Math.max(pixel, w * pixel), Math.max(pixel, h * pixel));
    };
    // Cardinal shoreline strips join at corners. Land always retains its own biome.
    const neighbours = surrounding.slice(0, 4);
    if (biome !== 'ocean') {
        neighbours.forEach((other, side) => {
            if (other?.biome !== 'ocean') return;
            const horizontal = side % 2 === 0;
            const a = side === 1 ? 14 : 0, b = side === 2 ? 14 : 0;
            mark('#b5a26b', a, b, horizontal ? 16 : 2, horizontal ? 2 : 16);
            mark('#f0dfa0', side === 1 ? 13 : 0, side === 2 ? 13 : 0, horizontal ? 16 : 1, horizontal ? 1 : 16);
        });
    } else {
        neighbours.forEach((other, side) => {
            if (!other || other.biome === 'ocean') return;
            mark('#91cfdd', side === 1 ? 15 : 0, side === 2 ? 15 : 0, side % 2 === 0 ? 16 : 1, side % 2 === 0 ? 1 : 16);
        });
    }
}
export function paintPixelObjects(ctx, store, x, y, px, py, size) {
    if (size < 8) return;
    const biome = store.getCell(x, y)?.biome, seed = noise(x, y);
    if (['snow', 'volcanic', 'deadzone'].includes(biome)) {
        // Small original pixel silhouettes, stable in world coordinates.
        if (seed % 4 !== 0) return;
        paintPixelShadow(ctx, px, py, size);
        const pixel = size / 16;
        const mark = (color, a, b, w, h) => { ctx.fillStyle = color; ctx.fillRect(px + a * pixel, py + b * pixel, w * pixel, h * pixel); };
        if (biome === 'deadzone') {
            mark('#524c55', 8, 5, 2, 8); mark('#524c55', 5, 7, 4, 2); mark('#524c55', 10, 4, 3, 2);
        } else {
            for (let row = 0; row < 5; row++) mark(biome === 'snow' ? '#829aa7' : '#3c3643', 7 - row, 5 + row, 2 + row * 2, 1);
            mark(biome === 'snow' ? '#ffffff' : '#af8175', 6, 5, 4, 2);
        }
        return;
    }
    const sprite = terrainSprite(biome, seed);
    if (sprite === null) return;
    const dense = ['forest', 'jungle', 'taiga', 'mountain'].includes(biome);
    const scale = dense ? 1.6 : 1;
    const offset = dense ? ((seed % 3) - 1) * size / 16 : 0;
    if (!drawPixelSprite(ctx, sprite, px - size * (scale - 1) / 2 + offset, py - size * (scale - 1) * 0.7, size * scale, dense || sprite !== 9)) {
        ctx.fillStyle = '#49774d'; ctx.fillRect(px + size / 4, py + size / 4, size / 2, size / 2);
    }
}
