import aws from 'aws-sdk';
import download from 'download';
import fs from 'fs';
import crypto from 'crypto';
import url from 'url';
import path from 'path';
import axios from 'axios';
import { GQLErrors } from '../../middleware/middleware';
import CustomType from '../../custom-type/custom-type';

export const downloadFiles = async (files: CustomType.FileToBeUploaded1): Promise<CustomType.FileToBeUploaded1> => {
    for (let index = 0; index < Object.keys(files).length; index++) {
        let key = Object.keys(files)[index];
        try {
            //generate cuid for file name
            const cuid = crypto.randomBytes(32).toString('hex');
            const parsed = url.parse(files[key].path);
            const fullname = path.basename(parsed.pathname || '');
            let ext = path.extname(fullname);
            if (!ext) {
                if (key == "video") {
                    ext = '.mp4';
                } else {
                    ext = '.jpg';
                }
            }
            let size = 0;
            const response = await axios.head(files[key].path);
            size = response.headers['content-length'];
            files[key].size = size;
            try {
                try {
                    await download(files[key].path, path.resolve(__dirname, 'temp'), { filename: cuid + ext });
                    //console.log('downloaded with download');
                } catch (error: any) {
                    //console.log(error.message);
                    try {
                        const response = await axios.get(files[key].path, { responseType: 'arraybuffer' });
                        fs.writeFileSync(path.resolve(__dirname, `temp/${cuid + ext}`), response.data);
                        //console.log('downloaded with axios');
                    } catch (error: any) {
                        //console.log(error.message);
                        files[key].file_not_found = true;
                        continue;
                    }

                }

                //check if file is downloaded
                if (fs.existsSync(path.resolve(__dirname, `temp/${cuid + ext}`))) {
                    // Set S3 endpoint to DigitalOcean Spaces
                    const spacesEndpoint = new aws.Endpoint('nyc3.digitaloceanspaces.com');
                    const s3 = new aws.S3({
                        endpoint: spacesEndpoint,
                        accessKeyId: process.env.SPACE_ACCESS_KEY,
                        secretAccessKey: process.env.SPACE_ACCESS_SECRET,
                    });
                    const fileContent = fs.readFileSync(path.resolve(__dirname, `temp/${cuid + ext}`));
                    const params = {
                        Bucket: 'wildsocial',
                        Key: cuid + ext,
                        Body: fileContent,
                        ACL: 'public-read',
                    };
                    try {
                        const data = await s3.upload(params).promise();
                        //console.log(`File uploaded successfully. ${data.Location}`);
                        files[key].uploaded = true;
                        files[key].path = data.Location;
                    }
                    catch (error: any) {
                        files[key].uploaded = false;
                    }
                    try {
                        fs.unlinkSync(path.resolve(__dirname, `temp/${cuid + ext}`));
                    } catch (error: any) {
                        //console.log(error.message);
                    }
                } else {
                    files[key].file_not_found = true;
                }
            } catch (error: any) {
                files[key].file_not_found = true;
            }
        } catch (error: any) {
            files[key].file_not_found = true;
        }
    }
    return files;
};

//         for (let index = 0; index < files.length; index++) {
//             let key = files[index].key;
//             //generate cuid for file name
//             const cuid = crypto.randomBytes(32).toString('hex');
//             const parsed = url.parse(files[index].path);
//             const fullname = path.basename(parsed.pathname || '');
//             const ext = path.extname(fullname);
//             let size = 0;
//             try {
//                 const response = await axios.head(files[index].path);
//                 size = response.headers['content-length'];
//                 files[index].size = size;
//                 try {
//                     await download(files[index].path, 'helper/FileManagment/temp', { filename: cuid + ext });
//                     //check if file is downloaded
//                     if (fs.existsSync(`helper/FileManagment/temp/${cuid + ext}`)) {
//                         // Set S3 endpoint to DigitalOcean Spaces
//                         const spacesEndpoint = new aws.Endpoint('nyc3.digitaloceanspaces.com');
//                         const s3 = new aws.S3({
//                             endpoint: spacesEndpoint,
//                             accessKeyId: process.env.SPACE_ACCESS_KEY,
//                             secretAccessKey: process.env.SPACE_ACCESS_SECRET,
//                         });
//                         const fileContent = fs.readFileSync(`helper/FileManagment/temp/${cuid + ext}`);
//                         const params = {
//                             Bucket: 'skimsocial',
//                             Key: cuid + ext,
//                             Body: fileContent,
//                             ACL: 'public-read',
//                         };
//                         try {
//                             await s3.upload(params).promise();
//                             files[index] = {
//                                 key,
//                                 path: `${process.env.SPACE_ORIGIN_END_POINT}/${cuid + ext}`,
//                                 size: size,
//                                 uploaded: true,
//                                 file_not_found: false
//                             };
//                             fs.unlinkSync(`helper/FileManagment/temp/${cuid + ext}`);
//                         }
//                         catch (error : any) {
//                             fs.unlinkSync(`helper/FileManagment/temp/${cuid + ext}`);
//                             files[index] = {
//                                 key,
//                                 path: files[index].path,
//                                 size: 0,
//                                 uploaded: false,
//                                 file_not_found: false
//                             };
//                         }
//                     }
//                 } catch (error : any) {
//                     files[index] = {
//                         key,
//                         path: files[index].path,
//                         size: 0,
//                         uploaded: false,
//                         file_not_found: true
//                     };
//                 }
//             } catch (error : any) {
//                 files[index] = {
//                     key,
//                     path: files[index].path,
//                     size: 0,
//                     uploaded: false,
//                     file_not_found: true
//                 };
//             }
//         }
//     } catch (error : any) {
//         throw GQLErrors.FILE_NOT_FOUND;
//     }
//     return files;
// }    