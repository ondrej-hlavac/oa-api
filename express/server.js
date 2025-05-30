"use strict";
require("encoding");
const { Storage } = require("@google-cloud/storage");
const processFile = require("../middleware/upload");
const { format } = require("util");
const express = require("express");
const cors = require("cors");
const path = require("path");
const serverless = require("serverless-http");
const findingsData = require("../faunaBackup/findings.json");
const findingsTagsData = require("../faunaBackup/tags.json");
const findingsTimeTagsData = require("../faunaBackup/time-tags.json");

// init server app
const app = express();
app.use(express.json());

// set cors
const allowedOrigins = [
  "http://localhost:3000",
  "https://osobniarcheologie.com",
  "https://www.osobniarcheologie.com",
  "https://www.osobniarcheologie.cz",
  "https://osobniarcheologie.cz",
];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin) return callback(null, true);
      if (allowedOrigins.indexOf(origin) === -1) {
        let msg = "The CORS policy for this site does not " + "allow access from the specified Origin!";
        return callback(new Error(msg), false);
      }
      return callback(null, true);
    },
  })
);

// read .env
require("dotenv").config();

// google cloud storage
const imageStorage = new Storage({
  // keyFilename
  projectId: process.env.GOOGLE_PROJECT_ID,
  credentials: {
    client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    private_key: process.env.GOOGLE_SERVICE_ACCOUNT_KEY.replace(/\\n/gm, "\n"),
  },
});

const bucket = imageStorage.bucket(process.env.FINDING_BUCKET_NAME);
// console.log("process.env.GOOGLE_SERVICE_ACCOUNT_KEY.replace(/\\n/gm, '\n')", process.env.GOOGLE_SERVICE_ACCOUNT_KEY.replace(/\\n/gm, '\n'))

// init db client
const faunadb = require("faunadb");
const client = new faunadb.Client({
  secret: process.env.FAUNADB_SECRET,
  domain: "db.eu.fauna.com",
  scheme: "https",
});

// // db queries
const {
  Paginate,
  Get,
  Match,
  Index,
  Join,
  Map,
  IsRef,
  Create,
  Ref,
  Collection,
  Lambda,
  Let,
  Select,
  Var,
  Filter,
  Documents,
  Function: Fn,
  Update,
} = faunadb.query;

// init express router
const router = express.Router();

// FINDINGS
// FINDINGS create
router.post("/findings", async (req, res) => {
  // if (!req.headers.authentication) {
  //   res.send(400, 'missing authorization header');
  // }

  // if (req.headers.authentication !== process.env.API_KEY) {
  //   res.send(401, 'unauthorized request');
  // }

  // const { tags } = params;
  const { basicTagId, timeTagId } = req.body;

  const doc = await client
    .query(
      Create(Collection("findings"), {
        data: {
          ...req.body,
          basicTag: Select("ref", Get(Ref(Collection("tags"), basicTagId))),
          timeTag: Select("ref", Get(Ref(Collection("timeTags"), timeTagId))),
        },
      })
    )
    .catch((e) => res.send(e));

  res.send(doc);
});

// FINDINGS read
router.get("/findings", async (req, res) => {
  console.log("get findings");
  // const doc = await client
  //   .query(
  //     Map(
  //       Paginate(
  //         Filter(Match(Index("findings_with_refs")), Lambda(["name", "basicTag", "timeTag", "imageUrl", "ref"], IsRef(Var("basicTag")))),
  //         { size: 400 }
  //       ),
  //       Lambda(["name", "basicTag", "timeTag", "imageUrl", "ref"], {
  //         findingDoc: Get(Var("ref")),
  //         basicTag: Get(Var("basicTag")),
  //         timeTag: Get(Var("timeTag")),
  //       })
  //     )
  //   )
  //   .catch((e) => console.log(e));

  return res.json(findingsData);
  return res.json(doc);
});

