var colyseus = require('colyseus');
var models = require('../app/models/');
var request = require('request');

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
    }
    refreshConfigData() {
        let item;
        this.models.tokens.find().all((err, tokens) => {
            if (err) return next(err);
            for (item of tokens) {
                if (!item.token in this.tokens) {
                    this.tokens[item.token] = 0;
                }
            }
        })
        this.models.setting.find().all((err, setting) => {
            if (err) return next(err);
            for (item of setting) {
                this.setting[item.key] = item.value;
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
                token
            }
        });
        this.users['u' + auth.id] = user;
    }
    getToken() {
        let i, j;
        for (j = 0; i < 10; j++) {
            for (i in this.tokens) {
                if (this.tokens[i] == j) {
                    this.tokens[i] = j + 1;
                    return i;
                }
            }
        }
    }
    onMessage(client, message) {
        let type, value;
        for (type in this.message) {
            value = message[type];
            switch (type) {
                case 'trade':
                    console.log('================= buy ==============');
                    console.log(value);
                    console.log('====================================');
                    break;
            }
        }
    }

    onLeave(client, consented) {
        this.tokens[client.token] = this.tokens[client.token] - 1;
    }
    onDispose() {

    }

    trade(client, { balanceType, tradeType, bet, marketId, point, tradeAt }) {
        if (client.balance[balanceType] > bet) {
            this.models.market.get(marketId, (err, market) => {
                if (err) {
                    this.send(client, { error: 'market' });
                }
                else {
                    let data = {
                        balanceType,
                        tradeType,
                        market: market.id,
                        symbol: market.symbol,
                        point,
                        tradeAt: point + (tradeAt * 60),
                        bet,
                        profit: this.profit,
                    }
                    this.models.order.create(data, (err, order) => {
                        if (err) {
                            this.send(client, { error: 'order' });
                        }
                        else {
                            this.send(client, { order: { point, } });
                        }
                    })
                }
            });
        }
        else {
            this.send(client, { error: 'balance' });
        }
    }

}



module.exports = Server;