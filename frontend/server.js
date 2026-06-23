// デザイン確定までの最小プレースホルダ。静的な「準備中」ページを 8080 で配信する。
const http = require('http');
const fs = require('fs');
const path = require('path');

const port = process.env.PORT || 8080;
const html = fs.readFileSync(path.join(__dirname, 'public', 'index.html'));

http
  .createServer((_req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
  })
  .listen(port, '0.0.0.0', () => console.log(`Tempica frontend placeholder on :${port}`));
