(function () {
    'use strict';

    angular
        .module('exchangeRateViewerApp')
        .controller('mainController', mainController);


    mainController.$inject = ['$scope', '$location', '$timeout', 'currencyLoader', 'dateUtils', 'stateKeeper'];

    function mainController($scope, $location, $timeout, currencyLoader, dateUtils, stateKeeper) {
        $scope.currencies = [];
        $scope.showCurrencyDetails = showCurrencyDetails;
        $scope.loadCurrencies = loadCurrencies;
        $scope.close = close;
        $scope.selectToday = selectToday;

        $scope.date = restoreDate() || dateUtils.today();
        loadCurrencies();

        var datePicker = $('#datepickerButton')
            .fdatepicker({
                initialDate: dateUtils.dateToString($scope.date),
                format: 'dd-mm-yyyy',
                onRender: function (date) {
                    if (date.getFullYear() < 2002) {
                        return 'disabled';
                    } else {
                        return date.valueOf() > (new Date()).valueOf() ? 'disabled' : '';
                    }
	            }
            })
            .on('changeDate', e => {
                $scope.date = dateUtils.toUtc1(e.date);
                loadCurrencies();
            }).data('datepicker');;

        stateKeeper.addSuspensionListener(onSuspend);


        function loadCurrencies() {
            $scope.loading = true;
            $scope.noInternetConnection = false;
            $scope.error = false;

            currencyLoader
                .loadCurrenciesForDate($scope.date)
                .then(loadedCurrencies => {
                    $scope.currencies = loadedCurrencies;
                    $timeout(() => $scope.$digest());
                }, err => {
                    $scope.loading = false;

                    if (err === 'NO_INTERNET_CONNECTION') {
                        $scope.noInternetConnection = true;
                        $timeout(angular.noop);
                    } else {
                        $scope.error = true;
                        console.log('ERROR: ' + err);
                        $timeout(angular.noop);
                    }
                }).done(x => {
                    $scope.loading = false;
                });
        }

        function showCurrencyDetails(currency) {
            $location.path('/details/' + currency.code);
        }

        function onSuspend(state) {
            state['main'] = {
                date: $scope.date.getTime()
            };
        }

        function restoreDate() {
            return stateKeeper.getState()['main'] && new Date(stateKeeper.getState()['main'].date);
        }

        function close() {
            window.close();
        }

        function selectToday() {
            $scope.date = dateUtils.today();
            datePicker.update($scope.date);
            loadCurrencies();
        }
        
    }
})();