
module.exports = function (orm, db) {
  var Payment = db.define('payment', {
    id: { type: 'serial', key: true },
    title: { type: 'text', required: true },
    logo: { type: 'text', required: true },
    link: { type: 'text', required: true },
  });
  Payment.sync();
};
//refreshtime , profit
