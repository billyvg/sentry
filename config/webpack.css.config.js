/*eslint-env node*/
/*eslint import/no-nodejs-modules:0 */
const config = require('../webpack.config');

const MiniCssExtractPlugin = require('mini-css-extract-plugin');

config.entry = {
  sentry: 'less/jest-ci.less',
};

config.module = {
  ...config.module,
  rules: [
    ...config.module.rules.filter(({test}) =>
      ['/\\.css/', '/\\.less$/'].includes(test.toString())
    ),

    {
      test: /\.(jpe?g|png|gif|ttf|eot|svg|woff(2)?)(\?[a-z0-9=&.]+)?$/,
      use: [
        {
          loader: 'url-loader',
          options: {
            esModule: false,
            limit: true,
          },
        },
      ],
    },
  ],
};

// We replace `MiniCssExtractPlugin` because this config is only used for testing
// and we don't want to deal with `[contenthash]`:w
config.plugins = [
  ...config.plugins.filter(
    plugin => Object.getPrototypeOf(plugin).constructor.name !== 'MiniCssExtractPlugin'
  ),
  new MiniCssExtractPlugin(),
];

module.exports = config;
