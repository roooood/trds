var colyseus = require('colyseus');
var models = require('../app/models/');
var request = require('request');
var canddleUrl = 'https://finnhub.io/api/v1/{type}/candle?symbol={symbol}&resolution=1&count=1&token={token}';
var canddleUrlFrom = 'https://finnhub.io/api/v1/{type}/candle?symbol={symbol}&resolution=1&from={from}&to={to}&token={token}';

class State {
    constructor() {
    }
}
class Server extends colyseus.Room {
    constructor(options) {
        super(options);
        this.db = null;
        this.models = null;
        this.users = {};
        this.tokens = {};
        this.setting = {};
        this.orders = [];
        this.time = 0;
        this.checker = null;
    }
    async onInit(options) {
        this.setState(new State);
        let promise = new Promise((resolve, reject) => {
            models(function (err, ldb) {
                resolve(ldb);
            });
        });

        this.db = await promise;
        this.models = this.db.models;

        this.refreshConfigData();
        this.getAllOrders();

        this.clock.setTimeout(() => {
            this.checker = this.clock.setInterval(this.checkOrders, 1000);
        }, 2000);
    }
    refreshConfigData() {
        let item;

        this.models.setting.find().all((err, setting) => {
            if (err) return next(err);
            for (item of setting) {
                this.setting[item.key] = item.value;
            }
        })
        this.models.tokens.find().all((err, tokens) => {
            if (err) return next(err);
            for (item of tokens) {
                if (!(item.token in this.tokens)) {
                    this.tokens[item.token] = 0;
                }
            }
        })
    }
    requestJoin(options, isNewRoom) {
        return true;
    }
    async onAuth(options) {
        let promise = new Promise((resolve, reject) => {
            this.models.user.find({ token: options.key }, 1, (err, user) => {
                resolve(user[0])
            });
        });
        return await promise;
    }
    onJoin(client, options, auth) {
        client.model = auth;
        let user = {
            id: auth.id,
            username: auth.username,
            balance: {
                real: auth.realBalance,
                practice: auth.practiceBalance,
            }
        }
        let token = this.getToken();

        client.id = auth.id;
        client.balance = user.balance;
        client.token = token;

        this.send(client, {
            welcome: {
                user,
                token,
                setting: this.setting
            }
        });
        this.users['u' + auth.id] = user;
    }
    getToken(temp = false) {
        let i, j;
        for (j = 0; j < 10; j++) {
            for (i in this.tokens) {
                if (this.tokens[i] === j) {
                    this.tokens[i] = temp ? j : j + 1;
                    return i;
                }
            }
        }
    }
    onMessage(client, message) {
        let type, value;
        for (type in message) {
            value = message[type];
            switch (type) {
                case 'trade':
                    this.trade(client, value);
                    break;
                case 'get':
                    this['get' + value](client);
                    break;
            }
        }
    }

    onLeave(client, consented) {
        this.tokens[client.token] = this.tokens[client.token] - 1;
    }
    onDispose() {

    }

    trade(client, { balanceType, tradeType, bet, marketId, tradeAt }) {

        if (client.balance[balanceType] > bet) {
            this.models.market.get(marketId, (err, market) => {
                if (err) {
                    this.send(client, { error: 'market' });
                }
                else {
                    this.getCandle(market, (candle) => {
                        let data = {
                            balanceType,
                            tradeType,
                            price: candle.price,
                            point: candle.point,
                            tradeAt: candle.point + (tradeAt * 60),
                            bet,
                            profit: parseInt(this.setting.profit),
                            market_id: market.id,
                            user_id: client.id,
                        }
                        this.models.order.create(data, (err, order) => {
                            if (err) {
                                this.send(client, { error: 'order' });
                            }
                            else {
                                order.market = market;
                                this.send(client, { order: [order] });
                                this.orders.push(order);
                                let newBalance = client.balance[balanceType] - bet;
                                client.balance[balanceType] = client.balance[balanceType] - bet;
                                this.send(client, { balance: { type: balanceType, balance: newBalance } });
                            }
                        })
                    })
                }
            });
        }
        else {
            this.send(client, { error: 'balance' });
        }
    }
    getOrders(client) {
        client.model.getOrder().order("-id").run((err, orders) => {
            this.send(client, { orders: orders });
        });
    }
    getAllOrders() {
        this.getTime();
        this.models.order.find({ status: 'pending' }).all((err, orders) => {
            if (err) return next(err);
            this.orders = orders;
        });
    }
    getTime() {
        getCandle({ type: 'crypto', symbol: 'BINANCE:BTCUSDC' }, (market) => {
            this.time = market.point;
        })
    }
    getOver(price) {
        let over = (parseInt(this.setting.tradePercent) * price) / 100;
        return price + over;
    }
    checkOrders() {
        let i;
        for (i in this.orders) {
            if (this.orders[i] != null) {
                if (this.time >= this.orders[i].tradeAt) {
                    this.getCandleHistory(this.orders[i].market, { from: this.orders[i].point, to: this.orders[i].tradeAt }, (candles) => {
                        let price = this.getOver(this.orders[i].price);
                        let type = this.orders[i].tradeType == 'buy' ? 'h' : 'l';
                        let len = candles.c.length, j, check, res, win = false;
                        for (j = 0; j < len; j++) {
                            check = (j == 0) ? data.c[j] : data[type][j];
                            res = type == 'h' ? price < check : price > check;
                            if (res) {
                                win = true;
                                break;
                            }
                        }
                        this.setOrderResult(i, { type: win ? 'win' : 'lose' });
                    })
                }
            }
        }
        this.time++;
        console.log(this.time)
    }
    setOrderResult(index, { type }) {
        this.orders[index].status = 'done';
        this.orders[index].amount = type == win ? this.orders[index].bet * this.orders[index].profit : 0;
        this.orders[index].save(function (err) {
            if (err)
                console.log("error update order !", this.orders[index]);
            else {
                let user = this.userById(this.orders[index].user_id);
                if (user !== false) {
                    this.send(this.clients[user], { orderResult: this.orders[index] });
                    this.orders[index] = null;
                }
            }
        });
    }
    getCandle(market, callBack) {
        let url = canddleUrl;
        let { type, symbol } = market;
        let post = {
            type,
            symbol,
            token: this.getToken(true)
        }
        for (let i in post) {
            url = url.replace('{' + i + '}', post[i])
        }
        request(url, (error, response, body) => {
            let data = JSON.parse(body);
            if (!('s' in data) || data.s != 'ok') {
                return callBack(null);
            }
            return callBack({ point: data.t[0], price: data.c[0] });
        });
    }
    getCandleHistory(market, time, callBack) {
        let url = canddleUrl;
        let { type, symbol } = market;
        let post = {
            type,
            symbol,
            from: time.from,
            to: time.to,
            token: this.getToken(true)
        }
        for (let i in post) {
            url = url.replace('{' + i + '}', post[i])
        }
        request(url, (error, response, body) => {
            let data = JSON.parse(body);
            if (!('s' in data) || data.s != 'ok') {
                return callBack(null);
            }
            return callBack(data);
        });
    }
    userById(id) {
        let i;
        for (i in this.clients) {
            if (this.clients[i].id == id) {
                return i;
            }
        }
        return false
    }
}



module.exports = Server;