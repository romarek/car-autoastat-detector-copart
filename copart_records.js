const fs = require("fs");
const http = require("http");
const https = require("https");
const path = require('path');
const StreamArray = require('stream-json/streamers/StreamArray');
const {Writable} = require('stream');
const axios = require('axios');
const Jimp = require('jimp');

async function convertCSVtoJSON() {
    const filePath = path.join(__dirname, './salesdata.csv');
    let f = fs.readFileSync(filePath, {encoding: 'utf-8'}, 
        function(err){console.log(err);});
    f = f.split("\n");
    headers = f.shift().split(",");

    const json = [];    
    f.forEach(function(d){
        tmp = {}
        row = d.split(",")
        for(let i = 0; i < headers.length; i++){
            tmp[headers[i]] = row[i];
        }
        json.push(tmp);
    });

    const outPath = path.join(__dirname, './salesdata.json');
    fs.writeFileSync(outPath, JSON.stringify(json), 'utf8', 
        function(err){console.log(err);});
}

async function JSONedit() {
    fs.readFile('./salesdata.json', 'utf8', function (err,data) {
        if (err) {
          return console.log(err);
        }
        var result = data.replace(/\\"/g, '');
        // var prettyResult = prettier.format(JSON.stringify(result),{ semi: false, parser: "json" });
        fs.writeFile('./salesdatatoimport.json', result, 'utf8', function (err) {
           if (err) return console.log(err);
        });
      });
    
}

async function JSONkeysReplace() {
    fs.readFile('./salesdatatoimport.json', 'utf8', function (err,data) {
        if (err) {
          return console.log(err);
        }
        var result = data
            .replace(/(Yard number)/g, 'YardNumber')
            .replace(/(Yard name)/g, 'YardName')
            .replace(/(Sale Date M\/D\/CY)/g, 'SaleDateMDCY')
            .replace(/(Day of Week)/g, 'DayOfWeek')
            .replace(/(Sale time \(HHMM\))/g, 'SaleTimeHHMM')
            .replace(/(Time Zone)/g, 'TimeZone')
            .replace(/(Lot number)/g, 'LotNumber')
            .replace(/(Vehicle Type)/g, 'VehicleType')
            .replace(/(Model Group)/g, 'ModelGroup')
            .replace(/(Model Detail)/g, 'ModelDetail')
            .replace(/(Body Style)/g, 'BodyStyle')
            .replace(/(Damage Description)/g, 'DamageDescription')
            .replace(/(Secondary Damage)/g, 'SecondaryDamage')
            .replace(/(Sale Title State)/g, 'SaleTitleState')
            .replace(/(Sale Title Type)/g, 'SaleTitleType')
            .replace(/(Has Keys-Yes or No)/g, 'HasKeysYesOrNo')
            .replace(/(Lot Cond. Code)/g, 'LotCondCode')
            .replace(/(Est. Retail Value)/g, 'EstRetailValue')
            .replace(/(Repair cost)/g, 'RepairCost')
            .replace(/(Runs\/Drives)/g, 'RunsDrives')
            .replace(/(Sale Status)/g, 'SaleStatus')
            .replace(/(Location city)/g, 'LocationCity')
            .replace(/(Location state)/g, 'LocationState')
            .replace(/(Location ZIP)/g, 'LocationZIP')
            .replace(/(Location country)/g, 'LocationCountry')
            .replace(/(Currency Code)/g, 'CurrencyCode')
            .replace(/(Image Thumbnail)/g, 'ImageThumbnail')
            .replace(/(Create Date\/Time)/g, 'CreateDateTime')
            .replace(/(Grid\/Row)/g, 'GridRow')
            .replace(/(Make-an-Offer Eligible)/g, 'MakeAnOfferEligible')
            .replace(/(Buy-It-Now Price)/g, 'BuyItNowPrice')
            .replace(/(Last Updated Time)/g, 'LastUpdatedTime')
            .replace(/(Image URL)/g, 'ImageURL')
            .replace(/(High Bid)/g, 'HighBid')
            .replace(/(Special Note)/, 'SpecialNote')
            .replace(/(Fuel Type)/, 'FuelType')
            .replace(/(Item#)/, 'Item')
            .replace(/(Odometer Brand)/, 'OdometerBrand');
        fs.writeFile('./salesdatatoimportfields.json', result, 'utf8', function (err) {
           if (err) return console.log(err);
        });
      });    
}

async function postRecordsIntoDatabase() {
    const fileStream = fs.createReadStream(path.join(__dirname, './salesdatatoimportfields.json'));
    const jsonStream = StreamArray.withParser();

    let processNumber = 1;

    const processingStream = new Writable({
        write({key, value}, encoding, callback) {          
            setTimeout(() => {
                // console.log(JSON.stringify(value));
                axios.post('http://localhost:8081/api/salesdata', value, { headers: {
                    'Content-Type': 'application/json'
                }})
                .then(function (response) {
                    console.table(`Item ${processNumber}`);
                    processNumber++;
                })
                .catch(function (error) {
                    console.log(error);
                });
                callback();
            }, 50);
        },
        objectMode: true
    });

    fileStream.pipe(jsonStream.input);
    jsonStream.pipe(processingStream);

    processingStream.on('finish', () => console.log('All done'));
}

function getRecordsFromFile() {
    const example = fs.readFile(path.join(__dirname, './salesdatatoimportfields.json'), 'utf8', function(err, data) {
        if (err) {
            return console.log(err);
        }
        dataGenerator(data);
    });
}

async function dataGenerator(data) {
    for await (let num of asyncDataGenerator(data)) {
        const car = {
            VIN: JSON.parse(data)[num].VIN,
            Make: JSON.parse(data)[num].Make,
            ModelGroup: JSON.parse(data)[num].ModelGroup,
            Color: JSON.parse(data)[num].Color,
            Year: JSON.parse(data)[num].Year,
            CreateDateTime: JSON.parse(data)[num].CreateDateTime,
            ImageURL: JSON.parse(data)[num].ImageURL
        };
        await axios
            .get(car.ImageURL, { headers: {
                'Content-Type': 'application/json'
            }})
            .then(function (response) {
                async function downloadImagesToStorage() {
                    for await (let num2 of asyncImagesGenerator()) {
                        getImageForExternal(
                            response.data.lotImages[num2].link[0].url,
                            num2,
                            car.Make,
                            car.ModelGroup,
                            car.Color,
                            car.Year,
                            car.VIN,
                            car.CreateDateTime
                        );
                    }
                }
                downloadImagesToStorage();
                console.log(`Downloaded: ${car.VIN} - ${car.Make} ${car.ModelGroup} ${car.Year} ${car.Color}`);
            })
            .catch(function (error) {
                console.log(error);
            });
    }
}

function getImageForExternal(
    imgURLToRestore,
    number,
    make,
    model,
    color,
    year,
    VIN,
    date
) {
    Jimp.read(imgURLToRestore)
    .then(imageRead => {
        console.log(date);
      return imageRead
        .quality(100)
        .write(`/var/www/html/storage/${make.toLowerCase()}-${model.toLowerCase()}-${year.toLowerCase()}-${color.toLowerCase()}-${VIN}_${number}.jpg`);
    })
    .catch(err => {
      console.error(err);
    });
  }

async function* asyncDataGenerator(data) {
    let i = 1;
    while (i < JSON.parse(data).length) {
      yield i++;
    }
}

async function* asyncImagesGenerator() {
    let i = 0;
    while (i < 10) {
      yield i++;
    }
}

convertCSVtoJSON()
    .then(convertedToJSON => {
        setTimeout(function() {
            JSONedit(convertedToJSON)
                .then(deletedBackslash => {
                    setTimeout(function() {
                        JSONkeysReplace(deletedBackslash)
                            .then(keysReplace => {
                                setTimeout(function() {
                                    postRecordsIntoDatabase();
                                }, 15000)
                                console.log('Proccess 3 finished!');
                            });
                    }, 10000);
                    console.log('Proccess 2 finished!');
                });
        }, 5000);
    })
    .then(proccess => console.log('Proccess finished!'))
    .catch(error => console.log(error));