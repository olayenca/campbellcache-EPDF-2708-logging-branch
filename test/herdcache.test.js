const Logging = require('./testlogging');
var chai = require('chai');
var expect = chai.expect;
const Rx = require('rxjs');
const rp = require('request-promise');
const freeportfinder = require("find-free-port")
var jswiremocklib, jswiremock, stubFor, get, post, urlEqualTo, a_response;
jswiremocklib = require('jswiremock'), jswiremock = jswiremocklib.jswiremock, stubFor = jswiremocklib.stubFor, get = jswiremocklib.get, post = jswiremocklib.post, urlEqualTo = jswiremocklib.urlEqualTo, a_response = jswiremocklib.a_response, stopJSWireMock = jswiremocklib.stopJSWireMock;


var assert = require('assert');
var proxyquire = require('proxyquire');
var HerdCache = require('../lib/herdcache');
var fs = require('fs');

var AutodiscoveryServer = require('./autodiscovery-server');


describe('ObservableMemcached', function() {
  var memcachedMock;
  var memcachedMockOriginalGet;
  var InMemoryObservableMemcached;
  var EnabledObservableMemcached;
  var DisabledObservableMemcached;
  var herdcache;
  var testAutodiscoveryServer;
  const key = "key";
  const key2 = "sunday";
  const value = "BOB";
  var cacheEnabled = true;
  var wiremock = null;
  var mockPort;
  var supplierCalled=0;
  var restBody = "[{\"status\":\"success\"}]";
  var slowHttpRequest1Second;

  beforeEach(function() {
    console.log("=============================");

    // find a port to run the wiremock on
    freeportfinder(3000, function(err, freePort){
      if(err) {
        throw err;
      }
      wiremock = new jswiremock(freePort); //port
      mockPort=freePort;
      stubFor(wiremock, get(urlEqualTo("/bob"))
        .willReturn(a_response()
            .withStatus(200)
            .withHeader({"Content-Type": "application/json"})
            .withBody(restBody)));
    });

    memcachedMock = require('memcached-mock');
    InMemoryObservableMemcached = proxyquire('../lib/observable-memcached', {memcached: memcachedMock});
    herdcache = new HerdCache({
      autodiscovery : true,
      autodiscovery_url : "127.0.0.1:11211",
      autodiscovery_interval: 200
    })

    testAutodiscoveryServer = new AutodiscoveryServer(fs.readFileSync(__dirname + '/fixtures/single', 'utf8'));
    EnabledObservableMemcached = new InMemoryObservableMemcached(true,["blah"]);
    DisabledObservableMemcached = new InMemoryObservableMemcached(false,["blah"]);
    HerdCache.prototype._observableMemcacheFactory = function(hosts,options) {
      if(cacheEnabled) {
        console.log("returning enabled cache");
        if(options.metricsrecorder) {
          EnabledObservableMemcached.setMetricsRecorder(options.metricsrecorder);
        }
        return EnabledObservableMemcached;
      } else {
        console.log("returning disabled cache");
        if(options.metricsrecorder) {
          DisabledObservableMemcached.setMetricsRecorder(options.metricsrecorder);
        }
        return DisabledObservableMemcached;
      }
    }

    // Set key to BOB for 10 mins
    EnabledObservableMemcached.client.set(key,value,600,function() {});
    memcachedMockOriginalGet = memcachedMock.prototype.get;

    // only execute the request after 1 second.
    slowHttpRequest1Second = Rx.Observable.create(function(observer) {
      setTimeout(() => {
        var rep = rp('http://127.0.0.1:'+mockPort+'/bob');
          rep.then(function (htmlString) {
            supplierCalled++;
            observer.next(htmlString);
          })
          rep.catch(function (err) {
            supplierCalled++;
            observer.error(err);
          });
        }
    )},1000);
  });

  afterEach(function() {
    wiremock.stopJSWireMock();
    testAutodiscoveryServer.shutdown();
    herdcache.shutdown();
    memcachedMock.prototype.get = memcachedMockOriginalGet;
    console.log("=============================");
  });

  describe("apply", function() {
    //
    // Testing if a slow rest request results in a internal cache hit on the herdcache
    // Observable cache.
    //
    it("Returns observable that results in a value from supplier, when cache is disabled",
      function(done) {
        this.timeout(5000);

        cacheEnabled = false;
        // Run in a set timeout to allow autodiscover to return disabled cache
        setTimeout(() => {
          var obs = herdcache.apply(key,slowHttpRequest1Second);
          var obs2 = herdcache.apply(key,slowHttpRequest1Second);

          assert.equal(obs,obs2,
                      "the second call to apply should return the currently executing suppler");

          var observableCalled=0;
          obs.subscribe(function(retrievedValue) {
            assert.equal(restBody,retrievedValue.value());
            observableCalled++;
          });

          obs2.subscribe(function(retrievedValue) {
            assert.equal(restBody,retrievedValue.value());
            observableCalled++;
          });

          // Checks that internal cache is cleared on completion
          setTimeout(() => {
              var obs3 = herdcache.apply(key,slowHttpRequest1Second);
              obs3.subscribe(function(retrievedValue) {
                assert.equal(restBody,retrievedValue.value());
                observableCalled++;
              });
          },2000);

          setTimeout(() => {
            assert.equal(observableCalled,3,"all 3 observables should have been called");
            assert.equal(supplierCalled,2,"Supplier function should have been called twice");
            done();
          },3500);
        },300);
    });

    //
    // Testing if a slow rest request results in a internal cache hit on the herdcache
    // Observable cache.  When cache is enabled.
    //
    it("Returns observable that results in a value from supplier, when cache is enabled",
      function(done) {
        this.timeout(5000);
        cacheEnabled = true;
        // Run in a set timeout to allow autodiscover to return disabled cache
        setTimeout(() => {
          var obs = herdcache.apply(key,slowHttpRequest1Second);
          var obs2 = herdcache.apply(key,slowHttpRequest1Second);

          assert.equal(obs,obs2,"the second call to apply should return the currently executing suppler");

          var observableCalled=0;
          obs.subscribe(function(retrievedValue) {
            assert.equal(restBody,retrievedValue.value());
            observableCalled++;
          });

          obs2.subscribe(function(retrievedValue) {
            assert.equal(restBody,retrievedValue.value());
            observableCalled++;
          });

          setTimeout(() => {
            assert.equal(2,observableCalled,"both observables should have been called");
            assert.equal(1,supplierCalled,"Supplier function should have been called once");
            done();
          },2000);
        },500);
    });
  });

  describe("Get", function() {
    it("Executes only when observed",function(done) {
      cacheEnabled = true;
      this.timeout(5000);
      var called = monkeyPatchGet(1000,memcachedMock);
      setTimeout(() => {
        var observableCalled = 0;
        obs = herdcache.get(key);
        // obs.subscribe(function(retrievedValue) {
        //   observableCalled++;
        // });

        setTimeout(()=> {
          assert.equal(0,called());
          done();
        },2000);
      },500);
    });

    it("Returns observable from get request that takes time to fulfil",
      function(done) {
        // add a delay to the test
        monkeyPatchGet(1000,memcachedMock);
        this.timeout(5000);

        var observableCalled = 0;
        //
        // need to wait for autodiscovery to have run first
        // to have created the memcached client with the memcachedMock
        //

        var cacheItem = null;
        var obs = null;
        setTimeout(() => {
          obs = herdcache.get(key);
          obs.subscribe(function(retrievedValue) {
            assert.equal("BOB",retrievedValue.value());
            observableCalled++;
            cacheItem = retrievedValue;
          });

          // Check for herdcache throttle returning same observable
          var obs2 = herdcache.get(key);
          var obs3 = herdcache.get('NOSUCHKEY');
          assert.equal(obs,obs2)
          assert.notEqual(obs,obs3)

          obs2.subscribe(function(retrievedValue) {
            assert.equal("BOB",retrievedValue.value());
            observableCalled++;
          });
        },500)

        // Ensure calculated observable value is returned,
        // and cache not recalled.
        setTimeout(() => {
          obs.subscribe(function(val) {
            assert.equal(val,cacheItem);
          });
        },1500);

        setTimeout(() => {
          assert.equal(2,observableCalled);
          done();
        },3000);

    });

    it("Returns observable that returns an empty Cache Item",
      function(done) {
        // add a delay to the test
        monkeyPatchGet(2000,memcachedMock);
        this.timeout(5000);

        var observableCalled = 0;
        //
        // need to wait for autodiscovery to have run first
        // to have created the memcached client with the memcachedMock
        //
        setTimeout(() => {
          var obs = herdcache.get("NO_SUCH_THING");
          obs.subscribe(function(retrievedValue) {
            assert.equal(null,retrievedValue.value());
            assert.equal(false,retrievedValue.isFromCache());
            done();
          });

        },500)
    });

    it("Returns observable that returns an empty Cache Item, when cache is not enabled",
      function(done) {
        cacheEnabled = false;
        // add a delay to the test
        monkeyPatchGet(1000,memcachedMock);
        this.timeout(5000);

        var observableCalled = 0;
        //
        // need to wait for autodiscovery to have run first
        // to have created the memcached client with the memcachedMock
        //

        var obs = null;
        var cacheItem = null;
        setTimeout(() => {
          obs = herdcache.get("NO_SUCH_THING");
          obs.subscribe(function(retrievedValue) {
            cacheItem = retrievedValue;
            assert.equal(null,retrievedValue.value());
            assert.equal(false,retrievedValue.isFromCache());
          });
        },500)

        setTimeout(() => {
           obs.subscribe(function(retrievedValue) {
            assert.equal(null,retrievedValue.value());
            assert.equal(false,retrievedValue.isFromCache());
            assert.equal(cacheItem, retrievedValue);
          });
        },1500);

        // setTimeout(() => {
        //   assert.equal(1,herdcache.metrics._getMetricCounter('get').printObj()['count']);
        //   done();
        // },2000);
    });

  });


});

function monkeyPatchGet(timeout,mock) {
  const originalGet = mock.prototype.get;
  var called = 0;
  const get = function(key,cb) {
    called++;
    setTimeout(() => {
      originalGet.call(this,key,cb);
    },timeout);
  }

  mock.prototype.get = get

  return function() {
    return called;
  }
}