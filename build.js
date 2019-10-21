const rollup = require('rollup');
const resolve = require('rollup-plugin-node-resolve'); // 告诉 Rollup 如何查找外部模块
const commonjs = require('rollup-plugin-commonjs'); // 将CommonJS模块转换为 ES2015 供 Rollup 处理
const filesize = require('rollup-plugin-filesize');
const vue = require('rollup-plugin-vue'); // 处理vue文件
const babel = require('rollup-plugin-babel'); // rollup 的 babel 插件，ES6转ES5
const postcss = require('rollup-plugin-postcss');
const { terser } = require('rollup-plugin-terser');
const htmlTemplate = require('rollup-plugin-bundle-html');
const replace = require('rollup-plugin-replace');
const progress = require('rollup-plugin-progress');
const path = require('path');

// see below for details on the options
const inputOptions = (src_dir, dest_dir) => ({
  input: path.join(src_dir, 'index.js'),
  external: ['vue'],
  plugins: [
    resolve({
      extensions: ['.js', '.vue', '.json'],
    }),
    progress(),
    replace({
      'process.env.NODE_ENV': JSON.stringify('production'),
      'process.env.VUE_ENV': JSON.stringify('browser'),
    }),
    filesize(), // 统计文件大小
    commonjs(), // 将 CommonJS 模块转换为 ES2015 供 Rollup 处理
    postcss({
      extract: true, // 提取 css 为单文件
      minimize: true,
    }), // 处理 css
    vue({ css: false }), // 处理vue文件
    babel({
      exclude: 'node_modules/**',
    }), // ，ES6转ES5

    terser(), //js压缩
    htmlTemplate({
      template: path.join(src_dir, 'index.html'),
      dest: dest_dir,
      filename: 'index.html',
      inject: 'body',
    }),
  ],
});
const outputOptions = dest_dir => ({
  dir: dest_dir,
  entryFileNames: '[name].[hash].js',
  chunkFileNames: '[name].[hash].js',
  format: 'umd',
});

async function rollupBuild(src_dir, dest_dir) {
  // create a bundle
  const bundle = await rollup.rollup(inputOptions(src_dir, dest_dir));

  // or write the bundle to disk
  await bundle.write(outputOptions(dest_dir));
}

module.exports = rollupBuild;
