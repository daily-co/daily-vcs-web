import DailyVCSWebRenderer from './VCSWebRenderer';

console.log('VCSWebRenderer loaded', DailyVCSWebRenderer);

const renderer = new DailyVCSWebRenderer(
  callObject,
  // DailyVCSBaselineComposition,
  rootEl,
  {
    callbacks: {
      onError(error) {},
      onParamsChanged(params) {},
      onStart() {},
      onStop() {},
    },
  }
);
