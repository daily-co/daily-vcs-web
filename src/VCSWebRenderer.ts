import type {
  VCSComposition,
  VCSApi,
  VideoInputSlot,
  ViewportSize,
  ActiveVideoSlot,
  GetAssetUrlCb,
  Options,
  VCSCallbacks,
  Params,
} from './types';

const MAX_VIDEO_INPUT_SLOTS = 20;

/**
 * VCSWebRenderer
 * It's a wrapper around the VCSComposition to render the DOM element.
 */
export default class DailyVCSWebRenderer {
  /**
   * comp is the VCS composition.
   * for more info, see https://docs.daily.co/reference/vcs/core-concepts/composition
   */
  private comp!: VCSComposition;
  /**
   * rootEl is the DOM element where the VCS composition will be rendered.
   */
  private rootEl!: HTMLElement;
  /**
   * viewportSize is the size of the DOM element that will be rendered.
   */
  private viewportSize!: ViewportSize;
  private defaultParams!: Params;
  private getAssetUrlCb!: GetAssetUrlCb;
  /**
   * fps is the framerate of the VCS composition.
   * It defaults to 30.
   */
  private fps = 30;
  /**
   * paramValues is a map of paramId to value.
   * It's used to keep track of the current state of the VCS composition.
   */
  private paramValues: Record<string, any> = {};
  /**
   * activeVideoInputSlots is an array of active video input slots.
   * It's used to keep track of the video tracks that are currently being rendered.
   */
  private activeVideoInputSlots: (ActiveVideoSlot | boolean)[] = [];
  /**
   * scaleFactor is the scale factor used to render the VCS composition.
   * It's computed based on the viewportSize and the size of the rootEl.
   */
  private scaleFactor!: number;
  /**
   * vcsApi is the VCSApi instance returned by the VCSComposition.
   * It's used to send updates to the VCS composition.
   */
  private vcsApi!: VCSApi;
  /**
   * sources is a map of videoSlots and assetImages.
   * It's used to keep track of the video tracks and images that are currently being rendered.
   */
  private sources: {
    videoSlots: VideoInputSlot[];
    assetImages: Record<string, string>;
  } = {
    videoSlots: [],
    assetImages: {},
  };
  /**
   * maxVideoInputSlots is the maximum number of video input slots that can be rendered.
   * It defaults to 20.
   */
  private maxVideoInputSlots: number = MAX_VIDEO_INPUT_SLOTS;
  private callbacks: VCSCallbacks = {};

  /**
   * constructor
   * @param comp is the VCS composition.
   * @param rootEl is the DOM element where the VCS composition will be rendered.
   * @param opts.viewportSize is the size of the DOM element that will be rendered.
   * @param opts.defaultParams is a map of paramId to default value.
   * @param opts.getAssetUrlCb is a callback that will be called when the VCS composition needs to load an asset.
   * @param opts.maxVideoInputSlots is the maximum number of video input slots that can be rendered.
   * @param opts.fps is the framerate of the VCS composition.
   */
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

    if (opts?.fps) this.fps = opts.fps;
    if (opts?.callbacks) this.callbacks = opts.callbacks;

    this.recomputeOutputScaleFactor();

    for (let i = 0; i < this.maxVideoInputSlots; i++) {
      this.setActiveVideoInput(i, false);
    }
  }

  private recomputeOutputScaleFactor() {
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

  /**
   * rootDisplaySizeChanged should be called when the size of the rootEl changes.
   * It will recompute the scale factor and update the VCS composition.
   * This is needed to render the VCS composition at the correct size.
   */
  rootDisplaySizeChanged() {
    this.recomputeOutputScaleFactor();

    if (this.vcsApi) {
      this.vcsApi.setScaleFactor(this.scaleFactor);
    }
  }

  private async setupDefaultSources() {
    this.sources = {
      videoSlots: [],
      assetImages: {},
    };
  }

  private placeVideoSourceInDOM(el: HTMLElement, trackId: string) {
    // place element in DOM so it gets updates
    el.setAttribute('style', 'display: none;');
    if (trackId) {
      el.setAttribute('data-video-remote-track-id', trackId);
    }
    this.rootEl.appendChild(el);
  }

  /**
   * start starts the VCS composition.
   * It should be called after the DOM element has been rendered.
   */
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
    this.callbacks.onStart?.();
  }

  /**
   * to stop the VCS composition.
   */
  stop() {
    if (!this.vcsApi) return;

    this.vcsApi.stop();
    this.callbacks.onStop?.();
  }

  private onError(error: any) {
    console.error('VCS composition error: ', error);
    this.callbacks.onError?.(error);
  }

  private setActiveVideoInput(
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

  private sendActiveVideoInputSlots() {
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

  /**
   * sendParam sends a param update to the VCS composition.
   * @param paramId
   * @param value
   */
  sendParam(paramId: string, value: any) {
    if (!this.vcsApi) return;

    this.vcsApi.setParamValue(paramId, value);

    // retain a copy of param values so we can reset renderer to the same state
    this.paramValues[paramId] = value;
    this.callbacks.onParamsChanged?.(this.paramValues);
  }

  /**
   * sendParams sends a map of param updates to the VCS composition.
   */
  sendParams(params: Record<string, any>) {
    if (!this.vcsApi) return;

    Object.entries(params).forEach(([id, value]) => this.sendParam(id, value));
  }

  private sendUpdateImageSources() {
    if (!this.vcsApi) return;

    this.vcsApi.updateImageSources(this.sources);
  }

  /**
   * applyTracks applies the video tracks to the VCS composition.
   * @param videos is an array of video tracks.
   */
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
