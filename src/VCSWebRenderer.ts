import { calculateViewportSize } from './lib/calculateViewportSize';
import { isTrackOff } from './lib/isTrackOff';
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
  Merge,
} from './types';

const MAX_VIDEO_INPUT_SLOTS = 20;
const DEFAULT_ASPECT_RATIO = 16 / 9;

/**
 * VCSWebRenderer
 * It's a wrapper around the VCSComposition to render the DOM element.
 */
export default class DailyVCSWebRenderer {
  /**
   * callObject is the Daily callObject.
   * for more info, see https://docs.daily.co/reference/rn-daily-js/factory-methods/create-call-object#main
   */
  private callObject!: any;
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
   * it will be neglected if the aspectRatio is set.
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
   * aspectRatio is to automatically compute the viewportSize based on the rootEl size.
   * It defaults to 16/9.
   */
  private aspectRatio: number = DEFAULT_ASPECT_RATIO;

  private participantIds: string[] = [];

  /**
   * constructor
   * @param callObject is the Daily callObject.
   * @param comp is the VCS composition.
   * @param rootEl is the DOM element where the VCS composition will be rendered.
   * @param opts is the options object.
   * @param opts.callObject is the Daily callObject.
   * @param opts.callbacks is a map of callbacks.
   * @param opts.viewportSize is the size of the DOM element that will be rendered.
   * @param opts.defaultParams is a map of paramId to default value.
   * @param opts.getAssetUrlCb is a callback that will be called when the VCS composition needs to load an asset.
   * @param opts.maxVideoInputSlots is the maximum number of video input slots that can be rendered.
   * @param opts.fps is the framerate of the VCS composition.
   * @param opts.aspectRatio is to automatically compute the viewportSize based on the rootEl size.
   * @param opts.participantIds is an array of participantIds to render.
   */
  constructor(
    callObject: any,
    comp: VCSComposition,
    rootEl: HTMLElement,
    opts: Options
  ) {
    if (!callObject || typeof callObject.participants !== 'function') {
      console.error('VCSMeetingRenderer constructor needs a Daily callObject');
    }
    this.callObject = callObject;

    if (!comp || typeof comp.startDOMOutputAsync !== 'function') {
      console.error('VCSMeetingRenderer constructor needs a VCS composition');
      return;
    }
    this.comp = comp;
    this.getAssetUrlCb = opts?.getAssetUrlCb ?? null;

    this.rootEl = rootEl;

    // viewportSize is the render size used by VCS.
    // for video layers, this doesn't affect resolution, as they are rendered as actual DOM elements.
    // for graphics, this sets the size of the canvas element.
    this.viewportSize = opts?.viewportSize ?? { w: 1280, h: 720 };

    if (opts?.aspectRatio) {
      this.aspectRatio = opts.aspectRatio;
      this.viewportSize = calculateViewportSize(rootEl, this.aspectRatio);
    }

    if (opts?.defaultParams) {
      this.defaultParams = opts.defaultParams;
    }

    if (opts?.maxVideoInputSlots) {
      this.maxVideoInputSlots = opts.maxVideoInputSlots;
    }

    if (opts?.fps) this.fps = opts.fps;
    if (opts?.callbacks) this.callbacks = opts.callbacks;

    if (opts?.participantIds && opts?.participantIds.length > 0) {
      this.participantIds = opts.participantIds;
    }

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

  private handleParticipantsChange() {
    const participants = Object.values(this.callObject.participants());
    const videos = participants
      .filter((p: any) =>
        this.participantIds.length > 0
          ? this.participantIds.includes(p.session_id) &&
            !isTrackOff(p?.tracks.video.state)
          : !isTrackOff(p?.tracks.video.state)
      )
      .map((p: any) => ({
        active: true,
        id: p.session_id,
        sessionId: p.session_id,
        displayName: p.user_name || 'Guest',
        track: p.tracks.video.persistentTrack,
        type: 'camera' as const,
      }));

    const screens = participants
      .filter((p: any) =>
        this.participantIds.length > 0
          ? this.participantIds.includes(p.session_id) &&
            !isTrackOff(p?.tracks.screenVideo.state)
          : !isTrackOff(p?.tracks.screenVideo.state)
      )
      .map((p: any) => ({
        active: true,
        id: p.session_id,
        sessionId: p.session_id,
        displayName: '',
        track: p.tracks.screenVideo.persistentTrack,
        type: 'screenshare' as const,
      }));

    this.applyTracks([...videos, ...screens]);
  }

  private setupEventListeners() {
    this.callObject.on('participant-joined', () =>
      this.handleParticipantsChange()
    );
    this.callObject.on('participant-updated', () =>
      this.handleParticipantsChange()
    );
    this.callObject.on('participant-left', () =>
      this.handleParticipantsChange()
    );
  }

  private removeEventListeners() {
    this.callObject.off('participant-joined', () =>
      this.handleParticipantsChange()
    );
    this.callObject.off('participant-updated', () =>
      this.handleParticipantsChange()
    );
    this.callObject.off('participant-left', () =>
      this.handleParticipantsChange()
    );
  }

  /**
   * starts the VCS composition.
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

    this.handleParticipantsChange();
    this.setupEventListeners();

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
   * stops the VCS composition.
   */
  stop() {
    if (!this.vcsApi) return;

    this.removeEventListeners();
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

    const arr: (boolean | ActiveVideoSlot)[] = [];
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
   * updateImageSources updates the image sources of the VCS composition.
   * @param images is a map of imageId to image URL.
   * @param mergeType determines how the new image sources will be merged with the existing image sources.
   */
  async updateImageSources(
    images: Record<string, string> = {},
    mergeType: 'merge' | 'replace' = 'replace'
  ) {
    const promises = Object.entries(images).map(
      ([name, image]) =>
        new Promise((resolve, reject) => {
          const img = new Image();

          img.onload = () => resolve({ name, image });
          img.onerror = () => {
            console.error(`Image load failed, asset ${name}`);
            reject(new Error(`Image load failed, asset ${name}`));
          };
          img.src = image;
        })
    );

    try {
      const results = await Promise.all(promises);
      const images = results.reduce(
        (acc: Record<string, string>, item: any) => {
          acc[item.name] = item.image;
          return acc;
        },
        {}
      );

      if (mergeType === 'merge') {
        this.sources.assetImages = {
          ...this.sources.assetImages,
          ...images,
        };
      } else if (mergeType === 'replace') {
        this.sources.assetImages = images;
      } else {
        console.error(
          'Invalid mergeType. Please use either "merge" or "replace".'
        );
        return;
      }
      this.sendUpdateImageSources();
    } catch (error) {
      console.error(error);
    }
  }

  /**
   * applyTracks applies the video tracks to the VCS composition.
   * @param videos is an array of video tracks.
   */
  private applyTracks(videos: VideoInputSlot[]) {
    if (!this.sources || !videos) return;

    const prevSlots = this.sources.videoSlots;
    const newSlots: VideoInputSlot[] = [];

    for (const video of videos) {
      if (!video?.track) continue;
      const prevSlot = prevSlots.find((it) => it.id === video.id);
      if (prevSlot && prevSlot?.track?.id === video.track.id) {
        newSlots.push({ ...prevSlot, displayName: video.displayName });
      } else {
        const mediaStream = new MediaStream([video.track]);
        let videoEl;
        if (prevSlot?.element) {
          videoEl = prevSlot.element;
        } else {
          videoEl = document.createElement('video');
          this.placeVideoSourceInDOM(videoEl, video.track.id);
        }
        videoEl.srcObject = mediaStream;
        videoEl.setAttribute('autoplay', 'true');
        videoEl.setAttribute('playsinline', 'true');
        videoEl.setAttribute('controls', 'false');

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
    }

    prevSlots
      .filter((ps) => newSlots.every((ns) => ns.id !== ps.id))
      .forEach((ps) => {
        this.rootEl
          .querySelector(`[data-video-remote-track-id="${ps?.track?.id}"]`)
          ?.remove();
      });

    let didChange = newSlots.length !== prevSlots.length;
    if (!didChange) {
      for (let i = 0; i < newSlots.length; i++) {
        if (newSlots[i].id !== prevSlots[i].id) {
          didChange = true;
          break;
        }
      }
    }

    if (didChange) {
      this.sources.videoSlots = newSlots;
      this.sendUpdateImageSources();

      for (let i = 0; i < MAX_VIDEO_INPUT_SLOTS; i++) {
        const slot = newSlots[i];
        if (slot) {
          this.setActiveVideoInput(
            i,
            true,
            slot.id,
            slot.displayName,
            slot.type === 'screenshare'
          );
        } else {
          this.setActiveVideoInput(i, false);
        }
      }
      this.sendActiveVideoInputSlots();
      this.rootDisplaySizeChanged();
    }
  }

  /**
   * updateParticipantIds updates the participantIds to render.
   * @param participantIds is an array of participantIds to render. If it's empty, all participants will be rendered.
   * @param mergeType determines how the new participantIds will be merged with the existing participantIds.
   */
  updateParticipantIds(participantIds: string[], mergeType: Merge = 'replace') {
    this.participantIds =
      mergeType === 'merge'
        ? [...this.participantIds, ...participantIds]
        : participantIds;
    this.handleParticipantsChange();
  }
}
