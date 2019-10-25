var _ = require('lodash');
var request = require('request');
var settings = require('../../config/settings');

var url = 'https://finnhub.io/api/v1/@/candle?symbol=#&resolution=!&count=' + settings.candleLimit + '&token=bmlk6r7rh5rb2pv98jqg';

var tbl = { '1m': 'min1', '5m': 'min5', '15m': 'min15', '30m': 'min30', 'H': 'hour', 'D': 'day', 'W': 'week', 'M': 'month', }
var rsl = { '1m': '1', '5m': '5', '15m': '15', '30m': '30', 'H': '60', 'D': 'D', 'W': 'W', 'M': 'M' };

function hub2db(data, market) {
    let len = data.c.length, i, ret = [];
    for (i = 0; i < len; i++) {
        ret.push({
            open: data.o[i],
            high: data.h[i],
            low: data.l[i],
            close: data.c[i],
            value: data.v[i],
            time: data.t[i],
            market_id: market
        })
    }
    return ret;
}
module.exports = {
    history: function (req, res, next) {
        let params = _.pick(req.body, 'market', 'resolution');
        let table = tbl[params.resolution];
        let childGet = 'get' + table.charAt(0).toUpperCase() + table.slice(1);
        let resolution = rsl[params.resolution];
        req.models.market.get(params.market, function (err, market) {
            market[childGet](function (err, candles) {
                let candle, ret = [];
                if (candles.length == 0) {
                    let api = url.replace('@', market.type).replace('#', market.symbol).replace('!', resolution);
                    request(api, function (error, response, body) {
                        body = JSON.parse(body);
                        if (typeof body == 'object') {
                            let data = hub2db(body, market.id);
                            req.models[table].create(data, function (err, candles) {
                                for (candle of candles) {
                                    ret.push(candle.serialize())
                                }
                                return res.send(ret);
                            })
                        }
                    });
                }
                else {
                    for (candle of candles) {
                        ret.push(candle.serialize())
                    }
                    return res.send(ret);
                }
            })
        });
    },
};
