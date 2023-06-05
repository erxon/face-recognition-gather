import mongoose from "mongoose";

const photoSchema = {
  image: String,
  images: [
    {
      publicId: String,
      fileName: String,
    },
  ],
  reportId: { type: mongoose.Schema.Types.ObjectId, ref: "Report" },
  type: String,
  missingPerson: String,
  faceDiscriptor: mongoose.Schema.Types.Array
};

const Photo = mongoose.model("Photo", photoSchema);

export default Photo;
