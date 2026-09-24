// -----------------------------------------------------------------------------
// SETTINGS DRAWER (noir map)
// -----------------------------------------------------------------------------
// Save management + options for the map UI. Back up progress to a copy-pasteable
// blob (localStorage is fragile and never leaves the browser it was written in),
// import a backup on another device, toggle sound, and reset. The classic layout
// keeps its own TopBar controls; this is the map's equivalent.
// -----------------------------------------------------------------------------

import { useState } from 'react';
import { useGame } from '../../store/GameContext';
import { usePrefersReducedMotion } from '../hooks';
import { isMuted, toggleMuted } from '../sfx';

export function SettingsDrawer() {
  const { actions } = useGame();
  const [muted, setMuted] = useState(isMuted());
  const [blob, setBlob] = useState('');
  const [importText, setImportText] = useState('');
  const [msg, setMsg] = useState('');
  const reduce = usePrefersReducedMotion();

  const doExport = () => {
    const b = actions.exportSave();
    setBlob(b);
    if (navigator.clipboard?.writeText) {
      navigator.clipboard
        .writeText(b)
        .then(() => setMsg('Backup copied to clipboard.'))
        .catch(() => setMsg('Backup ready below — select and copy it.'));
    } else {
      setMsg('Backup ready below — select and copy it.');
    }
  };

  const doImport = () => {
    if (!window.confirm('Import this backup? It replaces your current game.')) return;
    const ok = actions.importSave(importText);
    setMsg(ok ? 'Save imported.' : "That backup couldn't be read — check the text and try again.");
    if (ok) {
      setImportText('');
      setBlob('');
    }
  };

  return (
    <div className="nf-mp">
      <div className="nf-mp-head">
        <div className="nf-mp-eyebrow">
          <span className="nf-dos-dot" /> Settings
        </div>
        <div className="nf-mp-title">Save &amp; options</div>
        <div className="nf-mp-sub">Back up your progress, or move it to another device.</div>
      </div>

      <div className="nf-mp-body">
        <div className="nf-mp-sect">Options</div>
        <div className="nf-set-row">
          <div className="nf-set-rowtext">
            <b>Sound</b>
            <span>Synth cues on launches, collects, level-ups and more.</span>
          </div>
          <button className="nf-set-toggle" aria-pressed={!muted} onClick={() => setMuted(toggleMuted())}>
            {muted ? 'Off' : 'On'}
          </button>
        </div>
        <div className="nf-set-note">
          Motion: <b>{reduce ? 'reduced' : 'full'}</b>
          {reduce
            ? ' — following your system "reduce motion" setting.'
            : ' — set your OS/browser "reduce motion" to calm the animations.'}
        </div>

        <div className="nf-mp-sect">Backup</div>
        <button className="nf-wide-btn" onClick={() => actions.save()}>
          Save now
        </button>
        <button className="nf-wide-btn" onClick={doExport}>
          Export backup
        </button>
        {blob && (
          <textarea
            className="nf-set-blob"
            readOnly
            value={blob}
            rows={3}
            onFocus={(e) => e.currentTarget.select()}
            aria-label="Backup code"
          />
        )}

        <div className="nf-mp-sect">Import</div>
        <textarea
          className="nf-set-blob"
          placeholder="Paste a backup code here…"
          value={importText}
          rows={3}
          onChange={(e) => setImportText(e.target.value)}
          aria-label="Paste a backup code"
        />
        <button className="nf-wide-btn go" disabled={!importText.trim()} onClick={doImport}>
          Import &amp; replace
        </button>

        {msg && <div className="nf-set-msg">{msg}</div>}

        <div className="nf-mp-sect">Danger</div>
        <button className="nf-wide-btn danger" onClick={() => actions.reset()}>
          Reset game
        </button>
      </div>
    </div>
  );
}
