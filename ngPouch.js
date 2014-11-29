'use strict';

angular.module('ngPouch', ['angularLocalStorage','mdo-angular-cryptography'])
  .service('ngPouch', function($timeout, storage,$crypto) {

    var service =  {
      // Databases
      db: new PouchDB("LocalDB"),
      remotedb: undefined,

      // Options
      invokeApply: true,


      // Persistent Settings
      settings: {
        database: undefined,
        username: undefined,
        password: undefined,
        stayConnected: undefined
      },

      // Persistent Status
      status: {
        localChanges: 0,
        changeEvents: {},
        replicationToEvents: {},
        replicationFromEvents: {}
      },

      // Session Status
      session: {
        // Session Stats
        status: "offline",
        docsSent: 0,
        docsReceived: 0,
        currentRetryDelay: 10,
        maxRetryDelay: 60*1000*10,
        retryDelayInc: 1000,
        lastConnectionAttempt: undefined,
        publishInProgress: false
      },

      // SPromises & Even Emitters
      changes: undefined,
      replicationTo: undefined,
      replicationFrom: undefined,
      delayStatusPromise: undefined,
      retryPromise: undefined,
      publishPromise: undefined,

      /*
       *  Initializers
       *
       */

      init: function() {
        // Load Persistent Data
        this.loadSettings();
        this.loadStatus();

        // Start Session
        this.trackChanges();
        this.initRobustSync(1000);

        this.initEncryption();

        // Had to use these functions somewhere
        // to get WebStorm to turn green.
        // This is a really silly use of them
        return [this.statusIcon(), this.statusTitle()];
      },


      /*
       *  storage aware accessors for settings and status
       */

      incrementLocalChanges: function() {
        var self = this;
        if( typeof self.status.localChanges === "number")
        {
          self.status.localChanges++;
        } else {
          self.status.localChanges = 1;
        }
        this.persistStatus();
      },

      resetLocalChanges: function() {
        this.status.localChanges = 0;
        this.persistStatus();
      },

      storeChangeEvent: function(value, event) {
        var self = this;
        if( typeof self.status.changeEvents === "undefined")
        {
          self.status.changeEvents = {}
        }
        self.status.changeEvents[event] = value;
        self.persistStatus();
      },

      storeReplicationToEvent: function(value, event) {
        var self = this;
        if( typeof self.status.replicationToEvents === "undefined")
        {
          self.status.replicationToEvents = {}
        }

        self.status.replicationToEvents[event] = value;
        self.persistStatus();
      },

      storeReplicationFromEvent: function(value, event) {
        var self = this;
        if( typeof self.status.replicationFromEvents === "undefined")
        {
          self.status.replicationFromEvents = {}
        }
        self.status.replicationFromEvents[event] = value;
        self.persistStatus();
      },

      persistStatus: function() {
        storage.pouchStatus = this.status;
      },

      loadSettings: function() {
        if (typeof storage.pouchSettings !== "undefined") {
          this.settings = storage.pouchSettings;
        }
      },

      loadStatus: function() {
        if (typeof storage.pouchStatus !== "undefined") {
          this.status = storage.pouchStatus
        }
      },

      /*
       *  Public Methods
       */


      publish: function(f) {
        // Cancel previous publishers from other controllers
        // Run the function immediately and then again on database changes
        // Prevent from getting called while in progress

        var self = this;
        self.session.publishInProgress = false;

        var runFn = function(info) {
          if ( self.session.publishInProgress === false) {
            self.session.publishInProgress = true;
            f().finally(function() {
              $timeout(function() {
                self.session.publishInProgress=false;
              }, 0, self.invokeApply);
            });
          }
        };

        self.db.info(function(err, info) {

          if(typeof self.publishPromise !== "undefined") {
            if(typeof self.publishPromise.cancel !== "undefined")
            {
              self.publishPromise.cancel();
            }
          }

          self.publishPromise = self.db.changes({
            since: (info.update_seq-1),
            live: true
          }).on('change', runFn);

        });

        runFn();
      },

      getSettings: function() {
        return this.settings;
      },

      saveSettings: function(settings) {
        //this.db.logout();
        this.settings = settings;
        storage.pouchSettings = this.getSettings();
        this.initRobustSync(1000);
      },

      localChanges: function() {
        if (typeof this.status === "undefined")
        {
          return "undefined";
        } else
        {
          return this.status.localChanges;
        }
      },

      statusIcon: function() {
        switch(this.session.status) {
          case "connecting":
            return "ion-ios7-cloudy-night-outline";
          case "online":
            return "ion-ios7-cloud-outline";
          case "offline":
            return "ion-ios7-cloudy-night";
          case "idle":
            return "ion-ios7-cloud-outline";
          case "receiving":
            return "ion-ios7-cloud-download-outline";
          case "sending":
            return "ion-ios7-cloud-upload-outline";
          default:
            return "ion-alert-circled";
        }
      },

      statusTitle: function() {
        switch(this.session.status) {
          case "online":
            return "Connected";
          case "connecting":
            return "Trying to connect";
          case "offline":
            return "Not connected";
          case "idle":
            return "Connected";
          case "receiving":
            return "Receiving Data";
          case "sending":
            return "Sending Data";
          default:
            return "Unknown Status";
        }
      },

      // Destroy and recreated local db and changes db
      reset: function() {
        var self = this;
        PouchDB.destroy("LocalDB").then( function() {
          storage.pouchStatus = {};
          storage.session = {};
          self.disconnect();
          self.init();
        });
      },

      /*
       *  Private Methods
       */


      initRobustSync: function(delay) {
        var self = this;
        self.session.currentRetryDelay = delay;
        self.cancelProgressiveRetry();

        if (self.settings.stayConnected === true) {
          self.progressiveRetry();
        }
      },

      attemptConnection: function() {
        var self = this;
        self.session.lastConnectionAttempt = new Date();
        self.flashSessionStatus("connecting");
        self.connect();
      },


      maxOutProgressiveDelay: function() {
        this.initRobustSync(this.session.maxRetryDelay);
      },

      restartProgressiveDelay: function() {
        if (this.session.status !== "connecting" &&
          this.session.status !== "offline")
        {
          this.initRobustSync(1000);
        }
      },

      cancelProgressiveRetry: function() {
        var self = this;
        if (typeof self.retryPromise === "object") {
          $timeout.cancel(self.retryPromise);
        }
      },

      progressiveRetry: function() {
        var self = this;
        if (self.session.currentRetryDelay < self.session.maxRetryDelay)
        {
          self.session.currentRetryDelay = self.session.currentRetryDelay + self.session.retryDelayInc;
        }

        self.retryPromise = $timeout( function() {
          self.progressiveRetry();
          self.attemptConnection();
        }, self.session.currentRetryDelay, false)
      },

      flashSessionStatus: function(status) {
        var self = this;
        var s = self.session.status;
        self.setSessionStatus(status);
        self.delaySessionStatus(2000, s);
      },

      setSessionStatus: function(status) {
        var self = this;
        self.cancelSessionStatus();
        $timeout(function() {
          self.session.status = status;
        },0,self.invokeApply);
      },

      delaySessionStatus: function(delay, status) {
        var self = this;
        self.cancelSessionStatus();
        self.delayStatusPromise= $timeout(
          function() {
            self.setSessionStatus(status);
          },delay, self.invokeApply);
      },

      cancelSessionStatus: function() {

        var self = this;
        if (typeof self.delayStatusPromise === "object")
        {
          $timeout.cancel(self.delayStatusPromise);
        }
      },

      /**
       * Check the key and value, if value is to encrypt returns true
       * @param key The key in the doc
       * @param value The value in the doc
       * @returns {boolean} true if key is to encrypt
       */
      isKeyInEncryptionList: function(key,value){
        var exclusiveDisable = [
            'design_doc'
        ];
          //Exclude by you
        if(exclusiveDisable.indexOf(key)){
          return false;
          //Internal field
        }else if(key.substr(0,1) === '_') {
          return false;
        }else if (typeof value === 'function' ){
          return false;
        }else{
          return true;
        }
      },

      recursiveObjectEncyptDecypt: function (obj, encptDecpytFunction){
        var self = this;
        for (var key in obj){
          var val = obj[key];
          if(self.isKeyInEncryptionList(key,val)){

              //Recusive call if object
            if(typeof val === 'object'){
              obj[key] = self.recursiveObjectEncyptDecypt.call(self,val,encptDecpytFunction);

              //Call for each element of an array
            }else if (typeof val === 'array'){
              for (var i in val){
                var arrVal = val[i]
                val[i] = self.recursiveObjectEncyptDecypt.call(self,val[i],encptDecpytFunction);
              }

              //If normal val
            }else {
              obj[key] = encptDecpytFunction.call(this,val);
            }
          }
          if (typeof val === 'function'){
            delete obj[key];
          }
        }
        return obj;
      },
      /**
       *
       */
      initEncryption: function () {
        var self = this;
        var recursiveObjectEncyptDecypt = self.recursiveObjectEncyptDecypt
        if(!self.db.filter){
          throw new Error("Please use the pouchdb.filter plugin, see bower.json")
        }else {
          self.db.filter({
            incoming:function(doc){
              return self.recursiveObjectEncyptDecypt(doc,$crypto.encrypt)
            },
            outgoing: function(doc){
              return self.recursiveObjectEncyptDecypt(doc,$crypto.decrypt)
            }
          })
        }
      },
      trackChanges: function() {
        var self = this;
        if (typeof self.changes === "object") {
          self.changes.cancel();
        }
        self.db.info()
          .then( function(info) {
            self.changes = self.db.changes({
              since: info.update_seq,
              live: true
            })
              .on('change', function(info) {self.handleChanges(info, "change")} )
              .on('error', function(info) {self.handleChanges(info, "error")})
              .on('complete', function(info) {self.handleChanges(info, "complete")})
          });

      },

      handleChanges: function(info, event) {
        var self = this;
        info.occurred_at = new Date();
        self.storeChangeEvent(info, event);
        if (event === "change") {
          $timeout(function() {
            self.incrementLocalChanges();
          }, 0, self.invokeApply);
        }

      },

      handleReplicationFrom: function(info, event) {
        var self = this;
        info.occurred_at = new Date();
        self.storeReplicationFromEvent(info, event);
        switch (event) {
          case "uptodate":
            self.maxOutProgressiveDelay();
            self.delaySessionStatus(800, "idle");
            break;
          case "error":
            self.restartProgressiveDelay();
            self.delaySessionStatus(800, "offline");
            break;
          case "complete":
            //self.restartProgressiveDelay();
            //self.delaySessionStatus(800, "offline");
            break;
          case "change":
            self.maxOutProgressiveDelay();
            if(info.docs_written > self.session.docsReceived){
              self.session.docsReceived = info.docs_written;
              self.setSessionStatus("receiving");
            }
            break
        }
      },

      handleReplicationTo: function(info, event) {
        var self = this;
        switch (event) {
          case "uptodate":
            self.maxOutProgressiveDelay();
            self.resetLocalChanges();
            self.delaySessionStatus(800, "idle");
            break;
          case "error":
            self.restartProgressiveDelay();
            self.delaySessionStatus(800, "offline");
            break;
          case "complete":
            //self.restartProgressiveDelay();
            //self.delaySessionStatus(800, "offline");
            break;
          case "change":
            self.maxOutProgressiveDelay();
            if(info.docs_written > self.session.docsSent){
              self.session.docsSent = info.docs_written;
              self.setSessionStatus("sending");
            }
            break
        }
        info.occurred_at = new Date();
        this.storeReplicationToEvent(info, event);
      },


      // Disconnect from Remote Database
      disconnect: function() {
        var self = this;
        if(typeof self.session.replicationTo === "object") {
          console.log("disconnect to");
          self.session.replicationTo.cancel();
        }

        if(typeof self.session.replicationFrom === "object") {
          console.log("disconnect from");
          self.session.replicationFrom.cancel();
        }
      },

      createRemoteDb: function() {
        var self = this;

        if (typeof self.settings.database === "string")
        {
          self.remotedb = new PouchDB(this.settings.database);
          if (typeof self.settings.username === "string" && typeof self.settings.password === "string")
          {
            self.remotedb.login(this.settings.username, this.settings.password, function (err, response) {})
          }
        }
      },

      logoff: function() {
        this.settings['stayConnected']=false;
        storage.pouchSettings = this.getSettings();

        // Throwing the kitchen sync to break the live sync
        this.cancelProgressiveRetry();
        this.disconnect();
        this.createRemoteDb();
        this.delaySessionStatus(800, "offline");
      },

      // Connect to Remote Database and Start Replication
      connect: function() {
        var self = this;
        self.session.docsSent = 0;
        self.session.docsReceived = 0;
        self.disconnect();
        self.createRemoteDb();
        self.session.replicationTo = self.db.replicate.to(self.remotedb, {live: true})
          .on('change', function(info)   {self.handleReplicationTo(info, "change")})
          .on('uptodate', function(info) {self.handleReplicationTo(info, "uptodate")})
          .on('error', function(info)    {self.handleReplicationTo(info, "error")})
          .on('complete', function(info) {self.handleReplicationTo(info, "complete")});

        self.session.replicationFrom = self.db.replicate.from(self.remotedb, {live: true})
          .on('change', function(info)   {self.handleReplicationFrom(info, "change")})
          .on('uptodate', function(info) {self.handleReplicationFrom(info, "uptodate")})
          .on('error', function(info)    {self.handleReplicationFrom(info, "error")})
          .on('complete', function(info) {self.handleReplicationFrom(info, "complete")});
      }


    };

    service.init();
    return service
  });

