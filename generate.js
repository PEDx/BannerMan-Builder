#!/usr/bin/env node

// 生成可发布升级的 各平台 新版本资源

const path = require('path'),
  util = require('util'),
  fs = require('fs'),
  rd = require('rd'),
  program = require('commander'),
  chalk = require('chalk'),
  shell = require('shelljs'),
  http = require('http');
let commit = '';
const rollupBuild = require('./build.js');
// 生成项目
const projectDir = './project';
const templateDir = './template';
const indexFileName = 'index.js';
const htmlFileName = 'index.html';
const pkgFileName = 'package.json';
const http_api_path = 'http://192.168.27.234:6060/api/v1/page';
const npm_package_path = 'http://npm.bannerman.club/-/verdaccio/packages';
const data_inject_comment = '<!-- PAGE_DATA_INJECT_HERE -->';
const pkg_scope_prefix = '@banner-man/';
const widgetVersion = {
  render: '^0.0.3',
  common: '0.0.2',
  'widget-button': '^0.0.5',
  'widget-container': '0.0.2',
  'widget-tabs': '0.0.2',
  'widget-search': '0.0.2',
};
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

function gitCommit(id) {
  shell.exec('git add .');
  shell.exec(`git commit -m '页面 ${id} 构建'`);
  shell.exec(`git push`);
  return shell.exec('git rev-parse HEAD').stdout.slice(0, 7) || 'null';
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

function writeIndexFile(js_path, dest_dir, importWidgetMap) {
  console.log(
    chalk.blue(
      `\n正在生成 index.js \nfile: ${path.join(dest_dir, indexFileName)}`,
    ),
  );
  return new Promise((resolve, reject) => {
    fs.readFile(js_path, { encoding: 'utf-8' }, function(err, data) {
      if (err) {
        reject(err);
        return;
      }
      let js_data = '';
      Object.keys(importWidgetMap).forEach(key => {
        js_data += importWidgetMap[key];
      });
      js_data += data;
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
  });
}
function writePkgFile(pkg_path, dest_dir, installWidgetVersionMap, pageData) {
  const dest_pkg_path = path.join(dest_dir, pkgFileName);
  console.log(chalk.blue(`\n正在生成 package.json \nfile: ${dest_pkg_path}`));
  return new Promise((resolve, reject) => {
    const read_pkg_path = fsExistsSync(dest_pkg_path)
      ? dest_pkg_path
      : pkg_path;
    fs.readFile(read_pkg_path, { encoding: 'utf-8' }, (err, data) => {
      if (err) {
        reject(err);
        return;
      }
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
  });
}

function injectScript2Html(html_path, dest_dir, pageData) {
  console.log(
    chalk.blue(`\n正在生成 HTML \nfile: ${path.join(dest_dir, htmlFileName)}`),
  );
  return new Promise((resolve, reject) => {
    fs.readFile(html_path, { encoding: 'utf-8' }, function(err, data) {
      if (err) {
        reject(err);
        return;
      }
      const data_str = `<script type="text/javascript">window.BANNER_MAN_PAGE_DATA = ${JSON.stringify(
        pageData,
      )};</script>`;
      const html_data = data.replace(data_inject_comment, data_str);
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
  });
}

function generate_project(id) {
  const _dir = path.join(projectDir, id);
  if (!fsExistsSync(_dir)) {
    shell.mkdir(_dir);
  }
  generate_page(id);
}

function generate_page(id) {
  const _dir = path.join(projectDir, id);
  const js_path = path.join(templateDir, indexFileName);
  const pkg_path = path.join(templateDir, pkgFileName);
  const html_path = path.join(templateDir, htmlFileName);
  console.log(chalk.blue(`\n正在拉取页面 ${id} 服务端数据`));
  Promise.all([getPageData(id), getWidgetVersionInfoFromNpm()]).then(res => {
    console.log(
      chalk.blue(`\n页面 ${id} 数据及组件版本信息拉取完成,生成页面中...`),
    );
    const pageData = res[0].data;
    const widgetInfoList = res[1];
    const widgetVersionMap = {};
    const importWidgetMap = {};
    const installWidgetVersionMap = {};
    widgetInfoList.forEach(val => {
      widgetVersionMap[val.name] = val.version;
    });
    console.log(chalk.green(`组件版本最新信息:`));
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
    Promise.all([
      injectScript2Html(html_path, _dir, pageData),
      writeIndexFile(js_path, _dir, importWidgetMap),
      writePkgFile(pkg_path, _dir, installWidgetVersionMap, pageData),
    ]).then(() => {
      console.log(chalk.green(`\n页面生成完成, 现在开始构建页面...\n`));
      shell.exec(`cd ${_dir} && npm version patch`);
      // commit = gitCommit(id);
      build(id);
    });
  });
}

// 构建项目
async function build(id) {
  deploy_info = {
    COMMIT: commit,
    DATE: new Date().toLocaleString(),
    ID: id,
  };
  // 每次构建都会重新请求页面数据, 升级依赖
  const _dir = path.join(projectDir, id);
  const dest_dir = path.join(_dir, 'dist');
  // shell.cd(_dir);
  // 安装依赖
  console.log(chalk.yellow(`\n安装依赖中...\n`));
  shell.exec(`cd ${_dir} && npm install`);
  console.log(chalk.yellow(`安装完成\n`));
  if (fsExistsSync(dest_dir)) {
    shell.rm('-r', dest_dir);
  }
  // 构建项目
  await rollupBuild(_dir, path.join(_dir, 'dist'), deploy_info);
  // 回调服务接口
  console.log(chalk.green(`\n`));
  console.log(deploy_info);
  console.log(chalk.green(`\n页面 ${id} 构建完成.\n`));
}
// 删除项目
function deleteProj() {
  console.log('delete');
}

program
  .version('0.0.1')
  .description('项目生成器')
  .option('-g, --generate <id>', '生成页面项目')
  .option('-b, --build <id>', '构建一个项目')
  .option('-l, --list', '列出所有页面')
  .option('-d, --delete <id>', '删除项目')
  .action(option => {
    if (option.list) {
      console.log('\n所有页面项目\n');
      shell
        .ls('-l', projectDir)
        .forEach((dir, idx) =>
          console.log(chalk.blue(`${idx + 1}. ${dir.name}`)),
        );
      console.log('\n');
      return;
    }
    if (option.generate) {
      const id = option.generate;
      if (existsPageDir(id)) {
        console.log(chalk.red('\n项目已经存在, 尝试重新构建\n'));
        generate_page(option.id);
      } else {
        console.log(chalk.yellow('\n生成项目\n'));
        generate_project(option.id);
      }
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
        deleteProj(option.build);
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
  generate_project,
};
