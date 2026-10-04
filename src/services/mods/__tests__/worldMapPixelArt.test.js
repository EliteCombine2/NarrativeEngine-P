import { describe, expect, it } from 'vitest';
import { hillshadeMultiplier } from '../../../../public/bundled-mods/worldmap/renderer.js';
import { observedTerrainStore } from '../../../../public/bundled-mods/worldmap/exploration.js';
import { PIXEL_PALETTE, TERRAIN_VARIANTS, terrainVariant, paintTerrainVariant, paintPixelCell, paintPixelFog, paintPixelRelief, paintPixelShadow } from '../../../../public/bundled-mods/worldmap/pixelArt.js';

function raster(size = 16) {
    const pixels = Array(size * size).fill('');
    const ctx = { fillStyle: '', imageSmoothingEnabled: true, fillRect(x, y, w, h) {
        expect(x).toBeGreaterThanOrEqual(0); expect(y).toBeGreaterThanOrEqual(0);
        expect(x + w).toBeLessThanOrEqual(size); expect(y + h).toBeLessThanOrEqual(size);
        for (let py = Math.floor(y); py < y + h; py++) for (let px = Math.floor(x); px < x + w; px++) pixels[py * size + px] = this.fillStyle;
    } };
    return { ctx, pixels };
}

describe('pixel terrain variants', () => {
    it('gives every biome four visibly distinct sprites with seamless base edges', () => {
        expect(TERRAIN_VARIANTS).toEqual(['A', 'B', 'C', 'D']);
        for (const [biome, base] of Object.entries(PIXEL_PALETTE)) {
            const sprites = TERRAIN_VARIANTS.map((_, v) => {
                const { ctx, pixels } = raster();
                paintTerrainVariant(ctx, biome, v, 0, 0, 16);
                for (let i = 0; i < 16; i++) {
                    expect(pixels[i]).toBe(base); expect(pixels[240 + i]).toBe(base);
                    expect(pixels[i * 16]).toBe(base); expect(pixels[i * 16 + 15]).toBe(base);
                }
                return pixels.join(',');
            });
            expect(new Set(sprites).size, biome).toBe(4);
        }
    });
    it('keeps variant choice stable at negative coordinates and across zoom sizes', () => {
        const found = new Set();
        for (let y = -8; y < 8; y++) for (let x = -8; x < 8; x++) {
            const v = terrainVariant(x, y);
            expect(terrainVariant(x, y)).toBe(v); found.add(v);
            const store = { getCell: () => ({ biome: 'plains' }) };
            const a = raster(), b = raster(32);
            paintPixelCell(a.ctx, store, x, y, 0, 0, 16);
            paintPixelCell(b.ctx, store, x, y, 0, 0, 32);
            for (let i = 0; i < 256; i++) expect(b.pixels[Math.floor(i / 16) * 64 + (i % 16) * 2]).toBe(a.pixels[i]);
        }
        expect([...found].sort()).toEqual([0, 1, 2, 3]);
    });
    it('retains connected shoreline strips on every land variant', () => {
        for (let x = 0; x < 16; x++) {
            const store = { getCell: (cx, cy) => ({ biome: cy === -1 ? 'ocean' : 'plains' }) };
            const { ctx, pixels } = raster();
            paintPixelCell(ctx, store, x, 0, 0, 0, 16);
            expect(pixels.slice(0, 16)).toEqual(Array(16).fill('#f0dfa0'));
            expect(pixels.slice(16, 32)).toEqual(Array(16).fill('#b5a26b'));
        }
    });
});


