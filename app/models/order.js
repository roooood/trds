
module.exports = function (orm, db) {
  var Order = db.define('order', {
    id: { type: 'serial', key: true },
    balanceType: ["real", "practice"],
    tradeType: ["buy", "sell"],
    market: String,
    symbol: String,
    point: { type: 'integer' },
    tradeAt: { type: 'integer' },
    status: ["pending", "done"],
    bet: Number,
    profit: Number,
    amount: Number,
    time: { type: 'date', time: true },
  },
    {
      hooks: {
        beforeValidation: function () {
          this.time = new Date();
          this.status = 'pending';
        }
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
  Order.hasOne('user', db.models.user, { required: true, autoFetch: false, reverse: 'order' });
  Order.sync();
};
