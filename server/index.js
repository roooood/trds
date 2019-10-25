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
    getToken() {
        let i, j;
        for (j = 0; j < 10; j++) {
            for (i in this.tokens) {
                if (this.tokens[i] === j) {
                    this.tokens[i] = j + 1;
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
                        symbol: market.symbol,
                        point,
                        tradeAt: point + (tradeAt * 60),
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
                            this.send(client, { order: { point } });

                            let newBalance = client.balance[balanceType] - bet;
                            client.balance[balanceType] = client.balance[balanceType] - bet;
                            this.send(client, { balance: { type: balanceType, balance: newBalance } });
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