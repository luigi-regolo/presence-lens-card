/**
 * Presence Lens Card — Home Assistant dashboard card. Version 1.0
 * Copyright (c) 2026 luigi-regolo. SPDX-License-Identifier: GPL-3.0-only.
 * Read-only card for presence and radar sensors: state, time since the last change,
 * mini radar of the detected distance and a 24-hour history popup. No commands are ever sent.
 * No external scripts, fonts, analytics or assets.
 */
(() => {
  'use strict';

  const VERSION = '1.0';
  const TAG = 'presence-lens-card';
  const EDITOR_TAG = 'presence-lens-card-editor';
  const IS_PHONE = Math.min(window.screen ? window.screen.width : 9999, window.screen ? window.screen.height : 9999) < 600;
  const DAY = 86400000;
  const HIST_REFRESH = 300000;   // history is requested at most every 5 minutes (60 s when the popup opens)
  const HIST_RETRY = 600000;     // after a failed request, wait 10 minutes before trying again

  /* ------------------------------------------------------------ strings */
  const STR = {
    it: {
      title_default: 'Occupazione stanza',
      s_on: 'Presenza rilevata', s_off: 'Nessuna presenza', s_na: 'Non disponibile',
      since_on: 'Presente da', since_off: 'Assente da', since_na: 'Non disponibile da',
      at_on: 'Presente dalle', at_off: 'Assente dalle', at_na: 'Non disponibile dalle',
      sensor: 'Sensore presenza', distance: 'Distanza', occupancy: 'Occupazione 24 h',
      details: 'Dettagli e stato', popup_title: 'Dettagli presenza', close: 'Chiudi',
      last24: 'Ultime 24 ore', detections: 'rilevazioni', summary: 'Riepilogo 24 ore',
      m_det: 'Rilevazioni', m_occ: 'Occupazione', m_off: 'Assenza più lunga', m_last: 'Ultima presenza', ongoing: 'In corso',
      sensor_sec: 'Sensore', readonly: 'Sola lettura', d_now: 'Distanza attuale', d_min: 'Distanza minima', d_max: 'Distanza massima', sens: 'Sensibilità',
      last_change: 'Ultimo cambio', radar_note: 'Il sensore misura solo la distanza, non la direzione: il radar evidenzia l’arco alla distanza rilevata.',
      na_note: 'Lo stato non disponibile non viene mai trattato come assenza di persone.',
      history: 'Cronologia', f_all: 'Tutto', f_on: 'Presenza', f_off: 'Assenza', f_na: 'Non disponibile',
      ev_on: 'Presenza rilevata', ev_off: 'Nessuna presenza', ev_na: 'Non disponibile', in_progress: 'in corso',
      no_hist: 'Storico non disponibile. Serve Recorder con la cronologia abilitata.', no_events: 'Nessun evento per questo filtro.',
      no_target: 'Nessun bersaglio', na_radar: 'Sensore non disponibile', today: 'Oggi', yesterday: 'Ieri',
      example: 'Esempio', missing: 'Entità non trovata', missing_hint: 'Controlla l’entità nella configurazione della card:',
      u_min: 'min', u_h: 'h', u_d: 'g', radar_alt_on: 'Radar: bersaglio a', radar_alt_off: 'Radar: nessun bersaglio', radar_alt_na: 'Radar: sensore non disponibile',
      strip_alt: 'Stato del sensore nelle ultime 24 ore', legend_on: 'Presenza', legend_off: 'Assenza', legend_na: 'Non disponibile',
      history_filter: 'Filtro cronologia'
    },
    en: {
      title_default: 'Room occupancy',
      s_on: 'Presence detected', s_off: 'No presence', s_na: 'Unavailable',
      since_on: 'Present for', since_off: 'Absent for', since_na: 'Unavailable for',
      at_on: 'Present since', at_off: 'Absent since', at_na: 'Unavailable since',
      sensor: 'Presence sensor', distance: 'Distance', occupancy: 'Occupancy 24 h',
      details: 'Details and status', popup_title: 'Presence details', close: 'Close',
      last24: 'Last 24 hours', detections: 'detections', summary: '24-hour summary',
      m_det: 'Detections', m_occ: 'Occupancy', m_off: 'Longest absence', m_last: 'Last presence', ongoing: 'Ongoing',
      sensor_sec: 'Sensor', readonly: 'Read only', d_now: 'Current distance', d_min: 'Minimum distance', d_max: 'Maximum distance', sens: 'Sensitivity',
      last_change: 'Last change', radar_note: 'The sensor only measures distance, not direction: the radar highlights the arc at the detected distance.',
      na_note: 'An unavailable state is never treated as nobody being there.',
      history: 'History', f_all: 'All', f_on: 'Presence', f_off: 'Absence', f_na: 'Unavailable',
      ev_on: 'Presence detected', ev_off: 'No presence', ev_na: 'Unavailable', in_progress: 'ongoing',
      no_hist: 'History not available. It needs Recorder with history enabled.', no_events: 'No events for this filter.',
      no_target: 'No target', na_radar: 'Sensor unavailable', today: 'Today', yesterday: 'Yesterday',
      example: 'Example', missing: 'Entity not found', missing_hint: 'Check the entity in the card configuration:',
      u_min: 'min', u_h: 'h', u_d: 'd', radar_alt_on: 'Radar: target at', radar_alt_off: 'Radar: no target', radar_alt_na: 'Radar: sensor unavailable',
      strip_alt: 'Sensor state over the last 24 hours', legend_on: 'Presence', legend_off: 'Absence', legend_na: 'Unavailable',
      history_filter: 'History filter'
    }
  };

  const DEFAULTS = {
    entity: '', name: '', distance_entity: '', min_distance_entity: '', max_distance_entity: '', sensitivity_entity: '',
    eyebrow: 'PRESENCE LENS CARD', title: '', occupancy_label: '', show_eyebrow: true, show_title: true,
    theme_mode: 'auto', panel: 'radar', show_strip: false, since_format: 'duration', radar_max: 0
  };
  const PRESENCE_CLASSES = ['presence', 'occupancy', 'motion'];

  /* ------------------------------------------------------------ helpers */
  const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const ic = (name) => '<ha-icon icon="' + esc(name) + '"></ha-icon>';
  const cleanTitle = (t) => String(t == null ? '' : t).trim().replace(/\.+$/, '');
  const str = (v) => (typeof v === 'string' ? v.trim() : '');

  function normalizeConfig(raw) {
    if (!raw || typeof raw !== 'object') throw new Error('Invalid configuration');
    const c = Object.assign({}, DEFAULTS, raw);
    ['entity', 'name', 'distance_entity', 'min_distance_entity', 'max_distance_entity', 'sensitivity_entity'].forEach((k) => { c[k] = str(c[k]); });
    c.eyebrow = typeof c.eyebrow === 'string' ? c.eyebrow : DEFAULTS.eyebrow;
    c.title = typeof c.title === 'string' ? c.title : '';
    c.occupancy_label = typeof c.occupancy_label === 'string' ? c.occupancy_label : '';
    c.show_eyebrow = c.show_eyebrow !== false;
    c.show_title = c.show_title !== false;
    c.show_strip = c.show_strip === true;
    if (['auto', 'light', 'dark'].indexOf(c.theme_mode) < 0) c.theme_mode = 'auto';
    if (['radar', 'tiles', 'none'].indexOf(c.panel) < 0) c.panel = 'radar';
    if (['duration', 'time'].indexOf(c.since_format) < 0) c.since_format = 'duration';
    const r = parseFloat(c.radar_max);
    c.radar_max = isFinite(r) && r > 0 && r <= 100 ? r : 0;
    return c;
  }

  const lower = (s) => String(s == null ? '' : s).toLowerCase();
  const UNIT = { m: 1, cm: 0.01, mm: 0.001, km: 1000, ft: 0.3048, in: 0.0254, yd: 0.9144 };
  // Numeric state of a sensor converted to metres. A missing or unknown unit is read as metres.
  function toMeters(st) {
    if (!st) return null;
    const v = parseFloat(st.state);
    if (!isFinite(v) || lower(st.state) === 'nan') return null;
    const u = lower(st.attributes && st.attributes.unit_of_measurement);
    const f = Object.prototype.hasOwnProperty.call(UNIT, u) ? UNIT[u] : 1;
    return v * f;
  }
  const mapState = (s) => (s === 'on' ? 'on' : s === 'off' ? 'off' : 'na');
  const tsOf = (v) => (typeof v === 'number' ? v * 1000 : (typeof v === 'string' ? Date.parse(v) : NaN));

  // History from the websocket API. Items are compressed ({s, lc, lu}) or full state objects.
  function buildSegs(items, start, end) {
    const pts = [];
    (items || []).forEach((it) => {
      if (!it) return;
      const s = it.s !== undefined ? it.s : it.state;
      const raw = it.lc !== undefined ? it.lc : (it.lu !== undefined ? it.lu : (it.last_changed !== undefined ? it.last_changed : it.last_updated));
      const t = tsOf(raw);
      if (s === undefined || !isFinite(t)) return;
      pts.push({ t: Math.max(start, t), st: mapState(s) });
    });
    pts.sort((a, b) => a.t - b.t);
    const merged = [];
    pts.forEach((p) => { const l = merged[merged.length - 1]; if (!l || l.st !== p.st) merged.push({ st: p.st, start: p.t }); });
    if (!merged.length) return null;
    return merged.map((m, i) => ({ st: m.st, start: m.start, end: i + 1 < merged.length ? merged[i + 1].start : end }));
  }

  function derive(segs, now) {
    const on = segs.filter((x) => x.st === 'on'), offs = segs.filter((x) => x.st === 'off');
    const sum = (arr) => arr.reduce((a, x) => a + (x.end - x.start), 0);
    const covered = segs.length ? segs[segs.length - 1].end - segs[0].start : 0;
    const usable = covered - sum(segs.filter((x) => x.st === 'na'));
    const lastOn = on.length ? on[on.length - 1] : null;
    return {
      detections: on.length,
      occ: usable > 0 ? Math.round(sum(on) / usable * 100) : null,
      longestOff: offs.length ? Math.max.apply(null, offs.map((x) => x.end - x.start)) : 0,
      lastOn: lastOn ? (lastOn.end >= now - 90000 ? 'ongoing' : lastOn.end) : null
    };
  }

  function demoSegs(now) {
    const plan = [[40, 'on'], [25, 'off'], [45, 'on'], [605, 'off'], [35, 'on'], [285, 'off'], [50, 'on'], [343, 'off'], [12, 'on']];
    let t = now - DAY;
    return plan.map((p) => { const s = { st: p[1], start: t, end: t + p[0] * 60000 }; t = s.end; return s; });
  }

  /* ------------------------------------------------------------- radar */
  function radarSVG(m, T, fmtM, compact) {
    const cx = 130, cy = 122, R = 112, a = 70 * Math.PI / 180, sx = Math.sin(a), sy = Math.cos(a);
    const arc = (r) => 'M' + (cx - r * sx).toFixed(1) + ' ' + (cy - r * sy).toFixed(1) + ' A' + r.toFixed(1) + ' ' + r.toFixed(1) + ' 0 0 1 ' + (cx + r * sx).toFixed(1) + ' ' + (cy - r * sy).toFixed(1);
    const na = m.state === 'na', max = m.max;
    let g = '<path class="rsec' + (na ? ' rsec-na' : '') + '" d="M' + cx + ' ' + cy + ' L' + (cx - R * sx).toFixed(1) + ' ' + (cy - R * sy).toFixed(1) + ' A' + R + ' ' + R + ' 0 0 1 ' + (cx + R * sx).toFixed(1) + ' ' + (cy - R * sy).toFixed(1) + ' Z"/>';
    const lx = Math.sin(62 * Math.PI / 180), ly = Math.cos(62 * Math.PI / 180);
    [max / 3, max * 2 / 3, max].forEach((d) => {
      const r = d / max * R;
      g += '<path class="rg' + (na ? ' rg-na' : '') + '" d="' + arc(r) + '"/>';
      if (!compact) g += '<text class="rt" x="' + (cx + r * lx + 3).toFixed(1) + '" y="' + (cy - r * ly).toFixed(1) + '">' + esc(fmtM(d)) + '</text>';
    });
    if (m.min > 0 && m.min < max) g += '<path class="rg rg-min" d="' + arc(m.min / max * R) + '"/>';
    const hasDist = m.state === 'on' && m.dist != null;
    if (hasDist) {
      const r = Math.min(m.dist, max) / max * R;
      g += '<path class="rhi-glow" d="' + arc(r) + '"/><path class="rhi" d="' + arc(r) + '"/>';
      if (!compact) g += '<text class="rv" text-anchor="end" x="' + (cx - r * lx - 4).toFixed(1) + '" y="' + (cy - r * ly + 4).toFixed(1) + '">' + esc(fmtM(m.dist)) + '</text>';
    } else if (!compact) {
      g += na ? '<text class="rw" text-anchor="middle" x="' + cx + '" y="86">' + esc(T.na_radar) + '</text>' : '<text class="rt" text-anchor="middle" x="' + cx + '" y="86">' + esc(T.no_target) + '</text>';
    }
    const lv = m.state === 'on' ? 'ok' : na ? 'warn' : 'neutral';
    g += '<circle class="rdot-' + lv + '" cx="' + cx + '" cy="' + cy + '" r="5"/>';
    const alt = hasDist ? T.radar_alt_on + ' ' + fmtM(m.dist) : (na ? T.radar_alt_na : T.radar_alt_off);
    return '<svg class="radar" viewBox="0 0 260 130" role="img" aria-label="' + esc(alt) + '">' + g + '</svg>';
  }

  /* ---------------------------------------------------------------- css */
  const CARD_CSS = `
:host{
  display:block;
  --font:var(--ha-font-family-body,Roboto,Arial,sans-serif);
  --accent:#0a7156;--bg:#fafbf9;--tile:#f0f2ef;--circle:#ffffff;--line:#e0e5df;--fg:#18221c;--muted:#56675c;--btn-fg:#0a7156;
  --wbg:#f9f3de;--wbd:#d3bd63;--wfg:#5f4a10;--idle:#858e89;--scrim:#0009;
}
:host([data-mode="dark"]){
  --accent:#0e795d;--bg:#101211;--tile:#191c1a;--circle:#282b29;--line:#2b302c;--fg:#f5f7f4;--muted:#bbc5bd;--btn-fg:#f5f7f4;
  --wbg:#302b1b;--wbd:#816e31;--wfg:#f1d78b;--idle:#8b918e;
}
*{box-sizing:border-box}
button{font:inherit;color:inherit;cursor:pointer}
svg{display:block}
ha-icon{display:block;flex:none;margin:0;--mdc-icon-size:20px;width:20px;height:20px}
:focus-visible{outline:2px solid var(--accent);outline-offset:3px}
.wrap{container-type:inline-size;width:100%;max-width:100%;min-width:0}
.lens{background:var(--bg);color:var(--fg);font-family:var(--font);border:1px solid var(--line);border-radius:26px;padding:18px;width:100%;min-width:0;display:grid;gap:12px;position:relative}
.head{margin:2px 4px 5px;min-width:0}
.eyebrow{font-size:10px;letter-spacing:1.7px;font-weight:750;color:var(--muted);text-transform:uppercase;margin-bottom:7px;overflow-wrap:anywhere}
.title{margin:0;font-size:25px;line-height:1.14;font-weight:780;letter-spacing:-.7px;overflow-wrap:anywhere}
.title b{color:var(--accent);font-weight:800}
.demo{position:absolute;top:14px;right:16px;font-size:10px;letter-spacing:1.2px;font-weight:700;text-transform:uppercase;color:var(--muted);border:1px solid var(--line);border-radius:999px;padding:2px 9px;background:var(--tile)}
.lbody{display:grid;gap:10px;min-width:0;grid-template-columns:minmax(0,1fr);grid-template-areas:"row" "xtra" "strip"}
.lbody.nox{grid-template-areas:"row" "strip"}
.row{grid-area:row;display:grid;grid-template-columns:36px minmax(0,1fr) auto;gap:10px;align-items:center;background:var(--tile);border:1px solid var(--line);border-radius:16px;padding:10px 12px;min-height:56px;min-width:0}
.xtra{grid-area:xtra}.sbox{grid-area:strip}
.ico{width:36px;height:36px;border-radius:50%;display:grid;place-items:center;flex:none;line-height:0;background:var(--circle);color:var(--muted);box-shadow:inset 0 0 0 1px var(--line)}
.ico ha-icon{--mdc-icon-size:20px;width:20px;height:20px}
.ico-ok{background:color-mix(in srgb,var(--accent) 14%,transparent);color:var(--btn-fg);box-shadow:none}
.ico-warn{background:var(--wbg);color:var(--wfg);box-shadow:inset 0 0 0 1px var(--wbd)}
.ico.big{width:44px;height:44px}
.ico.big ha-icon{--mdc-icon-size:24px;width:24px;height:24px}
.info{min-width:0}
.name{font-size:14px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sub{font-size:12px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.since{text-align:right;display:grid;gap:1px}
.slbl{font-size:11px;color:var(--muted);white-space:nowrap}
.since strong{font-size:15px;font-weight:600;font-variant-numeric:tabular-nums;white-space:nowrap}
.tiles{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
.tiles.one{grid-template-columns:minmax(0,1fr)}
.tile{background:var(--tile);border:1px solid var(--line);border-radius:16px;padding:14px 16px 13px;min-width:0}
.tile .n{font-size:26px;font-weight:700;line-height:1.1;font-variant-numeric:tabular-nums;white-space:nowrap}
.tile .l{font-size:12.5px;color:var(--muted);margin-top:5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.rpanel{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(0,1fr);gap:12px;align-items:center;background:var(--tile);border:1px solid var(--line);border-radius:16px;padding:10px 14px}
.rpanel .radar{max-width:170px;margin:0 auto}
.rside{display:grid;gap:8px}
.rside .n{font-size:20px;font-weight:700;line-height:1.1;font-variant-numeric:tabular-nums}
.rside .l{font-size:12px;color:var(--muted);margin-top:2px}
.sbox{background:var(--tile);border:1px solid var(--line);border-radius:16px;padding:10px 14px 8px;display:grid;gap:6px;min-width:0}
.sbox .strip{height:8px;border-radius:4px}
.sbox .shd{display:flex;justify-content:space-between;gap:8px;font-size:11px;color:var(--muted)}
.sbox .shd b{font-weight:600;color:var(--fg)}
.detail{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;min-height:40px;padding:8px 14px;border-radius:999px;font-weight:600;font-size:13.5px;line-height:1.2;color:var(--btn-fg);border:1px solid color-mix(in srgb,var(--accent) 45%,transparent);background:color-mix(in srgb,var(--accent) 12%,transparent)}
.detail:hover{background:color-mix(in srgb,var(--accent) 22%,transparent)}
.detail ha-icon{--mdc-icon-size:18px;width:18px;height:18px}
.err{display:grid;gap:6px}
.err code{font-size:12px;overflow-wrap:anywhere;color:var(--muted)}
@container (max-width:380px){.lens{padding:13px;border-radius:23px}.title{font-size:23px}}
@container (max-width:310px){
  .lens{padding:10px}.title{font-size:21px}.eyebrow{font-size:9px}
  .row{grid-template-columns:36px minmax(0,1fr)}
  .since{grid-column:2;display:flex;justify-content:space-between;align-items:baseline;text-align:left;gap:8px}
  .rpanel{grid-template-columns:minmax(0,1fr)}
}
@container (max-width:280px){.tiles{grid-template-columns:minmax(0,1fr)}}
@container (min-width:560px){
  .lbody{grid-template-columns:minmax(0,1.2fr) minmax(0,1fr);grid-template-areas:"row xtra" "strip xtra";grid-template-rows:1fr 1fr;gap:10px;align-items:stretch}
  .lbody.nox{grid-template-columns:minmax(0,1fr);grid-template-areas:"row" "strip";grid-template-rows:auto}
  .lbody.nostrip{grid-template-areas:"row xtra";grid-template-rows:auto}
  .lbody.nox.nostrip{grid-template-areas:"row"}
  .row{min-height:64px}
  .sbox{align-content:center}
  .rpanel{padding:14px 18px;gap:16px}
  .rpanel .radar{max-width:230px}
  .rside .n{font-size:26px}
  .tiles.xtra{grid-template-columns:minmax(0,1fr)}
  .tiles.xtra .tile{display:flex;flex-direction:column;justify-content:center}
}
/* radar */
.radar{width:100%;max-width:300px;height:auto;margin:0 auto}
.rsec{fill:color-mix(in srgb,var(--accent) 7%,transparent);stroke:var(--line);stroke-width:1}
.rsec-na{fill:none;stroke-dasharray:3 3}
.rg{fill:none;stroke:var(--line);stroke-width:1}
.rg-na{stroke-dasharray:3 3}
.rg-min{stroke-dasharray:2 3;stroke:var(--muted);stroke-opacity:.55}
.rhi-glow{fill:none;stroke:var(--accent);stroke-opacity:.22;stroke-width:9;stroke-linecap:round}
.rhi{fill:none;stroke:var(--accent);stroke-width:3;stroke-linecap:round}
.rdot-ok{fill:var(--accent)}.rdot-neutral{fill:var(--idle)}.rdot-warn{fill:var(--wbd)}
.rt{font:500 9.5px var(--font);fill:var(--muted)}
.rv{font:700 11px var(--font);fill:var(--btn-fg)}
.rw{font:600 10.5px var(--font);fill:var(--wfg)}
/* strip */
.strip{display:flex;gap:1px;height:28px;border-radius:8px;overflow:hidden}
.strip i{display:block;min-width:2px}
.s-on{background:var(--accent)}
.s-off{background:color-mix(in srgb,var(--idle) 35%,transparent)}
.s-na{background:var(--wbd)}
@keyframes ring{0%{box-shadow:0 0 0 0 color-mix(in srgb,var(--accent) 38%,transparent)}70%,100%{box-shadow:0 0 0 9px transparent}}
@keyframes glow{0%,100%{stroke-opacity:.26}50%{stroke-opacity:.07}}
.row .ico-ok,.nowrow .ico-ok{animation:ring 2.6s ease-out infinite}
.rhi-glow{animation:glow 2.6s ease-in-out infinite}
@media (prefers-reduced-motion:reduce){*{transition:none!important;animation:none!important}}
/* popup */
.backdrop{position:fixed;inset:0;z-index:9999;overscroll-behavior:contain;background:var(--scrim);display:flex;align-items:center;justify-content:center;font-family:var(--font);color:var(--fg);padding:max(16px,env(safe-area-inset-top)) max(16px,env(safe-area-inset-right)) max(16px,env(safe-area-inset-bottom)) max(16px,env(safe-area-inset-left))}
.dialog{width:min(390px,100%);max-width:100%;min-width:0;align-self:center;height:min(calc(100vh - 40px),680px);height:min(calc(100dvh - 40px),680px);max-height:calc(100dvh - 32px - env(safe-area-inset-top,0px) - env(safe-area-inset-bottom,0px));display:flex;flex-direction:column;background:var(--bg);color:var(--fg);border:1px solid var(--line);border-radius:26px;overflow:hidden;box-shadow:0 18px 60px #0005}
.dialog.is-wide{width:min(1120px,100%);height:min(80vh,560px);height:min(80dvh,560px)}
.mhead{flex:none;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:16px 16px 12px 18px;background:var(--bg);border-bottom:1px solid var(--line)}
.mtitle{flex:1;min-width:0;margin:0;font-size:17px;font-weight:600;line-height:1.3}
.close{display:grid;place-items:center;line-height:0;margin:0;padding:0;width:40px;height:40px;flex:none;border:1px solid var(--line);border-radius:50%;background:var(--tile);color:var(--fg)}
.close ha-icon{display:block;flex:none;margin:0;--mdc-icon-size:18px;width:18px;height:18px}
.mbody{flex:1 1 auto;min-height:0;overflow-y:auto;overflow-x:hidden;overscroll-behavior:contain;padding:12px 18px 18px;min-width:0;display:grid;gap:12px;align-content:start}
.is-wide .mbody{padding:12px 22px 22px;grid-template-columns:repeat(2,minmax(0,1fr))}
.is-wide .b-tl,.is-wide .b-hist,.is-wide .b-nohist{grid-column:1 / -1}
.is-wide .b-stats{grid-template-rows:auto 1fr}
.is-wide .b-stats .minis{grid-auto-rows:1fr}
.is-wide .b-stats .mini{align-content:center}
@media (min-width:1024px){.is-wide .mbody{grid-template-columns:repeat(3,minmax(0,1fr))}.is-wide .b-sensor{grid-template-rows:auto repeat(4,1fr)}}
@media (max-width:1023px){.is-wide .b-sensor{grid-column:1 / -1}}
@media (max-width:639px){.is-wide .mbody{grid-template-columns:minmax(0,1fr)}.is-wide .b-sensor{grid-column:auto}}
.dialog:not(.is-wide) .b-now{order:1}.dialog:not(.is-wide) .b-tl{order:2}.dialog:not(.is-wide) .b-stats{order:3}.dialog:not(.is-wide) .b-sensor{order:4}.dialog:not(.is-wide) .b-hist,.dialog:not(.is-wide) .b-nohist{order:5}
.box{background:var(--tile);border:1px solid var(--line);border-radius:24px;padding:14px;display:grid;gap:10px;align-content:start;min-width:0}
.bh{display:flex;align-items:center;justify-content:space-between;gap:8px;margin:0 4px;min-height:20px}
.bt{font-size:10px;letter-spacing:1.3px;font-weight:600;text-transform:uppercase;color:var(--muted)}
.tag{display:inline-flex;align-items:center;gap:4px;font-size:11px;font-weight:600;color:var(--muted);border:1px solid var(--line);border-radius:999px;padding:2px 9px;background:var(--bg)}
.tag ha-icon{--mdc-icon-size:13px;width:13px;height:13px}
.nowrow{display:flex;align-items:center;gap:12px;margin:0 2px}
.nst{font-size:18px;font-weight:600;line-height:1.25}
.nsub{font-size:13px;color:var(--muted);font-variant-numeric:tabular-nums}
.note{margin:0 4px;font-size:12px;color:var(--muted);line-height:1.45}
.kv{display:flex;align-items:center;gap:10px;min-height:34px;margin:0 4px}
.ki{flex:none;color:var(--muted)}
.kl{flex:1 1 auto;min-width:0}
.kvv{font-weight:600;font-variant-numeric:tabular-nums;text-align:right}
.axis{position:relative;height:16px;margin:0 2px;font-size:11px;color:var(--muted);font-variant-numeric:tabular-nums}
.axis span{position:absolute;top:0;transform:translateX(-50%);white-space:nowrap}
.legend{display:flex;flex-wrap:wrap;gap:6px 16px;font-size:12px;color:var(--muted);margin:0 4px}
.legend span{display:inline-flex;align-items:center;gap:6px}
.legend i{width:10px;height:10px;border-radius:3px;display:block}
.minis{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.mini{background:var(--bg);border:1px solid var(--line);border-radius:14px;padding:12px 14px;display:grid;gap:2px;min-width:0}
.mini .ml{font-size:12px;color:var(--muted)}
.mini strong{font-size:16px;font-weight:600;font-variant-numeric:tabular-nums;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.chips{display:flex;flex-wrap:wrap;gap:6px}
.chip{min-height:36px;padding:0 14px;border:1px solid var(--line);border-radius:999px;background:var(--bg);color:var(--muted);font-size:13px}
.chip[aria-pressed="true"]{background:color-mix(in srgb,var(--accent) 14%,transparent);border-color:color-mix(in srgb,var(--accent) 45%,transparent);color:var(--fg);font-weight:600}
.evs{display:grid;gap:8px}
.is-wide .evs{grid-template-columns:repeat(auto-fill,minmax(260px,1fr))}
.ev{display:flex;align-items:center;gap:10px;min-width:0;min-height:50px;padding:7px 10px;background:var(--bg);border:1px solid var(--line);border-radius:16px}
.ev .ico{width:32px;height:32px}
.ev .ico ha-icon{--mdc-icon-size:18px;width:18px;height:18px}
.evt{min-width:0}.evn{font-size:14px;font-weight:600}.evs2{font-size:11px;color:var(--muted);font-variant-numeric:tabular-nums}
.empty{display:flex;align-items:center;gap:10px;color:var(--muted);font-size:13px;margin:0 4px}
.empty ha-icon{--mdc-icon-size:20px;width:20px;height:20px}
`;

  /* --------------------------------------------------------------- card */
  class PresenceLensCard extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: 'open' });
      this.shadowRoot.innerHTML = '<style>' + CARD_CSS + '</style><div id="r"></div>';
      this._root = this.shadowRoot.getElementById('r');
      this._cfg = null; this._hass = null; this._sig = null;
      this._popup = false; this._filter = 'all'; this._focus = '';
      this._hist = null; this._histAt = 0; this._histFail = 0; this._histBusy = false; this._histVer = 0;
      this._wide = false; this._timer = null;
      this._onKey = (e) => this._key(e);
      this._onResize = () => { if (this._popup && this._layoutWide() !== this._wide) this._render(); };
      this.shadowRoot.addEventListener('click', (e) => this._click(e));
    }

    static getStubConfig(hass) {
      const st = (hass && hass.states) || {};
      const ids = Object.keys(st).filter((id) => id.indexOf('binary_sensor.') === 0 && PRESENCE_CLASSES.indexOf(st[id].attributes && st[id].attributes.device_class) >= 0);
      ids.sort((a, b) => PRESENCE_CLASSES.indexOf(st[a].attributes.device_class) - PRESENCE_CLASSES.indexOf(st[b].attributes.device_class));
      return ids.length ? { entity: ids[0] } : {};
    }
    static getConfigElement() { return document.createElement(EDITOR_TAG); }
    getCardSize() { return 4; }
    getGridOptions() { return { columns: 12, min_columns: 6 }; }

    setConfig(config) {
      this._cfg = normalizeConfig(config);
      this._hist = null; this._histAt = 0; this._histFail = 0; this._sig = null;
      this._render();
      this._ensureHistory(true);
    }

    set hass(h) {
      this._hass = h;
      if (!this._cfg) return;
      const sig = this._signature();
      if (sig === this._sig) return;
      this._sig = sig;
      this._render();
      this._ensureHistory(false);
    }
    get hass() { return this._hass; }

    connectedCallback() {
      window.addEventListener('resize', this._onResize);
      this._timer = window.setInterval(() => { if (this._cfg) this._render(); }, 60000);
    }
    disconnectedCallback() {
      window.removeEventListener('resize', this._onResize);
      document.removeEventListener('keydown', this._onKey, true);
      if (this._timer) window.clearInterval(this._timer);
    }

    /* ---- environment ---- */
    _lang() { const h = this._hass; const l = (h && ((h.locale && h.locale.language) || h.language)) || 'it'; return String(l).toLowerCase(); }
    _T() { return lower(this._lang()).indexOf('it') === 0 ? STR.it : STR.en; }
    _mode() {
      const m = this._cfg.theme_mode;
      if (m === 'light' || m === 'dark') return m;
      return this._hass && this._hass.themes && this._hass.themes.darkMode ? 'dark' : 'light';
    }
    _layoutWide() { return !IS_PHONE && window.matchMedia('(min-width:640px) and (min-height:600px)').matches; }
    _nf(max) { try { return new Intl.NumberFormat(this._lang(), { maximumFractionDigits: max, minimumFractionDigits: 0 }); } catch (e) { return new Intl.NumberFormat('en', { maximumFractionDigits: max }); } }
    _fmtM(v) { return this._nf(1).format(Math.round(v * 10) / 10) + ' m'; }
    _fmtDur(ms) {
      const T = this._T(), m = Math.max(1, Math.round(ms / 60000));
      if (m < 60) return m + ' ' + T.u_min;
      if (m < 1440) { const h = Math.floor(m / 60), r = m % 60; return r ? h + ' ' + T.u_h + ' ' + r + ' ' + T.u_min : h + ' ' + T.u_h; }
      const d = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60);
      return h ? d + ' ' + T.u_d + ' ' + h + ' ' + T.u_h : d + ' ' + T.u_d;
    }
    _hm(ms) { try { return new Intl.DateTimeFormat(this._lang(), { hour: '2-digit', minute: '2-digit' }).format(new Date(ms)); } catch (e) { return new Date(ms).toTimeString().slice(0, 5); } }
    _clock(ms, now, hideToday) {
      const T = this._T(), d = new Date(ms), n = new Date(now);
      const day0 = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
      const diff = Math.round((day0(n) - day0(d)) / DAY);
      if (diff === 0) return (hideToday ? '' : T.today + ' ') + this._hm(ms);
      if (diff === 1) return T.yesterday + ' ' + this._hm(ms);
      let ds = ''; try { ds = new Intl.DateTimeFormat(this._lang(), { day: 'numeric', month: 'short' }).format(d); } catch (e) { ds = d.toLocaleDateString(); }
      return ds + ' ' + this._hm(ms);
    }

    /* ---- data ---- */
    _now() { return Date.now(); }
    _model() {
      const c = this._cfg, h = this._hass, now = this._now();
      if (!c.entity) {
        const segs = demoSegs(now), last = segs[segs.length - 1];
        return { demo: true, state: 'on', since: last.start, dist: 1.8, min: 0.3, max: 6, sens: '7', hasDist: true, hasMin: true, hasMax: true, hasSens: true, segs: segs, name: null, now: now };
      }
      const st = h && h.states ? h.states[c.entity] : null;
      if (!st) return { missing: true, now: now };
      const state = mapState(st.state);
      const dst = c.distance_entity && h.states[c.distance_entity];
      const mn = c.min_distance_entity && h.states[c.min_distance_entity];
      const mx = c.max_distance_entity && h.states[c.max_distance_entity];
      const sn = c.sensitivity_entity && h.states[c.sensitivity_entity];
      const minV = toMeters(mn), maxV = toMeters(mx);
      const max = maxV && maxV > 0 ? maxV : (c.radar_max || 6);
      let since = Date.parse(st.last_changed);
      if (!isFinite(since)) since = now;
      const segs = this._hist;
      if (segs && segs.length) {
        const last = segs[segs.length - 1];
        // after a Home Assistant restart last_changed can restart: the history knows the real start of the state
        if (last.st === state && last.start < since) since = last.start;
      }
      return {
        state: state, since: since, dist: toMeters(dst), min: minV || 0, max: max, now: now,
        sens: sn && sn.state !== 'unavailable' && sn.state !== 'unknown' ? this._nf(2).format(parseFloat(sn.state)) : null,
        hasDist: !!dst, hasMin: minV != null, hasMax: maxV != null, hasSens: !!(sn && isFinite(parseFloat(sn.state))),
        segs: segs, name: st.attributes && st.attributes.friendly_name ? st.attributes.friendly_name : c.entity
      };
    }

    _signature() {
      const h = this._hass, c = this._cfg;
      if (!h || !h.states) return 'none';
      const parts = [this._mode(), this._lang(), this._histVer, this._popup ? 'p' : '-'];
      [c.entity, c.distance_entity, c.min_distance_entity, c.max_distance_entity, c.sensitivity_entity].forEach((id) => {
        if (!id) return;
        const s = h.states[id];
        parts.push(id + ':' + (s ? s.state + '@' + s.last_changed : '-'));
      });
      return parts.join('|');
    }

    _histExpected() {
      const h = this._hass;
      if (!h || this._hist || !this._wantsHistory() || typeof h.callWS !== 'function') return false;
      if (h.config && Array.isArray(h.config.components) && h.config.components.indexOf('history') < 0 && h.config.components.indexOf('recorder') < 0) return false;
      if (this._histFail && this._now() - this._histFail < HIST_RETRY) return false;
      return true;
    }
    _wantsHistory() { return !!this._cfg && !!this._cfg.entity && (this._cfg.show_strip || this._cfg.panel !== 'none' || this._popup); }
    _ensureHistory(force) {
      const h = this._hass, c = this._cfg;
      if (!h || !c || !c.entity || this._histBusy || !this._wantsHistory()) return;
      if (typeof h.callWS !== 'function') return;
      if (h.config && Array.isArray(h.config.components) && h.config.components.indexOf('history') < 0 && h.config.components.indexOf('recorder') < 0) return;
      const now = this._now();
      if (this._histFail && now - this._histFail < HIST_RETRY) return;
      const age = now - this._histAt;
      if (!force && this._hist && age < (this._popup ? 60000 : HIST_REFRESH)) return;
      if (!force && !this._hist && this._histAt && age < HIST_REFRESH) return;
      this._histBusy = true;
      const start = now - DAY;
      h.callWS({ type: 'history/history_during_period', start_time: new Date(start).toISOString(), end_time: new Date(now).toISOString(), entity_ids: [c.entity], include_start_time_state: true, significant_changes_only: false, minimal_response: true, no_attributes: true })
        .then((res) => {
          const items = res && res[c.entity];
          this._hist = buildSegs(items, start, now);
          this._histAt = now; this._histFail = 0; this._histVer += 1; this._sig = null;
        })
        .catch(() => { this._hist = null; this._histAt = now; this._histFail = now; this._histVer += 1; this._sig = null; })
        .then(() => { this._histBusy = false; if (this._cfg) this._render(); });
    }

    /* ---- markup ---- */
    _panelItems(m, d, T, pend) {
      const items = [];
      if (m.hasDist) items.push([m.state === 'on' && m.dist != null ? this._fmtM(m.dist) : '—', T.distance]);
      if (d && d.occ != null) items.push([d.occ + '%', str(this._cfg.occupancy_label) || T.occupancy]);
      else if (pend) items.push(['—', str(this._cfg.occupancy_label) || T.occupancy]);
      return items;
    }
    _cardHTML(m) {
      const c = this._cfg, T = this._T();
      if (m.missing) {
        return '<div class="wrap"><article class="lens err"><div class="title">' + esc(T.missing) + '</div><div class="sub" style="white-space:normal">' + esc(T.missing_hint) + '</div><code>' + esc(c.entity) + '</code></article></div>';
      }
      const segs = m.segs, d = segs && segs.length ? derive(segs, m.now) : null;
      const pend = !d && this._histExpected();
      const title = cleanTitle(c.title) || T.title_default;
      const head = (c.show_eyebrow || c.show_title)
        ? '<div class="head">' + (c.show_eyebrow && c.eyebrow ? '<div class="eyebrow">' + esc(c.eyebrow) + '</div>' : '') + (c.show_title ? '<div class="title">' + esc(title) + '<b>.</b></div>' : '') + '</div>'
        : '';
      const lv = m.state === 'on' ? 'ok' : m.state === 'na' ? 'warn' : 'neutral';
      const icon = m.state === 'on' ? 'mdi:motion-sensor' : m.state === 'na' ? 'mdi:alert-circle-outline' : 'mdi:motion-sensor-off';
      const sTxt = m.state === 'on' ? T.s_on : m.state === 'na' ? T.s_na : T.s_off;
      const key = m.state === 'on' ? 'on' : m.state === 'na' ? 'na' : 'off';
      const timeFmt = c.since_format === 'time';
      const sLabel = timeFmt ? T['at_' + key] : T['since_' + key];
      const sVal = timeFmt ? this._clock(m.since, m.now, true) : this._fmtDur(m.now - m.since);
      let extra = '';
      if (c.panel !== 'none') {
        const items = this._panelItems(m, d, T, pend);
        if (c.panel === 'radar' && m.hasDist) {
          extra = '<div class="rpanel xtra">' + radarSVG(m, T, (v) => this._fmtM(v), true) + '<div class="rside">' +
            items.map((it) => '<div><div class="n">' + esc(it[0]) + '</div><div class="l">' + esc(it[1]) + '</div></div>').join('') + '</div></div>';
        } else if (items.length) {
          extra = '<div class="tiles xtra' + (items.length === 1 ? ' one' : '') + '">' + items.map((it) => '<div class="tile"><div class="n">' + esc(it[0]) + '</div><div class="l">' + esc(it[1]) + '</div></div>').join('') + '</div>';
        }
      }
      const showStrip = c.show_strip && ((segs && segs.length) || pend);
      const strip = showStrip && !d
        ? '<div class="sbox"><div class="shd"><span>' + esc(T.last24) + '</span><b>—</b></div><div class="strip" role="img" aria-label="' + esc(T.strip_alt) + '"><i class="s-off" style="flex:1 1 0"></i></div></div>'
        : showStrip
        ? '<div class="sbox"><div class="shd"><span>' + esc(T.last24) + '</span><b>' + d.detections + ' ' + esc(T.detections) + '</b></div>' +
          '<div class="strip" role="img" aria-label="' + esc(T.strip_alt) + '">' + segs.map((x) => '<i class="s-' + x.st + '" style="flex:' + Math.max(1, x.end - x.start) + ' 1 0"></i>').join('') + '</div></div>'
        : '';
      return '<div class="wrap"><article class="lens">' + (m.demo ? '<span class="demo">' + esc(T.example) + '</span>' : '') + head +
        '<div class="lbody' + (extra ? '' : ' nox') + (strip ? '' : ' nostrip') + '">' +
          '<div class="row"><span class="ico ico-' + lv + '">' + ic(icon) + '</span>' +
            '<div class="info"><div class="name">' + esc(c.name || T.sensor) + '</div><div class="sub">' + esc(sTxt) + '</div></div>' +
            '<div class="since"><span class="slbl">' + esc(sLabel) + '</span><strong>' + esc(sVal) + '</strong></div></div>' +
          extra + strip +
        '</div>' +
        '<button class="detail" type="button" id="open" data-open="1"><span>' + esc(T.details) + '</span>' + ic('mdi:chevron-right') + '</button>' +
        '</article></div>';
    }

    _stripHTML(m, T) {
      const segs = m.segs, start = segs[0].start, end = segs[segs.length - 1].end, span = end - start;
      const bars = segs.map((x) => '<i class="s-' + x.st + '" style="flex:' + Math.max(1, x.end - x.start) + ' 1 0" title="' + esc(T['ev_' + x.st]) + ' · ' + esc(this._fmtDur(x.end - x.start)) + '"></i>').join('');
      // labels sit on round hours (every 6 h by the local clock), positioned inside the real window
      const marks = [];
      for (let t = Math.ceil(start / 3600000) * 3600000; t <= end; t += 3600000) { if (new Date(t).getHours() % 6 === 0) marks.push(t); }
      const ticks = marks.map((t) => {
        const pc = (t - start) / Math.max(span, 1) * 100;
        return '<span style="left:' + pc.toFixed(2) + '%' + (pc < 7 ? ';transform:none' : pc > 93 ? ';transform:translateX(-100%)' : '') + '">' + esc(this._hm(t)) + '</span>';
      }).join('');
      return '<div class="strip" role="img" aria-label="' + esc(T.strip_alt) + '">' + bars + '</div><div class="axis">' + ticks + '</div>' +
        '<div class="legend"><span><i class="s-on"></i>' + esc(T.legend_on) + '</span><span><i class="s-off"></i>' + esc(T.legend_off) + '</span><span><i class="s-na"></i>' + esc(T.legend_na) + '</span></div>';
    }
    _eventsHTML(m, T) {
      let list = m.segs.slice().reverse();
      if (this._filter !== 'all') list = list.filter((x) => x.st === this._filter);
      if (!list.length) return '<div class="empty">' + ic('mdi:information-outline') + '<span>' + esc(T.no_events) + '</span></div>';
      const last = m.segs[m.segs.length - 1];
      return '<div class="evs">' + list.slice(0, 60).map((x) => {
        const lv = x.st === 'on' ? 'ok' : x.st === 'na' ? 'warn' : 'neutral';
        const icn = x.st === 'on' ? 'mdi:motion-sensor' : x.st === 'na' ? 'mdi:alert-circle-outline' : 'mdi:motion-sensor-off';
        return '<div class="ev"><span class="ico ico-' + lv + '">' + ic(icn) + '</span><div class="evt"><div class="evn">' + esc(T['ev_' + x.st]) + '</div><div class="evs2">' +
          esc(this._clock(x.start, m.now)) + ' · ' + (x === last ? esc(T.in_progress) + ', ' : '') + esc(this._fmtDur(x.end - x.start)) + '</div></div></div>';
      }).join('') + '</div>';
    }
    _popupHTML(m) {
      const c = this._cfg, T = this._T();
      const hasH = !!(m.segs && m.segs.length), d = hasH ? derive(m.segs, m.now) : null;
      const lv = m.state === 'on' ? 'ok' : m.state === 'na' ? 'warn' : 'neutral';
      const icon = m.state === 'on' ? 'mdi:motion-sensor' : m.state === 'na' ? 'mdi:alert-circle-outline' : 'mdi:motion-sensor-off';
      const key = m.state === 'on' ? 'on' : m.state === 'na' ? 'na' : 'off';
      const sTxt = m.state === 'on' ? T.s_on : m.state === 'na' ? T.s_na : T.s_off;
      const timeFmt = c.since_format === 'time';
      const sub = (timeFmt ? T['at_' + key] : T['since_' + key]) + ' ' + (timeFmt ? this._clock(m.since, m.now, true) : this._fmtDur(m.now - m.since));
      const kv = (icn, label, val) => '<div class="kv"><span class="ki">' + ic(icn) + '</span><span class="kl">' + esc(label) + '</span><span class="kvv">' + esc(val) + '</span></div>';
      const radar = (m.hasDist || m.demo) ? radarSVG(m, T, (v) => this._fmtM(v), false) : '';
      let h = '<section class="box b-now"><div class="nowrow"><span class="ico big ico-' + lv + '">' + ic(icon) + '</span><div><div class="nst">' + esc(sTxt) + '</div><div class="nsub">' + esc(sub) + '</div></div></div>' +
        radar + (radar ? '<p class="note">' + esc(T.radar_note) + '</p>' : '') +
        kv('mdi:clock-outline', T.last_change, this._clock(m.since, m.now)) +
        (m.state === 'na' ? '<p class="note">' + esc(T.na_note) + '</p>' : '') + '</section>';
      if (hasH) {
        h += '<section class="box b-stats"><div class="bh"><span class="bt">' + esc(T.summary) + '</span></div><div class="minis">' +
          '<div class="mini"><span class="ml">' + esc(T.m_det) + '</span><strong>' + d.detections + '</strong></div>' +
          '<div class="mini"><span class="ml">' + esc(T.m_occ) + '</span><strong>' + (d.occ == null ? '—' : d.occ + '%') + '</strong></div>' +
          '<div class="mini"><span class="ml">' + esc(T.m_off) + '</span><strong>' + (d.longestOff ? esc(this._fmtDur(d.longestOff)) : '—') + '</strong></div>' +
          '<div class="mini"><span class="ml">' + esc(T.m_last) + '</span><strong>' + (d.lastOn == null ? '—' : d.lastOn === 'ongoing' ? esc(T.ongoing) : esc(this._clock(d.lastOn, m.now))) + '</strong></div></div></section>';
      }
      const rows = [];
      if (m.hasDist) rows.push(kv('mdi:ruler', T.d_now, m.state === 'on' && m.dist != null ? this._fmtM(m.dist) : '—'));
      if (m.hasMin) rows.push(kv('mdi:ruler', T.d_min, this._fmtM(m.min)));
      if (m.hasMax) rows.push(kv('mdi:ruler', T.d_max, this._fmtM(m.max)));
      if (m.hasSens && m.sens != null) rows.push(kv('mdi:tune-variant', T.sens, m.sens));
      if (rows.length) h += '<section class="box b-sensor"><div class="bh"><span class="bt">' + esc(T.sensor_sec) + '</span><span class="tag">' + ic('mdi:lock-outline') + esc(T.readonly) + '</span></div>' + rows.join('') + '</section>';
      if (hasH) {
        h += '<section class="box b-tl"><div class="bh"><span class="bt">' + esc(T.last24) + '</span></div>' + this._stripHTML(m, T) + '</section>' +
          '<section class="box b-hist"><div class="bh"><span class="bt">' + esc(T.history) + '</span></div><div class="chips" role="group" aria-label="' + esc(T.history_filter) + '">' +
          [['all', T.f_all], ['on', T.f_on], ['off', T.f_off], ['na', T.f_na]].map((f) => '<button class="chip" type="button" data-filter="' + f[0] + '" aria-pressed="' + (this._filter === f[0]) + '">' + esc(f[1]) + '</button>').join('') +
          '</div>' + this._eventsHTML(m, T) + '</section>';
      } else {
        h += '<section class="box b-nohist"><div class="empty">' + ic('mdi:information-outline') + '<span>' + esc(T.no_hist) + '</span></div></section>';
      }
      return '<div class="backdrop" data-backdrop="1"><div class="dialog' + (this._wide ? ' is-wide' : '') + '" role="dialog" aria-modal="true" aria-labelledby="dtitle">' +
        '<div class="mhead"><h2 class="mtitle" id="dtitle">' + esc(T.popup_title) + '</h2><button class="close" type="button" id="close" data-close="1" aria-label="' + esc(T.close) + '">' + ic('mdi:close') + '</button></div>' +
        '<div class="mbody" id="pbody">' + h + '</div></div></div>';
    }

    _render() {
      if (!this._cfg) return;
      this.setAttribute('data-mode', this._mode());
      const m = this._model();
      const body = this._root.querySelector('.mbody');
      const top = body ? body.scrollTop : 0;
      const act = this.shadowRoot.activeElement ? this.shadowRoot.activeElement.id || (this.shadowRoot.activeElement.dataset && this.shadowRoot.activeElement.dataset.filter ? 'f-' + this.shadowRoot.activeElement.dataset.filter : '') : '';
      if (this._popup) this._wide = this._layoutWide();
      this._root.innerHTML = this._cardHTML(m) + (this._popup && !m.missing ? this._popupHTML(m) : '');
      if (this._popup) {
        const nb = this._root.querySelector('.mbody'); if (nb) nb.scrollTop = top;
        this._lockScroll();
      }
      const want = this._focus || act;
      this._focus = '';
      if (want) {
        let el = null;
        if (want.indexOf('f-') === 0) el = this._root.querySelector('[data-filter="' + want.slice(2) + '"]');
        else el = this.shadowRoot.getElementById(want);
        if (el) el.focus({ preventScroll: true });
      }
    }

    /* ---- interaction ---- */
    _click(e) {
      const t = e.target && e.target.closest ? e.target.closest('[data-open],[data-close],[data-filter],[data-backdrop]') : null;
      if (!t) return;
      if (t.dataset.backdrop) { if (e.target === t) this._closePopup(); return; }
      if (t.dataset.open) { this._openPopup(); return; }
      if (t.dataset.close) { this._closePopup(); return; }
      if (t.dataset.filter) { this._filter = t.dataset.filter; this._focus = 'f-' + t.dataset.filter; this._render(); }
    }
    _openPopup() {
      this._popup = true; this._filter = 'all'; this._focus = 'close'; this._wide = this._layoutWide();
      document.addEventListener('keydown', this._onKey, true);
      this._render();
      this._ensureHistory(false);
    }
    _closePopup() {
      if (!this._popup) return;
      this._popup = false;
      document.removeEventListener('keydown', this._onKey, true);
      this._focus = 'open'; this._render();
    }
    // The dashboard behind the popup must not move: scroll gestures that would leave the dialog body are cancelled.
    _lockScroll() {
      const overlay = this._root.querySelector('.backdrop');
      if (!overlay) return;
      const body = overlay.querySelector('.mbody');
      const atEdge = (dy) => !body || (dy < 0 && body.scrollTop <= 0) || (dy > 0 && body.scrollTop + body.clientHeight >= body.scrollHeight - 1);
      overlay.addEventListener('wheel', (e) => { if (!body || !body.contains(e.target) || atEdge(e.deltaY)) e.preventDefault(); }, { passive: false });
      let y = 0;
      overlay.addEventListener('touchstart', (e) => { const t = e.touches[0]; y = t ? t.clientY : 0; }, { passive: true });
      overlay.addEventListener('touchmove', (e) => { const t = e.touches[0], dy = y - (t ? t.clientY : y); if (!body || !body.contains(e.target) || atEdge(dy)) e.preventDefault(); }, { passive: false });
    }
    _key(e) {
      if (!this._popup) return;
      if (e.key === 'Escape') { e.stopPropagation(); this._closePopup(); return; }
      if (e.key === 'Tab') {
        const dlg = this._root.querySelector('.dialog'); if (!dlg) return;
        const f = [].slice.call(dlg.querySelectorAll('button')); if (!f.length) return;
        const first = f[0], last = f[f.length - 1], act = this.shadowRoot.activeElement;
        if (e.shiftKey && act === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && act === last) { e.preventDefault(); first.focus(); }
        else if (!dlg.contains(act)) { e.preventDefault(); first.focus(); }
      }
    }
  }

  /* ----------------------------------------------------------- the editor */
  const EDITOR_CSS = `
:host{display:block;color:var(--primary-text-color,#19221E);font-family:var(--ha-font-family-body,Roboto,Arial,sans-serif)}
*{box-sizing:border-box}
.ed{font-size:14px}
button,input,select{font:inherit;color:inherit}
.tabs{display:flex;gap:5px;overflow-x:auto;padding-bottom:14px;border-bottom:1px solid var(--divider-color,#E1E5E1)}
.tab{border:0;background:none;color:var(--secondary-text-color,#68716C);border-radius:13px;padding:10px 13px;white-space:nowrap;cursor:pointer}
.tab[aria-pressed="true"]{color:var(--primary-text-color,#19221E);background:var(--secondary-background-color,#F1F3EF);font-weight:650}
.heading{font-size:21px;font-weight:500;margin:25px 0 9px}
.desc{color:var(--secondary-text-color,#68716C);font-size:13px;line-height:1.5;margin-bottom:24px}
.field{display:block;margin:20px 0}
.label{font-size:14px;margin-bottom:10px}
.input{display:block;width:100%;background:var(--secondary-background-color,#F1F3EF);color:var(--primary-text-color,#19221E);border:0;border-bottom:1px solid var(--divider-color,#E1E5E1);padding:14px 13px;min-height:50px;border-radius:11px 11px 0 0}
.row{border-bottom:1px solid var(--divider-color,#E1E5E1);padding:13px 0;display:flex;align-items:center;justify-content:space-between;gap:15px}
.row label{flex:1;min-width:0}
.row input[type=checkbox]{width:18px;height:18px;accent-color:var(--primary-color,#064E3B);flex:none}
.muted{font-size:12px;line-height:1.5;color:var(--secondary-text-color,#68716C)}
.tiny{font-size:11px;color:var(--secondary-text-color,#68716C);margin:9px 0}
`;

  class PresenceLensCardEditor extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: 'open' });
      this._config = {}; this._hass = null; this._tab = 'sensor'; this._last = ''; this._built = false;
      this.shadowRoot.addEventListener('click', (e) => { const t = e.target.closest('[data-tab]'); if (t) { this._tab = t.dataset.tab; this._render(); } });
      this.shadowRoot.addEventListener('change', (e) => this._change(e));
      this.shadowRoot.addEventListener('input', (e) => this._input(e));
    }
    setConfig(config) {
      const j = JSON.stringify(config || {});
      if (this._built && j === this._last) return;
      this._config = clone(config || {}); this._last = j; this._render();
    }
    set hass(h) {
      const first = !this._hass; this._hass = h;
      if (first && this._built) this._render();
      else this.shadowRoot.querySelectorAll('ha-selector').forEach((s) => { s.hass = h; });
    }
    get hass() { return this._hass; }

    _emit(cfg) {
      this._config = cfg; this._last = JSON.stringify(cfg);
      this.dispatchEvent(new CustomEvent('config-changed', { detail: { config: cfg }, bubbles: true, composed: true }));
    }
    _norm() { try { return normalizeConfig(this._config); } catch (e) { return normalizeConfig({}); } }
    _set(key, value) { const c = clone(this._config); if (value === undefined || value === '' || value === null) delete c[key]; else c[key] = value; this._emit(c); }
    _it() { const h = this._hass; return !h || lower((h.locale && h.locale.language) || h.language || 'it').indexOf('it') === 0; }

    _siblings(entityId) {
      const h = this._hass, reg = h && h.entities && entityId ? h.entities[entityId] : null;
      if (!reg || !reg.device_id) return null;
      return Object.keys(h.entities).filter((id) => id !== entityId && h.entities[id].device_id === reg.device_id);
    }
    _fieldHTML(label, inner, help) { return '<div class="field"><div class="label">' + esc(label) + '</div>' + inner + (help ? '<div class="tiny">' + esc(help) + '</div>' : '') + '</div>'; }
    _checkHTML(id, label, help, on) {
      return '<div class="row"><label for="' + id + '">' + esc(label) + (help ? '<div class="muted">' + esc(help) + '</div>' : '') + '</label><input type="checkbox" id="' + id + '" ' + (on ? 'checked' : '') + '></div>';
    }
    _opts(list, cur) { return list.map((o) => '<option value="' + o[0] + '" ' + (cur === o[0] ? 'selected' : '') + '>' + esc(o[1]) + '</option>').join(''); }
    _tabSensor(it) {
      return '<div class="heading">' + (it ? 'Sensore di presenza' : 'Presence sensor') + '</div><div class="desc">' + (it
        ? 'Scegli il sensore di presenza. Se non ne scegli nessuno la card mostra un esempio. Gli altri campi sono facoltativi: se manca un’entità, la relativa informazione non viene mostrata.'
        : 'Choose the presence sensor. With none selected the card shows an example. The other fields are optional: if an entity is missing, its information is simply not shown.') + '</div>' +
        this._fieldHTML(it ? 'Sensore (binary_sensor)' : 'Sensor (binary_sensor)', '<div data-slot="entity"></div>') +
        this._fieldHTML(it ? 'Nome (facoltativo)' : 'Name (optional)', '<input class="input" type="text" id="name" maxlength="60" value="' + esc(this._config.name || '') + '">', it ? 'Se vuoto la card usa «Sensore presenza».' : 'If empty the card uses “Presence sensor”.') +
        '<div class="heading">' + (it ? 'Entità del radar (facoltative)' : 'Radar entities (optional)') + '</div><div class="desc">' + (it
          ? 'Se il sensore ha altre entità (distanza, soglie, sensibilità) puoi sceglierle qui. Quando Home Assistant lo permette, l’elenco mostra solo le entità dello stesso dispositivo.'
          : 'If the sensor has other entities (distance, thresholds, sensitivity) pick them here. When Home Assistant allows it, the list only shows entities of the same device.') + '</div>' +
        this._fieldHTML(it ? 'Distanza rilevata' : 'Detected distance', '<div data-slot="distance_entity"></div>') +
        this._fieldHTML(it ? 'Distanza minima di rilevamento' : 'Minimum detection distance', '<div data-slot="min_distance_entity"></div>') +
        this._fieldHTML(it ? 'Distanza massima di rilevamento' : 'Maximum detection distance', '<div data-slot="max_distance_entity"></div>') +
        this._fieldHTML(it ? 'Sensibilità' : 'Sensitivity', '<div data-slot="sensitivity_entity"></div>');
    }
    _tabLook(n, it) {
      return '<div class="heading">' + (it ? 'Aspetto Edera' : 'Edera look') + '</div><div class="desc">' + (it ? 'Titolo, intestazione e tema, coerenti con le altre card.' : 'Title, label and theme, consistent with the other cards.') + '</div>' +
        this._fieldHTML(it ? 'Intestazione superiore' : 'Top label', '<input class="input" type="text" id="eyebrow" maxlength="60" value="' + esc(n.eyebrow) + '">') +
        this._fieldHTML(it ? 'Titolo' : 'Title', '<input class="input" type="text" id="title" maxlength="60" value="' + esc(n.title) + '">', it ? 'Se vuoto: «Occupazione stanza». Il punto verde finale lo aggiunge la card.' : 'If empty: “Room occupancy”. The green dot is added by the card.') +
        this._fieldHTML(it ? 'Testo del riquadro percentuale' : 'Percentage tile text', '<input class="input" type="text" id="occlabel" maxlength="40" value="' + esc(n.occupancy_label) + '">', it ? 'Se vuoto: «Occupazione 24 h».' : 'If empty: “Occupancy 24 h”.') +
        this._checkHTML('show-eyebrow', it ? 'Mostra intestazione superiore' : 'Show top label', '', n.show_eyebrow) +
        this._checkHTML('show-title', it ? 'Mostra titolo' : 'Show title', '', n.show_title) +
        this._fieldHTML(it ? 'Tema' : 'Theme', '<select class="input" id="theme">' + this._opts([['auto', it ? 'Automatico (Home Assistant)' : 'Automatic (Home Assistant)'], ['light', 'Light Edera'], ['dark', 'Dark Edera']], n.theme_mode) + '</select>');
    }
    _tabPanel(n, it) {
      return '<div class="heading">' + (it ? 'Contenuto della card' : 'Card content') + '</div><div class="desc">' + (it ? 'Scegli cosa mostrare sotto lo stato. Storico e occupazione richiedono Recorder; senza, queste parti non compaiono.' : 'Choose what to show under the state. History and occupancy need Recorder; without it those parts are not shown.') + '</div>' +
        this._fieldHTML(it ? 'Pannello' : 'Panel', '<select class="input" id="panel">' + this._opts([['radar', it ? 'Radar con numeri' : 'Radar with numbers'], ['tiles', it ? 'Solo riquadri numerici' : 'Number tiles only'], ['none', it ? 'Nessuno' : 'None']], n.panel) + '</select>', it ? 'Il radar richiede un’entità di distanza; senza, la card mostra i riquadri disponibili.' : 'The radar needs a distance entity; without one the card shows the tiles that are available.') +
        this._checkHTML('show-strip', it ? 'Striscia delle ultime 24 ore' : 'Last 24 hours strip', it ? 'Spenta di default: aumenta l’altezza della card.' : 'Off by default: it makes the card taller.', n.show_strip) +
        this._fieldHTML(it ? 'Formato di «Assente da»' : '“Absent for” format', '<select class="input" id="since">' + this._opts([['duration', it ? 'Durata (3 h 20 min)' : 'Duration (3 h 20 min)'], ['time', it ? 'Orario (dalle 15:35)' : 'Time (since 15:35)']], n.since_format) + '</select>') +
        this._fieldHTML(it ? 'Portata del radar in metri (0 = automatica)' : 'Radar range in metres (0 = automatic)', '<input class="input" type="number" id="rmax" min="0" max="100" step="0.5" value="' + n.radar_max + '">', it ? 'Usata solo se non è scelta un’entità con la distanza massima; senza, il radar usa 6 m.' : 'Only used when no maximum distance entity is selected; otherwise the radar uses 6 m.') +
        '<div class="muted" style="margin-top:18px">' + (it ? 'La card è di sola lettura: non invia mai comandi. Uno stato non disponibile non conta mai come assenza.' : 'The card is read-only: it never sends commands. An unavailable state never counts as absence.') + '</div>';
    }
    _mount(slot, selector, value, cb) {
      if (!slot) return;
      const el = document.createElement('ha-selector');
      el.hass = this._hass; el.selector = selector; el.value = value; el.required = false;
      el.addEventListener('value-changed', (ev) => { ev.stopPropagation(); cb(ev.detail ? ev.detail.value : undefined); });
      slot.appendChild(el);
    }
    _render() {
      const n = this._norm(), t = this._tab, it = this._it();
      const act = this.shadowRoot.activeElement ? this.shadowRoot.activeElement.id : '';
      const tabs = [['sensor', it ? 'Sensore' : 'Sensor'], ['look', it ? 'Aspetto' : 'Look'], ['panel', it ? 'Contenuto' : 'Content']];
      this.shadowRoot.innerHTML = '<style>' + EDITOR_CSS + '</style><div class="ed"><div class="tabs" role="group" aria-label="' + (it ? 'Sezioni' : 'Sections') + '">' +
        tabs.map((a) => '<button type="button" class="tab" data-tab="' + a[0] + '" id="t-' + a[0] + '" aria-pressed="' + (t === a[0]) + '">' + a[1] + '</button>').join('') + '</div>' +
        (t === 'sensor' ? this._tabSensor(it) : t === 'look' ? this._tabLook(n, it) : this._tabPanel(n, it)) + '</div>';
      this._built = true;
      if (t === 'sensor') {
        const sl = (name) => this.shadowRoot.querySelector('[data-slot="' + name + '"]');
        this._mount(sl('entity'), { entity: { domain: 'binary_sensor' } }, n.entity || undefined, (v) => this._set('entity', v || undefined));
        const sib = this._siblings(n.entity);
        const sel = (domains) => { const e = { domain: domains }; if (sib && sib.length) e.include_entities = sib; return { entity: e }; };
        [['distance_entity', ['sensor', 'number']], ['min_distance_entity', ['sensor', 'number']], ['max_distance_entity', ['sensor', 'number']], ['sensitivity_entity', ['sensor', 'number', 'select']]].forEach((f) => {
          this._mount(sl(f[0]), sel(f[1]), n[f[0]] || undefined, (v) => this._set(f[0], v || undefined));
        });
      }
      if (act) { const el = this.shadowRoot.getElementById(act); if (el && !el.disabled) el.focus({ preventScroll: true }); }
    }
    _change(e) {
      const el = e.target, c = clone(this._config);
      if (el.id === 'show-eyebrow') { c.show_eyebrow = el.checked; this._emit(c); return; }
      if (el.id === 'show-title') { c.show_title = el.checked; this._emit(c); return; }
      if (el.id === 'show-strip') { c.show_strip = el.checked; this._emit(c); return; }
      if (el.id === 'theme') { c.theme_mode = el.value; this._emit(c); return; }
      if (el.id === 'panel') { c.panel = el.value; this._emit(c); return; }
      if (el.id === 'since') { c.since_format = el.value; this._emit(c); return; }
      if (el.id === 'rmax') { const v = parseFloat(el.value); if (isFinite(v) && v > 0) c.radar_max = Math.min(100, v); else delete c.radar_max; this._emit(c); }
    }
    _input(e) {
      const el = e.target;
      if (el.id === 'eyebrow') { const c = clone(this._config); c.eyebrow = el.value; this._emit(c); }
      else if (el.id === 'title') this._set('title', el.value);
      else if (el.id === 'occlabel') this._set('occupancy_label', el.value);
      else if (el.id === 'name') this._set('name', el.value);
    }
  }

  if (!customElements.get(TAG)) customElements.define(TAG, PresenceLensCard);
  if (!customElements.get(EDITOR_TAG)) customElements.define(EDITOR_TAG, PresenceLensCardEditor);
  window.customCards = window.customCards || [];
  if (!window.customCards.some((c) => c.type === TAG)) {
    window.customCards.push({
      type: TAG, name: 'Presence Lens Card',
      description: 'Presence and radar sensor: state, time since the last change, mini radar and 24-hour history.',
      preview: true
    });
  }
  // eslint-disable-next-line no-console
  console.info('%c PRESENCE-LENS-CARD %c ' + VERSION + ' ', 'color:#fff;background:#0a7156;font-weight:700', 'color:#0a7156;background:#fff');
})();
