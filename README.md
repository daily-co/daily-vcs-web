# Daily VCS Web

The `@daily-co/daily-vcs-web` package enables developers to render a `VCSComposition` inside a given DOM element in the browser.

### Installation

Install the package via npm or yarn:

```bash
npm install @daily-co/daily-vcs-web
# or
yarn add @daily-co/daily-vcs-web

### Usage

Import the `DailyVCSWebRender` class from `@daily-co/daily-vcs-web` and create an instance to get started:

```js
import DailyIframe from '@daily-co/daily-js';
import DailyVCSBaselineComposition from '@daily-co/vcs-composition-daily-baseline-web';
import DailyVCSWebRenderer from '@daily-co/daily-vcs-web';

const callObject = DailyIframe.createCallObject();
const rootEl = document.getElementById('vcs-wrapper'); // DOM element where the VCS composition will be rendered
const opts = {
  callObject: callObject,
  viewportSize: { w: 1280, h: 720 }, // Optional: size of the DOM element that will be rendered
  defaultParams: {}, // Optional: map of paramId to default value
  getAssetUrlCb: null, // Optional: callback for loading assets by the VCS composition
  maxVideoInputSlots: 20, // Optional: maximum number of video input slots that can be rendered
  fps: 30, // Optional: framerate of the VCS composition (default is 30)
  aspectRatio: 16 / 9, // Optional: automatically compute the viewportSize based on the rootEl size (default is 16/9)
  participantIds: [], // Optional: array of participantIds to render
};

const renderer = new DailyVCSWebRenderer(callObject, DailyVCSBaselineComposition, rootEl, opts);
```

### Methods

The DailyVCSWebRenderer class provides the following methods:

- `start()`

Starts the VCS composition and renders it to the specified DOM element.

```
renderer.start();
```

- `stop()`

Stops the VCS composition and removes it from the DOM.

```
renderer.stop()
```

- `sendParam(paramId, value)`

Sends a parameter update to the VCS composition.

```
renderer.sendParam('paramId', value);
```

- `sendParams(params)`

Sends a map of parameter updates to the VCS composition.

```
renderer.sendParams({
  paramId1: value1,
  paramId2: value2,
  ...params
});
```

- `updateImageSources(images, mergeType)`

Updates the image sources of the VCS composition.

```
renderer.updateImageSources(
  {
    imageId1: 'imageUrl1',
    imageId2: 'imageUrl2',
    // ...
  },
  'replace' // Optional: mergeType, either 'merge' or 'replace' (default is 'replace')
);

```

- `updateParticipantIds(participantIds, mergeType)`

Updates the participantIds to render.

```
renderer.updateParticipantIds(
  ['participantId1', 'participantId2', ...],
  'replace' // Optional: mergeType, either 'merge' or 'replace' (default is 'replace')
);
```

### Properties

The DailyVCSWebRenderer class also provides several read-only properties:

- rootElement: The DOM element where the VCS composition is rendered.
- vcsApiInstance: The VCSApi instance returned by the VCSComposition. It can be used to send updates to the VCS composition.
- composition: The VCS composition object.
- participants: An array of participantIds to render.
- params: A map of paramId to value. It keeps track of the current state of the VCS composition.
- size: The render viewport size used by VCS.

### Callbacks

The DailyVCSWebRenderer class allows you to set optional callbacks that will be triggered during specific events. The available callbacks are:

- onStart: Called when the VCS composition starts.
- onStop: Called when the VCS composition stops.
- onError: Called when an error occurs during the VCS composition.
- onParamsChanged: Called when parameter values are updated.

```
const opts = {
  // ... other options ...
  callbacks: {
    onStart: () => console.log('VCS composition started.'),
    onStop: () => console.log('VCS composition stopped.'),
    onError: (e) => console.log('VCS composition error:', e),
    onParamsChanged: (params) => console.log('Params changed', params),
  }
}
```
