import type {
  MediaCandidateSnapshot,
  OfficialDisclosureEvidence,
} from '@/detection/contracts';
import type { SupportedSite } from '@/shared/sites';

export interface DomMediaCandidate {
  element: Element;
  snapshot: MediaCandidateSnapshot;
}

export interface SiteAdapter {
  readonly site: SupportedSite;
  getRouteKey(url: URL): string;
  collectCandidates(root: ParentNode): readonly DomMediaCandidate[];
  readOfficialDisclosures(
    candidate: DomMediaCandidate,
  ): readonly OfficialDisclosureEvidence[];
  observePage(onChange: (roots: readonly ParentNode[]) => void): () => void;
}
