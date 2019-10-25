
module.exports = function (orm, db) {
  var User = db.define('user', {
    id: { type: 'serial', key: true },
    username: { type: 'text', required: true, unique: true },
    password: { type: 'text', required: true },
    email: { type: 'text', required: true, unique: true },
    realBalance: Number,
    practiceBalance: Number,
    joinedAt: { type: 'date', required: true, time: true },
    lastSeen: { type: 'date', required: true, time: true },
    status: Boolean,
    token: String
  },
    {
      hooks: {
        beforeValidation: function () {
          this.joinedAt = new Date();
          this.lastSeen = new Date();
          this.status = true;
          this.realBalance = 0;
          this.practiceBalance = 10000;
        }
      },
      validations: {
        username: [
          orm.enforce.ranges.length(4, undefined, 'usernameIsShort'),
          orm.enforce.unique("usernameIsInUse")
        ],
        email: [
          orm.enforce.patterns.email("emailIsInvalid"),
          orm.enforce.unique("emailIsInUse")
        ],
        password: [
          orm.enforce.ranges.length(8, undefined, 'passwordIsShort')
        ],
      },
      methods: {
        serialize: function () {
          return {
            username: this.username,
            balance: {
              real: this.realBalance,
              practice: this.practiceBalance,
            },
            token: this.token,
          };
        }
      }
    });
  User.sync();
};
