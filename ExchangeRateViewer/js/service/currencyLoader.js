(function () {
    'use strict';

    angular
        .module('exchangeRateViewerApp')
        .factory('currencyLoader', currencyLoader);


    function currencyLoader() {
        const FIRST_YEAR = 2002;
        const CACHE_FILE_NAME = 'currenciesdata';
        const CACHE_VALIDITY_TIME_IN_HOURS = 5;

        var currenciesCachedData = null;

        return {
            loadCurrenciesForDate: loadCurrenciesForDate,
            loadCurrencyForDateRange: loadCurrencyForDateRange
        };


        function loadCurrenciesForDate(date) {
            return new WinJS.Promise(function (resolve, reject, notify) {
                date = normalize(date);

                initialize().then(function () {
                    var index = findLastIndex(currenciesCachedData.fileNames, n => fetchDateFrom(n) <= date);
                    if (index > -1) {
                        date = fetchDateFrom(currenciesCachedData.fileNames[index]);
                    } else {
                        date = fetchDateFrom(currenciesCachedData.fileNames[currenciesCachedData.fileNames.length - 1]);
                        currenciesCachedData.fileNames
                    }

                    downloadMissingExchangeRates(date, date).then(function () {
                        var result = [];
                        for (var i = 0; i < currenciesCachedData.currencies.length; i++) {
                            var currency = currenciesCachedData.currencies[i];
                            var currencySnapshot = getCurrencyWithExchangeRatesOfDateRange(currency.code, date, date);
                            if (currencySnapshot.courses.length > 0) {
                                result.push(currencySnapshot);
                            }
                        }

                        resolve(result);
                    }, reject, notify);
                }, reject);
            });
        }

        function normalize(date) {
            return new Date(date.getFullYear(), date.getMonth(), date.getDate());
        }

        function loadCurrencyForDateRange(currencyCode, startDate, endDate) {
            return new WinJS.Promise(function (resolve, reject, notify) {
                startDate = normalize(startDate);
                endDate = normalize(endDate);

                initialize()
                .then(function () {
                    downloadMissingExchangeRates(startDate, endDate, notify)
                        .then(function () {
                            var currency = getCurrencyWithExchangeRatesOfDateRange(currencyCode, startDate, endDate);
                            resolve(currency);
                        }, reject);
                }, reject);
            });
        }

        function initialize() {
            return new WinJS.Promise(function (resolve, reject) {
                if (currenciesCachedData === null) {
                    loadCachedData().then(function (cachedCurrenciesCachedData) {
                        if (cachedCurrenciesCachedData === null) {
                            currenciesCachedData = createEmptyCurrenciesCachedData();
                            loadAllFileNames().then(fileNames => {
                                currenciesCachedData.fileNames = fileNames;
                                cacheOnDisk().then(resolve, reject);
                            }, err => {
                                currenciesCachedData = null;
                                reject(err);
                            });
                        } else {
                            currenciesCachedData = cachedCurrenciesCachedData;
                            updateFileNames().then(resolve, reject);
                        }
                    });
                } else {
                    resolve();
                }
            });
        }

        function loadCachedData() {
            return new WinJS.Promise(function (resolve, reject) {
                WinJS.Application.local.readText(CACHE_FILE_NAME, null)
                    .then(function (fileContent) {
                        if (fileContent === null) {
                            resolve(null);
                        } else {
                            var cachedData = JSON.parse(fileContent)
                            cachedData.lastUpdate = new Date(Date.parse(cachedData.lastUpdate));
                            cachedData.cachedDates = cachedData.cachedDates.map(d => new Date(Date.parse(d)));
                            cachedData.currencies.forEach(currency => {
                                currency.courses.forEach(c => c.date = new Date(Date.parse(c.date)));
                            });

                            resolve(cachedData);
                        }
                    }, reject);
            });
        }

        function createEmptyCurrenciesCachedData() {
            return {
                currencies: [],
                lastUpdate: new Date(),
                cachedDates: [],
                fileNames: []
            };
        }

        function loadAllFileNames() {
            return new WinJS.Promise(function (resolve, reject) {
                var currencyFileNames = [];

                loadFileNamesForYearRecursively(FIRST_YEAR);

                function loadFileNamesForYearRecursively(year) {
                    if (year > (new Date()).getFullYear()) {
                        resolve(currencyFileNames);
                        return;
                    }

                    var yearString = "";
                    if ((new Date()).getFullYear() != year) {
                        yearString = "" + year;
                    }

                    loadUrlContent("http://www.nbp.pl/kursy/xml/dir" + yearString + ".txt")
                        .then(content => {
                            var fileNames = content.split('\n');

                            for (var i = 0; i < fileNames.length; i++) {
                                if (isFileWithAverageExchangeRate(fileNames[i])) {
                                    currencyFileNames.push(fileNames[i]);
                                }
                            }

                            loadFileNamesForYearRecursively(year + 1);
                        }, reject);
                }
            });

        }

        function loadFileNamesForYear(year) {
            return new WinJS.Promise(function (resolve, reject) {
                var yearString = "";
                if ((new Date()).getFullYear() != year) {
                    yearString = "" + year;
                }

                var currencyFileNames = [];

                loadUrlContent("http://www.nbp.pl/kursy/xml/dir" + yearString + ".txt")
                .then(content => {
                    var fileNames = content.split('\n');

                    for (var i = 0; i < fileNames.length; i++) {
                        if (isFileWithAverageExchangeRate(fileNames[i])) {
                            currencyFileNames.push(fileNames[i]);
                        }
                    }

                    resolve(currencyFileNames);
                }, reject);
            });
        }

        function loadUrlContent(url) {
            return new WinJS.Promise(function (resolve, reject) {
                if (!checkInternetConnection()) {
                    reject('NO_INTERNET_CONNECTION');
                }

                var httpClient = new Windows.Web.Http.HttpClient();

                httpClient.getBufferAsync(new Windows.Foundation.Uri(url))
                    .then(function (buffer) {
                        var byteArray = Windows.Security.Cryptography.CryptographicBuffer.copyToByteArray(buffer),
                            blob = new Blob([byteArray], { type: 'text/plain' }),
                            reader = new FileReader();

                        httpClient.close();

                        reader.onload = e => resolve(e.target.result);
                        reader.onerror = reject;
                        reader.readAsText(blob, 'iso-8859-2');
                    }, reject);
            });
        }

        function checkInternetConnection() {
            var internetconection = new Windows.Networking.Connectivity.NetworkInformation.getInternetConnectionProfile();
            if ((!('getNetworkConnectivityLevel' in internetconection)) || ((internetconection.getNetworkConnectivityLevel()) < 3)) {
                return false;
            }
            else {
                return true;
            }
        }

        function isFileWithAverageExchangeRate(fileName) {
            return fileName[0] === 'a';
        }

        function updateFileNames() {
            return new WinJS.Promise(function (resolve, reject) {
                var lastUpdate = new Date(currenciesCachedData.lastUpdate.getTime() + CACHE_VALIDITY_TIME_IN_HOURS * 3600000);
                if ((new Date()) > currenciesCachedData.cachedDates[currenciesCachedData.cachedDates.length - 1] && (new Date()) > lastUpdate) {
                    loadFileNamesForYear((new Date()).getFullYear())
                        .then(function (downloadedFileNames) {
                            var lastCachedFileNameIndex = downloadedFileNames.indexOf(currenciesCachedData.fileNames[currenciesCachedData.fileNames.length - 1]);

                            for (var i = lastCachedFileNameIndex + 1; i < downloadedFileNames.length; i++) {
                                currenciesCachedData.fileNames.push(downloadedFileNames[i]);
                            }

                            currenciesCachedData.lastUpdate = new Date();
                            cacheOnDisk().then(resolve, reject);
                        }, reject);
                } else {
                    resolve();
                }
            });
        }

        function downloadMissingExchangeRates(startDate, endDate, notify) {
            return new WinJS.Promise(function (resolve, reject, notice) {
                var datesToDownload = fetchDatesToDownload(startDate, endDate);
                if (datesToDownload.length > 0) {
                    downloadCoursesForDates(datesToDownload)
                        .then(function (downloadedCurrencies) {
                            updateCurrenciesWithDownloadedCourses(downloadedCurrencies);
                            updateListOfCachedDates(datesToDownload);

                            cacheOnDisk().then(resolve, reject, notice);
                        }, reject, notify);
                } else {
                    resolve();
                }
            });
        }

        function fetchDatesToDownload(startDate, endDate) {
            var datesToDownload = [];

            var cachedDateIndex = findIndex(currenciesCachedData.cachedDates, d => d >= startDate);
            var fileNameIndex = findIndex(currenciesCachedData.fileNames, n => fetchDateFrom(n) >= startDate);
            if (fileNameIndex == -1) {
                var date = fetchDateFrom(currenciesCachedData.fileNames[currenciesCachedData.fileNames.length - 1]);

                if (currenciesCachedData.cachedDates.map(d => d.getTime()).indexOf(date.getTime()) === -1) {
                    datesToDownload.push(date);
                }
                return datesToDownload;
            }

            for (var date = new Date(startDate.getTime()) ; date <= endDate; date = nextDay(date)) {
                if (cachedDateIndex != -1 && currenciesCachedData.cachedDates.length > cachedDateIndex && currenciesCachedData.cachedDates[cachedDateIndex].getTime() === date.getTime()) {
                    cachedDateIndex += 1;
                    continue;
                }

                while (currenciesCachedData.fileNames.length > fileNameIndex && date > fetchDateFrom(currenciesCachedData.fileNames[fileNameIndex])) {
                    fileNameIndex += 1;
                }

                if (currenciesCachedData.fileNames.length > fileNameIndex && date.getTime() === fetchDateFrom(currenciesCachedData.fileNames[fileNameIndex]).getTime()) {
                    datesToDownload.push(date);
                    fileNameIndex += 1;
                }
            }

            console.log(datesToDownload);
            return datesToDownload;
        }

        function nextDay(date) {
            var result = new Date(date.getTime());
            result.setDate(result.getDate() + 1);
            return result;
        }

        function findIndex(array, matcher) {
            for (var i = 0; i < array.length; i++) {
                if (matcher(array[i])) {
                    return i;
                }
            }

            return -1;
        }

        function findLastIndex(array, matcher) {
            for (var i = array.length - 1; i >= 0; i--) {
                if (matcher(array[i])) {
                    return i;
                }
            }

            return -1;
        }

        function fetchDateFrom(fileName) {
            var dateString = '20' + fileName.substr(5);
            return new Date(parseInt(dateString.substr(0, 4)), parseInt(dateString.substr(4, 2) - 1), parseInt(dateString.substr(6, 2)));
        }

        function downloadCoursesForDates(datesToDownload) {
            var fileNamesToDownload = fetchFileNamesToDownload(datesToDownload);
            return downloadCurrenciesForFileNames(fileNamesToDownload);
        }

        function fetchFileNamesToDownload(datesToDownload) {
            var fileNamesToDownload = [];
            var fileNameIndex = findIndex(currenciesCachedData.fileNames, n => fetchDateFrom(n) >= datesToDownload[0]);

            if (fileNameIndex === -1) {
                fileNameIndex = currenciesCachedData.fileNames.length - 1;
            }

            for (var i = 0; i < datesToDownload.length; i++) {
                var dateToDownload = datesToDownload[i];

                while (currenciesCachedData.fileNames.length > fileNameIndex && dateToDownload < fetchDateFrom(currenciesCachedData.fileNames[fileNameIndex])) {
                    fileNameIndex += 1;
                }

                if (currenciesCachedData.fileNames.length > fileNameIndex && dateToDownload.getTime() === fetchDateFrom(currenciesCachedData.fileNames[fileNameIndex]).getTime()) {
                    fileNamesToDownload.push(currenciesCachedData.fileNames[fileNameIndex]);
                    fileNameIndex += 1;
                }
            }

            return fileNamesToDownload;
        }

        function downloadCurrenciesForFileNames(fileNamesToDownload) {
            return new WinJS.Promise(function (resolve, reject, notify) {
                var currencies = {};

                downloadCurrencyForIndex(0, onSuccess);

                function downloadCurrencyForIndex(index, onSuccess) {
                    if (index >= fileNamesToDownload.length) {
                        onSuccess();
                        return;
                    }
                    var fileName = fileNamesToDownload[index];

                    loadCurrencySnapshotsFromFile(fileName).then(function (currencySnapshots) {
                        for (var j = 0; j < currencySnapshots.length; j++) {
                            var currencySnapshot = currencySnapshots[j];

                            if (!currencies.hasOwnProperty(currencySnapshot.code)) {
                                currencies[currencySnapshot.code] = {
                                    code: currencySnapshot.code,
                                    name: null,
                                    courses: []
                                };
                            }

                            if (currencySnapshot.name != null) {
                                currencies[currencySnapshot.code].name = currencySnapshot.name;
                            }

                            if (currencySnapshot.country != null) {
                                currencies[currencySnapshot.code].country = currencySnapshot.country;
                            }

                            currencies[currencySnapshot.code].courses.push({
                                date: currencySnapshot.date,
                                course: currencySnapshot.course
                            });
                        }


                        notify(index / fileNamesToDownload.length * 100);

                        downloadCurrencyForIndex(index + 1, onSuccess);
                    }, reject);
                }

                function onSuccess() {
                    var result = [];

                    for (var j in currencies) {
                        currencies[j].courses.sort((a, b) => a.date.getTime() - b.date.getTime());
                        result.push(currencies[j]);
                    }

                    resolve(result);
                }
            });
        }

        function loadCurrencySnapshotsFromFile(fileName) {
            return new WinJS.Promise(function (resolve, reject) {
                loadUrlContent("http://www.nbp.pl/kursy/xml/" + fileName + ".xml")
                .then(xmlString => {
                    var date = fetchDateFrom(fileName);

                    var parser = new DOMParser();
                    var xmlDoc = parser.parseFromString(xmlString, 'text/xml');

                    var currencySnapshots = [];

                    var nodes = xmlDoc.getElementsByTagName('pozycja');
                    for (var i = 0; i < nodes.length; i++) {
                        var currencySnapshot = {
                            date: date
                        };
                        currencySnapshots.push(currencySnapshot);

                        for (var j = 0; j < nodes[i].childNodes.length; j++) {
                            switch (nodes[i].childNodes[j].tagName) {
                                case 'nazwa_waluty':
                                    currencySnapshot.name = nodes[i].childNodes[j].textContent;
                                    break;
                                case 'kod_waluty':
                                    currencySnapshot.code = nodes[i].childNodes[j].textContent;
                                    break;
                                case 'kurs_sredni':
                                    currencySnapshot.course = parseFloat(nodes[i].childNodes[j].textContent.replace(",", "."));
                                    break;
                                case 'nazwa_kraju':
                                    currencySnapshot.country = nodes[i].childNodes[j].textContent;
                                    break;
                            }
                        }
                    }

                    resolve(currencySnapshots);
                }, reject);
            });
        }

        function updateCurrenciesWithDownloadedCourses(downloadedCurrencies) {
            for (var i = 0; i < downloadedCurrencies.length; i++) {
                var downloadedCurrency = downloadedCurrencies[i];

                var cachedCurrency = currenciesCachedData.currencies.filter(c => c.code == downloadedCurrency.code)[0];
                if (cachedCurrency === undefined) {
                    currenciesCachedData.currencies.push(downloadedCurrency);
                } else {
                    if (downloadedCurrency.name != null) {
                        cachedCurrency.name = downloadedCurrency.name;
                    }
                    if (downloadedCurrency.country != null) {
                        cachedCurrency.country = downloadedCurrency.country;
                    }

                    var courseIndex = findIndex(cachedCurrency.courses, c => c.date > downloadedCurrency.courses[0].date);
                    if (courseIndex == -1) {
                        cachedCurrency.courses = cachedCurrency.courses.concat(downloadedCurrency.courses);
                    } else {
                        for (var j = 0; j < downloadedCurrency.courses.length; j++) {
                            var course = downloadedCurrency.courses[j];
                            while (cachedCurrency.courses.length > courseIndex && cachedCurrency.courses[courseIndex].date < course.date) {
                                courseIndex += 1;
                            }

                            if (cachedCurrency.courses.length <= courseIndex || cachedCurrency.courses[courseIndex].date > course.date) {
                                cachedCurrency.courses.splice(courseIndex, 0, course);
                            }
                        }
                    }
                }

            }
        }

        function updateListOfCachedDates(downloadedDates) {
            var dateIndex = findIndex(currenciesCachedData.cachedDates, d => d > downloadedDates[0]);
            if (dateIndex == -1) {
                currenciesCachedData.cachedDates = currenciesCachedData.cachedDates.concat(downloadedDates);
            } else {
                for (var i = 0; i < downloadedDates.length; i++) {
                    while (currenciesCachedData.cachedDates.length - 1 > dateIndex && currenciesCachedData.cachedDates[dateIndex] < downloadedDates[i]) {
                        dateIndex += 1;
                    }

                    currenciesCachedData.cachedDates.splice(dateIndex, 0, downloadedDates[i]);
                    dateIndex += 1;
                }
            }
        }

        function cacheOnDisk() {
            return WinJS.Application.local.writeText(CACHE_FILE_NAME, JSON.stringify(currenciesCachedData));
        }

        function getCurrencyWithExchangeRatesOfDateRange(currencyCode, startDate, endDate) {
            var currency = currenciesCachedData.currencies.filter(x => x.code === currencyCode)[0];
            var courseSnapshots = currency.courses.filter(c => c.date >= startDate && c.date <= endDate);
            
            return {
                name: currency.name,
                code: currency.code,
                country: currency.country,
                rate: currency.rate,
                courses: courseSnapshots
            };
        }
    }
})();
