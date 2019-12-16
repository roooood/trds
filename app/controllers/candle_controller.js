var _ = require('lodash');
var request = require('request');

var base = 'https://finnhub.io/api/v1/';

module.exports = {
    history: function (req, res, next) {
        let params = _.pick(req.body, 'url');

        request(base + params.url, function (error, response, body) {
            return res.send(body);
        });

    },
};
