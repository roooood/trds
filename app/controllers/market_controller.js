var _ = require('lodash');
var request = require('request');
var cryptoUrl = 'https://finnhub.io/api/v1/crypto/symbol?exchange=binance&token=bmlk6r7rh5rb2pv98jqg';
var forexUrl = 'https://finnhub.io/api/v1/forex/symbol?exchange=fxpig&token=bmlk6r7rh5rb2pv98jqg';
module.exports = {
    new: function (req, res, next) {
        // request(cryptoUrl, function (error, response, body) {
        //     body = JSON.parse(body);
        //     let data = [];
        //     let item;
        //     if (typeof body == 'object') {
        //         for (item of body) {
        //             data.push({
        //                 type: 'crypto',
        //                 symbol: item.symbol,
        //                 display: item.displaySymbol,
        //                 description: item.description.replace('Binance ', '')
        //             });
        //         }
        //         req.models.market.create(data);
        //         return res.send(data);
        //     }
        // });

        // request(forexUrl, function (error, response, body) {
        //     body = JSON.parse(body);
        //     let data = [];
        //     let item;
        //     if (typeof body == 'object') {
        //         for (item of body) {
        //             data.push({
        //                 type: 'forex',
        //                 symbol: item.symbol,
        //                 display: item.displaySymbol,
        //                 description: item.description.replace('FXPIG ', '').replace('.spa', '').replace('.sfl', '').replace('.mpa', '')
        //             });
        //         }
        //         req.models.market.create(data);
        //         return res.send(data);
        //     }
        // });
    },
    list: function (req, res, next) {
        let { type } = req.params;
        req.models.market.find({ type }, function (err, markets) {
            let data = {};
            data[type] = markets;
            return res.send(data)
        });
    }
};
