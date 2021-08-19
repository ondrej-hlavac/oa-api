'use strict';
require('encoding');
const express = require('express');
const cors = require('cors');
const path = require('path');
const serverless = require('serverless-http');

// init server app
const app = express();
app.use(express.json());
// app.use(cors({origin: false}))

const allowedOrigins = ['http://localhost:3000',
  'https://festive-carson-cbfab3.netlify.app'];
app.use(cors({
  origin: function(origin, callback){
    // allow requests with no origin
    // (like mobile apps or curl requests)
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
  Create,
  Ref,
  Collection,
  Lambda,
  Select,
  Var,
  Call,
  Function: Fn
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

  const doc = await client.query(
    Create(
      Collection('findings'),
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

// FINDINGS read
router.get('/findings', async (req, res) => {
  const doc = await client.query(
      Map(
        Paginate(
          Match(Index("all_findings"))
        ),
        Lambda("X", Get(Var("X")))
      )
    )
    .catch((e) => console.log(e));
        
  return res.json(doc);
});

// FINDINGS find by ID
router.get('/finding/:id', async (req, res) => {
  console.log("🚀 ~ file: server.js ~ line 41 ~ router.get ~ req", req)

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