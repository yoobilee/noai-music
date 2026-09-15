import { type FormEvent, useEffect, useState } from 'react';
import { browser, type Browser } from 'wxt/browser';

import { parseBlocklistArtistInput, parseBlocklistChannelInput, parseBlocklistTrackInput } from '@/blocklist/identityInput';
import { addBlockedArtist, addBlockedChannel, addBlockedTrack, loadBlocklist, readBlocklistChange, removeBlockedArtist, removeBlockedChannel, removeBlockedTrack, saveBlocklist } from '@/storage/blocklist';
import { DEFAULT_BLOCKLIST, type PersistedBlocklist } from '@/storage/contracts';

type Kind = 'track' | 'artist' | 'channel';
type BlocklistMessageKey =
  | 'trackBlocklistInputLabel' | 'artistBlocklistInputLabel' | 'channelBlocklistInputLabel'
  | 'trackAllowlistInputPlaceholder' | 'artistAllowlistInputPlaceholder' | 'channelBlocklistInputPlaceholder'
  | 'addTrackBlocklist' | 'addArtistBlocklist' | 'addChannelBlocklist'
  | 'invalidTrackIdentity' | 'invalidArtistIdentity' | 'invalidChannelIdentity'
  | 'blockedTracksHeading' | 'blockedArtistsHeading' | 'blockedChannelsHeading'
  | 'blocklistDescription' | 'emptyBlocklist' | 'removeBlocklistItem' | 'blocklistSaveError'
  | 'blocklistHeading' | 'blockedTrackCount' | 'blockedArtistCount' | 'blockedChannelCount';
const config = {
  track: { input: 'blocklist-track-input', label: 'trackBlocklistInputLabel', placeholder: 'trackAllowlistInputPlaceholder', add: 'addTrackBlocklist', invalid: 'invalidTrackIdentity' },
  artist: { input: 'blocklist-artist-input', label: 'artistBlocklistInputLabel', placeholder: 'artistAllowlistInputPlaceholder', add: 'addArtistBlocklist', invalid: 'invalidArtistIdentity' },
  channel: { input: 'blocklist-channel-input', label: 'channelBlocklistInputLabel', placeholder: 'channelBlocklistInputPlaceholder', add: 'addChannelBlocklist', invalid: 'invalidChannelIdentity' },
} as const;

const message = (key: BlocklistMessageKey, substitution?: string) => browser.i18n.getMessage(key, substitution);

