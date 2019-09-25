

module.exports = function (orm, db) {
  var User = db.define('user', {
    id: { type: 'serial', key: true },
    username: { type: 'text', required: true, unique: true },
    password: { type: 'text', required: true },
    email: { type: 'text', required: true, unique: true },
    joinedAt: { type: 'date', required: true, time: true },
    lastSeen: { type: 'date', required: true, time: true },
    status: Boolean,
    token: String
  },
    {
      hooks: {
        beforeCreate: function () {
          this.joinedAt = new Date();
          this.lastSeen = new Date();
          this.status = true;
          this.password = md5(this.password);
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
            id: this.id,
            username: this.username,
            email: this.email,
            joinedAt: this.joinedAt,
            lastSeen: this.lastSeen,
            status: this.status,
          };
        }
      }
    });
  db.sync();
};
