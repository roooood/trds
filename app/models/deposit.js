
module.exports = function (orm, db) {
  var Deposit = db.define('deposit', {
    id: { type: 'serial', key: true },
    type: ["bitcoin", "ethereum", "bitcoincash", "litecoin", "usdc"],
    amount: Number,
    price: Number,
    status: ["pending", "cenceled", "done"],
    payCode: { type: 'text' },
    payId: { type: 'text' },
    time: { type: 'date', time: true },
  },
    {
      methods: {
        serialize: function () {
          return {
            id: this.id,
            type: this.type,
            amount: this.amount,
            price: this.price,
            status: this.status,
            time: this.time,
          };
        }
      }
    });
  Deposit.hasOne('user', db.models.user, { required: true, autoFetch: true, reverse: 'deposit' });
  Deposit.sync();
};
