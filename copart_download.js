const http = require('http');
const fs = require('fs');

const file = fs.createWriteStream("salesdata.csv");
const request = http.get('http://185.157.81.192/salesdata.csv', function(response) {
  response.pipe(file);
  console.log('Downloading CSV from Copart...');
});