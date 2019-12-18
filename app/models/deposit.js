
module.exports = function (orm, db) {
  var Deposit = db.define('deposit', {
    id: { type: 'serial', key: true },
    amount: Number,
    price: Number,
    status: ["pending", "cenceled", "done"],
    meta: { type: 'text' },
    description: { type: 'text' },
    time: { type: 'date', time: true },
  },
    {
      methods: {
        serialize: function () {
          return {
            id: this.id,
          };
        }
      }
    });
  Deposit.hasOne('user', db.models.user, { required: true, autoFetch: true, reverse: 'deposit' });
  Deposit.hasOne('payment', db.models.payment, { required: true, autoFetch: true, reverse: 'deposit' });

  Deposit.sync();
};
