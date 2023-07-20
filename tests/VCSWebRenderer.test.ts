import DailyIframe, { DailyCall } from '@daily-co/daily-js';
import {
  DailyVCSWebRenderer,
  VCSComposition,
  Options,
  VCSApi,
  VideoInputSlot,
} from '../src';

const mockVCSApi: VCSApi = {
  setActiveVideoInputSlots: jest.fn(),
  setParamValue: jest.fn(),
  setScaleFactor: jest.fn(),
  updateImageSources: jest.fn(),
  stop: jest.fn(),
};

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

(global as any).ResizeObserver = ResizeObserverMock;

class MediaStreamMock {
  constructor() {}

  getTracks() {
    return [];
  }
}

(global as any).MediaStream = MediaStreamMock;

class ImageMock {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  src: string = '';

  constructor() {
    setTimeout(() => {
      // Simulate image loaded successfully after a short delay
      if (this.onload) {
        this.onload();
      }
    }, 10);
  }
}

(global as any).Image = ImageMock;

describe('VCSWebRenderer', () => {
  let callObject: DailyCall;
  let comp: VCSComposition;
  let roolEl: HTMLElement;
  let renderer: DailyVCSWebRenderer;

  beforeEach(() => {
    callObject = DailyIframe.createCallObject();
    comp = {
      startDOMOutputAsync: jest.fn(async () => mockVCSApi),
    };
    roolEl = document.createElement('div');
    const optsMock: Options = {
      getAssetUrlCb: jest.fn(),
    };

    renderer = new DailyVCSWebRenderer(callObject, comp, roolEl, optsMock);
  });

  afterEach(() => {
    renderer.stop();
    jest.restoreAllMocks();
  });

  test('Constructor should initialize the DailyVCSWebRenderer instance correctly', () => {
    expect(renderer.rootElement).toBe(roolEl);
    expect(renderer.vcsApiInstance).toBeUndefined();
  });

  test('start() should start the VCS composition', async () => {
    comp.startDOMOutputAsync = jest.fn(() => Promise.resolve(mockVCSApi));

    await renderer.start();

    // Assert that the startDOMOutputAsync function is called with the correct arguments
    expect(comp.startDOMOutputAsync).toHaveBeenCalledWith(
      roolEl,
      renderer.size.w,
      renderer.size.h,
      expect.any(Object),
      expect.any(Object)
    );

    expect(renderer.vcsApiInstance).toBeDefined();
  });

  test('stop() should stop the VCS composition', async () => {
    await renderer.start();

    expect(renderer.vcsApiInstance).toBeDefined();
    renderer.stop();

    expect(renderer.vcsApiInstance!.stop).toHaveBeenCalled();
  });

  test('sendParam() should update the VCS composition with the provided param', async () => {
    await renderer.start();
    renderer.sendParam('paramId1', 'paramValue1');

    // Assert that vcsApi.setParamValue() is called with the correct arguments
    expect(renderer.vcsApiInstance!.setParamValue).toHaveBeenCalledWith(
      'paramId1',
      'paramValue1'
    );
  });

  test('sendParams() should update the VCS composition with the provided params', async () => {
    await renderer.start();

    // Call the sendParams() method
    renderer.sendParams({
      paramId2: 'paramValue2',
      paramId3: 'paramValue3',
    });

    // Assert that vcsApi.setParamValue() is called with the correct arguments for each param
    expect(renderer.vcsApiInstance!.setParamValue).toHaveBeenCalledWith(
      'paramId2',
      'paramValue2'
    );
    expect(renderer.vcsApiInstance!.setParamValue).toHaveBeenCalledWith(
      'paramId3',
      'paramValue3'
    );
  });

  test('applyTracks should handle videoSlots update correctly', async () => {
    await renderer.start();

    const videoInputSlots: VideoInputSlot[] = [
      {
        active: true,
        id: 'slot1',
        track: { id: 'track1' } as MediaStreamTrack,
        sessionId: 'session1',
        displayName: 'User1',
        type: 'camera',
      },
      {
        active: true,
        id: 'slot2',
        track: { id: 'track2' } as MediaStreamTrack,
        sessionId: 'session2',
        displayName: 'User2',
        type: 'camera',
      },
    ];

    renderer['sources'] = {
      assetImages: { ...renderer['sources'].assetImages },
      videoSlots: [
        {
          active: true,
          id: 'slot1',
          element: document.createElement('video'),
          track: { id: 'track1' } as MediaStreamTrack,
          sessionId: 'session1',
          displayName: 'User1',
          type: 'camera',
        },
      ],
    };

    renderer['applyTracks'](videoInputSlots);

    expect(renderer['sources'].videoSlots).toEqual([
      {
        active: true,
        id: 'slot1',
        element: expect.any(HTMLVideoElement),
        track: { id: 'track1' },
        sessionId: 'session1',
        displayName: 'User1',
        type: 'camera',
      },
      {
        active: true,
        id: 'videotrack_track2',
        element: expect.any(HTMLVideoElement),
        track: { id: 'track2' },
        sessionId: 'session2',
        displayName: 'User2',
        type: 'camera',
      },
    ]);

    expect(renderer.vcsApiInstance!.updateImageSources).toHaveBeenCalled();
    expect(
      renderer.vcsApiInstance!.setActiveVideoInputSlots
    ).toHaveBeenCalled();
  });

  test('should update the image sources with mergeType "merge"', () => {
    const images = {
      'images/overlay.png':
        'https://www.daily.co/tools/vcs-simulator/composition-assets/images/overlay.png',
      'images/user_white_64.png':
        'https://www.daily.co/tools/vcs-simulator/composition-assets/images/user_white_64.png',
    };
    const mergeType = 'merge';

    renderer.updateImageSources(images, mergeType).then(() => {
      expect(renderer['sources'].assetImages).toEqual(images);
    });
  });

  test('should update the image sources with mergeType "replace"', async () => {
    const images = {
      'images/overlay.png':
        'https://www.daily.co/tools/vcs-simulator/composition-assets/images/overlay.png',
      'images/user_white_64.png':
        'https://www.daily.co/tools/vcs-simulator/composition-assets/images/user_white_64.png',
    };
    const mergeType = 'replace';

    renderer.updateImageSources(images, mergeType).then(() => {
      expect(renderer['sources'].assetImages).toEqual(images);
    });
  });

  test('should log an error for invalid mergeType', async () => {
    const images = {
      'images/overlay.png':
        'https://www.daily.co/tools/vcs-simulator/composition-assets/images/overlay.png',
      'images/user_white_64.png':
        'https://www.daily.co/tools/vcs-simulator/composition-assets/images/user_white_64.png',
    };
    const mergeType = 'invalidMergeType';
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

    renderer.updateImageSources(images, mergeType as any).then(() => {
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Invalid mergeType. Please use either "merge" or "replace".'
      );
      expect(renderer['sources'].assetImages).toEqual({});
    });
  });

  test('updateParticipantIds() should update the participantIds', () => {
    renderer.updateParticipantIds(['participant1', 'participant2']);

    // Assert that the participantIds are updated
    expect(renderer.participants).toEqual(['participant1', 'participant2']);
  });

  test('resizeObserver should call rootDisplaySizeChanged when the size of the rootEl changes', () => {
    const resizeObserverMock = jest.fn();
    (global as any).ResizeObserver = jest.fn((callback) => {
      resizeObserverMock.mockImplementation(callback);
      return {
        observe: () => {},
        disconnect: () => {},
      };
    });

    renderer.start();

    resizeObserverMock({});
    expect(resizeObserverMock).toHaveBeenCalled();
  });
});
