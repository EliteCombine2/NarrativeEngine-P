import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import express from 'express';
import request from 'supertest';

let tmpDir: string;
let campaignsDir: string;

describe('campaign export reads CRLF archive scenes', () => {
    beforeEach(async () => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'transfer-crlf-'));
        vi.resetModules();
        vi.stubEnv('DATA_DIR', tmpDir);
        vi.doMock('../lib/embedder.js', () => ({
            embedText: vi.fn(),
            buildArchiveText: vi.fn(),
            buildLoreText: vi.fn(),
        }));
        vi.doMock('../lib/vectorStore.js', () => ({
            storeArchiveEmbedding: vi.fn(),
            storeLoreEmbedding: vi.fn(),
        }));

        const store = await import('../lib/fileStore.js');
        campaignsDir = store.CAMPAIGNS_DIR;
        fs.mkdirSync(campaignsDir, { recursive: true });
    });

    afterEach(() => {
        vi.unstubAllEnvs();
        vi.doUnmock('../lib/embedder.js');
        vi.doUnmock('../lib/vectorStore.js');
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it.each([['LF', '\n'], ['CRLF', '\r\n']])('exports player and GM text from %s scenes', async (_label, eol) => {
        const id = 'crlf-export';
        fs.writeFileSync(path.join(campaignsDir, `${id}.json`), JSON.stringify({ id, name: 'CRLF Export' }));
        const md = [
            '## SCENE 001', '*1/1/2025, 9:00:00 AM*', '',
            '**[USER]**', 'I enter the tavern.', '',
            '**[GM]**', 'The barkeep greets you.', '',
            '---', '',
        ].join(eol);
        fs.writeFileSync(path.join(campaignsDir, `${id}.archive.md`), md);
        fs.writeFileSync(path.join(campaignsDir, `${id}.archive.index.json`), JSON.stringify([{ sceneId: '001', timestamp: 1735722000000 }]));

        const { createTransferRouter } = await import('../routes/transfer.js');
        const app = express();
        app.use(express.json());
        app.use(createTransferRouter());

        const exported = await request(app).get(`/api/campaigns/${id}/export`).expect(200);

        expect(exported.body.scenes).toEqual([
            { sceneId: '001', userContent: 'I enter the tavern.', assistantContent: 'The barkeep greets you.', timestamp: 1735722000000 },
        ]);
    });
});