// FINDINGS find by ID
router.get("/finding/:id", async (req, res) => {
  // const doc = await client
  //   .query(
  //     // Map(
  //     //   Paginate(Documents(Collection('findings'),req.params.id)),
  //     //   // and in this function, the magic will happen, for now we just return the tweet.
  //     //   Lambda('f',
  //     //     Let({
  //     //         fweet: Get(Var('f'))
  //     //       },
  //     //       Var('fweet')
  //     //     )
  //     //   )
  //     // )
  //     Get(Ref(Collection("findings"), req.params.id))
  //   )
  //   .catch((e) => console.log(e));

  const findingById = findingsData.data.find((finding) => finding.findingDoc.ref["@ref"].id === req.params.id);

  return res.json(findingById);
});

// FINDINGS find by tag
router.get("/findings-by-tag/:id", async (req, res) => {
  // const docs = await client
  //   .query(Paginate(Join(Match(Index("findings_by_tag"), Get(Ref(Collection("findings"), req.params.id))), Index("findings"))))
  //   .catch((e) => console.log(e));

  const docs = findingsData.data.filter(
    (finding) => finding.basicTag.ref["@ref"].id === req.params.id || finding.timeTag.ref["@ref"].id === req.params.id
  );

  res.json({ data: docs.findingDoc });
});

// FINDINGS update
// router.put('/finding', async (req, res) => {

// })

// FINDINGS delete

// FINDING IMAGE

// FIXME: work bitch
// FINDING IMAGE create
router.post("/finding-image", async (req, res) => {
  // console.log('post image', req);

  try {
    await processFile(req, res);

    if (!req.file) {
      return res.status(400).send({ message: "Please upload a file!" });
    }

    // Create a new blob in the bucket and upload the file data.
    const blob = bucket.file(req.file.originalname);
    const blobStream = blob.createWriteStream({
      resumable: false,
    });

    blobStream.on("error", (err) => {
      res.status(500).send({ message_blobStream: err.message });
    });

    blobStream.on("finish", async (data) => {
      // Create URL for directly file access via HTTP.
      const privateUrl = format(`https://storage.googleapis.com/${bucket.name}/${blob.name}`);

      const publicUrl = format(`https://storage.googleapis.com/finding_images_thumbnails/${blob.name}`);

      try {
        // Make the file public
        await bucket.file(req.file.originalname).makePublic();
      } catch {
        return res.status(201).send({
          message: `Uploaded the file successfully: ${req.file.originalname}, but public access is denied!`,
          privateUrl: privateUrl,
          publicUrl: publicUrl,
          originalName: req.file.originalname,
        });
      }

      res.status(200).send({
        message: "Uploaded the file successfully: " + req.file.originalname,
        url: publicUrl,
      });
    });

    blobStream.end(req.file.buffer);
  } catch (err) {
    res.status(500).send({
      message: `Could not upload the file: ${req.file.originalname}. ${err}`,
    });
  }

  // TODO: old try
  // try {

  //   const document = await client.query(
  //     Create(
  //       Collection('images'),
  //       {
  //         data: {
  //           status: 'UPLOADING'
  //         }
  //       }
  //     )
  //   );

  //   const documentId = document.ref.id;
  //   // console.log("req.body.image", req.body)
  //   await findingBucket.file(documentId + '.jpg').save(req.body).catch((e) => console.log('bucket file save error', JSON.stringify(e)));
  //   // console.log("🚀 ~ file: server.js ~ line 216 ~ router.post ~ findingBucket", findingBucket)
  //   // console.log("🚀 ~ file: server.js ~ line 209 ~ router.post ~ bucket", bucket)

  //   await client.query(
  //     Update(
  //       Ref(Collection('images'), documentId),
  //       {
  //         data: {
  //           status: 'WAITING_FOR_THUMBNAIL'
  //         }
  //       }
  //     )
  //   );

  //   res.send({documentId});
  // } catch (e) {
  //   console.log('post finding image error', e)
  // }
});

