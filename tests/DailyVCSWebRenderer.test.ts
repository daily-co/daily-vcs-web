import DailyIframe, { DailyCall } from '@daily-co/daily-js';
import { DailyVCSWebRenderer, VCSComposition, Options, VCSApi } from '../src';

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

describe('DailyVCSWebRenderer', () => {
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

  test('updateParticipantIds() should update the participantIds', () => {
    renderer.updateParticipantIds(['participant1', 'participant2']);

    // Assert that the participantIds are updated
    expect(renderer.participants).toEqual(['participant1', 'participant2']);
  });
});
