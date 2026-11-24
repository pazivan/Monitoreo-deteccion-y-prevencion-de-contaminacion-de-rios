const http = require('http');
const req = http.request('http://localhost:3000/api/reportes', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' }
}, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log(res.statusCode, data));
});
req.write(JSON.stringify({
  correo: 'test@example.com',
  folio: 'INC-CDMX-9999',
  categoria: 'Falla en alumbrado público',
  ubicacion: 'Test Location',
  descripcion: 'Test Description',
  ubicacionGps: '19.4326,-99.1332',
  evidenciaBase64: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAgAAZABkAAD'
}));
req.end();
