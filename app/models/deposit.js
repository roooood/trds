
module.exports = function (orm, db) {
  var Deposit = db.define('deposit', {
    id: { type: 'serial', key: true },
    amount: Number,
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

  Deposit.sync();
};
