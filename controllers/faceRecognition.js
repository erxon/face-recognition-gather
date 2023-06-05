import { canvas } from "../commons/env.js";
import { faceDetectionOptions } from "../commons/faceDetectionNet.js";
import * as faceapi from "face-api.js";
import { getPhotos } from "../database/photos.js";
import { loadModels } from "../utilities/utilities.js";

const getFacesDescriptors = async (image) => {
  const facesDescriptors = await faceapi
    .detectAllFaces(image, faceDetectionOptions)
    .withFaceLandmarks()
    .withFaceDescriptors();

  return facesDescriptors;
};

const getSingleFaceDescriptors = async (image) => {
  const detections = await faceapi
    .detectSingleFace(image)
    .withFaceLandmarks()
    .withFaceDescriptor();
  return detections;
};

const loadLabeledDescriptors = async (references) => {
  return Promise.all(
    references.map(async (reference) => {
      const label = reference._id.toString();
      //Array of objects
      const faces = reference.images;
      const descriptions = [];
      for (let index = 0; index < faces.length; index++) {
        const imageId = faces[index].publicId;
        const imageUrl = process.env.REPORT_PHOTOS_URL.concat(imageId);
        const canvasImage = await canvas.loadImage(imageUrl);
        const detections = await getSingleFaceDescriptors(canvasImage);

        descriptions.push(detections.descriptor);
      }
      return new faceapi.LabeledFaceDescriptors(label, descriptions);
    })
  );
};

const loadImage = async (imageId) => {
  const imageUrl = process.env.QUERY_PHOTOS_URL.concat(imageId);
  const canvasImage = await canvas.loadImage(imageUrl);

  return canvasImage;
};

const loadMatches = async (query, references) => {
  const results = loadModels().then(async () => {
    const labeledDescriptors = await loadLabeledDescriptors(references);
    console.log(labeledDescriptors);
    const queryImage = await loadImage(query);
    const queryImageDescriptors = await getFacesDescriptors(queryImage);

    const faceMatcher = new faceapi.FaceMatcher(labeledDescriptors, 0.6);

    const matches = queryImageDescriptors
      .map((res) => {
        const bestMatch = faceMatcher.findBestMatch(res.descriptor);
        return bestMatch;
      })
      .filter((face) => {
        return face.distance <= 0.6;
      });

    return matches;
  });
  return results;
};

const matches = async (req, res) => {
  const query = req.body.imageId;
  const references = await getPhotos();
  try {
    const matches = await loadMatches(query, references);
    res.status(200).json({ matches: matches });
  } catch (error) {
    res.status(400).json({ error: error, message: "something went wrong" });
  }
};

const labeledDescriptors = async (req, res) => {
  const references = req.body.references;
  loadModels().then(async () => {
    try {
      const labeledDescriptors = await loadLabeledDescriptors(references);
      console.log(typeof labeledDescriptors[0].descriptors);
      res.status(200).json({ results: labeledDescriptors });
    } catch (error) {
      res.status(400).json({ error: error, message: "something went wrong" });
    }
  });
};

export { matches, labeledDescriptors };
