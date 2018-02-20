exports.config = {
  namespace: 'cheftonic-booking-component',
  generateDistribution: true,
  generateWWW: false,
  bundles: [
    { components: ['cheftonic-booking-component'] }
  ],
};

exports.devServer = {
  root: 'www',
  watchGlob: '**/**'
};