// TAGS

// TAGS create
router.post("/tags", async (req, res) => {
  console.log("post taks");

  // if (!req.headers.authentication) {
  //   res.send(400, 'missing authorization header');
  // }

  // if (req.headers.authentication !== process.env.API_KEY) {
  //   res.send(401, 'unauthorized request');
  // }

  const doc = await client
    .query(
      Create(Collection("tags"), {
        data: {
          ...req.body,
        },
      })
    )
    .catch((e) => res.send(e));

  res.send(doc);
});

// TAGS read
router.get("/tags", async (req, res) => {
  // const doc = await client.query(Map(Paginate(Match(Index("all_tags"))), Lambda("X", Get(Var("X"))))).catch((e) => console.log(e));

  return res.json(findingsTagsData);
});

// TAGS find by id
router.get("/tag/:id", async (req, res) => {
  // const doc = await client.query(Get(Ref(Collection("tags"), req.params.id))).catch((e) => console.log(e));
  const doc = findingsTagsData.data.find((tag) => tag.ref["@ref"].id === req.params.id);
  return res.json(doc);
});

// TIME TAGS

// TIME TAGS create
router.post("/time-tags", async (req, res) => {
  console.log("post taks");

  // if (!req.headers.authentication) {
  //   res.send(400, 'missing authorization header');
  // }

  // if (req.headers.authentication !== process.env.API_KEY) {
  //   res.send(401, 'unauthorized request');
  // }

  const doc = await client
    .query(
      Create(Collection("timeTags"), {
        data: {
          ...req.body,
        },
      })
    )
    .catch((e) => res.send(e));

  res.send(doc);
});

// TIME TAGS read
router.get("/time-tags", async (req, res) => {
  // const doc = await client.query(Map(Paginate(Match(Index("all_time_tags"))), Lambda("X", Get(Var("X"))))).catch((e) => console.log(e));

  return res.json(findingsTimeTagsData);
  return res.json(doc);
});

// TIME TAGS find by id
router.get("/time-tags/:id", async (req, res) => {
  // const doc = await client.query(Get(Ref(Collection("timeTags"), req.params.id))).catch((e) => console.log(e));

  const doc = findingsTimeTagsData.data.find((tag) => tag.ref["@ref"].id === req.params.id);
  return res.json(doc);
});

// RELATIONS

// RELATION create
router.post("/relation", async (req, res) => {
  // if (!req.headers.authentication) {
  //   res.send(400, 'missing authorization header');
  // }

  // if (req.headers.authentication !== process.env.API_KEY) {
  //   res.send(401, 'unauthorized request');
  // }

  const { finding, tag } = req.body;

  // const connectionFinding = Select('ref', Get(Match(Index('findings'), finding)));
  // const connectionTag = Select('ref', Get(Match(Index('tags'), tag)));

  const doc = await client
    .query(
      Create(Collection("relations"), {
        data: {
          finding: Select("ref", Get(Ref(Collection("findings"), finding))),
          tag: Select("ref", Get(Ref(Collection("tags"), tag))),
        },
      })
    )
    .catch((e) => res.send(e));

  res.send(doc);
});

// RELATION read
router.get("/relations", async (req, res) => {
  const doc = await client.query(Map(Paginate(Match(Index("all_relations"))), Lambda("X", Get(Var("X"))))).catch((e) => console.log(e));
  return res.json(doc);
});

// RELATION delete
router.delete("/relation", async (req, res) => {
  const doc = await client.query(Delete(q.Ref(q.Collection("relations"), req.body.id)));

  res.send(doc);
});

// base route
router.get("/", async (req, res) => {
  res.send(`Osobní Archeologie API is running well.`);
});

// server use lambda
app.use("/.netlify/functions/server", router); // path must route to lambda
app.use("/", (req, res) => res.sendFile(path.join(__dirname, "../index.html")));

// export server module
module.exports = app;
module.exports.handler = serverless(app);
