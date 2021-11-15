const fs = require("fs");
const http = require("http");
const https = require("https");
const path = require('path');
const StreamArray = require('stream-json/streamers/StreamArray');
const {Writable} = require('stream');
const sutil = require('line-stream-util');
const axios = require('axios');
const Jimp = require('jimp');

async function convertCSVtoJSON() {
    const filePath = path.join(__dirname, './salesdata.csv');
    let f = fs.readFileSync(filePath, {encoding: 'utf-8'}, 
        function(err){console.log(err);});
    f = f.replace(/(High Bid =non-vix,Sealed=Vix)/, 'FinalBid');
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
        var result = data.replace(/\\"/ig, '');
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
            .replace(/(Yard number)/ig, 'YardNumber')
            .replace(/(Yard name)/ig, 'YardName')
            .replace(/(Sale Date M\/D\/CY)/ig, 'SaleDateMDCY')
            .replace(/(Day of Week)/ig, 'DayOfWeek')
            .replace(/(Sale time \(HHMM\))/ig, 'SaleTimeHHMM')
            .replace(/(Time Zone)/ig, 'TimeZone')
            .replace(/(Lot number)/ig, 'LotNumber')
            .replace(/(Vehicle Type)/ig, 'VehicleType')
            .replace(/(Model Group)/ig, 'ModelGroup')
            .replace(/(Model Detail)/ig, 'ModelDetail')
            .replace(/(Body Style)/ig, 'BodyStyle')
            .replace(/(Damage Description)/ig, 'DamageDescription')
            .replace(/(Secondary Damage)/ig, 'SecondaryDamage')
            .replace(/(Sale Title State)/ig, 'SaleTitleState')
            .replace(/(Sale Title Type)/ig, 'SaleTitleType')
            .replace(/(Has Keys-Yes or No)/ig, 'HasKeysYesOrNo')
            .replace(/(Lot Cond. Code)/ig, 'LotCondCode')
            .replace(/(Est. Retail Value)/ig, 'EstRetailValue')
            .replace(/(Repair cost)/ig, 'RepairCost')
            .replace(/(Runs\/Drives)/ig, 'RunsDrives')
            .replace(/(Sale Status)/ig, 'SaleStatus')
            .replace(/(Location city)/ig, 'LocationCity')
            .replace(/(Location state)/ig, 'LocationState')
            .replace(/(Location ZIP)/ig, 'LocationZIP')
            .replace(/(Location country)/ig, 'LocationCountry')
            .replace(/(Currency Code)/ig, 'CurrencyCode')
            .replace(/(Image Thumbnail)/ig, 'ImageThumbnail')
            .replace(/(Create Date\/Time)/ig, 'CreateDateTime')
            .replace(/(Grid\/Row)/ig, 'GridRow')
            .replace(/(Make-an-Offer Eligible)/ig, 'MakeAnOfferEligible')
            .replace(/(Buy-It-Now Price)/ig, 'BuyItNowPrice')
            .replace(/(Last Updated Time)/ig, 'LastUpdatedTime')
            .replace(/(Image URL)/ig, 'ImageURL')
            .replace(/(High Bid)/ig, 'HighBid')
            .replace(/(Special Note)/ig, 'SpecialNote')
            .replace(/(Fuel Type)/ig, 'FuelType')
            .replace(/(Item#)/ig, 'Item')
            .replace(/(Odometer Brand)/ig, 'OdometerBrand');
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
        .write(`../../../../../www/html/storage/${make.toLowerCase()}-${model.toLowerCase()}-${year.toLowerCase()}-${color.toLowerCase()}-${VIN}_${number}.jpg`);
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
                                }, 35000)
                                console.log('Proccess 3 finished!');
                            });
                    }, 10000);
                    console.log('Proccess 2 finished!');
                });
        }, 5000);
    })
    .then(proccess => console.log('Proccess finished!'))
    .catch(error => console.log(error));