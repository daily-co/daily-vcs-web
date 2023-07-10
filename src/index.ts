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

const MAX_VIDEO_INPUT_SLOTS = 20;

export default class DailyVCSWebRenderer {
  private comp!: VCSComposition;
  private rootEl!: HTMLElement;
  private viewportSize!: ViewportSize;
  private defaultParams!: Record<string, string | number | boolean>;
  private getAssetUrlCb!: GetAssetUrlCb;
  private fps = 30;
  private paramValues: Record<string, any> = {};
  private activeVideoInputSlots: (ActiveVideoSlot | boolean)[] = [];
  private scaleFactor!: number;
  private vcsApi!: VCSApi;
  private sources: {
    videoSlots: VideoInputSlot[];
    assetImages: Record<string, string>;
  } = {
    videoSlots: [],
    assetImages: {},
  };
  private maxVideoInputSlots: number = MAX_VIDEO_INPUT_SLOTS;

  constructor(comp: VCSComposition, rootEl: HTMLElement, opts: Options) {
    if (!comp || typeof comp.startDOMOutputAsync !== 'function') {
      console.error('VCSMeetingRenderer constructor needs a VCS composition');
      return;
    }
    this.comp = comp;
    this.getAssetUrlCb = opts.getAssetUrlCb ?? null;

    this.rootEl = rootEl;

    // viewportSize is the render size used by VCS.
    // for video layers, this doesn't affect resolution, as they are rendered as actual DOM elements.
    // for graphics, this sets the size of the canvas element.
    this.viewportSize = opts.viewportSize ?? { w: 1280, h: 720 };

    this.defaultParams = opts.defaultParams ?? {};

    if (opts?.maxVideoInputSlots)
      this.maxVideoInputSlots = opts.maxVideoInputSlots;

    this.recomputeOutputScaleFactor();

    for (let i = 0; i < this.maxVideoInputSlots; i++) {
      this.setActiveVideoInput(i, false);
    }
  }

  recomputeOutputScaleFactor() {
    const displayW = this.rootEl.clientWidth;
    const displayH = this.rootEl.clientHeight;
    if (!displayW || !displayH) return;

    const asp = this.viewportSize.w / this.viewportSize.h;

    if (asp >= 1) {
      // fit landscape
      this.scaleFactor = displayW / this.viewportSize.w;
    } else {
      // fit portrait
      this.scaleFactor = displayH / this.viewportSize.h;
    }
  }

  rootDisplaySizeChanged() {
    this.recomputeOutputScaleFactor();

    if (this.vcsApi) {
      this.vcsApi.setScaleFactor(this.scaleFactor);
    }
  }

  async setupDefaultSources() {
    this.sources = {
      videoSlots: [],
      assetImages: {},
    };
  }

  placeVideoSourceInDOM(el: HTMLElement, trackId: string) {
    // place element in DOM so it gets updates
    el.setAttribute('style', 'display: none;');
    if (trackId) {
      el.setAttribute('data-video-remote-track-id', trackId);
    }
    this.rootEl.appendChild(el);
  }

  async start() {
    if (!this.comp) return;

    if (!this.sources) {
      await this.setupDefaultSources();
    }

    this.vcsApi = await this.comp.startDOMOutputAsync(
      this.rootEl,
      this.viewportSize.w,
      this.viewportSize.h,
      this.sources,
      {
        errorCb: this.onError.bind(this),
        getAssetUrlCb: this.getAssetUrlCb,
        fps: this.fps,
        scaleFactor: this.scaleFactor,
        enablePreload: true,
      }
    );

    this.sendActiveVideoInputSlots();

    if (this.defaultParams) {
      for (const key in this.defaultParams) {
        this.sendParam(key, this.defaultParams[key]);
      }
    }

    this.rootDisplaySizeChanged();
  }

  stop() {
    if (!this.vcsApi) return;

    this.vcsApi.stop();
  }

  onError(error: any) {
    console.error('VCS composition error: ', error);
  }

  setActiveVideoInput(
    idx: number,
    active: boolean,
    id = '',
    name = '',
    isScreenshare = false
  ) {
    this.activeVideoInputSlots[idx] = active
      ? {
          id: id || '',
          type: isScreenshare ? 'screenshare' : 'camera',
          displayName: isScreenshare ? '' : name,
        }
      : false;
  }

  sendActiveVideoInputSlots() {
    if (!this.vcsApi) return;

    const arr = [];
    for (const activeVideoInput of this.activeVideoInputSlots) {
      if (typeof activeVideoInput === 'object') {
        arr.push(activeVideoInput);
      } else {
        arr.push(false);
      }
    }

    this.vcsApi.setActiveVideoInputSlots(arr);
  }

  sendParam(paramId: string, value: any) {
    if (!this.vcsApi) return;

    this.vcsApi.setParamValue(paramId, value);

    // retain a copy of param values so we can reset renderer to the same state
    this.paramValues[paramId] = value;
  }

  sendUpdatedConfig(conf: Record<string, any>) {
    if (!this.vcsApi) return;
    Object.entries(conf).forEach(([id, value]) => {
      this.vcsApi.setParamValue(id, value);
      this.paramValues[id] = value;
    });
  }

  sendUpdateImageSources() {
    if (!this.vcsApi) return;

    this.vcsApi.updateImageSources(this.sources);
  }

  applyTracks(videos: VideoInputSlot[]) {
    if (!this.sources || !videos) return;

    const newSlots: VideoInputSlot[] = [];

    for (const video of videos) {
      if (!video?.track) continue;

      const prevSlot = this.sources.videoSlots.find((it) => it.id === video.id);
      const videoEl = prevSlot?.element ?? document.createElement('video');
      this.placeVideoSourceInDOM(videoEl, video.track.id);
      newSlots.push({
        active: true,
        id: `videotrack_${video.track.id}`,
        element: videoEl,
        track: video.track,
        sessionId: video.sessionId,
        displayName: video.displayName,
        type: video.type,
      });
    }

    const prevSlots = this.sources.videoSlots;
    for (const ps of prevSlots) {
      if (!newSlots.some((ns) => ns.id === ps.id)) {
        ps.element?.remove();
      }
    }

    this.sources.videoSlots = newSlots;
    this.sendUpdateImageSources();

    for (let i = 0; i < this.maxVideoInputSlots; i++) {
      const slot = newSlots[i];
      this.setActiveVideoInput(
        i,
        slot?.id !== undefined,
        slot?.id,
        slot?.displayName,
        slot?.type === 'screenshare'
      );
    }
    this.sendActiveVideoInputSlots();

    this.rootDisplaySizeChanged();
  }
}
