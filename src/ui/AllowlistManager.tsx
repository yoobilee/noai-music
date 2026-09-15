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
import {
  RuleInputForm,
  RuleListGroup,
  UserRuleSection,
} from '@/ui/UserRuleManager';

type AllowlistMessageKey =
  | 'addArtistAllowlist'
  | 'addTrackAllowlist'
  | 'allowlistDescription'
  | 'allowlistHeading'
  | 'allowlistSaveError'
  | 'allowlistSummaryCount'
  | 'allowlistSummaryDescription'
  | 'allowedArtistsHeading'
  | 'allowedTracksHeading'
  | 'artistAllowlistInputLabel'
  | 'artistAllowlistInputPlaceholder'
  | 'emptyAllowlist'
  | 'invalidArtistIdentity'
  | 'invalidTrackIdentity'
  | 'removeAllowlistItem'
  | 'trackAllowlistInputLabel'
  | 'trackAllowlistInputPlaceholder';

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
        if (active) setStatus('error');
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
  const headingLevel = compact ? 'h3' : 'h4';
  const removeText = message('removeAllowlistItem');

  return (
    <UserRuleSection
      compact={compact}
      description={message('allowlistDescription')}
      heading={message('allowlistHeading')}
      headingId="allowlist-heading"
      summaryCount={message(
        'allowlistSummaryCount',
        String(allowlist.tracks.length + allowlist.artists.length),
      )}
      summaryDescription={message('allowlistSummaryDescription')}
    >
      <div className="user-rule-manager__forms">
        <RuleInputForm
          buttonLabel={message('addTrackAllowlist')}
          disabled={disabled}
          error={trackError}
          errorId="allowlist-track-error"
          errorMessage={message('invalidTrackIdentity')}
          inputId="allowlist-track-input"
          label={message('trackAllowlistInputLabel')}
          onChange={setTrackInput}
          onSubmit={addTrack}
          placeholder={message('trackAllowlistInputPlaceholder')}
          value={trackInput}
        />
        <RuleInputForm
          buttonLabel={message('addArtistAllowlist')}
          disabled={disabled}
          error={artistError}
          errorId="allowlist-artist-error"
          errorMessage={message('invalidArtistIdentity')}
          inputId="allowlist-artist-input"
          label={message('artistAllowlistInputLabel')}
          onChange={setArtistInput}
          onSubmit={addArtist}
          placeholder={message('artistAllowlistInputPlaceholder')}
          value={artistInput}
        />
      </div>

      <div className="user-rule-manager__lists">
        <RuleListGroup
          disabled={disabled}
          emptyMessage={message('emptyAllowlist')}
          heading={message('allowedTracksHeading')}
          headingLevel={headingLevel}
          items={allowlist.tracks.map((track) => ({
            id: track.videoId,
            label: track.title,
            onRemove: () =>
              persist(removeAllowedTrack(allowlist, track.videoId)),
            removeLabel: `${removeText}: ${track.title ?? track.videoId}`,
            removeText,
          }))}
        />
        <RuleListGroup
          disabled={disabled}
          emptyMessage={message('emptyAllowlist')}
          heading={message('allowedArtistsHeading')}
          headingLevel={headingLevel}
          items={allowlist.artists.map((artist) => ({
            id: artist.artistId,
            label: artist.name,
            onRemove: () =>
              persist(removeAllowedArtist(allowlist, artist.artistId)),
            removeLabel: `${removeText}: ${artist.name ?? artist.artistId}`,
            removeText,
          }))}
        />
      </div>

      {status === 'error' ? (
        <p className="settings-panel__error" role="alert">
          {message('allowlistSaveError')}
        </p>
      ) : null}
    </UserRuleSection>
  );
}
