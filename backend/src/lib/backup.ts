import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createGzip } from 'node:zlib';
import { createReadStream, createWriteStream } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { pipeline } from 'node:stream/promises';
import {
  S3Client,
  PutObjectCommand,
  ListObjectsV2Command,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { pool } from '../db.js';
import { UPLOADS_DIR } from './uploads.js';
import { captureError } from './monitoring.js';

const execFileAsync = promisify(execFile);

// Stays completely inert until the BACKUP_S3_* variables are set - no bucket, no schedule,
// no behavior change. Set these on the backend service to start nightly backups.
export const backupEnabled = Boolean(
  process.env.BACKUP_S3_ENDPOINT &&
    process.env.BACKUP_S3_BUCKET &&
    process.env.BACKUP_S3_ACCESS_KEY_ID &&
    process.env.BACKUP_S3_SECRET_ACCESS_KEY
);

const KEEP_BACKUPS = 14; // ~2 weeks of daily backups

function s3Client() {
  return new S3Client({
    endpoint: process.env.BACKUP_S3_ENDPOINT,
    region: 'auto',
    credentials: {
      accessKeyId: process.env.BACKUP_S3_ACCESS_KEY_ID!,
      secretAccessKey: process.env.BACKUP_S3_SECRET_ACCESS_KEY!,
    },
  });
}

async function dumpDatabase(destPath: string) {
  const { rows: tables } = await pool.query<{ tablename: string }>(
    `SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`
  );

  const gzip = createGzip();
  const out = createWriteStream(destPath);
  const done = pipeline(gzip, out);

  gzip.write('{');
  for (let i = 0; i < tables.length; i++) {
    const { tablename } = tables[i];
    const { rows } = await pool.query(`SELECT * FROM "${tablename}"`);
    gzip.write(`${JSON.stringify(tablename)}:${JSON.stringify(rows)}`);
    if (i < tables.length - 1) gzip.write(',');
  }
  gzip.write('}');
  gzip.end();

  await done;
}

async function archiveUploads(destPath: string) {
  const parent = path.dirname(UPLOADS_DIR);
  const dirName = path.basename(UPLOADS_DIR);
  await execFileAsync('tar', ['-czf', destPath, '-C', parent, dirName]);
}

async function uploadFile(client: S3Client, key: string, filePath: string) {
  const body = await fs.readFile(filePath);
  await client.send(
    new PutObjectCommand({
      Bucket: process.env.BACKUP_S3_BUCKET,
      Key: key,
      Body: body,
    })
  );
}

async function pruneOldBackups(client: S3Client) {
  const { Contents } = await client.send(
    new ListObjectsV2Command({ Bucket: process.env.BACKUP_S3_BUCKET, Prefix: 'backups/' })
  );
  if (!Contents) return;

  const timestamps = [...new Set(Contents.map((o) => o.Key!.split('/')[1]))].sort();
  const toDelete = timestamps.slice(0, Math.max(0, timestamps.length - KEEP_BACKUPS));

  for (const ts of toDelete) {
    for (const suffix of ['db.json.gz', 'uploads.tar.gz']) {
      await client
        .send(new DeleteObjectCommand({ Bucket: process.env.BACKUP_S3_BUCKET, Key: `backups/${ts}/${suffix}` }))
        .catch(() => {}); // object may not exist for that backup
    }
  }
}

export async function runBackup() {
  if (!backupEnabled) return;

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'kuisoko-backup-'));
  const dbDumpPath = path.join(tmpDir, 'db.json.gz');
  const uploadsPath = path.join(tmpDir, 'uploads.tar.gz');

  try {
    await dumpDatabase(dbDumpPath);
    await archiveUploads(uploadsPath);

    const client = s3Client();
    await uploadFile(client, `backups/${timestamp}/db.json.gz`, dbDumpPath);
    await uploadFile(client, `backups/${timestamp}/uploads.tar.gz`, uploadsPath);
    await pruneOldBackups(client);

    console.log(`[backup] Completed backup ${timestamp}`);
  } catch (err) {
    console.error('[backup] Backup failed', err);
    captureError(err);
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
}

const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
const STARTUP_DELAY = 5 * 60 * 1000; // let the app finish booting before the first run

export function scheduleBackups() {
  if (!backupEnabled) {
    console.log('[backup] BACKUP_S3_* variables not set - scheduled backups disabled');
    return;
  }
  setTimeout(() => {
    void runBackup();
    setInterval(() => void runBackup(), TWENTY_FOUR_HOURS);
  }, STARTUP_DELAY);
  console.log('[backup] Scheduled backups enabled - first run in 5 minutes, then every 24h');
}
