(function () {
    'use strict';

    angular
        .module('exchangeRateViewerApp', [
            'chart.js',
            'ngRoute'
        ])

        .config(['$locationProvider', '$routeProvider', function config($locationProvider, $routeProvider) {
               $routeProvider
                  .when('/', {
                      templateUrl: 'main.html',
                      controller: 'mainController'
                  })
                  .when('/details/:currencyCode', {
                      templateUrl: 'details.html',
                      controller: 'detailsController'
                  })
                  .otherwise('/');
            }
        ])
        
        .run(['$rootScope', '$location', 'stateKeeper', function ($rootScope, $location, stateKeeper) {
            var app = WinJS.Application;
            var activation = Windows.ApplicationModel.Activation;

            app.onactivated = function (args) {
                if (args.detail.kind === activation.ActivationKind.launch) {
                    if (args.detail.previousExecutionState !== activation.ApplicationExecutionState.terminated) {
                        // TODO: This application has been newly launched. Initialize your application here.
                    } else {
                        // TODO: This application was suspended and then terminated.
                        // To create a smooth user experience, restore application state here so that it looks like the app never stopped running.
                        console.log('Restoring state');
                        var state = stateKeeper.getState();
                        
                        if (state['$path']) {
                            $location.path(state['$path']);
                        }
                    }
                    args.setPromise(WinJS.UI.processAll());
                }
            };

            app.oncheckpoint = function (args) {
                // TODO: This application is about to be suspended. Save any state that needs to persist across suspensions here.
                // You might use the WinJS.Application.sessionState object, which is automatically saved and restored across suspension.
                // If you need to complete an asynchronous operation before your application is suspended, call args.setPromise().
                stateKeeper.saveState();
            };

            app.start();
            WinJS.UI.processAll();

            $rootScope.$on('$routeChangeStart', function (next, current) {
                stateKeeper.saveState();
            });
        }]);
})();