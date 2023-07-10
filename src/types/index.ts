export type AssetType = 'font' | 'image';

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

export interface Options {
  viewportSize?: ViewportSize;
  defaultParams?: Record<string, string | number | boolean>;
  maxVideoInputSlots?: number;
  getAssetUrlCb: GetAssetUrlCb;
}
