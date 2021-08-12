const s3 = require("./s3");
const { successResponse, errorResponse } = require("../src/response");
const im = require('imagemagick');
const fs = require('fs');
const os = require('os');

const getFile = (imageBucket, objectKey, reject) => s3.getFileFromBucket(imageBucket, objectKey).catch(err => reject(errorResponse(err.code, 404, err)));


exports.original = (imageBucket, objectKey) => new Promise((resolve, reject) =>

    getFile(imageBucket, objectKey, reject).then(data => {
        const resBody = data.Body.toString('base64');
        if (resBody.length > 6 * 1024 * 1024) {
            exports.resize(imageBucket, objectKey, 2560).then(resolve).catch(reject);
            return;
        }
        resolve(successResponse(resBody, 'image/jpeg'));
    }));

exports.resize = (imageBucket, objectKey, width, height) => new Promise((resolve, reject) =>

    getFile(imageBucket, objectKey, reject).then(data => {

        const normalizeObjectKey = objectKey.split('/').join('.');
        const resizedFile = `${os.tmpDir}/resized.${imageBucket}.${normalizeObjectKey}.${width}.${height}`;

        const resizeCallback = (err, output, resolve, reject) => {
            if (err) {
                reject(errorResponse(null, 500, err));
            } else {
                console.log('INFO: Resize operation completed successfully');
                im.identify(resizedFile, (err, result) => {
                    console.log('INFO: MIME type of thumbnail is being identified');
                    let mimeType;
                    switch (result.format) {
                        case 'GIF':
                            mimeType = 'image/gif';
                            break;
                        case 'PNG':
                            mimeType = 'image/png';
                            break;
                        default:
                            mimeType = 'image/jpeg';
                    }

                    const response = successResponse(Buffer.from(fs.readFileSync(resizedFile)).toString('base64'), mimeType);
                    fs.unlink(resizedFile, () => console.log("INFO: Resized file cleaned up"));
                    resolve(response);
                });
            }
        };

        if (!!height && !!width) {
            im.crop({
                width: width,
                srcData: data.Body,
                dstPath: resizedFile,
                height: height,
                quality: 1,
                gravity: "Center"
            }, (err, output) => resizeCallback(err, output, resolve, reject));
        } else if (width) {
            im.resize({
                width: width,
                srcData: data.Body,
                dstPath: resizedFile
            }, (err, output) => resizeCallback(err, output, resolve, reject));
        } else {
            im.resize({
                height: height,
                srcData: data.Body,
                dstPath: resizedFile
            }, (err, output) => resizeCallback(err, output, resolve, reject));
        }
    }));