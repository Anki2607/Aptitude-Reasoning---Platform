const express = require('express');
const app = express();

app.get('/test', (req, res) => {
  res.send('Test works!');
});

app.listen(3001, () => {
  console.log('Minimal server on 3001');
});
