import { type FormEvent, useEffect, useState } from 'react';
import { browser, type Browser } from 'wxt/browser';

import {
  parseBlocklistArtistInput,
  parseBlocklistChannelInput,
  parseBlocklistTrackInput,
} from '@/blocklist/identityInput';
import {
  addBlockedArtist,
  addBlockedChannel,
  addBlockedTrack,
  loadBlocklist,
  readBlocklistChange,
  removeBlockedArtist,
  removeBlockedChannel,
  removeBlockedTrack,
  saveBlocklist,
} from '@/storage/blocklist';
import {
  DEFAULT_BLOCKLIST,
  type PersistedBlocklist,
} from '@/storage/contracts';
import {
  RuleInputForm,
  RuleListGroup,
  UserRuleSection,
} from '@/ui/UserRuleManager';
import { useMessage } from '@/ui/I18nContext';

type Kind = 'track' | 'artist' | 'channel';
type BlocklistMessageKey =
  | 'addArtistBlocklist'
  | 'addChannelBlocklist'
  | 'addTrackBlocklist'
  | 'artistAllowlistInputPlaceholder'
  | 'artistBlocklistInputLabel'
  | 'blockedArtistsHeading'
  | 'blockedChannelsHeading'
  | 'blockedTracksHeading'
  | 'blocklistDescription'
  | 'blocklistHeading'
  | 'blocklistSaveError'
  | 'blocklistSummaryCount'
  | 'blocklistSummaryDescription'
  | 'channelBlocklistInputLabel'
  | 'channelBlocklistInputPlaceholder'
  | 'emptyBlocklist'
  | 'invalidArtistIdentity'
  | 'invalidChannelIdentity'
  | 'invalidTrackIdentity'
  | 'removeBlocklistItem'
  | 'trackAllowlistInputPlaceholder'
  | 'trackBlocklistInputLabel';

const config = {
  track: {
    add: 'addTrackBlocklist',
    input: 'blocklist-track-input',
    invalid: 'invalidTrackIdentity',
    label: 'trackBlocklistInputLabel',
    placeholder: 'trackAllowlistInputPlaceholder',
  },
  artist: {
    add: 'addArtistBlocklist',
    input: 'blocklist-artist-input',
    invalid: 'invalidArtistIdentity',
    label: 'artistBlocklistInputLabel',
    placeholder: 'artistAllowlistInputPlaceholder',
  },
  channel: {
    add: 'addChannelBlocklist',
    input: 'blocklist-channel-input',
    invalid: 'invalidChannelIdentity',
    label: 'channelBlocklistInputLabel',
    placeholder: 'channelBlocklistInputPlaceholder',
  },
} as const;

