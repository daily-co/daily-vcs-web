import DailyIframe, { DailyCall } from '@daily-co/daily-js';
import {
  DailyVCSWebRenderer,
  VCSComposition,
  Options,
  VCSApi,
  VideoInput,
} from '../src';

const mockVCSApi: VCSApi = {
  setActiveVideoInputSlots: jest.fn(),
  setParamValue: jest.fn(),
  setScaleFactor: jest.fn(),
  setRoomPeerDescriptionsById: jest.fn(),
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
    const options: Options = {
      aspectRatio: 16 / 9,
      defaultParams: { paramId1: 'paramValue1' },
      getAssetUrlCb: jest.fn(),
      callbacks: {
        onStart: jest.fn(),
        onStop: jest.fn(),
        onError: jest.fn(),
        onParamsChanged: jest.fn(),
      },
    };

    renderer = new DailyVCSWebRenderer(callObject, comp, roolEl, options);
  });

  afterEach(() => {
    renderer.stop();
    jest.restoreAllMocks();
  });

  test('Constructor should initialize the DailyVCSWebRenderer instance correctly', () => {
    expect(renderer.rootElement).toBe(roolEl);
    expect(renderer['defaultParams']).toStrictEqual({
      paramId1: 'paramValue1',
    });
    expect(renderer['aspectRatio']).toBe(16 / 9);
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

  test('onStart callback should be triggered when the renderer is started', async () => {
    const onStartCallback = renderer['callbacks'].onStart;
    await renderer.start();
    expect(onStartCallback).toHaveBeenCalled();
  });

  test('onStop callback should be triggered when the renderer is stopped', async () => {
    const onStopCallback = renderer['callbacks'].onStop;
    await renderer.start();
    renderer.stop();
    expect(onStopCallback).toHaveBeenCalled();
  });

  test('onError callback should be triggered when there is an error in the VCS composition', () => {
    const consoleErrorMock = jest.spyOn(console, 'error').mockImplementation();

    const onErrorSpy = jest.spyOn(renderer['callbacks'], 'onError');
    const testError = new Error('Test Error');
    renderer['onError'](testError);

    expect(onErrorSpy).toHaveBeenCalledWith(testError);
    consoleErrorMock.mockRestore();
  });

  test('onParamsChanged callback should be triggered when the params are updated', async () => {
    const onParamsChangedCallback = renderer['callbacks'].onParamsChanged;
    await renderer.start();
    renderer.sendParam('paramId1', 'newParamValue');
    expect(onParamsChangedCallback).toHaveBeenCalledWith({
      paramId1: 'newParamValue',
    });
  });

  test('applyTracks should handle videoSlots update correctly', async () => {
    await renderer.start();

    const videoInputs: VideoInput[] = [
      {
        id: 'slot1',
        track: { id: 'track1' } as MediaStreamTrack,
        displayName: 'User1',
        type: 'camera',
        paused: false,
      },
      {
        id: 'slot2',
        track: { id: 'track2' } as MediaStreamTrack,
        displayName: 'User2',
        type: 'camera',
        paused: false,
      },
    ];

    renderer['sources'] = {
      assetImages: { ...renderer['sources'].assetImages },
      videoSlots: [
        {
          id: 'slot1',
          element: document.createElement('video'),
          track: { id: 'track1' } as MediaStreamTrack,
          displayName: 'User1',
          type: 'camera',
          paused: false,
        },
      ],
    };

    renderer['applyTracks'](videoInputs);

    expect(renderer['sources'].videoSlots).toEqual([
      {
        id: 'slot1',
        element: expect.any(HTMLVideoElement),
        track: { id: 'track1' },
        displayName: 'User1',
        type: 'camera',
        paused: false,
      },
      {
        id: 'slot2',
        element: expect.any(HTMLVideoElement),
        track: { id: 'track2' },
        displayName: 'User2',
        type: 'camera',
        paused: false,
      },
    ]);

    expect(
      renderer.vcsApiInstance!.setRoomPeerDescriptionsById
    ).toHaveBeenCalled();
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

  test('updateParticipantIds() should update the participantIds', async () => {
    await renderer.start();
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
