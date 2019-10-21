const express = require('express');
const generate = require('./generate.js');
const app = express();

function getRes(msg) {
  return {
    code: 0,
    msg,
  };
}

app.get('/generate/:id', function(req, res) {
  generate.generate_project(req.params.id);
  res.send(getRes('构建中'));
});
app.get('/build/:id', function(req, res) {
  generate.generate_page(req.params.id);
  res.send(getRes('构建中'));
});

console.log('listen(3080)');
app.listen(3080);