describe('soft terrain boundaries', () => {
    it('blends observed biome boundaries while keeping marks inside their cell', () => {
        const store = { getCell: (x) => ({ biome: x < 0 ? 'volcanic' : 'plains' }) };
        const { ctx, pixels } = raster();
        paintPixelCell(ctx, store, 0, 0, 0, 0, 16);
        expect(pixels.some(color => color.startsWith('rgb('))).toBe(true);
        expect(pixels[8 * 16 + 8]).toBe(PIXEL_PALETTE.plains);
    });
    it('does not introduce terrain colour from unobserved neighbours', () => {
        const store = { getCell: (x, y) => x === 0 && y === 0 ? { biome: 'plains' } : null };
        const { ctx, pixels } = raster();
        paintPixelCell(ctx, store, 0, 0, 0, 0, 16);
        expect(pixels.some(color => color.startsWith('rgb('))).toBe(false);
    });
    it('gives adjacent farmland cells one coherent crop orientation', () => {
        const store = { getCell: () => ({ biome: 'farmland' }) };
        const a = raster(), b = raster();
        paintPixelCell(a.ctx, store, 1, 1, 0, 0, 16);
        paintPixelCell(b.ctx, store, 2, 1, 0, 0, 16);
        expect(a.pixels).toEqual(b.pixels);
    });
    it('keeps unexplored cells fully opaque even with fog disabled', () => {
        for (const fog of [true, false]) {
            const { ctx, pixels } = raster();
            paintPixelFog(ctx, new Set(['1,0']), new Set(['1,0']), fog, 0, 0, 0, 0, 16);
            expect(pixels).toEqual(Array(256).fill('#17252d'));
        }
    });
    it('adds a graded fog fringe inside known terrain without covering its centre', () => {
        const generated = new Set();
        for (let y = -1; y <= 1; y++) for (let x = -1; x <= 0; x++) generated.add(`${x},${y}`);
        const { ctx, pixels } = raster();
        paintPixelFog(ctx, generated, generated, true, 0, 0, 0, 0, 16);
        expect(pixels[8 * 16 + 8]).toBe('');
        expect(new Set(pixels.filter(Boolean)).size).toBeGreaterThan(1);
    });
});


describe('elevation and shadows', () => {
    const shade = (ex, ey) => hillshadeMultiplier(ex, ey, 0.12);
    it('keeps flat land neutral and water unshaded', () => {
        for (const biome of ['plains', 'ocean']) {
            const {ctx,pixels} = raster();
            paintPixelRelief(ctx, {getCell: () => ({biome,elevation:0.5})}, 0, 0, 0, 0, 16, shade);
            expect(pixels).toEqual(Array(256).fill(''));
        }
    });
    it('lights slopes facing north-west and darkens opposing slopes', () => {
        for (const direction of [1,-1]) {
            const {ctx,pixels} = raster();
            const store = {getCell: (x,y) => ({biome:'plains',elevation:direction * 0.05 * (x+y)})};
            paintPixelRelief(ctx, store, 0, 0, 0, 0, 16, shade);
            expect(pixels.every(color => color.startsWith(direction === 1 ? 'rgba(255,240,197,' : 'rgba(23,31,47,'))).toBe(true);
        }
    });
    it('keeps shading continuous across cells on a uniform slope', () => {
        const store = {getCell: (x,y) => ({biome:'plains',elevation:0.03*x + 0.02*y})};
        const a=raster(), b=raster();
        paintPixelRelief(a.ctx,store,0,0,0,0,16,shade);
        paintPixelRelief(b.ctx,store,1,0,0,0,16,shade);
        expect(a.pixels).toEqual(b.pixels);
    });
    it('does not sample unobserved terrain to produce lighting', () => {
        const reads=[];
        const store=observedTerrainStore({getCell:(x,y)=>{reads.push(`${x},${y}`);return {biome:'plains',elevation:0.4};}},new Set(['0,0']));
        const {ctx,pixels}=raster();
        paintPixelRelief(ctx,store,0,0,0,0,16,shade);
        expect(reads.every(key=>key==='0,0')).toBe(true);
        expect(pixels.every(color=>color==='')).toBe(true);
    });
    it('draws contact shadows below and to the right, without blurring sprites', () => {
        const {ctx,pixels}=raster();
        paintPixelShadow(ctx,0,0,16);
        expect(pixels.slice(0,16*10).every(color=>color==='')).toBe(true);
        expect(new Set(pixels.filter(Boolean)).size).toBe(3);
    });
    it('adds ledge details only for a steep observed downhill edge', () => {
        const {ctx,pixels}=raster();
        paintPixelRelief(ctx,{getCell:x=>({biome:'mountain',elevation:x>0?0.1:0.5})},0,0,0,0,16,()=>1);
        expect(pixels).toContain('rgba(35,36,40,0.22)');
    });
});
