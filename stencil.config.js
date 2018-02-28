// const sass = require('@stencil/sass');

exports.config = {
  namespace: 'cheftonic-booking-component',
  generateDistribution: true,
  generateWWW: true,
  /* plugins: [
    sass()
  ]*/
};

exports.devServer = {
  root: 'www',
  watchGlob: '**/**'
};
