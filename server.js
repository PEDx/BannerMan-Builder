const express = require('express');
const generate = require('./generate.js');
const app = express();

app.get('/build/:id', function(req, res) {
  generate.generate_page(req.params.id, res);
  res.send('构建中...');
});

console.log('listen(3080)');
app.listen(3080);
