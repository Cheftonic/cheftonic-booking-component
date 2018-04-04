const sass = require('@stencil/sass');

exports.config = {
  namespace: 'cheftonic-booking-component',
  outputTargets: [
    { type: 'www' },
    { type: 'dist' }
  ],
  plugins: [
    sass()
  ]
};

exports.devServer = {
  root: 'www',
  watchGlob: '**/**'
};
