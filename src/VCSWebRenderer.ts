import { calculateViewportSize } from './lib/calculateViewportSize';
import { isTrackOff } from './lib/isTrackOff';
import { createPeerObject, createVideoInputObject } from './lib/videoUtils';
import type {
  VCSComposition,
  VCSApi,
  VideoInput,
  ViewportSize,
  ActiveVideoSlot,
  GetAssetUrlCb,
  Options,
  VCSCallbacks,
  Params,
  Merge,
  VCSPeer,
  State,
  WebFrameCb,
} from './types';

import { DailyCall } from '@daily-co/daily-js';

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
  private callObject!: DailyCall;
  /**
   * comp is the VCS composition.
   * for more info, see https://docs.daily.co/reference/vcs/core-concepts/composition
   */
  private readonly comp!: VCSComposition;
  /**
   * rootEl is the DOM element where the VCS composition will be rendered.
   */
  private readonly rootEl!: HTMLElement;
  /**
   * viewportSize is the size of the DOM element that will be rendered.
   * it will be neglected if the aspectRatio is set.
   */
  private viewportSize!: ViewportSize;
  private readonly defaultParams!: Params;
  private readonly defaultAssets!: Record<string, string>;
  private readonly getAssetUrlCb!: GetAssetUrlCb;
  private readonly webFrameCb?: WebFrameCb;
  /**
   * fps is the framerate of the VCS composition.
   * It defaults to 30.
   */
  private readonly fps: number = 30;
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
    videoSlots: VideoInput[];
    assetImages: Record<string, string>;
  } = {
    videoSlots: [],
    assetImages: {},
  };
  /**
   * maxVideoInputSlots is the maximum number of video input slots that can be rendered.
   * It defaults to 20.
   */
  private readonly maxVideoInputSlots: number = MAX_VIDEO_INPUT_SLOTS;
  private callbacks: VCSCallbacks = {};
  /**
   * aspectRatio is to automatically compute the viewportSize based on the rootEl size.
   * It defaults to 16/9.
   */
  private aspectRatio: number = DEFAULT_ASPECT_RATIO;

  private participantIds!: string[];
  private includePausedVideo: boolean = true;

  // tracks video input ids which 1) have been displayed at some point, 2) are not screenshares
  private knownNonScreenshareVideoInputIds: Set<string> = new Set();

  private resizeObserver!: ResizeObserver | null;

  private vcsState: State = 'idle';

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
   * @param opts.defaultAssets is a map of assetId to asset URL.
   * @param opts.getAssetUrlCb is a callback that will be called when the VCS composition needs to load an asset.
   * @param opts.webFrameCb is a callback that will be called when a WebFrame element has new properties.
   * @param opts.maxVideoInputSlots is the maximum number of video input slots that can be rendered.
   * @param opts.fps is the framerate of the VCS composition.
   * @param opts.aspectRatio is to automatically compute the viewportSize based on the rootEl size.
   * @param opts.participantIds is an array of participantIds to render.
   * @param opts.includePausedVideo determines whether to include paused video tracks.
   */
  constructor(
    callObject: DailyCall,
    comp: VCSComposition,
    rootEl: HTMLElement,
    opts: Options
  ) {
    if (!callObject) {
      console.error('VCSMeetingRenderer constructor needs a Daily callObject');
    }
    this.callObject = callObject;

    if (!comp || typeof comp.startDOMOutputAsync !== 'function') {
      console.error('VCSMeetingRenderer constructor needs a VCS composition');
      return;
    }
    this.comp = comp;
    this.getAssetUrlCb = opts.getAssetUrlCb;
    this.webFrameCb = opts?.webFrameCb ?? undefined;

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

    if (opts?.defaultAssets) {
      this.defaultAssets = opts.defaultAssets;
      this.updateImageSources(this.defaultAssets);
    }

    if (opts?.maxVideoInputSlots) {
      this.maxVideoInputSlots = opts.maxVideoInputSlots;
    }

    if (opts?.fps) this.fps = opts.fps;
    if (opts?.callbacks) this.callbacks = opts.callbacks;

    if (Array.isArray(opts?.participantIds)) {
      this.participantIds = opts.participantIds;
    }
    this.includePausedVideo = opts?.includePausedVideo ?? true;

    this.recomputeOutputScaleFactor();

    for (let i = 0; i < this.maxVideoInputSlots; i++) {
      this.setActiveVideoInput(i, false);
    }
  }

  private startResizeObserver() {
    this.resizeObserver = new ResizeObserver((entries) => {
      if (entries && entries.length > 0) {
        this.rootDisplaySizeChanged();
      }
    });

    this.resizeObserver.observe(this.rootEl);
  }

  private stopResizeObserver() {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
  }

  /**
   * rootElement is the DOM element where the VCS composition will be rendered.
   */
  get rootElement(): HTMLElement {
    return this.rootEl;
  }

  /**
   * aspectRatio is to automatically compute the viewportSize based on the rootEl size.
   * It defaults to 16/9.
   */
  get ratio(): number {
    return this.aspectRatio;
  }

  /**
   * state is the current state of the VCS composition.
   */
  get state(): State {
    return this.vcsState;
  }

  /**
   * vcsApiInstance is the instance returned by the VCSComposition.
   * It's used to send updates to the VCS composition.
   */
  get vcsApiInstance(): VCSApi | null {
    return this.vcsApi;
  }

  /**
   * comp is the VCS composition.
   * for more info, see https://docs.daily.co/reference/vcs/core-concepts/composition
   */
  get composition(): VCSComposition {
    return this.comp;
  }

  /**
   * participants is an array of participantIds to render.
   * if empty, all participants will be rendered.
   */
  get participants(): string[] {
    return this.participantIds;
  }

  /**
   * params is a map of paramId to value.
   * It's used to keep track of the current state of the VCS composition.
   */
  get params(): Params {
    return this.paramValues;
  }

  /**
   * size is the render viewport size used by VCS.
   */
  get size(): ViewportSize {
    return this.viewportSize;
  }

  /**
   * imageSources is a map of imageId to image URL.
   * It's used to keep track of the images that are currently being rendered.
   */
  get imageSources(): Record<string, string> {
    return this.sources.assetImages;
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
  private rootDisplaySizeChanged() {
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

  private placeVideoSourceInDOM(el: HTMLElement, participantId: string) {
    // place element in DOM so it gets updates
    el.setAttribute('style', 'display: none;');
    if (participantId) {
      el.setAttribute('data-video-id', participantId);
    }
    this.rootEl.appendChild(el);
  }

  private handleActiveSpeakerChange() {
    /*console.log(
      'active speaker now: ',
      this.callObject.getActiveSpeaker().peerId
    );*/
    // it's fine to simply rebuild the video input data for VCS on this update
    this.handleParticipantsChange();
  }

  private handleParticipantsChange() {
    const participants = Object.fromEntries(
      Object.values(this.callObject.participants()).map((p) => [
        p.session_id,
        p,
      ])
    );
    const filteredParticipants = Array.isArray(this.participantIds)
      ? this.participantIds.map((id) => participants[id]).filter(Boolean)
      : Object.values(participants);

    const videos: VideoInput[] = [];
    const screens: VideoInput[] = [];
    const peers = new Map<string, VCSPeer>();

    const includePaused = this.includePausedVideo;

    const activeSpeakerId = this.callObject.getActiveSpeaker().peerId ?? '';

    /*console.log(
      'includepaused %s, activespeaker %s, filtered participants: ',
      includePaused,
      activeSpeakerId,
      filteredParticipants
    );*/

    for (const p of filteredParticipants) {
      const dominant = p.session_id === activeSpeakerId;

      if (p?.participantType === 'remote-media-player') {
        // not checking the track state here, as we want to render the last frame of the video
        // when the track is paused
        videos.push(createVideoInputObject(p, dominant, 'rmpVideo'));
      } else {
        if (includePaused || !isTrackOff(p?.tracks?.video?.state)) {
          videos.push(createVideoInputObject(p, dominant));
        }
        if (includePaused || !isTrackOff(p?.tracks?.screenVideo?.state)) {
          screens.push(createVideoInputObject(p, dominant, 'screenVideo'));
        }
      }
      peers.set(
        p.session_id,
        createPeerObject(
          p,
          dominant,
          p?.participantType === 'remote-media-player'
        )
      );
    }

    //console.log(' .... peers: ', peers);

    this.applyTracks([...videos, ...screens]);
    this.vcsApi.setRoomPeerDescriptionsById(peers);
  }

  private setupEventListeners() {
    this.callObject.on(
      'participant-joined',
      this.handleParticipantsChange.bind(this)
    );
    this.callObject.on(
      'participant-updated',
      this.handleParticipantsChange.bind(this)
    );
    this.callObject.on(
      'participant-left',
      this.handleParticipantsChange.bind(this)
    );
    this.callObject.on(
      'active-speaker-change',
      this.handleActiveSpeakerChange.bind(this)
    );
  }

  private removeEventListeners() {
    this.callObject.off(
      'participant-joined',
      this.handleParticipantsChange.bind(this)
    );
    this.callObject.off(
      'participant-updated',
      this.handleParticipantsChange.bind(this)
    );
    this.callObject.off(
      'participant-left',
      this.handleParticipantsChange.bind(this)
    );
    this.callObject.off(
      'active-speaker-change',
      this.handleActiveSpeakerChange.bind(this)
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
        webFrameCb: this.webFrameCb,
        fps: this.fps,
        scaleFactor: this.scaleFactor,
        enablePreload: true,
      }
    );
    this.vcsState = 'started';

    this.handleParticipantsChange();
    this.setupEventListeners();

    this.sendActiveVideoInputSlots();
    this.sendParams({ ...this.paramValues, ...this.defaultParams });

    this.rootDisplaySizeChanged();
    this.callbacks.onStart?.();
    this.startResizeObserver();
  }

  /**
   * stops the VCS composition.
   */
  stop() {
    if (!this.vcsApi) return;

    this.removeEventListeners();
    this.vcsApi.stop();
    this.vcsState = 'stopped';
    this.callbacks.onStop?.();
    this.stopResizeObserver();
  }

  private onError(error: any) {
    console.error('VCS composition error: ', error);
    this.vcsState = 'error';
    this.callbacks.onError?.(error);
  }

  private setActiveVideoInput(
    idx: number,
    active: boolean,
    id = '',
    name = '',
    isScreenshare = false,
    paused = false,
    dominant = false
  ) {
    this.activeVideoInputSlots[idx] = active
      ? {
          id: id || '',
          type: isScreenshare ? 'screenshare' : 'camera',
          displayName: isScreenshare ? '' : name,
          paused,
          dominant,
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
    //console.log('sending video input slots: ', arr);

    this.vcsApi.setActiveVideoInputSlots(arr);
  }

  /**
   * sendParam sends a param update to the VCS composition.
   * @param paramId
   * @param value
   */
  sendParam(paramId: string, value: any) {
    if (this.vcsApi) {
      this.vcsApi.setParamValue(paramId, value);
      this.callbacks.onParamsChanged?.(this.paramValues);
    }

    // retain a copy of param values so we can reset renderer to the same state
    this.paramValues[paramId] = value;
  }

  /**
   * sendParams sends a map of param updates to the VCS composition.
   */
  sendParams(params: Record<string, any>, mergeType: Merge = 'merge') {
    if (mergeType === 'replace') this.paramValues = {};
    Object.entries(params).forEach(([id, value]) => this.sendParam(id, value));
  }

  private sendUpdateImageSources() {
    if (!this.vcsApi) return;

    //console.log('sending image sources: ', this.sources);

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

          img.onload = () => resolve({ name, image: img });
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
  private applyTracks(videos: VideoInput[]) {
    if (!this.sources || !videos) return;

    //console.log('applyTracks %d: ', videos.length, videos);

    const prevSlots = this.sources.videoSlots;
    const newSlots: VideoInput[] = [];

    for (const video of videos) {
      const isScreenshare = video.type === 'screenshare';

      if (!video.track) {
        if (
          this.includePausedVideo &&
          !isScreenshare &&
          this.knownNonScreenshareVideoInputIds.has(video.id)
        ) {
          // if this is a camera track that we've seen previously,
          // keep it in the list so the paused placeholder can be rendered.
          // screenshares are excluded because apps like Daily Studio can create
          // these tracks in a standby paused state, and we don't want to show those.
        } else {
          //console.log('skipping at %d: ', videos.indexOf(video), video);
          continue;
        }
      }

      const prevSlot = prevSlots.find((it) => it.id === video.id);
      if (prevSlot && prevSlot.track?.id === video.track?.id) {
        newSlots.push({
          ...prevSlot,
          dominant: video.dominant,
          paused: video.paused,
          displayName: video.displayName,
        });
      } else {
        let videoEl;
        let paused = video.paused ?? false;
        if (!video.track) {
          paused = true;
        } else {
          if (prevSlot?.element) {
            videoEl = prevSlot.element;
          } else {
            videoEl = document.createElement('video');
            this.placeVideoSourceInDOM(videoEl, video.id);

            videoEl.setAttribute('autoplay', 'true');
            videoEl.setAttribute('playsinline', 'true');
            videoEl.setAttribute('controls', 'false');
          }

          if (!videoEl.srcObject) {
            videoEl.srcObject = new MediaStream([video.track]);
          }
          const srcObject = videoEl.srcObject as MediaStream;
          const currentVideoTrack = srcObject.getVideoTracks()[0];
          if (!currentVideoTrack) {
            // shouldn't happen, we always set a track
            console.error(
              'no previous video track for video element, id %s',
              video.id
            );
            break;
          }

          if (currentVideoTrack.id !== video.track.id) {
            srcObject.removeTrack(currentVideoTrack);
            srcObject.addTrack(video.track);
          }
        }

        newSlots.push({
          ...video,
          paused,
          element: videoEl,
        });

        if (!isScreenshare) {
          this.knownNonScreenshareVideoInputIds.add(video.id);
        }
      }
    }

    prevSlots
      .filter((ps) => newSlots.every((ns) => ns.id !== ps.id))
      .forEach((ps) => {
        this.rootEl.querySelector(`[data-video-id="${ps?.id}"]`)?.remove();
      });

    let didChange = newSlots.length !== prevSlots.length;
    if (!didChange) {
      for (let i = 0; i < newSlots.length; i++) {
        const news = newSlots[i];
        const prev = prevSlots[i];
        //console.log(' ... %d', i, news, prev);
        if (
          news.id !== prev.id ||
          news.paused !== prev.paused ||
          news.dominant !== prev.dominant ||
          news.displayName !== prev.displayName ||
          news.track?.id !== prev.track?.id
        ) {
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
            slot.type === 'screenshare',
            slot.paused,
            slot.dominant
          );
        } else {
          this.setActiveVideoInput(i, false);
        }
      }
      this.sendActiveVideoInputSlots();

      // FIXME: why is this called here?
      this.rootDisplaySizeChanged();
    }
  }

  /**
   * updateAspectRatio updates the aspect ratio of the element.
   * @param aspectRatio is the new aspect ratio.
   * it will restart the VCS composition.
   */
  updateAspectRatio(aspectRatio: number) {
    this.aspectRatio = aspectRatio;
    this.viewportSize = calculateViewportSize(this.rootEl, this.aspectRatio);
    if (this.vcsState === 'started') {
      this.stop();
      this.start();
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
        ? [...new Set([...this.participantIds, ...participantIds])]
        : participantIds;

    if (this.vcsState === 'started') this.handleParticipantsChange();
  }
}
