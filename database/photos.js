import Photo from "./Photo.js";

async function getPhotos() {
  try {
    const photos = await Photo.find({ type: "reference" });
    return photos;
  } catch (error) {
    return error;
  }
}

export { getPhotos };
