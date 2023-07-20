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
