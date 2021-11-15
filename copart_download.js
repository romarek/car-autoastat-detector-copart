const https = require('https');
const fs = require('fs');

const file = fs.createWriteStream("salesdata.csv");
const request = https.get('https://inventory.copart.io/FTPLSTDM/salesdata.cgi?authKey=XMTY57AW', function(response) {
  response.pipe(file);
  console.log('Downloading CSV from Copart...');
});