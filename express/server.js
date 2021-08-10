'use strict';
require('encoding');
const express = require('express');
const faunadb = require('faunadb');
const path = require('path');
const serverless = require('serverless-http');

// read .env
require('dotenv').config();

// init server app
const app = express();
app.use(express.json())

// init db client
// const client = new faunadb.Client({ secret: process.env.FAUNADB_SECRET });

// // db queries
// const {
//   Paginate,
//   Get,
//   Match,
//   Index,
//   Map,
//   Create,
//   Collection,
//   Lambda,
//   Var
// } = faunadb.query;

// init express router
const router = express.Router();

// base route
router.get('/', async (req, res) => {
  res.send(`Osobní Archeologie API is running well.`)
})

// server use lambda
app.use('/.netlify/functions/server', router);  // path must route to lambda
app.use('/', (req, res) => res.sendFile(path.join(__dirname, '../index.html')));

// export server module
module.exports = app;
module.exports.handler = serverless(app);