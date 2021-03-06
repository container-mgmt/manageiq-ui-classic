/* global miqAjaxButton miqBuildCalendar miqButtons miqJqueryRequest miqRESTAjaxButton miqSparkleOff miqSparkleOn
add_flash miqFlashLater miqFlashSaved */

ManageIQ.angular.app.service('miqService', ['$timeout', '$document', '$q', 'API', '$window', function($timeout, $document, $q, API, $window) {
  var miqService = this;

  this.storedPasswordPlaceholder = '●●●●●●●●';
  this.deploymentExists = 'EXISTS';

  this.showButtons = function() {
    miqButtons('show');
  };

  this.hideButtons = function() {
    miqButtons('hide');
  };

  this.buildCalendar = function(year, month, date) {
    ManageIQ.calendar.calDateFrom = new Date(year, month, date);
    miqBuildCalendar(true);
  };

  this.miqAjaxButton = function(url, serializeFields, options) {
    miqAjaxButton(url, serializeFields, options);
  };

  this.miqAsyncAjaxButton = function(url, serializeFields) {
    miqJqueryRequest(url, {beforeSend: true, data: serializeFields});
  };

  this.restAjaxButton = function(url, button, dataType, data) {
    miqRESTAjaxButton(url, button, dataType, data);
  };

  this.jqueryRequest = function(url, options) {
    return miqJqueryRequest(url, options);
  };

  this.sparkleOn = function() {
    miqSparkleOn();
  };

  this.sparkleOff = function() {
    miqSparkleOff();
  };

  this.miqFlash = function(type, msg, options) {
    miqService.miqFlashClear();
    add_flash(msg, type, options);
  };

  // FIXME: usually we just hide it, merge the logic
  this.miqFlashClear = function() {
    $('#flash_msg_div').text('');
  };

  this.miqFlashLater = function(msgObj) {
    miqFlashLater(msgObj);
  };

  this.miqFlashSaved = function() {
    miqFlashSaved();
  };

  this.saveable = function(form) {
    return form.$valid && form.$dirty;
  };

  this.dynamicAutoFocus = function(element) {
    $timeout(function() {
      var queryResult = $document[0].getElementById(element);
      if (queryResult) {
        queryResult.focus();
      }
    }, 200);
  };

  this.detectWithRest = function($event, url) {
    angular.element('#button_name').val('detect');
    miqSparkleOn();
    return $q.when(miqRESTAjaxButton(url, $event.target, 'json'));
  };

  this.validateWithAjax = function(url) {
    miqSparkleOn();
    miqAjaxButton(url, true);
  };

  this.validateWithREST = function($event, credType, url, formSubmit) {
    angular.element('#button_name').val('validate');
    angular.element('#cred_type').val(credType);
    if (formSubmit) {
      miqSparkleOn();
      return $q.when(miqRESTAjaxButton(url, $event.target, 'json'));
    }
    $event.preventDefault();
  };

  this.validateClicked = function($event, authType, formSubmit, angularForm, url) {
    miqService.validateWithREST($event, authType, url, formSubmit)
      .then(function success(data) {
        if (data.level === 'error') {
          angularForm.default_auth_status.$setViewValue(false);
        } else {
          angularForm.default_auth_status.$setViewValue(true);
        }
        miqService.miqFlash(data.level, data.message);
        miqService.sparkleOff();
      });
  };

  this.disabledClick = function($event) {
    $event.preventDefault();
  };

  this.serializeModel = function(model) {
    var serializedObj = angular.copy(model);

    for (var k in serializedObj) {
      if (serializedObj.hasOwnProperty(k) && ! serializedObj[k]) {
        delete serializedObj[k];
      }
    }

    return serializedObj;
  };

  this.serializeModelWithIgnoredFields = function(model, ignoredFields) {
    var serializedObj = angular.copy(model);

    for (var k in serializedObj) {
      if ((ignoredFields.indexOf(k) >= 0) || (serializedObj.hasOwnProperty(k) && ! serializedObj[k])) {
        delete serializedObj[k];
      }
    }

    return serializedObj;
  };

  this.handleFailure = function(e) {
    miqSparkleOff();

    var message = __("Unknown error");
    if (e.data && e.data.error && e.data.error.message) {
      message = e.data.error.message;
    } else if (e.error && e.error.message) {
      message = e.error.message;
    } else if (e.message) {
      message = e.message;
    }

    console.error(message);
    miqService.miqFlash('error', message);

    return $q.reject(e);
  };

  this.getProviderTenants = function(callback) {
    return function(id) {
      if (! id) {
        callback([]);
        return;
      }
      miqService.sparkleOn();

      API.get('/api/providers/' + id + '/cloud_tenants?expand=resources&attributes=id,name')
        .then(getCloudTenantsByEms)
        .catch(miqService.handleFailure);
    };

    function getCloudTenantsByEms(data) {
      callback(data);
      miqService.sparkleOff();
    }
  };

  this.redirectBack = function(message, flashType, redirectUrl) {
    miqFlashLater({message: message, level: flashType});

    $window.location.href = redirectUrl;
  };
}]);
