require("dotenv").config();

const express = require("express");
const cors = require("cors");
const sharp = require("sharp");
const multer = require("multer");

const { uuid } = require("./utils");

const { rekogClient, s3Client } = require("./config");

const { IndexFacesCommand } = require("@aws-sdk/client-rekognition");
const { PutObjectCommand } = require("@aws-sdk/client-s3");

const app = express();
app.use(express.json({ limit: "30mb" }));
app.use(express.urlencoded({ extended: false }));

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
      
      const mainImage = await sharp(image.buffer).metadata();

      
      // const watermark_buffer = await sharp("./watermark.png").resize({
      //   height : Math.round( mainImage.height/10),
      //   width: Math.round( mainImage.width/5)
      // }).toBuffer();

      const watermark_buffer = await sharp("./watermark.png").resize({
        height: Math.round(mainImage.height / 10),
        width: Math.round(mainImage.width / 5),
        fit: "contain",
        background: { r: 255, g: 255, b: 255, alpha: 0 }
      }).toBuffer();
      // .extend({
      //   top: Math.round((mainImage.height - (mainImage.width / 5 * 2)) / 2),
      //   bottom: Math.round((mainImage.height - (mainImage.width / 5 * 2)) / 2),
      //   left: Math.round((mainImage.width - (mainImage.width / 5)) / 2),
      //   right: Math.round((mainImage.width - (mainImage.width / 5)) / 2),
      //   background: { r: 255, g: 255, b: 255, alpha: 0 }
      // })
      
      
      const image_buffer = await sharp(image.buffer)
        .composite([
          {
            input: watermark_buffer,
            gravity: "southeast",
            
          },
        ])
        .toBuffer();

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
        Body: image_buffer,
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
