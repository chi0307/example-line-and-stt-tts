const path = require('path');
const nodeExternals = require('webpack-node-externals');
const NodemonPlugin = require('nodemon-webpack-plugin');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');

module.exports = {
  target: 'node',
  context: path.resolve(__dirname, 'src'),
  entry: {
    index: './index.js',
  },
  output: {
    filename: '[name].js',
    path: path.resolve(__dirname, 'dist'),
  },
  module: {
    rules: [],
  },
  resolve: {
    extensions: ['.js'],
  },
  externals: [nodeExternals()],
  plugins: [new NodemonPlugin(), new CleanWebpackPlugin()],
};
