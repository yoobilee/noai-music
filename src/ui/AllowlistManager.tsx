import { type FormEvent, useEffect, useState } from 'react';
import { browser, type Browser } from 'wxt/browser';

import {
  parseAllowlistArtistInput,
  parseAllowlistTrackInput,
} from '@/allowlist/identityInput';
import {
  addAllowedArtist,
  addAllowedTrack,
  loadAllowlist,
  readAllowlistChange,
  removeAllowedArtist,
  removeAllowedTrack,
  saveAllowlist,
} from '@/storage/allowlist';
import {
  DEFAULT_ALLOWLIST,
  type PersistedAllowlist,
} from '@/storage/contracts';

type AllowlistMessageKey =
  | 'allowlistHeading'
  | 'allowlistDescription'
  | 'allowedTrackCount'
  | 'allowedArtistCount'
  | 'allowedTracksHeading'
  | 'allowedArtistsHeading'
  | 'trackAllowlistInputLabel'
  | 'trackAllowlistInputPlaceholder'
  | 'artistAllowlistInputLabel'
  | 'artistAllowlistInputPlaceholder'
  | 'addTrackAllowlist'
  | 'addArtistAllowlist'
  | 'removeAllowlistItem'
  | 'emptyAllowlist'
  | 'invalidTrackIdentity'
  | 'invalidArtistIdentity'
  | 'allowlistSaveError';

function message(
  key: AllowlistMessageKey,
  substitutions?: string | string[],
): string {
  return browser.i18n.getMessage(key, substitutions);
}

interface AllowlistManagerProps {
  compact?: boolean;
}

