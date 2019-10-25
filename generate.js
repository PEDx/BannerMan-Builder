#!/usr/bin/env node

// 生成可发布升级的 各平台 新版本资源

const path = require('path'),
  util = require('util'),
  fs = require('fs'),
  program = require('commander'),
  chalk = require('chalk'),
  shell = require('shelljs'),
  http = require('http'),
  rollupBuild = require('./build.js');

// 生成项目
let commit = '';
const projectDir = './project';
const templateDir = './template';
const indexFileName = 'index.js';
const htmlFileName = 'index.html';
const pkgFileName = 'package.json';
const http_api_path = 'http://192.168.27.234:6060/api/v1/page';
const npm_package_path = 'http://npm.bannerman.club/-/verdaccio/packages';
const data_inject_comment = '<!-- PAGE_DATA_INJECT_HERE -->';
const pkg_scope_prefix = '@banner-man/';

// 不存在project就创建
if (!fsExistsSync(projectDir)) {
  shell.mkdir(projectDir);
}

// 缓存模板文件
const temp_index_js_file = fs.readFileSync(
  path.resolve(templateDir, indexFileName),
  { encoding: 'utf-8' },
);
const temp_pkg_json_file = fs.readFileSync(
  path.resolve(templateDir, pkgFileName),
  { encoding: 'utf-8' },
);
const temp_index_html_file = fs.readFileSync(
  path.resolve(templateDir, htmlFileName),
  { encoding: 'utf-8' },
);

let deploy_info = {};
function getWidgetImportStr(widgetName) {
  return `import '${widgetName}/index';`;
}

function fsExistsSync(path) {
  try {
    fs.statSync(path, fs.F_OK);
  } catch (e) {
    return false;
  }
  return true;
}

function gitCommit(dir, id) {
  return (
    shell.exec(`cd ${dir} && git rev-parse HEAD`).stdout.slice(0, 7) || 'null'
  );
}

function getWidgetVersionInfoFromNpm() {
  return new Promise((resolve, reject) => {
    http
      .get(`${npm_package_path}`, resp => {
        let data = '';
        resp.on('data', chunk => {
          data += chunk;
        });
        resp.on('end', () => {
          let res = null;
          try {
            res = JSON.parse(data);
          } catch (error) {}
          resolve(res);
        });
      })
      .on('error', err => {
        reject(err);
        console.log('Error: ' + err.message);
      });
  });
}

function getPageData(id) {
  return new Promise((resolve, reject) => {
    http
      .get(`${http_api_path}/${id}`, resp => {
        let data = '';
        resp.on('data', chunk => {
          data += chunk;
        });
        resp.on('end', () => {
          let res = null;
          try {
            res = JSON.parse(data);
          } catch (error) {}
          resolve(res);
        });
      })
      .on('error', err => {
        reject(err);
        console.log('Error: ' + err.message);
      });
  });
}

function writeFile(path, data) {
  fs.writeFile(path, data, 'utf8', function(error) {
    if (error) {
      console.log(error);
      return false;
    }
    console.log('写入成功');
  });
}

function existsPageDir(id) {
  return fsExistsSync(path.join(projectDir, id));
}

function traversal(root, callback) {
  if (!Array.isArray(root)) return;
  function walk(node) {
    callback(node);
    node.children && node.children.forEach(walk);
  }
  root.forEach(walk);
}

function writeIndexFile(dest_dir, importWidgetMap) {
  console.log(
    chalk.blue(
      `\n正在生成 index.js \nfile: ${path.join(dest_dir, indexFileName)}`,
    ),
  );
  return new Promise((resolve, reject) => {
    let js_data = '';
    Object.keys(importWidgetMap).forEach(key => {
      js_data += importWidgetMap[key];
    });
    js_data += temp_index_js_file;
    fs.writeFile(
      path.join(dest_dir, indexFileName),
      js_data,
      {
        encoding: 'utf-8',
      },
      (err, data) => {
        if (err) {
          reject(err);
          return;
        }
        resolve();
      },
    );
  });
}

function generate_pkg_json(
  data,
  dest_pkg_path,
  installWidgetVersionMap,
  pageData,
) {
  return new Promise((resolve, reject) => {
    let pkg = {};
    try {
      pkg = JSON.parse(data);
    } catch (error) {}
    pkg.name = pageData.id;
    console.log(pageData);
    pkg.author = pageData.creater_name || 'banner man';
    // 更新依赖
    Object.keys(installWidgetVersionMap).forEach(key => {
      pkg.dependencies[key] = installWidgetVersionMap[key];
    });
    fs.writeFile(
      dest_pkg_path,
      JSON.stringify(pkg),
      {
        encoding: 'utf-8',
      },
      (err, data) => {
        if (err) {
          reject(err);
          return;
        }
        resolve();
      },
    );
  });
}

function writePkgFile(dest_dir, installWidgetVersionMap, pageData) {
  const dest_pkg_path = path.join(dest_dir, pkgFileName);
  console.log(chalk.blue(`\n正在生成 package.json \nfile: ${dest_pkg_path}`));
  return new Promise((resolve, reject) => {
    if (fsExistsSync(dest_pkg_path)) {
      fs.readFile(dest_pkg_path, { encoding: 'utf-8' }, (err, data) => {
        if (err) {
          reject(err);
          return;
        }
        generate_pkg_json(
          data,
          dest_pkg_path,
          installWidgetVersionMap,
          pageData,
        ).then(res => {
          resolve();
        });
      });
      return;
    }
    generate_pkg_json(
      temp_pkg_json_file,
      dest_pkg_path,
      installWidgetVersionMap,
      pageData,
    ).then(res => {
      resolve();
    });
  });
}

