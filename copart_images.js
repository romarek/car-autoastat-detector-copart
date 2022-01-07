const axios = require('axios');
const fs = require('fs');
const path = require('path');
const Jimp = require('jimp');

async function getRecordsFromFile() {
    const example = fs.readFile(path.join(__dirname, '../Copart_CSVDownload/salesdatatoimportfields.json'), 'utf8', function(err, data) {
        if (err) {
            return console.log(err);
        }
        setTimeout(function() {
            dataGenerator(data);
        }, 500); 
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
        console.log(`To jest ${car.ImageURL}`);
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
        .write(path.join(__dirname, `/storage/20220107/${make.toLowerCase()}/${make.toLowerCase()}-${model.toLowerCase()}-${year}-${color.toLowerCase()}-${VIN.toLowerCase()}_${number}.jpg`));
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

getRecordsFromFile();
