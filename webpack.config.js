const Encore = require('@symfony/webpack-encore');

if (!Encore.isRuntimeEnvironmentConfigured()) {
  Encore.configureRuntimeEnvironment(process.env.NODE_ENV || 'dev');
}

process.env.NODE_ENV = Encore.isProduction() ? 'production' : 'dev';

Encore
  .setOutputPath('assets/')
  .setPublicPath('/assets')
  .addStyleEntry('css/app', './_assets/css/app.css')
  .addEntry('js/app', './_assets/js/app.js')
  .copyFiles({from: './_assets/img', to: 'img/[path][name].[ext]'})
  .enablePostCssLoader()
  .disableSingleRuntimeChunk()
  .enableSourceMaps(!Encore.isProduction());

const cfg = Encore.getWebpackConfig();

module.exports = cfg;