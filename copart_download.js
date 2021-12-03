const https = require('https');
const fs = require('fs');

const file = fs.createWriteStream("salesdata.csv");
const request = https.get('https://storage.bidspace.info/salesdata.csv', function(response) {
  response.pipe(file);
  console.log('Downloading CSV from Copart...');
});