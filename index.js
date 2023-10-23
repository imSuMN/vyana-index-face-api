require("dotenv").config();

const express = require("express");
const cors = require("cors");
const fs = require("fs");
const multer = require("multer");

const { uuid } = require("./utils");

const { rekogClient, s3Client } = require("./config");

const { IndexFacesCommand } = require("@aws-sdk/client-rekognition");
const { PutObjectCommand } = require("@aws-sdk/client-s3");

const app = express();
app.use(express.json({ limit: "30mb" }));
app.use(
  express.urlencoded({  extended: false })
);

// app.use(function (req, res, next) {
//   res.header("Access-Control-Allow-Origin", "*");
//   res.header(
//     "Access-Control-Allow-Methods",
//     "GET, POST, OPTIONS, PUT, PATCH, DELETE"
//   );
//   res.header(
//     "Access-Control-Allow-Headers",
//     "x-access-token, Origin, X-Requested-With, Content-Type, Accept"
//   );
//   next();
// });

app.use(cors());

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

app.get("/", (req, res) => {
  res.send("Api Running...");
});

app.post("/indexFaces/:eventId", upload.array("images"), async (req, res) => {
  try {
    const uploadedImages = req.files;

    for (const image of uploadedImages) {
      const imageId = uuid();
      // Add face rekognition collection
      const input = {
        CollectionId: process.env.CollectionID,
        ExternalImageId: imageId,
        Image: {
          Bytes: image.buffer,
        },
      };

      const s3input = {
        Bucket: process.env.BucketName,
        Key: `${req.params.eventId}/` + imageId + ".jpg",
        Body: image.buffer,
      };

      const command = new IndexFacesCommand(input);
      const response = await rekogClient.send(command);

      const s3command = new PutObjectCommand(s3input);
      const s3response = await s3Client.send(s3command);
    }
    res
      .status(200)
      .json({ message: "Images processed and stored successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error processing images" });
  }
});

app.get("*", (req, res) => {
  res.status(404).send("Page Not Found");
});

const PORT = process.env.PORT;
app.listen(PORT, () => {
  console.log(`Server Started on PORT :${PORT}`);
});

module.exports = app;
