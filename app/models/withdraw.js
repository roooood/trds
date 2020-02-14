
module.exports = function (orm, db) {
  var Withdraw = db.define('withdraw', {
    id: { type: 'serial', key: true },
    amount: Number,
    description: { type: 'text' },
    time: { type: 'date', time: true },
  },
    {
      hooks: {
        beforeCreate: function () {
          this.time = new Date();
          this.status = 'auditing';
          this.amount = 0;
        }
      },
      methods: {
        serialize: function () {
          return {
            id: this.id,
          };
        }
      }
    });
  Withdraw.hasOne('user', db.models.user, { required: true, autoFetch: true, reverse: 'withdraw' });
  Withdraw.sync();
};
