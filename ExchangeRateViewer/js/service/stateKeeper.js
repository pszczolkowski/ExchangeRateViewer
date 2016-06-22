(function () {
    'use strict';

    angular
        .module('exchangeRateViewerApp')
        .factory('stateKeeper', stateKeeper);


    stateKeeper.$inject = ['$location'];

    function stateKeeper($location) {
        var listeners = [];

        return {
            addSuspensionListener: addSuspensionListener,
            saveState: saveState,
            getState: getState
        };


        function addSuspensionListener(listener) {
            listeners.push(listener);
        }

        function saveState() {
            var state = WinJS.Application.sessionState;
            listeners.forEach(listener => listener(state));

            state['$path'] = $location.path();
        }

        function getState() {
            return WinJS.Application.sessionState;
        }
    }
})();