export type AssetType = 'font' | 'image';
export type Params = Record<string, string | number | boolean>;

export interface ActiveVideoSlot {
  displayName?: string;
  dominant?: boolean;
  id: string;
  paused?: boolean;
  type?: 'camera' | 'screenshare';
}

export interface VideoInputSlot {
  active: boolean;
  displayName: string;
  element?: HTMLVideoElement;
  id: string;
  sessionId: string;
  track?: MediaStreamTrack;
  type: 'camera' | 'screenshare';
}

export interface VCSSources {
  videoSlots: (VideoInputSlot | boolean)[];
  assetImages: Record<string, string>;
}

export type GetAssetUrlCb = (
  name: string,
  namespace: string,
  type: AssetType
) => string;

export interface VCSOptions {
  enablePreload: boolean;
  errorCb(error: any): void;
  fps: number;
  getAssetUrlCb: GetAssetUrlCb;
  scaleFactor: number;
}

export interface VCSApi {
  setActiveVideoInputSlots(slots: (ActiveVideoSlot | boolean)[]): void;
  setParamValue(key: string, value: any): void;
  setScaleFactor(scaleFactor: number): void;
  stop(): void;
  updateImageSources(sources: VCSSources): void;
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
  aspectRatio?: number;
  fps?: number;
  viewportSize?: ViewportSize;
  defaultParams?: Params;
  maxVideoInputSlots?: number;
  getAssetUrlCb: GetAssetUrlCb;
  callbacks?: VCSCallbacks;
  participantIds?: string[];
}

export type Merge = 'replace' | 'merge';
