var settings = require('./settings');
var controllers = require('../app/controllers')
var colyseus = require('colyseus');
var http = require('http')
var ServerIO = require('../server/trade')

module.exports = function (app) {
  var server = http.createServer(app)
  var gameServer = new colyseus.Server({ server: server })
  gameServer.register('trade', ServerIO)
  server.listen(settings.port)

  var checkLogin = function (req, res, next) {
    if (req.user)
      next();
    else
      res.send({ success: false, message: "loginNeed" })
  };
  app.get('/', controllers.home);
  app.post('/manage/list', controllers.manage.list);
  app.post('/manage/delete', controllers.manage.delete);
  app.post('/manage/update', controllers.manage.update);
  app.post('/manage/add', controllers.manage.add);

  app.post('/user/add_account', controllers.user.add);
  app.post('/user/login', controllers.user.login);
  app.post('/user/username_check', controllers.user.usernameCheck);
  app.post('/user/email_check', controllers.user.emailCheck);
  app.post('/user/email_change', checkLogin, controllers.user.emailUpdate);
  app.post('/user/password_change', checkLogin, controllers.user.passwordUpdate);
  app.post('/user/delete_account', checkLogin, controllers.user.delete);

  app.get('/market/new/:type', controllers.market.new);
  app.get('/market/list/:type', controllers.market.list);

  app.post('/candle', checkLogin, controllers.candle.history);

  app.post('/cash/:type', checkLogin, controllers.cash);


};
