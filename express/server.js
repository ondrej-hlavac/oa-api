'use strict';
require('encoding');
const express = require('express');
const path = require('path');
const faunadb = require('faunadb');
const serverless = require('serverless-http');

// read .env
require('dotenv').config();

// init server app
const app = express();
app.use(express.json());

// init db client
const client = new faunadb.Client({ secret: process.env.FAUNADB_SECRET });
console.log("🚀 ~ file: server.js ~ line 20 ~ process.env.FAUNADB_SECRET", process.env.FAUNADB_SECRET)

// // db queries
const {
  Paginate,
  Get,
  Match,
  Index,
  Map,
  Create,
  Collection,
  Lambda,
  Var
} = faunadb.query;

// init express router
const router = express.Router();


// FINDINGS

// create
router.post('/findings', async (req, res) => {

  // if (!req.headers.authentication) {
  //   res.send(400, 'missing authorization header');
  // }

  // if (req.headers.authentication !== process.env.API_KEY) {
  //   res.send(401, 'unauthorized request');
  // }

  console.log("🚀 ~ file: server.js ~ line 42 ~ app.post ~ req", req.body)

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

// read
router.get('/findings', async (req, res) => {

  const doc = await client.query(
    Map(
      Paginate(
        Match(Index("all_findings"))
      ),
      Lambda("X", Get(Var("X")))
    )
  ).catch((e) => console.log(e))

  return res.json(doc)
});

// find by tag

// update

// delete


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