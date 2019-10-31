const express = require('express');
const bodyParser = require('body-parser');
const {
  generate_page,
  delete_project,
  unwrap_npm_package,
  list_project,
} = require('../generate.js');
const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

const block_map = {};

// fix: 单个任务需要在构建时 block
app.get('/build/:id', function(req, res) {
  const id = req.params.id;
  if (block_map[id]) {
    res.send({ msg: `页面 ${id} 构建进行中,请稍后再试` });
    return;
  }
  block_map[id] = true;
  generate_page(id, res)
    .then(msg => {
      delete block_map[id];
      res.send({ msg });
    })
    .catch(() => {
      delete block_map[id];
      res.send({ msg: `页面 ${id} 构建出现异常,请联系管理员` });
    });
});
app.get('/projects', function(req, res) {
  list_project().then(projects => {
    res.send({ projects });
  });
});
app.get('/delete/:id', function(req, res) {
  const id = req.params.id;
  console.log(id);
  if (block_map[id]) {
    res.send({ msg: `页面 ${id} 构建进行中,请稍后再试` });
    return;
  }
  delete_project(id).then(msg => {
    res.send(msg);
  });
});

// 用来配合发包工具 publish 时,解开包
app.post('/unwrap', function(req, res) {
  const data = req.body;
  unwrap_npm_package(data);
  res.send({ msg: 'ok' });
});

console.log('listen(3080)');
app.listen(3080);
