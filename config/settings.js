var path = require('path');

var settings = {
  path: path.normalize(path.join(__dirname, '..')),
  port: process.env.NODE_PORT || 2657,
  privateKey: 'my private key',
  coinbaseApiKey: '1aa27acf-f12d-4e47-b618-ee7400ff0669',
  database: {
    protocol: "mysql", // or "mysql"
    query: { pool: true },
    host: "localhost",
    database: "trade",
    user: "root",
    password: ""
  }
};

module.exports = settings;
