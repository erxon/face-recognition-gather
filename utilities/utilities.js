import { faceDetectionNet } from "../commons/faceDetectionNet.js";
import * as faceapi from "face-api.js";

const loadModels = async () => {
  return Promise.all([
    faceDetectionNet.loadFromDisk("./public/models"),
    faceapi.nets.faceLandmark68Net.loadFromDisk("./public/models"),
    faceapi.nets.faceRecognitionNet.loadFromDisk("./public/models"),
  ]);
};

export { loadModels };