export function AllowlistManager({ compact = false }: AllowlistManagerProps) {
  const [allowlist, setAllowlist] =
    useState<PersistedAllowlist>(DEFAULT_ALLOWLIST);
  const [trackInput, setTrackInput] = useState('');
  const [artistInput, setArtistInput] = useState('');
  const [trackError, setTrackError] = useState(false);
  const [artistError, setArtistError] = useState(false);
  const [status, setStatus] = useState<'loading' | 'ready' | 'saving' | 'error'>(
    'loading',
  );

  useEffect(() => {
    let active = true;
    void loadAllowlist(browser.storage.local)
      .then((loaded) => {
        if (active) {
          setAllowlist(loaded);
          setStatus('ready');
        }
      })
      .catch(() => {
        if (active) {
          setStatus('error');
        }
      });

    const handleStorageChange = (
      changes: Record<string, Browser.storage.StorageChange>,
      areaName: string,
    ) => {
      const changed = readAllowlistChange(changes, areaName);
      if (changed !== null) {
        setAllowlist(changed);
        setStatus('ready');
      }
    };
    browser.storage.onChanged.addListener(handleStorageChange);

    return () => {
      active = false;
      browser.storage.onChanged.removeListener(handleStorageChange);
    };
  }, []);

  const persist = (next: PersistedAllowlist) => {
    setAllowlist(next);
    setStatus('saving');
    void saveAllowlist(browser.storage.local, next)
      .then(() => setStatus('ready'))
      .catch(() => setStatus('error'));
  };

  const addTrack = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const videoId = parseAllowlistTrackInput(trackInput);
    if (videoId === null) {
      setTrackError(true);
      return;
    }

    setTrackError(false);
    setTrackInput('');
    persist(addAllowedTrack(allowlist, { videoId }));
  };

  const addArtist = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const artistId = parseAllowlistArtistInput(artistInput);
    if (artistId === null) {
      setArtistError(true);
      return;
    }

    setArtistError(false);
    setArtistInput('');
    persist(addAllowedArtist(allowlist, { artistId }));
  };

  const disabled = status === 'loading' || status === 'saving';

  const contents = (
    <>
      <p className="settings-panel__description">
        {message('allowlistDescription')}
      </p>

      <form className="allowlist-manager__form" onSubmit={addTrack}>
        <label htmlFor="allowlist-track-input">
          {message('trackAllowlistInputLabel')}
        </label>
        <div className="allowlist-manager__input-row">
          <input
            aria-describedby={trackError ? 'allowlist-track-error' : undefined}
            aria-invalid={trackError}
            disabled={disabled}
            id="allowlist-track-input"
            onChange={(event) => setTrackInput(event.currentTarget.value)}
            placeholder={message('trackAllowlistInputPlaceholder')}
            type="text"
            value={trackInput}
          />
          <button disabled={disabled} type="submit">
            {message('addTrackAllowlist')}
          </button>
        </div>
        {trackError ? (
          <p className="allowlist-manager__field-error" id="allowlist-track-error">
            {message('invalidTrackIdentity')}
          </p>
        ) : null}
      </form>

      <form className="allowlist-manager__form" onSubmit={addArtist}>
        <label htmlFor="allowlist-artist-input">
          {message('artistAllowlistInputLabel')}
        </label>
        <div className="allowlist-manager__input-row">
          <input
            aria-describedby={artistError ? 'allowlist-artist-error' : undefined}
            aria-invalid={artistError}
            disabled={disabled}
            id="allowlist-artist-input"
            onChange={(event) => setArtistInput(event.currentTarget.value)}
            placeholder={message('artistAllowlistInputPlaceholder')}
            type="text"
            value={artistInput}
          />
          <button disabled={disabled} type="submit">
            {message('addArtistAllowlist')}
          </button>
        </div>
        {artistError ? (
          <p
            className="allowlist-manager__field-error"
            id="allowlist-artist-error"
          >
            {message('invalidArtistIdentity')}
          </p>
        ) : null}
      </form>

      <div className="allowlist-manager__list-group">
        <h3>{message('allowedTracksHeading')}</h3>
        {allowlist.tracks.length === 0 ? (
          <p className="allowlist-manager__empty">{message('emptyAllowlist')}</p>
        ) : (
          <ul>
            {allowlist.tracks.map((track) => (
              <li key={track.videoId}>
                <span className="allowlist-manager__identity">
                  {track.title === undefined ? null : <span>{track.title}</span>}
                  <code>{track.videoId}</code>
                </span>
                <button
                  aria-label={`${message('removeAllowlistItem')}: ${track.title ?? track.videoId}`}
                  disabled={disabled}
                  onClick={() =>
                    persist(removeAllowedTrack(allowlist, track.videoId))
                  }
                  type="button"
                >
                  {message('removeAllowlistItem')}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="allowlist-manager__list-group">
        <h3>{message('allowedArtistsHeading')}</h3>
        {allowlist.artists.length === 0 ? (
          <p className="allowlist-manager__empty">{message('emptyAllowlist')}</p>
        ) : (
          <ul>
            {allowlist.artists.map((artist) => (
              <li key={artist.artistId}>
                <span className="allowlist-manager__identity">
                  {artist.name === undefined ? null : <span>{artist.name}</span>}
                  <code>{artist.artistId}</code>
                </span>
                <button
                  aria-label={`${message('removeAllowlistItem')}: ${artist.name ?? artist.artistId}`}
                  disabled={disabled}
                  onClick={() =>
                    persist(removeAllowedArtist(allowlist, artist.artistId))
                  }
                  type="button"
                >
                  {message('removeAllowlistItem')}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {status === 'error' ? (
        <p className="settings-panel__error" role="alert">
          {message('allowlistSaveError')}
        </p>
      ) : null}
    </>
  );

  if (compact) {
    return (
      <section
        aria-labelledby="allowlist-heading"
        className="allowlist-manager allowlist-manager--compact"
      >
        <details className="allowlist-manager__disclosure">
          <summary>
            <span
              className="allowlist-manager__summary-heading"
              id="allowlist-heading"
            >
              {message('allowlistHeading')}
            </span>
            <span aria-live="polite" className="allowlist-manager__counts">
              <span>
                {message('allowedTrackCount', String(allowlist.tracks.length))}
              </span>
              <span>
                {message(
                  'allowedArtistCount',
                  String(allowlist.artists.length),
                )}
              </span>
            </span>
            <span aria-hidden="true" className="allowlist-manager__chevron">⌄</span>
          </summary>
          <div className="allowlist-manager__compact-body">{contents}</div>
        </details>
      </section>
    );
  }

  return (
    <section aria-labelledby="allowlist-heading" className="allowlist-manager">
      <h2 id="allowlist-heading">{message('allowlistHeading')}</h2>
      {contents}
    </section>
  );
}