export function BlocklistManager({ compact = false }: { compact?: boolean }) {
  const resolveMessage = useMessage();
  const message = (key: BlocklistMessageKey, substitution?: string) =>
    resolveMessage(key, substitution);
  const [blocklist, setBlocklist] =
    useState<PersistedBlocklist>(DEFAULT_BLOCKLIST);
  const [inputs, setInputs] = useState<Record<Kind, string>>({
    artist: '',
    channel: '',
    track: '',
  });
  const [errors, setErrors] = useState<Record<Kind, boolean>>({
    artist: false,
    channel: false,
    track: false,
  });
  const [status, setStatus] = useState<'loading' | 'ready' | 'saving' | 'error'>(
    'loading',
  );

  useEffect(() => {
    let active = true;
    void loadBlocklist(browser.storage.local)
      .then((value) => {
        if (active) {
          setBlocklist(value);
          setStatus('ready');
        }
      })
      .catch(() => {
        if (active) setStatus('error');
      });

    const listener = (
      changes: Record<string, Browser.storage.StorageChange>,
      areaName: string,
    ) => {
      const changed = readBlocklistChange(changes, areaName);
      if (changed !== null) {
        setBlocklist(changed);
        setStatus('ready');
      }
    };
    browser.storage.onChanged.addListener(listener);

    return () => {
      active = false;
      browser.storage.onChanged.removeListener(listener);
    };
  }, []);

  const persist = (next: PersistedBlocklist) => {
    setBlocklist(next);
    setStatus('saving');
    void saveBlocklist(browser.storage.local, next)
      .then(() => setStatus('ready'))
      .catch(() => setStatus('error'));
  };

  const add = (kind: Kind, event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const next = (() => {
      if (kind === 'track') {
        const videoId = parseBlocklistTrackInput(inputs.track);
        return videoId === null
          ? null
          : addBlockedTrack(blocklist, { videoId });
      }
      if (kind === 'artist') {
        const artistId = parseBlocklistArtistInput(inputs.artist);
        return artistId === null
          ? null
          : addBlockedArtist(blocklist, { artistId });
      }
      const channel = parseBlocklistChannelInput(inputs.channel);
      return channel === null ? null : addBlockedChannel(blocklist, channel);
    })();

    if (next === null) {
      setErrors((value) => ({ ...value, [kind]: true }));
      return;
    }
    setErrors((value) => ({ ...value, [kind]: false }));
    setInputs((value) => ({ ...value, [kind]: '' }));
    persist(next);
  };

  const disabled = status === 'loading' || status === 'saving';
  const headingLevel = compact ? 'h3' : 'h4';
  const removeText = message('removeBlocklistItem');
  const lists = {
    track: blocklist.tracks.map((item) => ({
      id: item.videoId,
      label: item.title,
      onRemove: () => persist(removeBlockedTrack(blocklist, item.videoId)),
      removeLabel: `${removeText}: ${item.title ?? item.videoId}`,
      removeText,
    })),
    artist: blocklist.artists.map((item) => ({
      id: item.artistId,
      label: item.name,
      onRemove: () => persist(removeBlockedArtist(blocklist, item.artistId)),
      removeLabel: `${removeText}: ${item.name ?? item.artistId}`,
      removeText,
    })),
    channel: blocklist.channels.map((item) => {
      const id =
        item.identityType === 'channel-id' ? item.channelId : item.handle;
      return {
        id,
        label: item.name,
        onRemove: () => persist(removeBlockedChannel(blocklist, item)),
        removeLabel: `${removeText}: ${item.name ?? id}`,
        removeText,
      };
    }),
  };
  const headings = {
    artist: 'blockedArtistsHeading',
    channel: 'blockedChannelsHeading',
    track: 'blockedTracksHeading',
  } as const;

  return (
    <UserRuleSection
      className="blocklist-manager"
      compact={compact}
      description={message('blocklistDescription')}
      heading={message('blocklistHeading')}
      headingId="blocklist-heading"
      summaryCount={message(
        'blocklistSummaryCount',
        String(
          blocklist.tracks.length +
            blocklist.artists.length +
            blocklist.channels.length,
        ),
      )}
      summaryDescription={message('blocklistSummaryDescription')}
    >
      <div className="user-rule-manager__forms">
        {(['track', 'artist', 'channel'] as const).map((kind) => (
          <RuleInputForm
            buttonLabel={message(config[kind].add)}
            disabled={disabled}
            error={errors[kind]}
            errorMessage={message(config[kind].invalid)}
            inputId={config[kind].input}
            key={kind}
            label={message(config[kind].label)}
            onChange={(value) =>
              setInputs((current) => ({ ...current, [kind]: value }))
            }
            onSubmit={(event) => add(kind, event)}
            placeholder={message(config[kind].placeholder)}
            value={inputs[kind]}
          />
        ))}
      </div>

      <div className="user-rule-manager__lists">
        {(['track', 'artist', 'channel'] as const).map((kind) => (
          <RuleListGroup
            disabled={disabled}
            emptyMessage={message('emptyBlocklist')}
            heading={message(headings[kind])}
            headingLevel={headingLevel}
            items={lists[kind]}
            key={kind}
          />
        ))}
      </div>

      {status === 'error' ? (
        <p className="settings-panel__error" role="alert">
          {message('blocklistSaveError')}
        </p>
      ) : null}
    </UserRuleSection>
  );
}
