(function () {
    'use strict';

    angular
        .module('exchangeRateViewerApp')
        .controller('detailsController', detailsController);

    const DATA_POINTS_FOR_CHART = 50;
    const LABELS_FOR_CHART = 7;


    detailsController.$inject = ['$scope', '$location', '$routeParams', '$timeout', 'currencyLoader', 'dateUtils', 'stateKeeper'];

    function detailsController($scope, $location, $routeParams, $timeout, currencyLoader, dateUtils, stateKeeper) {
        $scope.chart = {
            labels: [],
            series: [],
            courses: []
        };

        $scope.saveChart = saveChart;
        $scope.loadCurrency = loadCurrency;
        $scope.loading = false;

        $timeout(addGestureDetection);

        var currencyCode = $routeParams.currencyCode
        $scope.startDate = restoreStartDate();
        if (!$scope.startDate) {
            $scope.startDate = dateUtils.today();
            $scope.startDate.setMonth($scope.startDate.getMonth() - 1);
        }
        $scope.endDate = restoreEndDate() || dateUtils.today();
        var startDatePicker = $('#startDatePickerButton')
            .fdatepicker({
                initialDate: dateUtils.dateToString($scope.startDate),
                format: 'dd-mm-yyyy',
                onRender: function (date) {
                    if (date.getFullYear() < 2002) {
                        return 'disabled';
                    }
                    else {
                        return date.valueOf() >= (new Date()).valueOf() ? 'disabled' : '';
                    }
                }
            })
            .on('changeDate', e => {
                $scope.startDate = dateUtils.toUtc1(e.date);

                if ($scope.startDate.valueOf() >= $scope.endDate.valueOf()) {
                    $scope.endDate = new Date($scope.startDate.getTime());
                    $scope.endDate.setDate($scope.startDate.getDate() + 1);
                    endDatePicker.update($scope.endDate);
                    $('#endDatePickerButton')[0].click();
                }

                $timeout(angular.noop);
            })
            .data('datepicker');
        var endDatePicker = $('#endDatePickerButton')
             .fdatepicker({
                 initialDate: dateUtils.dateToString($scope.endDate),
                 format: 'dd-mm-yyyy',
                 onRender: function (date) {
                     if (date.getFullYear() < 2002) {
                         return 'disabled';
                     }
                     else {
                         return date.valueOf() > (new Date()).valueOf() ? 'disabled' : '';
                     }
                 }
             })
            .on('changeDate', e => {
                $scope.endDate = dateUtils.toUtc1(e.date);

                if ($scope.endDate.valueOf() <= $scope.startDate.valueOf()) {
                    $scope.startDate = new Date($scope.endDate.getTime());
                    $scope.startDate.setDate($scope.endDate.getDate() - 1);
                    startDatePicker.update($scope.startDate);
                    $('#startDatePickerButton')[0].click();
                }

                $timeout(angular.noop);
            })
            .data('datepicker');

        loadCurrency();

        stateKeeper.addSuspensionListener(onSuspend);


        function restoreStartDate() {
            return stateKeeper.getState()['details'] && new Date(stateKeeper.getState()['details'].startDate);
        }

        function restoreEndDate() {
            return stateKeeper.getState()['details'] && new Date(stateKeeper.getState()['details'].endDate);
        }

        function loadCurrency() {
            $('#loadingProgressBar').css('width', '0%');
            $scope.loading = true;
            $scope.noInternetConnection = false;
            $scope.error = false;

            currencyLoader.loadCurrencyForDateRange(currencyCode, $scope.startDate, $scope.endDate)
            .then(function (currency) {
                $scope.currencyName = currency.name;

                $scope.chart.labels = [];
                $scope.chart.courses[0] = [];
                $scope.chart.series = ['Kurs ' + currency.name];

                if (currency.courses.length === 0) {
                    return;
                }

                $scope.chart.courses[0].push(currency.courses[0].course);

                var step = Math.round(currency.courses.length / DATA_POINTS_FOR_CHART) || 1;
                var courses = [];
                for (var i = 1; i < currency.courses.length - 1; i += step) {
                    $scope.chart.courses[0].push(currency.courses[i].course);
                    courses.push(currency.courses[i]);
                }

                var labelStep = Math.round(courses.length / (LABELS_FOR_CHART - 1));
                var labesAsDatesCount = 0;
                $scope.chart.labels.push(dateUtils.dateToString(courses[0].date));
                for (var i = 1; i < courses.length - 1; i++) {
                    if (i % labelStep === 0 && labesAsDatesCount < LABELS_FOR_CHART - 2) {
                        $scope.chart.labels.push(dateUtils.dateToString(courses[i].date));
                        labesAsDatesCount += 1;
                    } else {
                        $scope.chart.labels.push('');
                    }
                }

                $scope.chart.labels.push(dateUtils.dateToString(courses[courses.length - 1].date));
                                $scope.chart.courses[0].push(currency.courses[currency.courses.length - 1].course);

                $timeout(angular.noop);
            }, err => {
                $scope.loading = false;

                if (err === 'NO_INTERNET_CONNECTION') {
                    $scope.noInternetConnection = true;
                    $timeout(x => $scope.$digest());
                } else {
                    $scope.error = true;
                    console.log('ERROR: ' + err);
                    $timeout(x => $scope.$digest());
                }

            }, progress => {
                $('#loadingProgressBar').css('width', Math.round(progress) + '%');
            }).done(x => {
                $scope.loading = false;
            });
        }

        function saveChart() {
            var stream, encoderId;

            createFilePicker().pickSaveFileAsync().then(function (file) {
                if (file) {
                    switch (file.fileType) {
                        case ".jpg":
                            encoderId = Windows.Graphics.Imaging.BitmapEncoder.jpegEncoderId;
                            break;
                        case ".bmp":
                            encoderId = Windows.Graphics.Imaging.BitmapEncoder.bmpEncoderId;
                            break;
                        case ".png":
                        default:
                            encoderId = Windows.Graphics.Imaging.BitmapEncoder.pngEncoderId;
                            break;
                    }

                    return file.openAsync(Windows.Storage.FileAccessMode.readWrite);
                }
            }).then(function (_stream) {
                if (_stream) {
                    stream = _stream;
                    // BitmapEncoder expects an empty output stream; the user may have selected a pre-existing file.
                    stream.size = 0;

                    return Windows.Graphics.Imaging.BitmapEncoder.createAsync(encoderId, stream);
                }
            }).then(function (encoder) {
                if (!encoder) {
                    return false;
                }

                var width = $('#chart').width();
                var height = $('#chart').height();
                var outputPixelData = $('#chart')[0].getContext('2d').getImageData(0, 0, width, height);

                encoder.setPixelData(
                    Windows.Graphics.Imaging.BitmapPixelFormat.rgba8,
                    Windows.Graphics.Imaging.BitmapAlphaMode.straight,
                    width,
                    height,
                    96, // Horizontal DPI
                    96, // Vertical DPI
                    outputPixelData.data
                    );

                return encoder.flushAsync();
            }).then(function (result) {
                if (result !== false) {
                    showFileSaveSuccessModal();
                }
            }, function (error) {
                showFileSaveErrorModal();
            }).done(function () {
                stream && stream.close();
            });
        }

        function createFilePicker() {
            var filePicker = new Windows.Storage.Pickers.FileSavePicker();
            filePicker.viewMode = Windows.Storage.Pickers.PickerViewMode.thumbnail;
            filePicker.suggestedStartLocation = Windows.Storage.Pickers.PickerLocationId.picturesLibrary;
            filePicker.fileTypeChoices.insert("PNG file", [".png"]);
            filePicker.fileTypeChoices.insert("JPEG file", [".jpg"]);
            filePicker.fileTypeChoices.insert("Bitmap", [".bmp"]);
            filePicker.suggestedFileName = 'wykres';

            return filePicker;
        }

        function showFileSaveSuccessModal() {
            $('#fileSaveSuccessModal').foundation('reveal', 'open');
            $('#fileSaveSuccessModal button.close').click(e => $('#fileSaveSuccessModal').foundation('reveal', 'close'))
        }

        function showFileSaveErrorModal() {
            $('#fileSaveErrorModal').foundation('reveal', 'open');
            $('#fileSaveErrorModal button.close').click(e => $('#fileSaveErrorModal').foundation('reveal', 'close'))
        }

        function onSuspend(state) {
            state['details'] = {
                currencyCode: currencyCode,
                startDate: $scope.startDate.getTime(),
                endDate: $scope.endDate.getTime()
            };
        }

        function addGestureDetection() {
            var move = {};

            document.addEventListener('mousedown', e => {
                move.x = e.clientX;
                move.y = e.clientY;
                move.time = new Date();
                move.valid = true;
            });

            document.addEventListener('mousemove', e => {
                if (Math.abs(move.y - e.clientY) > 20) {
                    move.valid = false;
                }
            });

            document.addEventListener('mouseup', e => {
                if (e.clientX - move.x >= 100 && move.valid && (new Date()).getTime() - move.time <= 2000 && $location.path().indexOf('details') > -1) {
                    window.location.href = '#';
                }
            });
        }
        
    
    }
})();