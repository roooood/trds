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
        let params = _.pick(req.body, 'url');

        request(params.url, function (error, response, body) {
            return res.send(body);
        });

    },
};
