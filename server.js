var ghost = require('ghost');
var cluster = require('cluster');
var Loadmill = require('express-loadmill');

var express = require('express');
var parentApp = express();
var utils = require('./node_modules/ghost/core/server/services/url/utils');


// Heroku sets `WEB_CONCURRENCY` to the number of available processor cores.
var WORKERS = process.env.WEB_CONCURRENCY || 1;

if (cluster.isMaster) {
  // Master starts all workers and restarts them when they exit.
  cluster.on('exit', (worker, code, signal) => {
    console.log(`Starting a new worker because PID: ${worker.process.pid} exited code ${code} from ${signal} signal.`);
    cluster.fork();
  });
  for (var i = 0; i < WORKERS; i++) {
    cluster.fork();
  }
} else {
  // Run Ghost in each worker / processor core.
  ghost().then(function (ghostServer) {

    parentApp.use(Loadmill({
      verifyToken: "not-used",
      monitor: {
        // Required:
        apiToken: process.env.LOADMILL_API_TOKEN,
        // Default is TRUE:
        enabled: process.env.ENABLE_LOADMILL_MONITORING,
        
        appName: "ghost-on-heroku",     
        envName: process.env.LOADMILL_MONITOR_ENV,
        _destinationHost: process.env.LOADMILL_MONITOR_HOST,
        
      }
    }));

    // for automatic domain verification we always echo the challenge file name
    parentApp.use("/loadmill-challenge/:fileName", function (req, res) {
      const fileName = req.params.fileName;
      res.send(fileName.substr(0, fileName.length - 4));
    });

    parentApp.use('/', ghostServer.rootApp);

    ghostServer.start(parentApp);

  });
}
