'use strict';
require('encoding');
const googleStorage = require('@google-cloud/storage');
const express = require('express');
const cors = require('cors');
const path = require('path');
const serverless = require('serverless-http');

// init server app
const app = express();
app.use(express.json());

// set cors
const allowedOrigins = ['http://localhost:3000',
  'https://osobniarcheologie.netlify.app'];

app.use(cors({
  origin: function(origin, callback){
    if(!origin) return callback(null, true);
    if(allowedOrigins.indexOf(origin) === -1){
      let msg = 'The CORS policy for this site does not ' +
      'allow access from the specified Origin.';
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  }
}));

// read .env
require('dotenv').config();

const imageStorage = new googleStorage.Storage({
  projectId: process.env.GOOGLE_PROJECT_ID,
	credentials: {
    client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
		private_key: process.env.GOOGLE_SERVICE_ACCOUNT_KEY
	}
});

const findingBucket = imageStorage.bucket(process.env.FINDING_BUCKET_NAME);

// init db client
const faunadb = require('faunadb');
const client = new faunadb.Client({ 
  secret: process.env.FAUNADB_SECRET,
  domain: 'db.eu.fauna.com',
  scheme: 'https', 
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
  Select,
  Var,
  Filter,
  Function: Fn,
  Update
} = faunadb.query;

// init express router
const router = express.Router();

// FINDINGS
// FINDINGS create
router.post('/findings', async (req, res) => {

  // if (!req.headers.authentication) {
  //   res.send(400, 'missing authorization header');
  // }

  // if (req.headers.authentication !== process.env.API_KEY) {
  //   res.send(401, 'unauthorized request');
  // }

  // const { tags } = params;
  const { basicTagId, timeTagId } = req.body;

  const doc = await client.query(
    Create(
      Collection('findings'),
      {
        data: {
          ...req.body,
          basicTag: Select('ref', Get(
            Ref(
              Collection("tags"),
              basicTagId
            )
          )),
          timeTag: Select('ref', Get(
            Ref(
              Collection("timeTags"),
              timeTagId
            )
          )),
        }
      }
    )
  )
    .catch((e) => res.send(e))

  res.send(doc);
});

// FINDINGS read
router.get('/findings', async (req, res) => {
  const doc = await client.query(
    Map(
      Paginate(
        Filter(
          Match(Index("findings_with_refs")),
          Lambda(
            ["name", "basicTag", "timeTag", "imageUrl", "ref"],
            IsRef(Var("basicTag"))
          )
        )
      ),
      Lambda(
        ["name", "basicTag", "timeTag", "imageUrl", "ref"],
        {
          findingDoc: Get(Var("ref")),
          basicTag: Get(Var("basicTag")),
          timeTag: Get(Var("timeTag")),
        }
      )
    )
    )
    .catch((e) => console.log(e));
        
  return res.json(doc);
});

// FINDINGS find by ID
router.get('/finding/:id', async (req, res) => {

  const doc = await client.query(
      Get(
        Ref(
          Collection("findings"),
          req.params.id
        )
      )
    )
    .catch((e) => console.log(e));
        
  return res.json(doc);
});

// FINDINGS find by tag
router.get('/findings-by-tag/:id', async (req, res) => {

  const docs = await client.query(
    Paginate(
      Join(
        Match(
          Index('findings_by_tag'),
          Get(
            Ref(
              Collection("findings"),
              req.params.id
            )
          )
        ),
        Index("findings")
      )
    )
  ).catch((e) => console.log(e));
  
  res.json(docs)
})

// FINDINGS update

// FINDINGS delete


// FINDING IMAGE

// FIXME: work bitch
// FINDING IMAGE create
router.post('/finding-image', async (req, res) => {
  console.log('post image', JSON.stringify(req.body));

  try {

    const document = await client.query(
      Create(
        Collection('images'),
        {
          data: {
            status: 'UPLOADING'
          }
        }
      )
    );
    
    const documentId = document.ref.id;
    console.log("req.body", req.body.image)
    const bucket = await findingBucket.file(documentId + '.jpg').save(req.body.image).catch((e) => console.log(JSON.stringify(e)));
    console.log("🚀 ~ file: server.js ~ line 209 ~ router.post ~ bucket", bucket)
    

    await client.query(
      Update(
        Ref(Collection('images'), documentId),
        {
          data: {
            status: 'WAITING_FOR_THUMBNAIL'
          }
        }
      )
    );
            
    res.send({documentId});
  } catch (e) {
    console.log(e)
  }
});


// TAGS

// TAGS create
router.post('/tags', async (req, res) => {

  console.log('post taks')

  // if (!req.headers.authentication) {
  //   res.send(400, 'missing authorization header');
  // }

  // if (req.headers.authentication !== process.env.API_KEY) {
  //   res.send(401, 'unauthorized request');
  // }

  const doc = await client.query(
    Create(
      Collection('tags'),
      {
        data: {
          ...req.body
        }
      }
    )
  )
  .catch((e) => res.send(e))

  res.send(doc);
});

// TAGS read
router.get('/tags', async (req, res) => {
  const doc = await client.query(
      Map(
        Paginate(
          Match(Index("all_tags"))
        ),
        Lambda("X", Get(Var("X")))
      )
    ).catch((e) => console.log(e));
  return res.json(doc);
});

// TAGS find by id
router.get('/tag/:id', async (req, res) => {
  const doc = await client.query(
      Get(
        Ref(
          Collection("tags"),
          req.params.id
        )
      )
    ).catch((e) => console.log(e));
  return res.json(doc);
});

// TIME TAGS

// TIME TAGS create
router.post('/time-tags', async (req, res) => {

  console.log('post taks')

  // if (!req.headers.authentication) {
  //   res.send(400, 'missing authorization header');
  // }

  // if (req.headers.authentication !== process.env.API_KEY) {
  //   res.send(401, 'unauthorized request');
  // }

  const doc = await client.query(
    Create(
      Collection('timeTags'),
      {
        data: {
          ...req.body
        }
      }
    )
  )
  .catch((e) => res.send(e))

  res.send(doc);
});

// TIME TAGS read
router.get('/time-tags', async (req, res) => {
  const doc = await client.query(
      Map(
        Paginate(
          Match(Index("all_time_tags"))
        ),
        Lambda("X", Get(Var("X")))
      )
    ).catch((e) => console.log(e));
  return res.json(doc);
});

// TIME TAGS find by id
router.get('/time-tags/:id', async (req, res) => {
  const doc = await client.query(
      Get(
        Ref(
          Collection("timeTags"),
          req.params.id
        )
      )
    ).catch((e) => console.log(e));
  return res.json(doc);
});

// RELATIONS

// RELATION create
router.post('/relation', async (req, res) => {

  // if (!req.headers.authentication) {
  //   res.send(400, 'missing authorization header');
  // }

  // if (req.headers.authentication !== process.env.API_KEY) {
  //   res.send(401, 'unauthorized request');
  // }

  const { finding, tag } = req.body;

  // const connectionFinding = Select('ref', Get(Match(Index('findings'), finding)));
  // const connectionTag = Select('ref', Get(Match(Index('tags'), tag)));

  const doc = await client.query(
    Create(
      Collection('relations'),
      {
        data: {
          finding: Select('ref', Get(
            Ref(
              Collection("findings"),
              finding
            )
          )),
          tag: Select('ref', Get(
            Ref(
              Collection("tags"),
              tag
            )
          )),
        }
      }
    )
  )
  .catch((e) => res.send(e))

  res.send(doc);
});

// RELATION read
router.get('/relations', async (req, res) => {
  const doc = await client.query(
      Map(
        Paginate(
          Match(Index("all_relations"))
        ),
        Lambda("X", Get(Var("X")))
      )
    ).catch((e) => console.log(e));
  return res.json(doc);
});

// RELATION delete
router.delete('/relation', async (req, res) => {
  const doc = await client.query(
    Delete(q.Ref(q.Collection('relations'), req.body.id))
  )

  res.send(doc);
})


// base route
router.get('/', async (req, res) => {
  res.send(`Osobní Archeologie API is running well.`)
});

// server use lambda
app.use('/.netlify/functions/server', router);  // path must route to lambda
app.use('/', (req, res) => res.sendFile(path.join(__dirname, '../index.html')));

// export server module
module.exports = app;
module.exports.handler = serverless(app);