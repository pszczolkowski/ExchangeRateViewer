(function () {
    'use strict';

    angular
        .module('exchangeRateViewerApp')
        .factory('dateUtils', dateUtils);


    function dateUtils() {
        return {
            toUtc1: toUtc1,
            dateToString: dateToString,
            today: today
        };


        function toUtc1(date) {
            var result = new Date(date.getTime());
            result.setHours(result.getHours() + 9);

            return result;
        }

        function dateToString(date) {
            return (date.getDate() < 10 ? '0' : '') + date.getDate() + '-' + (date.getMonth() + 1 < 10 ? '0' : '') + (date.getMonth() + 1) + '-' + date.getFullYear()
        }

        function today() {
            var today = new Date();
            return new Date(today.getFullYear(), today.getMonth(), today.getDate());
        }
    }
})();