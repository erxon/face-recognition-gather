import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import * as faceapi from "face-api.js";
import { canvas } from "./commons/env.js";
import { saveFile } from "./commons/saveFile.js";
import {
  faceDetectionNet,
  faceDetectionOptions,
} from "./commons/faceDetectionNet.js";
import mongoose from "mongoose";
import dotenv from "dotenv";
import bodyParser from "body-parser";
import multer from "multer";
import { getPhotos } from "./photos.js";
dotenv.config();

mongoose.connect(process.env.MONGO_DB, { useNewUrlParser: true });
const database = mongoose.connection;
database.on("error", (error) => console.error(error));
database.once("open", async () => {
  console.log("Connected to DB");
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.static("public"));
app.use(express.static("commons"));
app.use(
  bodyParser.urlencoded({
    extended: true,
  })
);
app.use(bodyParser.json());
const port = process.env.PORT || 8000;
const upload = multer();

app.get("/", (req, res) => {
  const QUERY_IMAGE =
    "https://res.cloudinary.com/dg0cwy8vx/image/upload/v1682394439/my-uploads/lw2lglf5ggx5crwewrc6.jpg";

  async function run() {
    await faceDetectionNet.loadFromDisk("./public/models");
    //Face recognition
    await faceapi.nets.faceLandmark68Net.loadFromDisk("./public/models");
    await faceapi.nets.faceRecognitionNet.loadFromDisk("./public/models");

    const labeledFaceDescriptors = await loadLabeledImages();
    const queryImage = await canvas.loadImage(QUERY_IMAGE);

    const resultsQuery = await faceapi
      .detectAllFaces(queryImage, faceDetectionOptions)
      .withFaceLandmarks()
      .withFaceDescriptors();

    //Face matcher
    const faceMatcher = new faceapi.FaceMatcher(labeledFaceDescriptors, 0.6);

    const queryDrawBoxes = resultsQuery.map((res) => {
      const bestMatch = faceMatcher.findBestMatch(res.descriptor);
      console.log(bestMatch);
      return new faceapi.draw.DrawBox(res.detection.box, {
        label: bestMatch.toString(),
      });
    });
    const outQuery = faceapi.createCanvasFromMedia(queryImage);
    queryDrawBoxes.forEach((drawBox) => drawBox.draw(outQuery));

    saveFile("queryImage.jpg", outQuery.toBuffer("image/jpeg"));

    console.log("done, saved results to out/queryImage.jpg");

    async function loadLabeledImages() {
      //get photos in database
      const missingPersons = await getPhotos();

      return Promise.all(
        missingPersons.map(async (missingPerson) => {
          const label = missingPerson.missingPerson;
          const descriptions = [];
          for (let i = 0; i < 3; i++) {
            const publicId = missingPerson.images[i].publicId;
            const imageUrl = process.env.REPORT_PHOTOS_URL.concat(publicId);
            const image = await canvas.loadImage(imageUrl);
            console.log(image);
            const detections = await faceapi
              .detectSingleFace(image)
              .withFaceLandmarks()
              .withFaceDescriptor();
            descriptions.push(detections.descriptor);
          }
          return new faceapi.LabeledFaceDescriptors(label, descriptions);
        })
      );
    }
  }
  run();

  res.sendFile(`${__dirname}/index.html`);
});

//submit a query image
app.post("/findMatch", async (req, res) => {
  async function run() {
    await faceDetectionNet.loadFromDisk("./public/models");
    //Face recognition
    await faceapi.nets.faceLandmark68Net.loadFromDisk("./public/models");
    await faceapi.nets.faceRecognitionNet.loadFromDisk("./public/models");

    //Get labeled face descriptors
    const labeledFaceDescriptors = await loadLabeledImages();

    //Get the url of the query image
    const queryImage = process.env.QUERY_PHOTOS_URL.concat(req.body.publicId);
    console.log(queryImage);
    const loadQueryImage = await canvas.loadImage(queryImage);

    //get the descriptors of the query image
    const resultsQuery = await faceapi
      .detectAllFaces(loadQueryImage, faceDetectionOptions)
      .withFaceLandmarks()
      .withFaceDescriptors();

    //Match to known faces
    const faceMatcher = new faceapi.FaceMatcher(labeledFaceDescriptors, 0.6);
    const matches = resultsQuery
      .map((res) => {
        const bestMatch = faceMatcher.findBestMatch(res.descriptor);
        return bestMatch;
      })
      .filter((face) => {
        return face.distance <= 0.6;
      });
    //return only the matches that have less than 0.6 distance
    //loop through report-photos
    async function loadLabeledImages() {
      //get photos in database
      const missingPersons = await getPhotos();

      return Promise.all(
        missingPersons.map(async (missingPerson) => {
          const label = missingPerson._id.toString();
          const descriptions = [];
          for (let i = 0; i < 3; i++) {
            const publicId = missingPerson.images[i].publicId;
            const imageUrl = process.env.REPORT_PHOTOS_URL.concat(publicId);
            const image = await canvas.loadImage(imageUrl);
            console.log(image);
            const detections = await faceapi
              .detectSingleFace(image)
              .withFaceLandmarks()
              .withFaceDescriptor();
            descriptions.push(detections.descriptor);
          }
          return new faceapi.LabeledFaceDescriptors(label, descriptions);
        })
      );
    }
    return matches;
  }

  try {
    const matches = await run();
    res.status(200).json({ matches: matches });
  } catch (error) {
    res.status(400).json({ error: error + "Something went wrong" });
  }
});

//compute image descriptor for every uploaded images
app.post("/computeFaceDescriptor", async (req, res) => {
  const name = req.body.name;
  const images = req.body.photos

  await faceDetectionNet.loadFromDisk("./public/models");
  //Face recognition
  await faceapi.nets.faceLandmark68Net.loadFromDisk("./public/models");
  await faceapi.nets.faceRecognitionNet.loadFromDisk("./public/models");

  try{
    const labeledFaceDescriptors = await loadLabeledImages();
    res.status(200).json({descriptors: labeledFaceDescriptors})
  } catch (error) {
    res.status(400).json(error)
  }
  

  async function loadLabeledImages() {
    //get photos in database
    const photos = [{
      label: name,
      images: images
    }];

    console.log(photos[0].images)
    return Promise.all(
      photos.map(async (photo) => {
        const descriptions = [];
        for (let i = 0; i < images.length; i++) {
          const publicId = photo.images[i];
          const imageUrl = process.env.REPORT_PHOTOS_URL.concat(publicId);
          const image = await canvas.loadImage(imageUrl);

          const detections = await faceapi
            .detectSingleFace(image)
            .withFaceLandmarks()
            .withFaceDescriptor();
          descriptions.push(detections.descriptor);
        }
        return new faceapi.LabeledFaceDescriptors(photo.label, descriptions);
      })
    );
  }

  
});

app.listen(port, () => {
  console.log("server is running on port:", port);
});