function injectScript2Html(dest_dir, pageData) {
  console.log(
    chalk.blue(`\n正在生成 HTML \nfile: ${path.join(dest_dir, htmlFileName)}`),
  );
  return new Promise((resolve, reject) => {
    const data_str = `<script type="text/javascript">window.BANNER_MAN_PAGE_DATA = ${JSON.stringify(
      pageData,
    )};</script>`;
    const html_data = temp_index_html_file.replace(
      data_inject_comment,
      data_str,
    );
    fs.writeFile(
      path.join(dest_dir, htmlFileName),
      html_data,
      {
        encoding: 'utf-8',
      },
      (err, data) => {
        if (err) {
          reject(err);
          return;
        }
        resolve();
      },
    );
  });
}

async function generate_page(id) {
  console.time('generate_page');
  const _dir = path.join(projectDir, id);
  console.log(chalk.blue(`\n正在拉取页面 ${id} 服务端数据`));
  const pageData = ((await getPageData(id)) || {}).data;

  if (!pageData || !pageData.data) {
    console.log(chalk.red('\n页面数据不存在, 或已删除.\n'));
    return '页面数据不存在, 或已删除.';
  }
  console.log(
    chalk.blue(`\n页面 ${id} 数据及组件版本信息拉取完成,生成页面中...`),
  );
  // 不存在就创建
  if (!fsExistsSync(_dir)) {
    shell.mkdir(_dir);
    shell.exec(`echo 'node_modules/\ndist/' > ${_dir}/.gitignore`);
    shell.exec(`cd ${_dir} && git init`);
  }
  const widgetVersionMap = pageData.widgets_version;
  const importWidgetMap = {};
  const installWidgetVersionMap = {};

  console.log(chalk.green(`组件构建版本:`));
  console.log(widgetVersionMap);
  const data = pageData.data;
  pageData.id = id;
  traversal(data, node => {
    if (!importWidgetMap[node.name]) {
      const name = `${pkg_scope_prefix}${node.name}`;
      importWidgetMap[name] = getWidgetImportStr(name);
      installWidgetVersionMap[name] = widgetVersionMap[name];
    }
  });
  // 加入 render 和 common 两个包的更新
  ['render', 'common'].forEach(name => {
    const _name = `${pkg_scope_prefix}${name}`;
    installWidgetVersionMap[_name] = widgetVersionMap[_name];
  });

  await Promise.all([
    injectScript2Html(_dir, pageData),
    writeIndexFile(_dir, importWidgetMap),
    writePkgFile(_dir, installWidgetVersionMap, pageData),
  ]);
  console.log(chalk.green(`\n页面生成完成, 现在开始构建页面...\n`));
  await install(id);
  // 版本提交
  shell.exec(`cd ${_dir} && npm version patch`);
  commit = gitCommit(_dir, id);
  await build(_dir, id);
  return '页面构建完成';
}

// 构建项目
async function install(id) {
  // 每次构建都会重新请求页面数据, 升级依赖
  const _dir = path.join(projectDir, id);
  // 安装依赖
  console.log(chalk.yellow(`\n安装依赖中...\n`));
  shell.exec(`cd ${_dir} && npm install`);
  console.log(chalk.yellow(`安装完成\n`));
  console.log(chalk.yellow(`开始打包构建\n`));
}

async function build(src_dir, id) {
  deploy_info = {
    COMMIT: commit,
    DATE: new Date().toLocaleString(),
    ID: id,
  };
  const dest_dir = path.join(src_dir, 'dist');
  if (fsExistsSync(dest_dir)) {
    shell.rm('-r', dest_dir);
  }
  // 构建项目
  await rollupBuild(src_dir, dest_dir, deploy_info);
  // 回调服务接口
  console.log(chalk.green(`\n`));
  console.log(deploy_info);
  console.log(chalk.green(`\n页面 ${id} 构建完成.\n`));
  console.timeEnd('generate_page');
}
// 删除项目
function delete_project(id) {
  const projDir = path.resolve(projectDir, id);
  if (!fsExistsSync(projDir)) {
    return Promise.resolve({ msg: 'project no exists' });
  }
  return new Promise((resolve, reject) => {
    fs.rmdir(projDir, err => {
      if (err) reject(err);
      console.log('delete');
      resolve({ msg: 'delete success' });
    });
  });
}
// 列出项目
function list_project() {
  return new Promise((resolve, reject) => {
    fs.readdir(projectDir, (err, file) => {
      if (err) reject(err);
      resolve(file);
    });
  });
}

program
  .version('0.0.1')
  .description('项目生成器')
  .option('-b, --build <id>', '构建一个项目')
  .option('-l, --list', '列出所有页面')
  .option('-d, --delete <id>', '删除项目')
  .action(option => {
    if (option.list) {
      console.log('\n所有页面项目\n');
      list_project();
      console.log('\n');
      return;
    }
    if (option.build) {
      const id = option.build;
      console.log(chalk.green('\n构建项目\n'));
      if (existsPageDir(id)) {
        generate_page(option.build);
        console.log('\n');
        return;
      }
      console.log(chalk.red('未找到该项目,请确认.\n'));
      return;
    }
    if (option.delete) {
      const id = option.delete;
      console.log(chalk.green('删除项目\n'));
      if (existsPageDir(id)) {
        delete_project(id);
        console.log('\n');
        return;
      }
      console.log(chalk.red('未找到该项目,请确认.\n'));
      return;
    }
  });

program.parse(process.argv);

module.exports = {
  generate_page,
  delete_project,
  list_project,
};