export function BlocklistManager({ compact = false }: { compact?: boolean }) {
  const [blocklist, setBlocklist] = useState<PersistedBlocklist>(DEFAULT_BLOCKLIST);
  const [inputs, setInputs] = useState<Record<Kind, string>>({ track: '', artist: '', channel: '' });
  const [errors, setErrors] = useState<Record<Kind, boolean>>({ track: false, artist: false, channel: false });
  const [status, setStatus] = useState<'loading' | 'ready' | 'saving' | 'error'>('loading');

  useEffect(() => {
    let active = true;
    void loadBlocklist(browser.storage.local).then((value) => { if (active) { setBlocklist(value); setStatus('ready'); } }).catch(() => { if (active) setStatus('error'); });
    const listener = (changes: Record<string, Browser.storage.StorageChange>, areaName: string) => {
      const changed = readBlocklistChange(changes, areaName);
      if (changed) { setBlocklist(changed); setStatus('ready'); }
    };
    browser.storage.onChanged.addListener(listener);
    return () => { active = false; browser.storage.onChanged.removeListener(listener); };
  }, []);

  const persist = (next: PersistedBlocklist) => {
    setBlocklist(next); setStatus('saving');
    void saveBlocklist(browser.storage.local, next).then(() => setStatus('ready')).catch(() => setStatus('error'));
  };
  const add = (kind: Kind, event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parser = kind === 'track' ? parseBlocklistTrackInput : kind === 'artist' ? parseBlocklistArtistInput : parseBlocklistChannelInput;
    const id = parser(inputs[kind]);
    if (!id) { setErrors((value) => ({ ...value, [kind]: true })); return; }
    setErrors((value) => ({ ...value, [kind]: false }));
    setInputs((value) => ({ ...value, [kind]: '' }));
    persist(kind === 'track' ? addBlockedTrack(blocklist, { videoId: id }) : kind === 'artist' ? addBlockedArtist(blocklist, { artistId: id }) : addBlockedChannel(blocklist, { channelId: id }));
  };
  const disabled = status === 'loading' || status === 'saving';
  const lists = {
    track: blocklist.tracks.map((item) => ({ id: item.videoId, label: item.title })),
    artist: blocklist.artists.map((item) => ({ id: item.artistId, label: item.name })),
    channel: blocklist.channels.map((item) => ({ id: item.channelId, label: item.name })),
  };
  const headings = { track: 'blockedTracksHeading', artist: 'blockedArtistsHeading', channel: 'blockedChannelsHeading' } as const;
  const remove = (kind: Kind, id: string) => persist(kind === 'track' ? removeBlockedTrack(blocklist, id) : kind === 'artist' ? removeBlockedArtist(blocklist, id) : removeBlockedChannel(blocklist, id));
  const contents = <>
    <p className="settings-panel__description">{message('blocklistDescription')}</p>
    {(['track', 'artist', 'channel'] as const).map((kind) => <form className="allowlist-manager__form" key={kind} onSubmit={(event) => add(kind, event)}>
      <label htmlFor={config[kind].input}>{message(config[kind].label)}</label>
      <div className="allowlist-manager__input-row">
        <input aria-describedby={errors[kind] ? `${config[kind].input}-error` : undefined} aria-invalid={errors[kind]} disabled={disabled} id={config[kind].input} onChange={(event) => { const next = event.currentTarget.value; setInputs((value) => ({ ...value, [kind]: next })); }} placeholder={message(config[kind].placeholder)} type="text" value={inputs[kind]} />
        <button disabled={disabled} type="submit">{message(config[kind].add)}</button>
      </div>
      {errors[kind] ? <p className="allowlist-manager__field-error" id={`${config[kind].input}-error`}>{message(config[kind].invalid)}</p> : null}
    </form>)}
    {(['track', 'artist', 'channel'] as const).map((kind) => <div className="allowlist-manager__list-group" key={kind}>
      <h3>{message(headings[kind])}</h3>
      {lists[kind].length === 0 ? <p className="allowlist-manager__empty">{message('emptyBlocklist')}</p> : <ul>{lists[kind].map((item) => <li key={item.id}>
        <span className="allowlist-manager__identity">{item.label ? <span>{item.label}</span> : null}<code>{item.id}</code></span>
        <button aria-label={`${message('removeBlocklistItem')}: ${item.label ?? item.id}`} disabled={disabled} onClick={() => remove(kind, item.id)} type="button">{message('removeBlocklistItem')}</button>
      </li>)}</ul>}
    </div>)}
    {status === 'error' ? <p className="settings-panel__error" role="alert">{message('blocklistSaveError')}</p> : null}
  </>;

  if (compact) return <section aria-labelledby="blocklist-heading" className="allowlist-manager allowlist-manager--compact blocklist-manager"><details className="allowlist-manager__disclosure blocklist-manager__disclosure"><summary><span className="allowlist-manager__summary-heading" id="blocklist-heading">{message('blocklistHeading')}</span><span aria-live="polite" className="allowlist-manager__counts"><span>{message('blockedTrackCount', String(blocklist.tracks.length))}</span><span>{message('blockedArtistCount', String(blocklist.artists.length))}</span><span>{message('blockedChannelCount', String(blocklist.channels.length))}</span></span><span aria-hidden="true" className="allowlist-manager__chevron">⌄</span></summary><div className="allowlist-manager__compact-body">{contents}</div></details></section>;
  return <section aria-labelledby="blocklist-heading" className="allowlist-manager blocklist-manager"><h2 id="blocklist-heading">{message('blocklistHeading')}</h2>{contents}</section>;
}
