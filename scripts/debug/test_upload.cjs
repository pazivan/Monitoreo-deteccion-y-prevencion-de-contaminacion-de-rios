const http = require('http');
const req = http.request('http://localhost:3000/api/reportes/INC-CDMX-0020/foto', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' }
}, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log(res.statusCode, data.substring(0, 500)));
});
req.write(JSON.stringify({ evidenciaBase64: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAgAAZABkAAD' }));
req.end();
