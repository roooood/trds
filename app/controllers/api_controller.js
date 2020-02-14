var _ = require('lodash');
var settings = require('../../config/settings');

module.exports = function (req, res, next) {
    let { type } = req.params;
    let { apiKey, token } = req.body;
    if (apiKey != settings.apiKey) {
        return res.send({ error: 'apiKey is invalid' });
    }
    else if (type == 'info') {
        req.models.user.one({ token }, function (err, user) {
            if (user == null)
                res.send({ error: 'user not found!' })
            delete user.order;
            delete user.chat;
            res.send(user)
        })

    }
    else if (type == 'withdraw') {
        let { amount, description } = req.body;
        req.models.user.one({ token }, function (err, user) {
            if (user == null)
                res.send({ error: 'user not found!' });
            user.realBalance = parseInt(user.realBalance) - parseInt(amount);
            user.save();
            req.models.withdraw.create({
                amount,
                description,
                user_id: user.id
            }, function (err, withdraw) {
                if (err) {
                    return res.send({ error: err });
                }
                return res.send({ success: true });
            });
        })

    }
    else if (type == 'deposit') {
        let { amount, description } = req.body;
        req.models.user.one({ token }, function (err, user) {
            if (user == null)
                res.send({ error: 'user not found!' });
            user.realBalance = parseInt(user.realBalance) + parseInt(amount);
            user.save();
            req.models.deposit.create({
                amount,
                description,
                user_id: user.id
            }, function (err, deposit) {
                if (err) {
                    return res.send({ error: err });
                }
                return res.send({ success: true });
            });
        })

    }
    else {
        res.send({ error: 'method not found' })
    }
};
