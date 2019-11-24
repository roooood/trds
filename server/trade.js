var colyseus = require('colyseus');
var models = require('../app/models');
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
        this.tokens = null;
        this.setting = {};
        this.orders = [];
        this.serverTime = 0;
        this.checker = null;
        this.online = 0;
        this.orders = [];
        this.defaultMarket = null;
    }
    async onInit(options) {
        this.setState(new State);
        // let promise = new Promise((resolve, reject) => {
        //     models(function (err, ldb) {
        //         resolve(ldb);
        //     });
        // });

        // this.db = await promise;
        // this.models = this.db.models;

        await this.getDbModel();
        await this.getSeeting();
        // this.checkOrders();
    }
    getDbModel() {
        new Promise((resolve, reject) => {
            models((err, ldb) => {
                this.db = ldb;
                this.models = this.db.models;
                console.log('getDbModel')
                resolve(true);
            });
        });
    }
    getSeeting() {
        return new Promise((resolve, reject) => {
            let item;
            this.models.setting.find().all((err, setting) => {
                if (err) return next(err);
                for (item of setting) {
                    this.setting[item.key] = item.value;
                }
                console.log('getSeeting')
                resolve(true)
            })
        });
    }
    getTokens() {
        this.tokens = {};
        return new Promise((resolve, reject) => {
            let item;
            this.models.tokens.find().all((err, tokens) => {
                if (err) return next(err);
                for (item of tokens) {
                    if (!(item.token in this.tokens)) {
                        this.tokens[item.token] = 0;
                    }
                }
                console.log('getToken');
                resolve(true)
            })
        });
    }
    getDefaultMarket(check) {
        if (check && this.defaultMarket != null) {
            return this.defaultMarket;
        }
        return new Promise((resolve, reject) => {
            this.models.market.get(this.setting.defaultMarket, (err, market) => {
                if (err) {
                }
                else {
                    this.defaultMarket = market.serialize();
                }
                console.log('getDefaultMarket');
                resolve(this.defaultMarket)
            });
        });
    }
    requestJoin(options, isNewRoom) {
        return true;
    }
    async onAuth(options) {
        if (options.key == 'admin') {
            return true;
        }
        return new Promise((resolve, reject) => {
            this.models.user.find({ token: options.key }, 1, (err, user) => {
                resolve(user[0])
            });
        });
    }
    async onJoin(client, options, auth) {
        console.log('join');
        if (auth === true) {
            client.admin = true;
            this.send(client, { welcome: true });
            this.getAdminData();
            return;
        }
        this.online++;
        client.model = auth;
        let user = {
            id: auth.id,
            username: auth.username,
            balance: {
                real: auth.realBalance,
                practice: auth.practiceBalance,
            }
        }
        let token = await this.getToken();
        let market = await this.getDefaultMarket(true);

        client.id = auth.id;
        client.balance = user.balance;
        client.token = token;

        this.send(client, {
            welcome: {
                user,
                token,
                setting: this.setting,
                market: market,
            }
        });
        this.users['u' + auth.id] = user;
        this.getAdminData();
    }
    async getToken(temp = false) {
        if (this.tokens == null) {
            await this.getTokens();
        }
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
                case 'message':
                    this.message(client, value);
                    break;
                case 'get':
                    this['get' + value](client);
                    break;
            }
        }
    }

    onLeave(client, consented) {
        if (!'admin' in client)
            this.online--;
        this.tokens[client.token] = this.tokens[client.token] - 1;
        this.getAdminData();
    }
    onDispose() {

    }
    getAdminData() {
        this.sendToAdmin({
            online: this.online,
            users: this.users,
        })
    }
    sendToAdmin(data) {
        let i;
        for (i in this.clients) {
            if ('admin' in this.clients[i]) {
                this.send(this.clients[i], data);
            }
        }
    }
    message(client, message) {
        let user_id, text, status;
        if ('admin' in client) {
            user_id = message[0];
            text = message[1];
            status = 'to';
        }
        else {
            user_id = client.id;
            text = message;
            status = 'from';
        }

        this.models.chat.create({ text, status, user_id }, (err, message) => {
            if (err) {
                console.log(err)
            }
            else {
                this.models.chat.get(message.id, (err, msg) => {
                    let user = this.userById(user_id)
                    if (user)
                        this.send(this.clients[user], { message: [msg] });
                    this.sendToAdmin({ message: [msg] })
                });
            }
        })
    }

    trade(client, { balanceType, tradeType, bet, marketId, tradeAt }) {

        if (client.balance[balanceType] > bet) {
            this.models.market.get(marketId, (err, market) => {
                if (err) {
                    this.send(client, { error: 'market' });
                }
                else {
                    this.getCandle(market, (candle) => {
                        let delay = tradeAt * 60;
                        let data = {
                            balanceType,
                            tradeType,
                            price: candle.price,
                            point: candle.point,
                            tradeAt: candle.point + delay,
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
                                setTimeout(() => {
                                    this.checkOrder(order);
                                }, delay * 1000);
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
            for (let order of orders)
                order.user = order.user.toString();
            this.send(client, { orders });
        });
    }
    getVideos(client) {
        this.models.video.find().order("-id").all((err, videos) => {
            this.send(client, { videos });
        });
    }
    getLeads(client) {
        this.models.order.find({ status: 'done' }).order("-amount").all((err, leads) => {
            for (let lead of leads)
                lead.user = lead.user.toString();
            this.send(client, { leads });
        });
    }
    getMessages(client) {
        if (!('admin' in client)) {
            client.model.getChat().run((err, messages) => {
                for (let message of messages)
                    message.user = message.user.toString();
                this.send(client, { message: messages });
            });
        }
        else {
            this.models.chat.find().all((err, chats) => {
                if (err) return next(err);
                for (let chat of chats)
                    chat.user = chat.user.toString();
                this.send(client, { message: chats });
            })
        }
    }
    checkOrders() {
        this.getTime((time) => {
            this.models.order.find({ status: 'pending' }).all((err, orders) => {
                if (err) return next(err);
                let order, delay;
                for (order of orders) {
                    if (order.tradeAt < time) {
                        this.checkOrder(order);
                    }
                    else {
                        delay = order.tradeAt - time;
                        ((order, delay) => {
                            setTimeout(() => {
                                this.checkOrder(order);
                            }, delay * 1000);
                        })(order, delay);
                    }
                }
            });
        });
    }
    checkOrder(order) {
        this.getCandleHistory(order.market, { from: order.point, to: order.tradeAt }, (candles) => {
            if (candles != null) {
                let price = this.getOver(order.price);
                let type = order.tradeType == 'buy' ? 'h' : 'l';
                let len = candles.c.length, j, check, res, win = false;
                for (j = 0; j < len; j++) {
                    check = (j == 0) ? candles.c[j] : candles[type][j];
                    res = type == 'h' ? price < check : price > check;
                    if (res) {
                        win = true;
                        break;
                    }
                }
                this.setOrderResult(order, { type: win ? 'win' : 'lose' });
            }
        })
    }
    setOrderResult(order, { type }) {
        order.status = 'done';
        order.amount = type == 'win' ? (order.bet * order.profit) / 100 : 0;
        order.save((err, xorder) => {
            if (err)
                console.log("error update order !", err);
            else {
                let user = this.userById(order.user_id);
                if (user !== false) {
                    this.send(this.clients[user], { orderResult: order });
                }
            }
        });
    }
    getTime(callback) {
        this.getCandle({ type: 'crypto', symbol: 'BINANCE:BTCUSDT' }, (market) => {
            if (market != null)
                callback(market.point);
        })
    }
    getOver(price) {
        let over = (parseInt(this.setting.tradePercent) * price) / 100;
        return price + over;
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
            let data = this.parseJson(body);
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
            let data = this.parseJson(body);
            if (!('s' in data) || data.s != 'ok') {
                return callBack(null);
            }
            return callBack(data);
        });
    }
    parseJson(body) {
        try {
            return JSON.parse(body)
        } catch (error) {
            //console.log(error);
            return {};
        }
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