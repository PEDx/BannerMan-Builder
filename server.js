const express = require('express');
const { generate_page } = require('./generate.js');
const app = express();

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

console.log('listen(3080)');
app.listen(3080);
