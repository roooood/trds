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
        this.init = false;
    }
    async onInit(options) {
        this.setState(new State);

        await this.getDbModel();
    }
    getDbModel() {
        new Promise((resolve, reject) => {
            models((err, ldb) => {
                this.db = ldb;
                this.models = this.db.models;
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
                resolve(this.defaultMarket)
            });
        });
    }
    requestJoin(options, isNewRoom) {
        return true;
    }
    async onAuth(options) {
        if (!this.init) {
            await this.getSeeting();
            setTimeout(() => {
                this.checkOrders();
            }, 3000);
            this.init = true;
        }
        if (options.key == 'admin') {
            return true;
        }

        return new Promise((resolve, reject) => {
            this.models.user.one({ token: options.key }, 1, (err, user) => {
                if (user == null) {
                    resolve({invalid:true})
                }
                else 
                    resolve(user)
            });
        });
    }
    async onJoin(client, options, auth) {
        if (auth === true) {
            client.admin = true;
            this.send(client, { welcome: true });
            this.getAdminData();
            return;
        }
        else if ('invalid' in auth) {
            this.send(client, { user: 'invalid' });
            return;
        }
        this.online++;
        client.model = auth;
        let currency = 1;
        if (auth.currency != '') {
            let n = 'usd_' + auth.currency;
            if (n in this.setting) {
                currency = this.setting[n];
            }
        }
        let user = {
            id: auth.id,
            currency: currency,
            username: auth.username,
            balance: {
                real: auth.realBalance,
                practice: auth.practiceBalance,
            },
            cur: auth.currency,
            lang: auth.lang
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
    async refresh(client) {
        if ('admin' in client) {
            await this.getSeeting();
            this.broadcast({ setting: this.setting })
        }
    }
    userUpdate(client, userId) {
        if ('admin' in client) {
            let clnt = this.userById(userId);
            if (clnt !== false) {
                this.models.user.get(userId, (err, user) => {
                    let userInfo = {
                        id: user.id,
                        username: user.username,
                        balance: {
                            real: user.realBalance,
                            practice: user.practiceBalance,
                        }
                    }
                    this.send(this.clients[clnt], { user: userInfo });
                });
            }
        }
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
                case 'refresh':
                    this.refresh(client);
                    break;
                case 'user':
                    this.userUpdate(client, value);
                    break;
                case 'myOrder':
                    this.myOrder(client, value);
                    break;
                case 'message':
                    this.message(client, value);
                    break;
                case 'get':
                    this['get' + value](client);
                    break;
                case 'currency':
                    this.models.user.get(client.id, (err, user) => {
                        user.currency = value;
                        user.save();
                    });
                    let currency = 1;
                    let n = 'usd_' + value;
                    if (n in this.setting) {
                        currency = this.setting[n];
                    }
                    this.send(client, { currency})
                    break;
                case 'lang':
                    this.models.user.get(client.id, (err, user) => {
                        user.lang = value;
                        user.save();
                    });
                    break;
            }
        }
    }

    onLeave(client, consented) {
        if (!'admin' in client) {
            this.online--;
            this.tokens[client.token] = this.tokens[client.token] - 1;
            this.getAdminData();
        }
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
    trade(client, { balanceType, tradeType, bet, marketId, tradeAt, price }) {
        if (client.balance[balanceType] > bet) {
            this.models.market.get(marketId, (err, market) => {
                if (err) {
                    this.send(client, { error: 'market' });
                }
                else {
                    let sTime = Math.round((new Date()).getTime() / 1000)
                    let delay = tradeAt * 60;
                    let newPrice = this.getOver(price, tradeType);
                    let data = {
                        balanceType,
                        tradeType,
                        price: newPrice,
                        point: sTime,
                        tradeAt: sTime + delay,
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
                            if (balanceType == 'real') {
                                client.model.realBalance -= bet;
                            }
                            else {
                                client.model.practiceBalance -= bet;
                            }
                            let time = Math.round((new Date()).getTime() / 1000);
                            let newTime = (order.tradeAt - time);
                            if (newTime < 0)
                                newTime = 0;
                            client.model.save();
                            order.timer = newTime;
                            order.market = market;
                            this.send(client, { order: [order] });
                            this.orders.push(order);
                            let newBalance = (client.balance[balanceType] - bet).toFixed(2);
                            client.balance[balanceType] = newBalance;
                            this.send(client, { balance: { type: balanceType, balance: newBalance } });
                            setTimeout(() => {
                                this.checkOrder(order);
                            }, delay * 1000);
                        }
                    })

                }
            });
        }
        else {
            this.send(client, { error: 'balance' });
        }
    }
    oldtrade(client, { balanceType, tradeType, bet, marketId, tradeAt }) {
        if (client.balance[balanceType] > bet) {
            this.models.market.get(marketId, (err, market) => {
                if (err) {
                    this.send(client, { error: 'market' });
                }
                else {
                    this.getCandle(market, (candle) => {
                        if (candle == null) {
                            this.send(client, { error: 'unhandled' });
                            return;
                        }
                        let sTime = Math.round((new Date()).getTime() / 1000)
                        let delay = tradeAt * 60;
                        let price = this.getOver(candle.price, tradeType);
                        let data = {
                            balanceType,
                            tradeType,
                            price: price,
                            point: sTime,
                            tradeAt: sTime + delay,
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
                                if (balanceType == 'real') {
                                    client.model.realBalance -= bet;
                                }
                                else {
                                    client.model.practiceBalance -= bet;
                                }
                                client.model.save();
                                order.market = market;
                                this.send(client, { order: [order] });
                                this.orders.push(order);
                                let newBalance = (client.balance[balanceType] - bet).toFixed(2);
                                client.balance[balanceType] = newBalance;
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
    myOrder(client, market_id) {
        this.models.order.find({ user_id: client.id, market_id, status: 'pending' }).all((err, orders) => {
            let time = Math.round((new Date()).getTime() / 1000);
            let newTime;
            for (let order of orders) {
                newTime = (order.tradeAt - time);
                if (newTime < 0)
                    newTime = 0;
                order.timer = newTime;
                delete order.user;
            }
            this.send(client, { opens: orders });
        });
    }
    getOrders(client) {
        client.model.getOrder().order("-id").run((err, orders) => {
            let time = Math.round((new Date()).getTime() / 1000);
            let newTime;
            for (let order of orders) {
                newTime = (order.tradeAt - time);
                if (newTime < 0)
                    newTime = 0;
                order.timer = newTime;
                order.user = order.user.toString();
            }
            this.send(client, { orders });
        });
    }
    getVideos(client) {
        this.models.video.find().order("-id").all((err, videos) => {
            this.send(client, { videos });
        });
    }
    getLeads(client) {
        this.models.order.aggregate(['user_id']).sum("amount").groupBy("user_id").order("-sum_amount").limit(3).get((err, tops) => {
            let users = [];
            for (let top of tops)
                users.push(top.user_id);
            this.models.user.find({ id: users }, (err, user) => {
                let leaders = [];
                for (let lead of user) {
                    leaders[lead.id] = lead.toString();
                }
                let send = [];
                for (let i of tops) {
                    send.push(
                        {
                            user: leaders[i.user_id] || {},
                            amount: i.sum_amount
                        }
                    )
                }
                this.send(client, { leads: send });
            });
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
        let time = Math.round((new Date()).getTime() / 1000);
        // this.getTime((time) => {
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
        // });
    }
    checkOrder(order) {
        this.getCandleHistory(order.market, { from: order.point, to: order.tradeAt }, (candles) => {
            if (candles != null) {
                let price = order.price;
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
                let clnt = this.userById(order.user_id);
                if (clnt !== false) {
                    this.send(this.clients[clnt], { orderResult: order });
                }
            }
        });
        if (type == 'win') {
            let newBalance = order.amount + order.bet;
            let balance = 0;
            let clnt = this.userById(order.user_id);
            this.models.user.get(order.user_id, (err, user) => {
                if (order.balanceType == 'real') {
                    user.realBalance += newBalance;
                    if (clnt !== false) {
                        this.clients[clnt].realBalance += newBalance;
                    }
                    balance = user.realBalance.toFixed(2);
                }
                else {
                    user.practiceBalance += newBalance;
                    if (clnt !== false) {
                        this.clients[clnt].practiceBalance += newBalance;
                    }
                    balance = user.practiceBalance.toFixed(2);
                }
                if (clnt !== false) {
                    this.send(this.clients[clnt], { balance: { type: order.balanceType, balance } });
                }
                user.save();
            });
        }
    }
    getTime(callback) {
        this.getCandle({ type: 'crypto', symbol: 'BINANCE:BTCUSDT' }, (market) => {
            if (market != null)
                callback(market.point);
        })
    }
    getOver(price, type) {
        if (this.setting.tradePercent == 0) {
            return price;
        }
        let over = (parseFloat(this.setting.tradePercent) * price) / 100;
        let xprice = type == 'buy' ? price + over : price - over;
        let p = (price + '').split('.');
        if (p.length == 1) {
            return xprice.toFixed(0);
        }
        else {
            return xprice.toFixed(p[1].length);
        }
    }


    async getCandle(market, callBack) {
        let url = canddleUrl;
        let token = await this.getToken(true);
        let { type, symbol } = market;
        let post = {
            type,
            symbol,
            token
        }
        for (let i in post) {
            url = url.replace('{' + i + '}', post[i])
        }
        request(url, (error, response, body) => {
            try {
                let data = this.parseJson(body);
                if (data == 'null') {
                    callBack(null);
                }
                else if (!('s' in data) || data.s == 'no_data' || data.s != 'ok') {
                    callBack(null);
                }
                else
                    callBack({ point: data.t[0], price: data.c[0] });
            } catch (error) {
                callBack(null);
            }

        });
    }
    async getCandleHistory(market, time, callBack) {
        let token = await this.getToken(true);
        let url = canddleUrlFrom;
        let { type, symbol } = market;
        let post = {
            type,
            symbol,
            from: time.from,
            to: time.to,
            token
        }
        for (let i in post) {
            url = url.replace('{' + i + '}', post[i])
        }
        request(url, (error, response, body) => {
            let data = this.parseJson(body);
            if (data == 'null') {
                callBack(null);
            }
            else if (!('s' in data) || data.s == 'no_data' || data.s != 'ok') {
                callBack(null);
            }
            else
                callBack(data);
        });
    }
    parseJson(body) {
        try {
            return JSON.parse(body);

        } catch (error) {
            //console.log(error);
            return null;
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