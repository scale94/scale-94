// IdentityPanel.jsx — /CRYPTOGRAPHY's identity actions (scent-aether P2, spec §5.3, §6.2, §6.5).
// One visitor, one post-quantum identity: ML-KEM-768 (seals the accord) + ML-DSA-65 (P4 signs).
// Fingerprint, backup (Argon2id + AES-256-GCM), restore (deliberate, never automatic) and
// rotate (orphans the sealed accord, so it needs a second, informed click).
// Every label reads what ran: the KDF line comes from aether_seal_params().
import { useCallback, useEffect, useState } from 'react';
import { loadWasm } from '../../../wasm/wasmSingleton';
import { getVault as defaultGetVault, reconcileSpineAtBoot } from '../../lib/aetherRuntime';
import { formatFingerprint, VOLATILE_LABEL } from '../../lib/identityVault';
import { SCENT_ORPHANED } from '../../quintessence/spineStore';

const MIN_PASS = 12;

const defaultGetParams = async () => (await loadWasm()).aether_seal_params();

function defaultDownload(bytes, filename) {
  const url = URL.createObjectURL(new Blob([bytes], { type: 'application/json' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

const kdfLabel = (a) => `Argon2id · m=${a.m_kib / 1024} MiB · t=${a.t} · p=${a.p} · RFC 9106 §4 option 2`;

const RESTORE_ERRORS = {
  'bad-passphrase': 'WRONG PASSPHRASE — identity unchanged',
  malformed: 'NOT A SCALE94 IDENTITY BACKUP — identity unchanged',
};

const btn = 'px-2 py-1 border border-orange-500/30 text-orange-300/80 text-[9px] tracking-widest uppercase rounded-sm hover:bg-orange-950/40 disabled:opacity-30 disabled:cursor-not-allowed';
const field = 'bg-transparent border border-orange-900/40 rounded-sm px-2 py-1 text-[10px] text-orange-200/80 font-mono w-full';

export default function IdentityPanel({
  getVault = defaultGetVault,
  getParams = defaultGetParams,
  onIdentityChanged = reconcileSpineAtBoot,
  download = defaultDownload,
}) {
  const [vault, setVault] = useState(null);
  const [identity, setIdentity] = useState(null);
  const [params, setParams] = useState(null);
  const [status, setStatus] = useState('loading');   // loading | ready | empty | unavailable
  const [backupPass, setBackupPass] = useState('');
  const [restoreFile, setRestoreFile] = useState(null);
  const [restorePass, setRestorePass] = useState('');
  const [note, setNote] = useState(null);
  const [confirmRotate, setConfirmRotate] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [v, p] = await Promise.all([getVault(), getParams()]);
        const id = await v.getIdentityIfExists();
        if (!alive) return;
        setVault(v); setParams(p); setIdentity(id); setStatus(id ? 'ready' : 'empty');
      } catch (_) {
        if (alive) setStatus('unavailable');
      }
    })();
    return () => { alive = false; };
  }, [getVault, getParams]);

  const run = useCallback(async (fn) => {
    setBusy(true);
    try { await fn(); } finally { setBusy(false); }
  }, []);

  const create = () => run(async () => {
    const id = await vault.getOrCreateIdentity();
    setIdentity(id); setStatus('ready');
    await onIdentityChanged();
  });

  const backup = () => run(async () => {
    const bytes = await vault.exportBackup(backupPass);
    download(bytes, `scale94-identity-${identity.fp.slice(0, 8)}.json`);
    setBackupPass('');
    setNote('BACKUP WRITTEN — keep the file and the passphrase apart');
  });

  const restore = () => run(async () => {
    const bytes = new Uint8Array(await restoreFile.arrayBuffer());
    const r = await vault.importBackup(bytes, restorePass);
    setRestorePass('');
    if (!r.ok) { setNote(RESTORE_ERRORS[r.reason] ?? RESTORE_ERRORS.malformed); return; }
    setIdentity(r.identity); setStatus('ready');
    setNote('IDENTITY RESTORED');
    await onIdentityChanged();
  });

  const rotate = () => {
    if (!confirmRotate) { setConfirmRotate(true); return; }
    run(async () => {
      const id = await vault.rotate();
      setIdentity(id); setConfirmRotate(false);
      setNote('IDENTITY ROTATED — the old seal is orphaned');
      await onIdentityChanged();
    });
  };

  return (
    <section className="p-4 border border-orange-500/15 bg-orange-900/5 rounded-sm font-mono" aria-label="post-quantum identity">
      <div className="text-orange-600/50 text-[9px] tracking-widest uppercase mb-3">Your identity · one per visitor</div>

      {status === 'loading' && <div className="text-[10px] text-orange-400/40">opening the vault…</div>}
      {status === 'unavailable' && (
        <div className="text-[10px] text-orange-400/60">IDENTITY UNAVAILABLE — this origin has no WebCrypto</div>
      )}
      {status === 'empty' && (
        <div className="space-y-2">
          <div className="text-[10px] text-orange-400/60">NO IDENTITY YET — crystallize at /SCENT makes one, or make it here</div>
          <button type="button" className={btn} disabled={busy} onClick={create}>CREATE IDENTITY</button>
        </div>
      )}

      {status === 'ready' && identity && (
        <div className="space-y-4">
          <div>
            <div className="text-[8px] text-orange-600/50 tracking-widest">FP · SHA-256(ek‖pk)[0..16]</div>
            <div className="text-sm text-orange-200/90 tracking-wider">{formatFingerprint(identity.fp)}</div>
            <div className="text-[8px] text-orange-500/40 mt-1">
              {params?.mlkem ?? 'ML-KEM-768'} ek {identity.ek.length} B · {params?.mldsa ?? 'ML-DSA-65'} pk {identity.pk.length} B
              · since {new Date(identity.createdAt).toISOString().slice(0, 10)}
            </div>
            {identity.volatile && <div className="text-[9px] text-amber-400/70 mt-1">{VOLATILE_LABEL}</div>}
          </div>

          <div className="space-y-1">
            <div className="text-[8px] text-orange-600/50 tracking-widest">BACKUP · {params ? kdfLabel(params.argon2) : '…'} · AES-256-GCM</div>
            <input data-field="backup-pass" type="password" autoComplete="new-password" className={field}
              placeholder={`passphrase (at least ${MIN_PASS} characters)`}
              value={backupPass} onChange={e => setBackupPass(e.target.value)} />
            <button type="button" className={btn} disabled={busy || backupPass.length < MIN_PASS} onClick={backup}>BACKUP</button>
          </div>

          <div className="space-y-1">
            <div className="text-[8px] text-orange-600/50 tracking-widest">RESTORE · replaces this identity</div>
            <input data-field="restore-file" type="file" accept="application/json,.json" className="text-[9px] text-orange-400/50 file:mr-2 file:px-2 file:py-1 file:rounded-sm file:border file:border-solid file:border-orange-500/30 file:bg-transparent file:text-orange-300/80 file:text-[9px] file:tracking-widest file:uppercase file:font-mono"
              onChange={e => setRestoreFile(e.target.files?.[0] ?? null)} />
            <input data-field="restore-pass" type="password" autoComplete="current-password" className={field}
              placeholder="the backup's passphrase" value={restorePass} onChange={e => setRestorePass(e.target.value)} />
            <button type="button" className={btn} disabled={busy || !restoreFile || !restorePass} onClick={restore}>RESTORE</button>
          </div>

          <div className="space-y-1">
            {confirmRotate && (
              <div className="text-[9px] text-rose-400/70">Rotating orphans the sealed accord. {SCENT_ORPHANED}.</div>
            )}
            <button type="button" className={btn} disabled={busy} onClick={rotate}>
              {confirmRotate ? 'ROTATE — I understand' : 'ROTATE'}
            </button>
          </div>
        </div>
      )}

      {note && <div className="mt-3 text-[9px] text-orange-300/70" role="status">{note}</div>}
    </section>
  );
}
