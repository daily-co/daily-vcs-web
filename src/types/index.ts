export type AssetType = 'font' | 'image';
export type Params = Record<string, string | number | boolean>;
export type VcsVideoInputType = 'camera' | 'screenshare';

export interface VideoInput {
  id: string;
  type: VcsVideoInputType;
  displayName: string;
  dominant: boolean;
  paused?: boolean;
  pausedByUser?: boolean;
  element?: HTMLVideoElement;
  track?: MediaStreamTrack;
}

export interface ActiveVideoSlot {
  id: string;
  type: VcsVideoInputType;
  displayName?: string;
  paused?: boolean;
  dominant?: boolean;
}

export interface VCSSources {
  videoSlots: (VideoInput | boolean)[];
  assetImages: Record<string, string>;
}

export type GetAssetUrlCb = (
  name: string,
  namespace: string,
  type: AssetType
) => string;

export type WebFrameCb = (
  webFrameId: string,
  webFrameOpts: any,
  containerEl: HTMLElement
) => void;

export interface VCSOptions {
  fps: number;
  scaleFactor: number;
  enablePreload: boolean;
  errorCb(error: any): void;
  getAssetUrlCb: GetAssetUrlCb;
  webFrameCb?: WebFrameCb;
}

export interface VCSPeer {
  id: string;
  displayName: string;
  video: {
    id: string;
    paused: boolean;
  };
  audio: {};
  screenshareVideo: {
    id: string;
    paused: boolean;
  };
  screenshareAudio: {};
}

export interface VCSApi {
  setActiveVideoInputSlots(slots: (ActiveVideoSlot | boolean)[]): void;
  setParamValue(key: string, value: any): void;
  setScaleFactor(scaleFactor: number): void;
  stop(): void;
  updateImageSources(sources: VCSSources): void;
  setRoomPeerDescriptionsById(peers: Map<string, VCSPeer>): void;
}

export interface VCSComposition {
  startDOMOutputAsync(
    rootEl: HTMLElement,
    width: number,
    height: number,
    sources: VCSSources,
    options: VCSOptions
  ): Promise<VCSApi>;
}

export interface ViewportSize {
  w: number;
  h: number;
}

export interface VCSCallbacks {
  onStart?(): void;
  onStop?(): void;
  onError?(error: any): void;
  onParamsChanged?(params: Params): void;
}

export interface Options {
  getAssetUrlCb: GetAssetUrlCb;
  aspectRatio?: number;
  fps?: number;
  viewportSize?: ViewportSize;
  defaultParams?: Params;
  defaultAssets?: Record<string, string>;
  maxVideoInputSlots?: number;
  webFrameCb?: WebFrameCb;
  callbacks?: VCSCallbacks;
  participantIds?: string[];
  includePausedVideo?: boolean;
}

export type Merge = 'replace' | 'merge';

export type State = 'idle' | 'started' | 'stopped' | 'error';
